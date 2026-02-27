# Hybrid REST API + Plugin Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Figma REST API reads with PAT auth so the MCP "just works" after one-time setup. Plugin only needed for writes.

**Architecture:** Smart router in the MCP server classifies commands as read/write. Reads fall back to Figma REST API when plugin is disconnected. Writes require plugin. Token stored at `~/.figma-mcp-write/config.json`. Interactive `setup` CLI configures everything in one command.

**Tech Stack:** Node.js built-in `fetch` (18+), `readline`, no new deps.

---

## Task 1: Config Module

**Files:**
- Create: `src/server/config.ts`
- Test: `src/server/__tests__/config.test.ts`

**Step 1: Write the failing test**

```typescript
// src/server/__tests__/config.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { loadConfig, saveConfig, resolveToken, type Config } from "../config.js";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

const TEST_DIR = join(tmpdir(), "figma-mcp-test-" + Date.now());
const TEST_CONFIG_PATH = join(TEST_DIR, "config.json");

describe("Config", () => {
  beforeEach(() => {
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true });
  });

  describe("saveConfig / loadConfig", () => {
    it("should save and load config", () => {
      const config: Config = { token: "figd_test123", userName: "Test", createdAt: "2026-02-27" };
      saveConfig(config, TEST_CONFIG_PATH);
      const loaded = loadConfig(TEST_CONFIG_PATH);
      expect(loaded).toEqual(config);
    });

    it("should return null if config file does not exist", () => {
      const loaded = loadConfig(join(TEST_DIR, "nonexistent.json"));
      expect(loaded).toBeNull();
    });

    it("should return null if config file is invalid JSON", () => {
      writeFileSync(TEST_CONFIG_PATH, "not json");
      const loaded = loadConfig(TEST_CONFIG_PATH);
      expect(loaded).toBeNull();
    });
  });

  describe("resolveToken", () => {
    it("should prefer CLI arg over env and config", () => {
      const token = resolveToken({ cliToken: "cli_token", envToken: "env_token", configPath: TEST_CONFIG_PATH });
      expect(token).toBe("cli_token");
    });

    it("should use env if no CLI arg", () => {
      const token = resolveToken({ envToken: "env_token", configPath: TEST_CONFIG_PATH });
      expect(token).toBe("env_token");
    });

    it("should use config file if no CLI or env", () => {
      saveConfig({ token: "file_token", userName: "Test", createdAt: "2026-02-27" }, TEST_CONFIG_PATH);
      const token = resolveToken({ configPath: TEST_CONFIG_PATH });
      expect(token).toBe("file_token");
    });

    it("should return null if nothing available", () => {
      const token = resolveToken({ configPath: join(TEST_DIR, "no.json") });
      expect(token).toBeNull();
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/server/__tests__/config.test.ts`
Expected: FAIL — module not found

**Step 3: Write minimal implementation**

```typescript
// src/server/config.ts
import { readFileSync, writeFileSync, mkdirSync, chmodSync } from "fs";
import { dirname, join } from "path";
import { homedir } from "os";

export interface Config {
  token: string;
  userName: string;
  createdAt: string;
}

export const DEFAULT_CONFIG_DIR = join(homedir(), ".figma-mcp-write");
export const DEFAULT_CONFIG_PATH = join(DEFAULT_CONFIG_DIR, "config.json");

export function loadConfig(configPath: string = DEFAULT_CONFIG_PATH): Config | null {
  try {
    const raw = readFileSync(configPath, "utf-8");
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.token === "string") {
      return parsed as Config;
    }
    return null;
  } catch {
    return null;
  }
}

export function saveConfig(config: Config, configPath: string = DEFAULT_CONFIG_PATH): void {
  const dir = dirname(configPath);
  mkdirSync(dir, { recursive: true });
  writeFileSync(configPath, JSON.stringify(config, null, 2), { mode: 0o600 });
}

export interface TokenSources {
  cliToken?: string;
  envToken?: string;
  configPath?: string;
}

export function resolveToken(sources: TokenSources = {}): string | null {
  // Priority: CLI arg > env var > config file
  if (sources.cliToken) return sources.cliToken;
  if (sources.envToken) return sources.envToken;

  const config = loadConfig(sources.configPath ?? DEFAULT_CONFIG_PATH);
  return config?.token ?? null;
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/server/__tests__/config.test.ts`
Expected: PASS (6 tests)

**Step 5: Commit**

```bash
git add src/server/config.ts src/server/__tests__/config.test.ts
git commit -m "feat: add config module for token storage and resolution"
```

---

## Task 2: Figma REST API Client

**Files:**
- Create: `src/server/figma-api.ts`
- Test: `src/server/__tests__/figma-api.test.ts`

**Step 1: Write the failing test**

```typescript
// src/server/__tests__/figma-api.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { FigmaApiClient } from "../figma-api.js";

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("FigmaApiClient", () => {
  let client: FigmaApiClient;

  beforeEach(() => {
    client = new FigmaApiClient("figd_test_token");
    mockFetch.mockReset();
  });

  describe("verifyToken", () => {
    it("should return user info on valid token", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "123", handle: "hassan", email: "h@test.com" }),
      });
      const user = await client.verifyToken();
      expect(user).toEqual({ id: "123", handle: "hassan", email: "h@test.com" });
      expect(mockFetch).toHaveBeenCalledWith("https://api.figma.com/v1/me", {
        headers: { "X-Figma-Token": "figd_test_token" },
      });
    });

    it("should return null on invalid token", async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 403 });
      const user = await client.verifyToken();
      expect(user).toBeNull();
    });
  });

  describe("getFile", () => {
    it("should fetch and return file document", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          name: "Test File",
          document: { id: "0:0", type: "DOCUMENT", children: [
            { id: "0:1", name: "Page 1", type: "CANVAS", children: [
              { id: "1:2", name: "Frame", type: "FRAME", absoluteBoundingBox: { x: 0, y: 0, width: 300, height: 200 }, children: [] },
            ]},
          ]},
          styles: {},
          components: {},
        }),
      });
      const file = await client.getFile("abc123");
      expect(file).not.toBeNull();
      expect(file!.name).toBe("Test File");
      expect(file!.document.children).toHaveLength(1);
    });

    it("should return null on 404", async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });
      const file = await client.getFile("invalid");
      expect(file).toBeNull();
    });
  });

  describe("getNodes", () => {
    it("should fetch specific nodes by ID", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          nodes: {
            "1:2": { document: { id: "1:2", name: "Frame", type: "FRAME" } },
          },
        }),
      });
      const nodes = await client.getNodes("abc123", ["1:2"]);
      expect(nodes).toHaveProperty("1:2");
      expect(nodes!["1:2"].document.name).toBe("Frame");
    });
  });

  describe("getImage", () => {
    it("should return image URL for node", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          images: { "1:2": "https://figma-cdn.com/image.png" },
        }),
      });
      const url = await client.getImage("abc123", "1:2", { format: "png", scale: 2 });
      expect(url).toBe("https://figma-cdn.com/image.png");
    });
  });

  describe("extractFileKey", () => {
    it("should extract key from design URL", () => {
      expect(FigmaApiClient.extractFileKey("https://www.figma.com/design/abc123XYZ/My-File")).toBe("abc123XYZ");
    });

    it("should extract key from file URL", () => {
      expect(FigmaApiClient.extractFileKey("https://www.figma.com/file/abc123XYZ/My-File")).toBe("abc123XYZ");
    });

    it("should return raw key if not a URL", () => {
      expect(FigmaApiClient.extractFileKey("abc123XYZ")).toBe("abc123XYZ");
    });

    it("should return null for invalid URL", () => {
      expect(FigmaApiClient.extractFileKey("https://www.google.com")).toBeNull();
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/server/__tests__/figma-api.test.ts`
Expected: FAIL — module not found

**Step 3: Write minimal implementation**

```typescript
// src/server/figma-api.ts
const BASE_URL = "https://api.figma.com/v1";

export interface FigmaUser {
  id: string;
  handle: string;
  email: string;
}

export interface FigmaNode {
  id: string;
  name: string;
  type: string;
  children?: FigmaNode[];
  absoluteBoundingBox?: { x: number; y: number; width: number; height: number };
  [key: string]: unknown;
}

export interface FigmaFile {
  name: string;
  lastModified: string;
  document: FigmaNode;
  styles: Record<string, unknown>;
  components: Record<string, unknown>;
}

export interface FigmaNodesResponse {
  [nodeId: string]: {
    document: FigmaNode;
    components?: Record<string, unknown>;
    styles?: Record<string, unknown>;
  };
}

export class FigmaApiClient {
  constructor(private token: string) {}

  private async get(path: string): Promise<Response> {
    return fetch(`${BASE_URL}${path}`, {
      headers: { "X-Figma-Token": this.token },
    });
  }

  async verifyToken(): Promise<FigmaUser | null> {
    const res = await this.get("/me");
    if (!res.ok) return null;
    return (await res.json()) as FigmaUser;
  }

  async getFile(fileKey: string, depth?: number): Promise<FigmaFile | null> {
    const params = depth ? `?depth=${depth}` : "";
    const res = await this.get(`/files/${fileKey}${params}`);
    if (!res.ok) return null;
    return (await res.json()) as FigmaFile;
  }

  async getNodes(fileKey: string, nodeIds: string[]): Promise<FigmaNodesResponse | null> {
    const ids = nodeIds.map((id) => encodeURIComponent(id)).join(",");
    const res = await this.get(`/files/${fileKey}/nodes?ids=${ids}`);
    if (!res.ok) return null;
    const data = (await res.json()) as { nodes: FigmaNodesResponse };
    return data.nodes;
  }

  async getImage(
    fileKey: string,
    nodeId: string,
    options: { format?: string; scale?: number } = {}
  ): Promise<string | null> {
    const params = new URLSearchParams();
    params.set("ids", nodeId);
    if (options.format) params.set("format", options.format);
    if (options.scale) params.set("scale", String(options.scale));
    const res = await this.get(`/images/${fileKey}?${params.toString()}`);
    if (!res.ok) return null;
    const data = (await res.json()) as { images: Record<string, string> };
    return data.images[nodeId] ?? null;
  }

  async getStyles(fileKey: string): Promise<Record<string, unknown> | null> {
    const res = await this.get(`/files/${fileKey}/styles`);
    if (!res.ok) return null;
    return (await res.json()) as Record<string, unknown>;
  }

  async getComponents(fileKey: string): Promise<Record<string, unknown> | null> {
    const res = await this.get(`/files/${fileKey}/components`);
    if (!res.ok) return null;
    return (await res.json()) as Record<string, unknown>;
  }

  /**
   * Extract a Figma file key from a URL or return the raw key.
   * Supports: figma.com/design/KEY/..., figma.com/file/KEY/...
   */
  static extractFileKey(urlOrKey: string): string | null {
    // Try as URL first
    const match = urlOrKey.match(/figma\.com\/(?:design|file)\/([a-zA-Z0-9]+)/);
    if (match) return match[1];

    // If not a figma URL but looks like a bare key (alphanumeric)
    if (/^[a-zA-Z0-9]+$/.test(urlOrKey)) return urlOrKey;

    return null;
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/server/__tests__/figma-api.test.ts`
Expected: PASS (7 tests)

**Step 5: Commit**

```bash
git add src/server/figma-api.ts src/server/__tests__/figma-api.test.ts
git commit -m "feat: add Figma REST API client with token auth"
```

---

## Task 3: REST API Read Adapter

Maps REST API responses to the same shape as plugin CommandResponse, so tools return identical JSON regardless of source.

**Files:**
- Create: `src/server/rest-adapter.ts`
- Test: `src/server/__tests__/rest-adapter.test.ts`

**Step 1: Write the failing test**

```typescript
// src/server/__tests__/rest-adapter.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { RestReadAdapter } from "../rest-adapter.js";
import { FigmaApiClient } from "../figma-api.js";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("RestReadAdapter", () => {
  let adapter: RestReadAdapter;

  beforeEach(() => {
    const client = new FigmaApiClient("figd_test");
    adapter = new RestReadAdapter(client);
    mockFetch.mockReset();
  });

  describe("executeRead", () => {
    it("should handle get_page_nodes", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          name: "Test",
          document: { id: "0:0", type: "DOCUMENT", children: [
            { id: "0:1", name: "Page 1", type: "CANVAS", children: [
              { id: "1:2", name: "Frame", type: "FRAME", absoluteBoundingBox: { x: 0, y: 0, width: 100, height: 100 } },
              { id: "1:3", name: "Rect", type: "RECTANGLE", absoluteBoundingBox: { x: 10, y: 10, width: 50, height: 50 } },
            ]},
          ]},
        }),
      });
      adapter.setFileKey("abc123");
      const result = await adapter.executeRead("get_page_nodes", {});
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty("nodes");
      const nodes = (result.data as { nodes: unknown[] }).nodes;
      expect(nodes).toHaveLength(2);
    });

    it("should handle get_node", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          nodes: {
            "1:2": { document: { id: "1:2", name: "Frame", type: "FRAME" } },
          },
        }),
      });
      adapter.setFileKey("abc123");
      const result = await adapter.executeRead("get_node", { nodeId: "1:2" });
      expect(result.success).toBe(true);
      expect((result.data as { node: { name: string } }).node.name).toBe("Frame");
    });

    it("should handle search_nodes", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          name: "Test",
          document: { id: "0:0", type: "DOCUMENT", children: [
            { id: "0:1", name: "Page 1", type: "CANVAS", children: [
              { id: "1:2", name: "Login Frame", type: "FRAME" },
              { id: "1:3", name: "Button", type: "RECTANGLE" },
              { id: "1:4", name: "Login Text", type: "TEXT" },
            ]},
          ]},
        }),
      });
      adapter.setFileKey("abc123");
      const result = await adapter.executeRead("search_nodes", { query: "Login" });
      expect(result.success).toBe(true);
      const data = result.data as { nodes: unknown[]; count: number };
      expect(data.count).toBe(2);
    });

    it("should handle export_node", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          images: { "1:2": "https://cdn.figma.com/img.png" },
        }),
      });
      adapter.setFileKey("abc123");
      const result = await adapter.executeRead("export_node", { nodeId: "1:2", format: "png" });
      expect(result.success).toBe(true);
      expect((result.data as { url: string }).url).toBe("https://cdn.figma.com/img.png");
    });

    it("should return error if no file key set", async () => {
      const result = await adapter.executeRead("get_page_nodes", {});
      expect(result.success).toBe(false);
      expect(result.error).toContain("file");
    });

    it("should return error for unsupported command", async () => {
      adapter.setFileKey("abc123");
      const result = await adapter.executeRead("create_node", {});
      expect(result.success).toBe(false);
      expect(result.error).toContain("write");
    });
  });

  describe("canHandle", () => {
    it("should return true for read commands", () => {
      expect(RestReadAdapter.canHandle("get_node")).toBe(true);
      expect(RestReadAdapter.canHandle("get_page_nodes")).toBe(true);
      expect(RestReadAdapter.canHandle("search_nodes")).toBe(true);
      expect(RestReadAdapter.canHandle("export_node")).toBe(true);
    });

    it("should return false for write commands", () => {
      expect(RestReadAdapter.canHandle("create_node")).toBe(false);
      expect(RestReadAdapter.canHandle("set_fill")).toBe(false);
    });

    it("should return false for plugin-only commands", () => {
      expect(RestReadAdapter.canHandle("get_selection")).toBe(false);
      expect(RestReadAdapter.canHandle("scroll_to_node")).toBe(false);
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/server/__tests__/rest-adapter.test.ts`
Expected: FAIL — module not found

**Step 3: Write minimal implementation**

```typescript
// src/server/rest-adapter.ts
import { FigmaApiClient, FigmaNode } from "./figma-api.js";
import { CommandResponse, createSuccessResponse, createErrorResponse } from "../../shared/protocol.js";
import { randomUUID } from "crypto";

/** Commands that can be served by REST API when plugin is disconnected */
const REST_READ_COMMANDS = new Set([
  "get_node",
  "get_page_nodes",
  "search_nodes",
  "export_node",
  "get_node_css",
]);

/** Commands that require a live Figma session (plugin only, even for reads) */
const PLUGIN_ONLY_READS = new Set([
  "get_selection",
  "scroll_to_node",
]);

export class RestReadAdapter {
  private fileKey: string | null = null;
  private cachedFile: { key: string; document: FigmaNode; name: string } | null = null;

  constructor(private client: FigmaApiClient) {}

  setFileKey(key: string): void {
    this.fileKey = key;
    this.cachedFile = null; // Invalidate cache on file change
  }

  setFileUrl(url: string): boolean {
    const key = FigmaApiClient.extractFileKey(url);
    if (!key) return false;
    this.setFileKey(key);
    return true;
  }

  getFileKey(): string | null {
    return this.fileKey;
  }

  static canHandle(command: string): boolean {
    return REST_READ_COMMANDS.has(command);
  }

  static isPluginOnly(command: string): boolean {
    return PLUGIN_ONLY_READS.has(command);
  }

  async executeRead(command: string, params: Record<string, unknown>): Promise<CommandResponse> {
    const id = randomUUID();

    if (!REST_READ_COMMANDS.has(command)) {
      return createErrorResponse(id,
        `'${command}' is a write operation that requires the Figma plugin. ` +
        `Install it from the Figma Community, then run it in your Figma file.`
      );
    }

    if (!this.fileKey) {
      return createErrorResponse(id,
        "No file specified. Provide a Figma URL with fileUrl parameter, " +
        "e.g. fileUrl: 'https://www.figma.com/design/abc123/MyFile'"
      );
    }

    try {
      switch (command) {
        case "get_page_nodes": return await this.getPageNodes(id, params);
        case "get_node": return await this.getNode(id, params);
        case "search_nodes": return await this.searchNodes(id, params);
        case "export_node": return await this.exportNode(id, params);
        case "get_node_css": return await this.getNodeCss(id, params);
        default: return createErrorResponse(id, `Unhandled read command: ${command}`);
      }
    } catch (err) {
      return createErrorResponse(id,
        `REST API error: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  private async ensureFile(): Promise<{ document: FigmaNode; name: string }> {
    if (this.cachedFile && this.cachedFile.key === this.fileKey) {
      return this.cachedFile;
    }
    const file = await this.client.getFile(this.fileKey!);
    if (!file) throw new Error(`Could not fetch file '${this.fileKey}'. Check the file key and token permissions.`);
    this.cachedFile = { key: this.fileKey!, document: file.document, name: file.name };
    return this.cachedFile;
  }

  private async getPageNodes(id: string, params: Record<string, unknown>): Promise<CommandResponse> {
    const file = await this.ensureFile();
    const pages = file.document.children ?? [];
    // Use first page by default, or find by pageId
    const pageId = params.pageId as string | undefined;
    const page = pageId
      ? pages.find((p) => p.id === pageId)
      : pages[0];

    if (!page) return createErrorResponse(id, "No pages found in file");

    const nodes = (page.children ?? []).map((n) => simplifyNode(n));
    return createSuccessResponse(id, { nodes, pageName: page.name, pageId: page.id });
  }

  private async getNode(id: string, params: Record<string, unknown>): Promise<CommandResponse> {
    const nodeId = params.nodeId as string;
    if (!nodeId) return createErrorResponse(id, "nodeId is required");

    const nodes = await this.client.getNodes(this.fileKey!, [nodeId]);
    if (!nodes || !nodes[nodeId]) return createErrorResponse(id, `Node '${nodeId}' not found`);

    return createSuccessResponse(id, { node: simplifyNode(nodes[nodeId].document) });
  }

  private async searchNodes(id: string, params: Record<string, unknown>): Promise<CommandResponse> {
    const query = (params.query as string ?? "").toLowerCase();
    if (!query) return createErrorResponse(id, "query is required");

    const file = await this.ensureFile();
    const results: FigmaNode[] = [];
    traverseNodes(file.document, (node) => {
      if (node.name?.toLowerCase().includes(query)) {
        results.push(node);
      }
    });

    return createSuccessResponse(id, {
      nodes: results.map(simplifyNode),
      count: results.length,
      query,
    });
  }

  private async exportNode(id: string, params: Record<string, unknown>): Promise<CommandResponse> {
    const nodeId = params.nodeId as string;
    if (!nodeId) return createErrorResponse(id, "nodeId is required");

    const format = (params.format as string ?? "png").toLowerCase();
    const scale = params.scale as number ?? 2;
    const url = await this.client.getImage(this.fileKey!, nodeId, { format, scale });

    if (!url) return createErrorResponse(id, `Could not export node '${nodeId}'`);
    return createSuccessResponse(id, { nodeId, format, scale, url });
  }

  private async getNodeCss(id: string, params: Record<string, unknown>): Promise<CommandResponse> {
    const nodeId = params.nodeId as string;
    if (!nodeId) return createErrorResponse(id, "nodeId is required");

    const nodes = await this.client.getNodes(this.fileKey!, [nodeId]);
    if (!nodes || !nodes[nodeId]) return createErrorResponse(id, `Node '${nodeId}' not found`);

    const node = nodes[nodeId].document;
    const css = generateCssFromNode(node);
    return createSuccessResponse(id, { nodeId, css });
  }
}

// ============================================================
// Helpers
// ============================================================

function simplifyNode(node: FigmaNode): Record<string, unknown> {
  return {
    id: node.id,
    name: node.name,
    type: node.type,
    x: node.absoluteBoundingBox?.x,
    y: node.absoluteBoundingBox?.y,
    width: node.absoluteBoundingBox?.width,
    height: node.absoluteBoundingBox?.height,
    childCount: node.children?.length ?? 0,
  };
}

function traverseNodes(node: FigmaNode, visitor: (n: FigmaNode) => void): void {
  visitor(node);
  if (node.children) {
    for (const child of node.children) {
      traverseNodes(child, visitor);
    }
  }
}

function generateCssFromNode(node: FigmaNode): string {
  const lines: string[] = [];
  const box = node.absoluteBoundingBox;
  if (box) {
    lines.push(`width: ${box.width}px;`);
    lines.push(`height: ${box.height}px;`);
  }
  if (node.opacity !== undefined && node.opacity !== 1) {
    lines.push(`opacity: ${node.opacity};`);
  }
  if (node.cornerRadius !== undefined) {
    lines.push(`border-radius: ${node.cornerRadius}px;`);
  }
  return lines.join("\n");
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/server/__tests__/rest-adapter.test.ts`
Expected: PASS (8 tests)

**Step 5: Commit**

```bash
git add src/server/rest-adapter.ts src/server/__tests__/rest-adapter.test.ts
git commit -m "feat: add REST API read adapter with response mapping"
```

---

## Task 4: Smart Router — REST API Fallback

Modify the router to check plugin connection. If disconnected, delegate reads to REST API adapter.

**Files:**
- Modify: `src/server/router.ts`
- Test: `src/server/__tests__/router-fallback.test.ts`

**Step 1: Write the failing test**

```typescript
// src/server/__tests__/router-fallback.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Router } from "../router.js";
import { RestReadAdapter } from "../rest-adapter.js";
import { FigmaApiClient } from "../figma-api.js";
import { CommandQueue } from "../command-queue.js";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("Router REST API Fallback", () => {
  let router: Router;
  let queue: CommandQueue;
  let restAdapter: RestReadAdapter;

  beforeEach(() => {
    queue = new CommandQueue();
    const client = new FigmaApiClient("figd_test");
    restAdapter = new RestReadAdapter(client);
    restAdapter.setFileKey("abc123");
    // Create router with restAdapter, pluginConnected = false
    router = new Router(queue, { restAdapter, isPluginConnected: () => false });
    mockFetch.mockReset();
  });

  it("should route read commands to REST API when plugin disconnected", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        name: "Test",
        document: { id: "0:0", type: "DOCUMENT", children: [
          { id: "0:1", name: "Page 1", type: "CANVAS", children: [
            { id: "1:2", name: "Frame", type: "FRAME", absoluteBoundingBox: { x: 0, y: 0, width: 100, height: 100 } },
          ]},
        ]},
      }),
    });

    const result = await router.routeStructuredCommand("get_page_nodes", {});
    expect(result.success).toBe(true);
    expect(result.data).toHaveProperty("nodes");
  });

  it("should return helpful error for write commands when plugin disconnected", async () => {
    const result = await router.routeStructuredCommand("create_node", { nodeType: "RECTANGLE" });
    expect(result.success).toBe(false);
    expect(result.error).toContain("plugin");
  });

  it("should return plugin-only error for get_selection without plugin", async () => {
    const result = await router.routeStructuredCommand("get_selection", {});
    expect(result.success).toBe(false);
    expect(result.error).toContain("plugin");
  });

  it("should route through queue when plugin IS connected", async () => {
    const connectedRouter = new Router(queue, {
      restAdapter,
      isPluginConnected: () => true,
    });

    // Set up a handler that immediately resolves
    queue.onCommand((cmd) => {
      queue.resolveWithResponse({ id: cmd.id, success: true, data: { test: true } });
    });

    const result = await connectedRouter.routeStructuredCommand("get_page_nodes", {});
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ test: true });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/server/__tests__/router-fallback.test.ts`
Expected: FAIL — Router constructor doesn't accept options

**Step 3: Modify router.ts**

Add optional `RouterOptions` to the constructor:

```typescript
// In router.ts, add after imports:
import { RestReadAdapter } from "./rest-adapter.js";

export interface RouterOptions {
  restAdapter?: RestReadAdapter;
  isPluginConnected?: () => boolean;
}

// Modify Router class:
export class Router {
  private restAdapter: RestReadAdapter | null;
  private isPluginConnected: () => boolean;

  constructor(private queue: CommandQueue, options?: RouterOptions) {
    this.restAdapter = options?.restAdapter ?? null;
    this.isPluginConnected = options?.isPluginConnected ?? (() => false);
  }

  // Modify routeStructuredCommand:
  async routeStructuredCommand(
    command: string,
    params: Record<string, unknown>
  ): Promise<CommandResponse> {
    if (!this.isValidCommand(command)) {
      return createErrorResponse(
        randomUUID(),
        `Unknown command '${command}'. Available commands: ${Object.keys(COMMAND_CATEGORIES).join(", ")}`
      );
    }

    // If plugin is connected, always use it
    if (this.isPluginConnected()) {
      const timeout = this.getTimeout(command);
      return this.queue.enqueue(command, params, timeout);
    }

    // Plugin not connected — try REST API for reads
    if (this.restAdapter && RestReadAdapter.canHandle(command)) {
      return this.restAdapter.executeRead(command, params);
    }

    // Plugin-only read commands
    if (RestReadAdapter.isPluginOnly(command)) {
      return createErrorResponse(randomUUID(),
        `'${command}' requires the Figma plugin to be running (needs live session access). ` +
        `Open Figma and run the figma-mcp-write plugin.`
      );
    }

    // Write command without plugin
    return createErrorResponse(randomUUID(),
      `'${command}' is a write operation that requires the Figma plugin. ` +
      `Install it from the Figma Community and run it in your Figma file. ` +
      `Read operations are available via REST API.`
    );
  }

  // ... rest of methods stay the same
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/server/__tests__/router-fallback.test.ts`
Expected: PASS (4 tests)

**Step 5: Run all existing router tests to verify no regressions**

Run: `npx vitest run src/server/__tests__/router.test.ts`
Expected: PASS (existing tests still pass — Router constructor is backward-compatible with optional param)

**Step 6: Commit**

```bash
git add src/server/router.ts src/server/__tests__/router-fallback.test.ts
git commit -m "feat: add REST API fallback to router when plugin disconnected"
```

---

## Task 5: Wire Everything Together — index.ts + mcp.ts

Connect config, REST API client, and adapter to the server boot sequence.

**Files:**
- Modify: `src/server/index.ts`
- Modify: `src/server/mcp.ts`
- Modify: `src/server/tools/status.ts`

**Step 1: Modify index.ts**

```typescript
// src/server/index.ts
#!/usr/bin/env node

import { WebSocketManager } from "./websocket.js";
import { FigmaMcpServer } from "./mcp.js";
import { FigmaApiClient } from "./figma-api.js";
import { RestReadAdapter } from "./rest-adapter.js";
import { resolveToken } from "./config.js";
import { DEFAULT_PORT } from "../../shared/protocol.js";

async function main(): Promise<void> {
  // Handle setup subcommand
  if (process.argv[2] === "setup") {
    const { runSetup } = await import("./setup.js");
    await runSetup();
    return;
  }

  const port = parseInt(process.env.FIGMA_MCP_PORT ?? "", 10) || DEFAULT_PORT;

  // Resolve token: --token=xxx > FIGMA_API_TOKEN env > config file
  const cliToken = process.argv.find((a) => a.startsWith("--token="))?.split("=")[1];
  const token = resolveToken({ cliToken, envToken: process.env.FIGMA_API_TOKEN });

  // Create REST API client if token available
  let restAdapter: RestReadAdapter | undefined;
  if (token) {
    const apiClient = new FigmaApiClient(token);
    restAdapter = new RestReadAdapter(apiClient);
    console.error(`[figma-mcp-write] REST API enabled (reads work without plugin)`);
  } else {
    console.error(`[figma-mcp-write] No API token — reads require plugin. Run 'npx figma-mcp-write setup' to configure.`);
  }

  // Boot WebSocket server
  const wsManager = new WebSocketManager();
  await wsManager.start(port);
  console.error(`[figma-mcp-write] WebSocket server listening on ws://localhost:${port}`);

  // Boot MCP server (stdio)
  const mcpServer = new FigmaMcpServer(wsManager, undefined, restAdapter);
  await mcpServer.start();
  console.error(`[figma-mcp-write] MCP server started (stdio transport)`);

  // Log plugin connection events
  wsManager.onConnect(() => {
    const info = wsManager.fileInfo;
    console.error(`[figma-mcp-write] Plugin connected: "${info?.name}" (${info?.nodeCount} nodes)`);
  });

  wsManager.onDisconnect(() => {
    console.error(`[figma-mcp-write] Plugin disconnected — falling back to REST API for reads`);
  });

  // Graceful shutdown
  const shutdown = async () => {
    console.error(`[figma-mcp-write] Shutting down...`);
    await wsManager.close();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error) => {
  console.error(`[figma-mcp-write] Fatal error:`, error);
  process.exit(1);
});
```

**Step 2: Modify mcp.ts constructor to accept restAdapter**

Pass `restAdapter` and `isPluginConnected` to the Router:

```typescript
// In mcp.ts constructor, change:
constructor(wsManager: WebSocketManager, dsManager?: DesignSystemManager, restAdapter?: RestReadAdapter) {
    // ...
    this.router = new Router(this.queue, {
      restAdapter,
      isPluginConnected: () => wsManager.isConnected,
    });
    // ...
}
```

Add import for `RestReadAdapter` at top.

**Step 3: Modify status tool to show REST API mode**

Update `src/server/tools/status.ts` to accept and display REST API state:

```typescript
export function createStatusTool(
  wsManager: WebSocketManager,
  router: Router,
  restAdapter?: RestReadAdapter
): ToolDef {
  return {
    // ... same name/description/schema ...
    handler: async (params) => {
      const connected = wsManager.isConnected;
      const fileInfo = wsManager.fileInfo;
      const hasRestApi = !!restAdapter;
      const restFileKey = restAdapter?.getFileKey();

      // Handle fileUrl parameter — set the REST API target file
      const fileUrl = params.fileUrl as string | undefined;
      if (fileUrl && restAdapter) {
        const ok = restAdapter.setFileUrl(fileUrl);
        if (!ok) {
          return { error: `Invalid Figma URL: ${fileUrl}` };
        }
      }

      return {
        connected,
        mode: connected ? "plugin" : hasRestApi ? "rest-api" : "disconnected",
        file: connected
          ? { name: fileInfo?.name, id: fileInfo?.id, pages: fileInfo?.pages, nodeCount: fileInfo?.nodeCount }
          : restFileKey ? { key: restFileKey } : null,
        restApiEnabled: hasRestApi,
        availableCategories: [...],
        toolCount: 70,
        message: connected
          ? `Plugin connected to "${fileInfo?.name}" (full read/write access)`
          : hasRestApi
          ? `REST API mode — reads available${restFileKey ? ` for file ${restFileKey}` : ". Set a file URL to begin."}`
          : "No connection. Run 'npx figma-mcp-write setup' to configure.",
      };
    },
  };
}
```

**Step 4: Add fileUrl handling to category tools in mcp.ts**

In the category tool handler, extract `fileUrl` from params and set it on the adapter:

```typescript
handler: async (args: Record<string, unknown>) => {
  const { command, params } = args as { command: string; params: Record<string, unknown> };

  // If params contains fileUrl, set it on the REST adapter
  if (params.fileUrl && this.restAdapter) {
    this.restAdapter.setFileUrl(params.fileUrl as string);
    delete params.fileUrl; // Don't pass to plugin/command
  }

  return await this.router.routeCategoryCommand(cat.name, command, params);
},
```

**Step 5: Run full test suite**

Run: `npx vitest run`
Expected: All existing tests pass + new tests pass

**Step 6: Commit**

```bash
git add src/server/index.ts src/server/mcp.ts src/server/tools/status.ts
git commit -m "feat: wire REST API client into server boot and MCP tools"
```

---

## Task 6: Setup CLI

**Files:**
- Create: `src/server/setup.ts`
- Test: manual (interactive CLI)

**Step 1: Write setup.ts**

```typescript
// src/server/setup.ts
import { createInterface } from "readline/promises";
import { stdin, stdout } from "process";
import { execSync } from "child_process";
import { FigmaApiClient } from "./figma-api.js";
import { saveConfig } from "./config.js";
import { SERVER_VERSION } from "../../shared/protocol.js";

export async function runSetup(): Promise<void> {
  const rl = createInterface({ input: stdin, output: stdout });

  console.log();
  console.log(`  figma-mcp-write v${SERVER_VERSION}`);
  console.log();
  console.log("  Step 1: Figma API Token");
  console.log("  " + "─".repeat(40));
  console.log("  Go to: https://www.figma.com/settings");
  console.log("  → Security → Personal access tokens → Create new token");
  console.log("  → Enable 'file_content:read' scope");
  console.log();

  // Try to open browser
  try {
    const platform = process.platform;
    const cmd = platform === "darwin" ? "open" : platform === "win32" ? "start" : "xdg-open";
    execSync(`${cmd} "https://www.figma.com/settings"`, { stdio: "ignore" });
    console.log("  (Opened Figma settings in your browser)");
    console.log();
  } catch {
    // Browser open failed — user can navigate manually
  }

  const token = (await rl.question("  Paste your token: ")).trim();

  if (!token) {
    console.log("\n  No token provided. Aborting setup.");
    rl.close();
    process.exit(1);
  }

  // Verify token
  console.log("  Verifying...");
  const client = new FigmaApiClient(token);
  const user = await client.verifyToken();

  if (!user) {
    console.log("\n  ✗ Invalid token. Check that you copied the full token.");
    rl.close();
    process.exit(1);
  }

  console.log(`  ✓ Verified — logged in as "${user.handle}" (${user.email})`);

  // Save config
  saveConfig({ token, userName: user.handle, createdAt: new Date().toISOString() });
  console.log("  ✓ Token saved to ~/.figma-mcp-write/config.json");

  // Configure Claude Code
  console.log();
  console.log("  Step 2: Claude Code Integration");
  console.log("  " + "─".repeat(40));

  try {
    execSync("claude mcp add figma -- npx figma-mcp-write", { stdio: "ignore" });
    console.log('  ✓ Added "figma" MCP server to Claude Code');
  } catch {
    console.log('  ⚠ Could not auto-configure Claude Code.');
    console.log('  Run manually: claude mcp add figma -- npx figma-mcp-write');
  }

  // Plugin info
  console.log();
  console.log("  Step 3: Figma Plugin (for write access)");
  console.log("  " + "─".repeat(40));
  console.log("  Reads work immediately via REST API.");
  console.log("  For write access, install the Figma plugin:");
  console.log("  → https://www.figma.com/community/plugin/figma-mcp-write");
  console.log("  (Run it in your Figma file via Plugins menu)");
  console.log();
  console.log("  ✓ Setup complete! Open Claude Code and start designing.");
  console.log();

  rl.close();
}
```

**Step 2: Commit**

```bash
git add src/server/setup.ts
git commit -m "feat: add interactive setup CLI for one-time configuration"
```

---

## Task 7: Update README + package.json

**Files:**
- Modify: `README.md`
- Modify: `package.json`

**Step 1: Update package.json**

- Bump version to `0.3.0`
- Ensure bin points to `./dist/src/server/index.js`

**Step 2: Rewrite Quick Start in README**

Replace the current Quick Start with:

```markdown
## Quick Start

### Option A: One-command setup (recommended)

\```bash
npx figma-mcp-write setup
\```

This will:
1. Open your browser to create a Figma token
2. Verify and save the token
3. Configure Claude Code automatically

Reads work immediately. For write access, install the Figma plugin from the Community page.

### Option B: Manual setup

\```bash
# Set your Figma token
export FIGMA_API_TOKEN=figd_your_token_here

# Add to Claude Code
claude mcp add figma -- npx figma-mcp-write
\```
```

**Step 3: Add REST API mode section**

```markdown
## Connection Modes

| Mode | How | Reads | Writes |
|------|-----|-------|--------|
| **REST API** | Token only (no plugin) | ✓ via Figma API | ✗ |
| **Plugin** | Plugin running in Figma | ✓ real-time | ✓ full access |
| **Hybrid** | Token + Plugin | ✓ (plugin preferred) | ✓ full access |

The server automatically uses the best available mode.
```

**Step 4: Commit**

```bash
git add README.md package.json
git commit -m "docs: update README with one-command setup and connection modes"
```

---

## Task 8: Integration Test — Full Hybrid Flow

**Files:**
- Create: `test/integration/hybrid-flow.test.ts`

**Step 1: Write integration test**

Test that:
1. Server with token + no plugin → reads work via REST API (mocked fetch)
2. Server with token + plugin connected → reads route through plugin
3. Server with token + no plugin → writes return helpful error
4. Server with no token + no plugin → everything returns setup prompt
5. `fileUrl` parameter correctly sets the file key

**Step 2: Run all tests**

Run: `npx vitest run`
Expected: All tests pass (existing 566 + new ~25)

**Step 3: Commit**

```bash
git add test/integration/hybrid-flow.test.ts
git commit -m "test: add integration tests for hybrid REST API + plugin flow"
```

---

## Task 9: Build + E2E Verify

**Step 1: Build**

```bash
npm run build
```

**Step 2: E2E test — REST API mode (no plugin)**

Start server with token, send MCP requests, verify reads work:

```bash
FIGMA_API_TOKEN=figd_xxx node dist/src/server/index.js
# Send: figma_status → should show mode: "rest-api"
# Send: figma_reading get_page_nodes with fileUrl → should return nodes
```

**Step 3: E2E test — Hybrid mode (token + mock plugin)**

Reuse the e2e-full.mjs pattern from before, but now with token set.

**Step 4: Final commit**

```bash
git commit -m "chore: verify hybrid architecture E2E"
```

---

## Summary

| Task | What | New Tests |
|------|------|-----------|
| 1 | Config module (token storage) | 6 |
| 2 | REST API client | 7 |
| 3 | REST read adapter (response mapping) | 8 |
| 4 | Router fallback (smart routing) | 4 |
| 5 | Wire into index.ts + mcp.ts + status | 0 (covered by integration) |
| 6 | Setup CLI | 0 (interactive) |
| 7 | README + package.json | 0 |
| 8 | Integration tests | ~8 |
| 9 | Build + E2E verify | 0 |
| **Total** | | **~33 new tests** |
