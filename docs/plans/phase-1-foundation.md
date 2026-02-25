# Phase 1: Foundation + Router

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the complete server + plugin skeleton with smart router architecture. At the end, `figma_status` works end-to-end through the full stack.

**Architecture:** MCP server (stdio) + WebSocket server (ws://localhost:3846) + Smart Router + Figma Plugin skeleton

**Tech Stack:** TypeScript, @modelcontextprotocol/sdk, ws, uuid, esbuild, vitest

---

## Task 1: Shared Protocol Types

**Files:**
- Create: `shared/protocol.ts`

**Step 1: Create shared/protocol.ts**

```typescript
// shared/protocol.ts
import { randomUUID } from "crypto";

// ============================================================
// Commands (Client → Plugin)
// ============================================================

export interface Command {
  id: string;
  type: string;
  params: Record<string, unknown>;
  batch?: Command[];
  contextRequest?: boolean;
}

export interface CommandResponse {
  id: string;
  success: boolean;
  data?: unknown;
  error?: string;
  batchResults?: CommandResponse[];
  context?: DesignSystemContext;
}

// ============================================================
// Plugin Events (Plugin → Client, push-based)
// ============================================================

export type PluginEventType =
  | "selection_changed"
  | "page_changed"
  | "file_saved"
  | "design_system_updated";

export interface PluginEvent {
  event: PluginEventType;
  data: unknown;
}

// ============================================================
// Handshake
// ============================================================

export interface HandshakeMessage {
  type: "handshake";
  fileInfo: FileInfo;
}

export interface HandshakeAck {
  type: "handshake_ack";
  serverVersion: string;
}

export interface FileInfo {
  name: string;
  id: string;
  pages: PageInfo[];
  nodeCount: number;
}

export interface PageInfo {
  id: string;
  name: string;
}

// ============================================================
// Design System Context
// ============================================================

export interface DesignSystemContext {
  variables: {
    collections: VariableCollectionInfo[];
    colorTokens: VariableInfo[];
    spacingTokens: VariableInfo[];
    typographyTokens: VariableInfo[];
  };
  styles: {
    textStyles: StyleInfo[];
    colorStyles: StyleInfo[];
    effectStyles: StyleInfo[];
    gridStyles: StyleInfo[];
  };
  components: {
    local: ComponentInfo[];
    external: LibraryInfo[];
  };
  conventions: {
    namingPattern: "BEM" | "atomic" | "flat" | "unknown";
    spacingScale: number[];
    colorPalette: ColorGroupInfo[];
  };
}

export interface VariableCollectionInfo {
  id: string;
  name: string;
  modes: { id: string; name: string }[];
  variableCount: number;
}

export interface VariableInfo {
  id: string;
  name: string;
  type: string;
  value: unknown;
  collectionId: string;
}

export interface StyleInfo {
  id: string;
  name: string;
  type: string;
  description: string;
}

export interface ComponentInfo {
  id: string;
  name: string;
  description: string;
  variantProperties?: Record<string, string[]>;
}

export interface LibraryInfo {
  name: string;
  componentCount: number;
  enabled: boolean;
}

export interface ColorGroupInfo {
  name: string;
  colors: string[];
}

// ============================================================
// WebSocket Message Wrapper
// ============================================================

export type WebSocketMessage =
  | { type: "command"; payload: Command }
  | { type: "response"; payload: CommandResponse }
  | { type: "event"; payload: PluginEvent }
  | HandshakeMessage
  | HandshakeAck
  | { type: "scan_design_system" }
  | { type: "design_system_result"; payload: DesignSystemContext };

// ============================================================
// Constants
// ============================================================

export const DEFAULT_PORT = 3846;
export const DEFAULT_TIMEOUT = 30_000;
export const BULK_TIMEOUT = 120_000;
export const DESIGN_SYSTEM_SCAN_TIMEOUT = 60_000;
export const RECONNECT_INTERVAL = 2_000;
export const DISCONNECT_BUFFER = 5_000;
export const MAX_BATCH_SIZE = 100;
export const MAX_BULK_NODES = 1000;
export const SERVER_VERSION = "0.2.0";

// ============================================================
// Helpers
// ============================================================

export function createCommand(type: string, params: Record<string, unknown>): Command {
  return { id: randomUUID(), type, params };
}

export function createSuccessResponse(id: string, data?: unknown): CommandResponse {
  return { id, success: true, data };
}

export function createErrorResponse(id: string, error: string): CommandResponse {
  return { id, success: false, error };
}

// ============================================================
// Validation
// ============================================================

export const NODE_ID_PATTERN = /^\d+:\d+$/;

export function isValidNodeId(id: string): boolean {
  return NODE_ID_PATTERN.test(id);
}

export function isValidHexColor(color: string): boolean {
  return /^#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/.test(color);
}
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --project tsconfig.json`
Expected: No errors (shared/ is included in tsconfig.json)

**Step 3: Commit**

```bash
git add shared/protocol.ts
git commit -m "feat: add shared protocol types for command/response, events, and design system context"
```

---

## Task 2: Command Queue

**Files:**
- Create: `src/server/command-queue.ts`
- Create: `src/server/__tests__/command-queue.test.ts`

**Step 1: Write the failing test**

```typescript
// src/server/__tests__/command-queue.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { CommandQueue } from "../command-queue.js";

describe("CommandQueue", () => {
  let queue: CommandQueue;

  beforeEach(() => {
    queue = new CommandQueue();
  });

  afterEach(() => {
    queue.clear();
  });

  describe("enqueue", () => {
    it("creates a pending command and returns a promise", () => {
      const promise = queue.enqueue("test_cmd", { key: "value" });
      expect(promise).toBeInstanceOf(Promise);
      expect(queue.pendingCount).toBe(1);
    });

    it("assigns a UUID to the command", () => {
      const spy = vi.fn();
      queue.onCommand(spy);
      queue.enqueue("test_cmd", { key: "value" });
      expect(spy).toHaveBeenCalledOnce();
      const command = spy.mock.calls[0][0];
      expect(command.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
      );
      expect(command.type).toBe("test_cmd");
      expect(command.params).toEqual({ key: "value" });
    });
  });

  describe("resolve", () => {
    it("resolves the promise when response arrives", async () => {
      const spy = vi.fn();
      queue.onCommand(spy);
      const promise = queue.enqueue("test_cmd", {});
      const command = spy.mock.calls[0][0];

      queue.resolve(command.id, { nodeId: "1:2" });

      const result = await promise;
      expect(result).toEqual({
        id: command.id,
        success: true,
        data: { nodeId: "1:2" },
      });
      expect(queue.pendingCount).toBe(0);
    });
  });

  describe("reject", () => {
    it("resolves with error when rejection arrives", async () => {
      const spy = vi.fn();
      queue.onCommand(spy);
      const promise = queue.enqueue("test_cmd", {});
      const command = spy.mock.calls[0][0];

      queue.reject(command.id, "Node not found");

      const result = await promise;
      expect(result).toEqual({
        id: command.id,
        success: false,
        error: "Node not found",
      });
    });
  });

  describe("timeout", () => {
    it("rejects after default timeout", async () => {
      vi.useFakeTimers();
      const promise = queue.enqueue("test_cmd", {});
      vi.advanceTimersByTime(30_001);

      const result = await promise;
      expect(result.success).toBe(false);
      expect(result.error).toContain("timed out");
      vi.useRealTimers();
    });

    it("uses custom timeout when provided", async () => {
      vi.useFakeTimers();
      const promise = queue.enqueue("test_cmd", {}, 5_000);
      vi.advanceTimersByTime(5_001);

      const result = await promise;
      expect(result.success).toBe(false);
      expect(result.error).toContain("timed out");
      vi.useRealTimers();
    });
  });

  describe("clear", () => {
    it("rejects all pending commands", async () => {
      const p1 = queue.enqueue("cmd1", {});
      const p2 = queue.enqueue("cmd2", {});

      queue.clear();

      const r1 = await p1;
      const r2 = await p2;
      expect(r1.success).toBe(false);
      expect(r2.success).toBe(false);
      expect(queue.pendingCount).toBe(0);
    });
  });

  describe("batch", () => {
    it("enqueues a batch command with sub-commands", () => {
      const spy = vi.fn();
      queue.onCommand(spy);

      queue.enqueueBatch([
        { type: "create_node", params: { type: "FRAME" } },
        { type: "set_fill", params: { color: "#FF0000" } },
      ]);

      expect(spy).toHaveBeenCalledOnce();
      const command = spy.mock.calls[0][0];
      expect(command.type).toBe("batch");
      expect(command.batch).toHaveLength(2);
    });

    it("rejects batch exceeding MAX_BATCH_SIZE", async () => {
      const commands = Array.from({ length: 101 }, (_, i) => ({
        type: `cmd_${i}`,
        params: {},
      }));

      const result = await queue.enqueueBatch(commands);
      expect(result.success).toBe(false);
      expect(result.error).toContain("exceeds maximum");
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/server/__tests__/command-queue.test.ts`
Expected: FAIL — module not found

**Step 3: Write the implementation**

```typescript
// src/server/command-queue.ts
import { randomUUID } from "crypto";
import {
  Command,
  CommandResponse,
  createSuccessResponse,
  createErrorResponse,
  DEFAULT_TIMEOUT,
  BULK_TIMEOUT,
  MAX_BATCH_SIZE,
} from "../../shared/protocol.js";

interface PendingCommand {
  resolve: (response: CommandResponse) => void;
  timer: ReturnType<typeof setTimeout>;
}

type CommandListener = (command: Command) => void;

export class CommandQueue {
  private pending = new Map<string, PendingCommand>();
  private listener: CommandListener | null = null;

  get pendingCount(): number {
    return this.pending.size;
  }

  onCommand(listener: CommandListener): void {
    this.listener = listener;
  }

  enqueue(
    type: string,
    params: Record<string, unknown>,
    timeout: number = DEFAULT_TIMEOUT
  ): Promise<CommandResponse> {
    const command: Command = {
      id: randomUUID(),
      type,
      params,
    };

    return new Promise<CommandResponse>((resolvePromise) => {
      const timer = setTimeout(() => {
        this.pending.delete(command.id);
        resolvePromise(
          createErrorResponse(
            command.id,
            `Command '${type}' timed out after ${timeout}ms`
          )
        );
      }, timeout);

      this.pending.set(command.id, { resolve: resolvePromise, timer });

      if (this.listener) {
        this.listener(command);
      }
    });
  }

  enqueueBatch(
    commands: { type: string; params: Record<string, unknown> }[],
    timeout: number = BULK_TIMEOUT
  ): Promise<CommandResponse> {
    if (commands.length > MAX_BATCH_SIZE) {
      const id = randomUUID();
      return Promise.resolve(
        createErrorResponse(
          id,
          `Batch size ${commands.length} exceeds maximum of ${MAX_BATCH_SIZE}`
        )
      );
    }

    const batch: Command[] = commands.map((cmd) => ({
      id: randomUUID(),
      type: cmd.type,
      params: cmd.params,
    }));

    const batchCommand: Command = {
      id: randomUUID(),
      type: "batch",
      params: {},
      batch,
    };

    return new Promise<CommandResponse>((resolvePromise) => {
      const timer = setTimeout(() => {
        this.pending.delete(batchCommand.id);
        resolvePromise(
          createErrorResponse(
            batchCommand.id,
            `Batch command timed out after ${timeout}ms`
          )
        );
      }, timeout);

      this.pending.set(batchCommand.id, { resolve: resolvePromise, timer });

      if (this.listener) {
        this.listener(batchCommand);
      }
    });
  }

  resolve(id: string, data?: unknown): void {
    const pending = this.pending.get(id);
    if (!pending) return;

    clearTimeout(pending.timer);
    this.pending.delete(id);
    pending.resolve(createSuccessResponse(id, data));
  }

  reject(id: string, error: string): void {
    const pending = this.pending.get(id);
    if (!pending) return;

    clearTimeout(pending.timer);
    this.pending.delete(id);
    pending.resolve(createErrorResponse(id, error));
  }

  resolveWithResponse(response: CommandResponse): void {
    const pending = this.pending.get(response.id);
    if (!pending) return;

    clearTimeout(pending.timer);
    this.pending.delete(response.id);
    pending.resolve(response);
  }

  clear(): void {
    for (const [id, pending] of this.pending) {
      clearTimeout(pending.timer);
      pending.resolve(
        createErrorResponse(id, "Command queue cleared — connection lost")
      );
    }
    this.pending.clear();
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/server/__tests__/command-queue.test.ts`
Expected: All 7 tests PASS

**Step 5: Commit**

```bash
git add src/server/command-queue.ts src/server/__tests__/command-queue.test.ts
git commit -m "feat: add command queue with UUID pairing, timeouts, and batch support"
```

---

## Task 3: WebSocket Server

**Files:**
- Create: `src/server/websocket.ts`
- Create: `src/server/__tests__/websocket.test.ts`

**Step 1: Write the failing test**

```typescript
// src/server/__tests__/websocket.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { WebSocketManager } from "../websocket.js";
import WebSocket, { WebSocketServer } from "ws";
import {
  Command,
  CommandResponse,
  HandshakeMessage,
  DEFAULT_PORT,
} from "../../../shared/protocol.js";

describe("WebSocketManager", () => {
  let manager: WebSocketManager;

  beforeEach(() => {
    manager = new WebSocketManager();
  });

  afterEach(async () => {
    await manager.close();
  });

  describe("start", () => {
    it("starts a WebSocket server on the specified port", async () => {
      await manager.start(0); // port 0 = random available port
      expect(manager.port).toBeGreaterThan(0);
      expect(manager.isRunning).toBe(true);
    });
  });

  describe("connection", () => {
    it("accepts a plugin connection and completes handshake", async () => {
      await manager.start(0);
      const port = manager.port;

      const client = new WebSocket(`ws://localhost:${port}`);
      await new Promise<void>((resolve) => client.on("open", resolve));

      // Send handshake
      const handshake: HandshakeMessage = {
        type: "handshake",
        fileInfo: {
          name: "Test File",
          id: "file123",
          pages: [{ id: "page1", name: "Page 1" }],
          nodeCount: 42,
        },
      };
      client.send(JSON.stringify(handshake));

      // Wait for ack
      const ack = await new Promise<string>((resolve) => {
        client.on("message", (data) => resolve(data.toString()));
      });
      const parsed = JSON.parse(ack);
      expect(parsed.type).toBe("handshake_ack");
      expect(parsed.serverVersion).toBeDefined();

      // Connection state
      expect(manager.isConnected).toBe(true);
      expect(manager.fileInfo?.name).toBe("Test File");

      client.close();
    });

    it("emits disconnect when plugin disconnects", async () => {
      await manager.start(0);
      const port = manager.port;

      const onDisconnect = vi.fn();
      manager.onDisconnect(onDisconnect);

      const client = new WebSocket(`ws://localhost:${port}`);
      await new Promise<void>((resolve) => client.on("open", resolve));

      // Handshake
      client.send(
        JSON.stringify({
          type: "handshake",
          fileInfo: { name: "Test", id: "f1", pages: [], nodeCount: 0 },
        })
      );
      await new Promise<void>((resolve) => {
        client.on("message", () => resolve());
      });

      client.close();

      // Wait for disconnect
      await new Promise<void>((resolve) => setTimeout(resolve, 100));
      expect(onDisconnect).toHaveBeenCalledOnce();
      expect(manager.isConnected).toBe(false);
    });
  });

  describe("sendCommand", () => {
    it("sends a command to the plugin", async () => {
      await manager.start(0);
      const port = manager.port;

      const client = new WebSocket(`ws://localhost:${port}`);
      await new Promise<void>((resolve) => client.on("open", resolve));

      // Handshake
      client.send(
        JSON.stringify({
          type: "handshake",
          fileInfo: { name: "Test", id: "f1", pages: [], nodeCount: 0 },
        })
      );
      await new Promise<void>((resolve) => {
        client.on("message", () => resolve());
      });

      // Send command
      const command: Command = {
        id: "cmd-123",
        type: "get_selection",
        params: {},
      };

      const received = new Promise<Command>((resolve) => {
        client.on("message", (data) => {
          const msg = JSON.parse(data.toString());
          if (msg.type === "command") {
            resolve(msg.payload);
          }
        });
      });

      manager.sendCommand(command);
      const result = await received;
      expect(result.id).toBe("cmd-123");
      expect(result.type).toBe("get_selection");
    });

    it("throws when no plugin is connected", () => {
      const command: Command = {
        id: "cmd-1",
        type: "test",
        params: {},
      };
      expect(() => manager.sendCommand(command)).toThrow("No plugin connected");
    });
  });

  describe("handleResponse", () => {
    it("emits response events", async () => {
      await manager.start(0);
      const port = manager.port;

      const onResponse = vi.fn();
      manager.onResponse(onResponse);

      const client = new WebSocket(`ws://localhost:${port}`);
      await new Promise<void>((resolve) => client.on("open", resolve));

      // Handshake
      client.send(
        JSON.stringify({
          type: "handshake",
          fileInfo: { name: "Test", id: "f1", pages: [], nodeCount: 0 },
        })
      );
      await new Promise<void>((resolve) => {
        client.on("message", () => resolve());
      });

      // Send response from plugin
      const response: CommandResponse = {
        id: "cmd-456",
        success: true,
        data: { nodeId: "1:2" },
      };
      client.send(JSON.stringify({ type: "response", payload: response }));

      await new Promise<void>((resolve) => setTimeout(resolve, 50));
      expect(onResponse).toHaveBeenCalledWith(response);
    });
  });

  describe("handleEvent", () => {
    it("emits plugin events", async () => {
      await manager.start(0);
      const port = manager.port;

      const onEvent = vi.fn();
      manager.onPluginEvent(onEvent);

      const client = new WebSocket(`ws://localhost:${port}`);
      await new Promise<void>((resolve) => client.on("open", resolve));

      // Handshake
      client.send(
        JSON.stringify({
          type: "handshake",
          fileInfo: { name: "Test", id: "f1", pages: [], nodeCount: 0 },
        })
      );
      await new Promise<void>((resolve) => {
        client.on("message", () => resolve());
      });

      // Send event from plugin
      client.send(
        JSON.stringify({
          type: "event",
          payload: {
            event: "selection_changed",
            data: { nodeIds: ["1:2", "3:4"] },
          },
        })
      );

      await new Promise<void>((resolve) => setTimeout(resolve, 50));
      expect(onEvent).toHaveBeenCalledWith({
        event: "selection_changed",
        data: { nodeIds: ["1:2", "3:4"] },
      });
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/server/__tests__/websocket.test.ts`
Expected: FAIL — module not found

**Step 3: Write the implementation**

```typescript
// src/server/websocket.ts
import { WebSocketServer, WebSocket as WS } from "ws";
import {
  Command,
  CommandResponse,
  PluginEvent,
  FileInfo,
  HandshakeMessage,
  WebSocketMessage,
  SERVER_VERSION,
  DEFAULT_PORT,
} from "../../shared/protocol.js";

type ResponseListener = (response: CommandResponse) => void;
type EventListener = (event: PluginEvent) => void;
type ConnectionListener = () => void;

export class WebSocketManager {
  private wss: WebSocketServer | null = null;
  private pluginSocket: WS | null = null;
  private _port = 0;
  private _fileInfo: FileInfo | null = null;

  private responseListeners: ResponseListener[] = [];
  private eventListeners: EventListener[] = [];
  private connectListeners: ConnectionListener[] = [];
  private disconnectListeners: ConnectionListener[] = [];

  get port(): number {
    return this._port;
  }

  get isRunning(): boolean {
    return this.wss !== null;
  }

  get isConnected(): boolean {
    return (
      this.pluginSocket !== null &&
      this.pluginSocket.readyState === WS.OPEN
    );
  }

  get fileInfo(): FileInfo | null {
    return this._fileInfo;
  }

  async start(port: number = DEFAULT_PORT): Promise<void> {
    return new Promise((resolve, reject) => {
      this.wss = new WebSocketServer({ port }, () => {
        const addr = this.wss!.address();
        this._port = typeof addr === "object" ? addr.port : port;
        resolve();
      });

      this.wss.on("error", reject);

      this.wss.on("connection", (ws) => {
        this.handleConnection(ws);
      });
    });
  }

  private handleConnection(ws: WS): void {
    // Only allow one plugin connection at a time
    if (this.pluginSocket && this.pluginSocket.readyState === WS.OPEN) {
      this.pluginSocket.close(1000, "New connection replacing old one");
    }

    ws.on("message", (data) => {
      try {
        const message = JSON.parse(data.toString()) as WebSocketMessage;
        this.handleMessage(ws, message);
      } catch {
        // Ignore malformed messages
      }
    });

    ws.on("close", () => {
      if (ws === this.pluginSocket) {
        this.pluginSocket = null;
        this._fileInfo = null;
        for (const listener of this.disconnectListeners) {
          listener();
        }
      }
    });

    ws.on("error", () => {
      // Error handled by close event
    });
  }

  private handleMessage(ws: WS, message: WebSocketMessage): void {
    switch (message.type) {
      case "handshake":
        this.handleHandshake(ws, message as HandshakeMessage);
        break;
      case "response":
        for (const listener of this.responseListeners) {
          listener(message.payload);
        }
        break;
      case "event":
        for (const listener of this.eventListeners) {
          listener(message.payload);
        }
        break;
      case "design_system_result":
        // Forward as a response-like event
        for (const listener of this.responseListeners) {
          listener({
            id: "design_system_scan",
            success: true,
            data: message.payload,
          });
        }
        break;
    }
  }

  private handleHandshake(ws: WS, message: HandshakeMessage): void {
    this.pluginSocket = ws;
    this._fileInfo = message.fileInfo;

    ws.send(
      JSON.stringify({
        type: "handshake_ack",
        serverVersion: SERVER_VERSION,
      })
    );

    for (const listener of this.connectListeners) {
      listener();
    }
  }

  sendCommand(command: Command): void {
    if (!this.isConnected) {
      throw new Error("No plugin connected");
    }

    this.pluginSocket!.send(
      JSON.stringify({ type: "command", payload: command })
    );
  }

  requestDesignSystemScan(): void {
    if (!this.isConnected) {
      throw new Error("No plugin connected");
    }

    this.pluginSocket!.send(
      JSON.stringify({ type: "scan_design_system" })
    );
  }

  onResponse(listener: ResponseListener): void {
    this.responseListeners.push(listener);
  }

  onPluginEvent(listener: EventListener): void {
    this.eventListeners.push(listener);
  }

  onConnect(listener: ConnectionListener): void {
    this.connectListeners.push(listener);
  }

  onDisconnect(listener: ConnectionListener): void {
    this.disconnectListeners.push(listener);
  }

  async close(): Promise<void> {
    if (this.pluginSocket) {
      this.pluginSocket.close();
      this.pluginSocket = null;
    }
    if (this.wss) {
      return new Promise((resolve) => {
        this.wss!.close(() => {
          this.wss = null;
          resolve();
        });
      });
    }
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/server/__tests__/websocket.test.ts`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/server/websocket.ts src/server/__tests__/websocket.test.ts
git commit -m "feat: add WebSocket server with handshake, command routing, and event handling"
```

---

## Task 4: Vitest Configuration

**Files:**
- Create: `vitest.config.ts`

**Step 1: Create vitest.config.ts**

```typescript
// vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: false,
    environment: "node",
    include: [
      "src/**/__tests__/**/*.test.ts",
      "plugin/**/__tests__/**/*.test.ts",
      "test/**/*.test.ts",
    ],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts", "plugin/**/*.ts", "shared/**/*.ts"],
      exclude: ["**/__tests__/**", "**/*.d.ts"],
    },
    testTimeout: 10_000,
  },
});
```

**Step 2: Verify tests run**

Run: `npx vitest run`
Expected: All existing tests pass

**Step 3: Commit**

```bash
git add vitest.config.ts
git commit -m "chore: add vitest configuration"
```

---

## Task 5: Smart Router

**Files:**
- Create: `src/server/router.ts`
- Create: `src/server/__tests__/router.test.ts`

**Step 1: Write the failing test**

```typescript
// src/server/__tests__/router.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Router } from "../router.js";
import { CommandQueue } from "../command-queue.js";
import { CommandResponse } from "../../../shared/protocol.js";

describe("Router", () => {
  let router: Router;
  let queue: CommandQueue;

  beforeEach(() => {
    queue = new CommandQueue();
    router = new Router(queue);
  });

  describe("routeStructuredCommand", () => {
    it("routes a single command to the queue", async () => {
      const spy = vi.fn();
      queue.onCommand(spy);

      // Immediately resolve the command
      const promise = router.routeStructuredCommand("create_node", {
        type: "FRAME",
        name: "Test",
      });

      const command = spy.mock.calls[0][0];
      queue.resolve(command.id, { nodeId: "1:2" });

      const result = await promise;
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ nodeId: "1:2" });
    });

    it("determines the correct category for a command", () => {
      expect(router.getCategory("create_node")).toBe("layers");
      expect(router.getCategory("set_text_content")).toBe("text");
      expect(router.getCategory("set_fill")).toBe("styling");
      expect(router.getCategory("set_auto_layout")).toBe("layout");
      expect(router.getCategory("create_component")).toBe("components");
      expect(router.getCategory("create_page")).toBe("pages");
      expect(router.getCategory("boolean_operation")).toBe("vectors");
      expect(router.getCategory("export_node")).toBe("export");
      expect(router.getCategory("create_variable")).toBe("variables");
      expect(router.getCategory("get_node")).toBe("reading");
      expect(router.getCategory("design_lint")).toBe("superpowers");
    });

    it("returns error for unknown command", async () => {
      const result = await router.routeStructuredCommand("nonexistent_tool", {});
      expect(result.success).toBe(false);
      expect(result.error).toContain("Unknown command");
    });
  });

  describe("routeBatch", () => {
    it("routes a batch of commands with variable substitution", async () => {
      const commands = [
        { command: "create_node", params: { type: "FRAME", name: "Parent" } },
        { command: "create_text", params: { text: "Hello", parentId: "$0" } },
      ];

      const spy = vi.fn();
      queue.onCommand(spy);

      const promise = router.routeBatch(commands);

      // Resolve first command
      const batchCmd = spy.mock.calls[0][0];
      queue.resolve(batchCmd.id, {
        batchResults: [
          { id: "sub1", success: true, data: { nodeId: "10:1" } },
          { id: "sub2", success: true, data: { nodeId: "10:2" } },
        ],
      });

      const result = await promise;
      expect(result.success).toBe(true);
      expect(result.operations).toHaveLength(2);
      expect(result.nodeIds).toContain("10:1");
      expect(result.nodeIds).toContain("10:2");
    });

    it("substitutes $0 references in batch params", () => {
      const resolved = router.substituteVariables(
        { text: "Hello", parentId: "$0" },
        [{ nodeId: "10:1", name: "Frame" }]
      );
      expect(resolved.parentId).toBe("10:1");
    });

    it("substitutes $N.property references", () => {
      const resolved = router.substituteVariables(
        { width: "$0.width", name: "$1.name" },
        [
          { nodeId: "10:1", width: 200, name: "Frame A" },
          { nodeId: "10:2", width: 100, name: "Frame B" },
        ]
      );
      expect(resolved.width).toBe(200);
      expect(resolved.name).toBe("Frame B");
    });
  });

  describe("routeCategoryCommand", () => {
    it("routes a category command to the correct executor", async () => {
      const spy = vi.fn();
      queue.onCommand(spy);

      const promise = router.routeCategoryCommand("layers", "create_node", {
        type: "FRAME",
      });

      const command = spy.mock.calls[0][0];
      queue.resolve(command.id, { nodeId: "1:2" });

      const result = await promise;
      expect(result.success).toBe(true);
    });

    it("rejects if command doesn't belong to category", async () => {
      const result = await router.routeCategoryCommand(
        "layers",
        "set_fill",
        {}
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain("does not belong to category");
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/server/__tests__/router.test.ts`
Expected: FAIL — module not found

**Step 3: Write the implementation**

```typescript
// src/server/router.ts
import {
  Command,
  CommandResponse,
  createErrorResponse,
  MAX_BATCH_SIZE,
  DEFAULT_TIMEOUT,
  BULK_TIMEOUT,
} from "../../shared/protocol.js";
import { CommandQueue } from "./command-queue.js";
import { randomUUID } from "crypto";

// ============================================================
// Command → Category mapping
// ============================================================

const COMMAND_CATEGORIES: Record<string, string> = {
  // Layers (8)
  create_node: "layers",
  create_text: "layers",
  delete_node: "layers",
  duplicate_node: "layers",
  move_node: "layers",
  resize_node: "layers",
  rename_node: "layers",
  reorder_node: "layers",

  // Text (5)
  set_text_content: "text",
  set_text_style: "text",
  set_text_color: "text",
  set_text_alignment: "text",
  find_replace_text: "text",

  // Styling (8)
  set_fill: "styling",
  set_stroke: "styling",
  set_corner_radius: "styling",
  set_opacity: "styling",
  set_effects: "styling",
  set_blend_mode: "styling",
  set_constraints: "styling",
  apply_style: "styling",

  // Layout (5)
  set_auto_layout: "layout",
  add_to_auto_layout: "layout",
  set_layout_grid: "layout",
  group_nodes: "layout",
  ungroup_nodes: "layout",

  // Components (6)
  create_component: "components",
  create_component_set: "components",
  create_instance: "components",
  swap_instance: "components",
  set_instance_override: "components",
  detach_instance: "components",

  // Pages (4)
  create_page: "pages",
  switch_page: "pages",
  create_section: "pages",
  set_page_background: "pages",

  // Vectors (3)
  boolean_operation: "vectors",
  flatten_node: "vectors",
  set_mask: "vectors",

  // Export (4)
  export_node: "export",
  set_export_settings: "export",
  set_image_fill: "export",
  get_node_css: "export",

  // Variables (4)
  create_variable: "variables",
  set_variable_value: "variables",
  create_variable_collection: "variables",
  bind_variable: "variables",

  // Reading (5)
  get_node: "reading",
  get_selection: "reading",
  get_page_nodes: "reading",
  search_nodes: "reading",
  scroll_to_node: "reading",

  // Superpowers (18)
  bulk_rename: "superpowers",
  bulk_style: "superpowers",
  design_lint: "superpowers",
  accessibility_check: "superpowers",
  localize_text: "superpowers",
  generate_layout: "superpowers",
  design_system_scan: "superpowers",
  responsive_check: "superpowers",
  color_palette_extract: "superpowers",
  typography_audit: "superpowers",
  spacing_audit: "superpowers",
  component_coverage: "superpowers",
  bulk_resize: "superpowers",
  smart_align: "superpowers",
  export_tokens: "superpowers",
  import_tokens: "superpowers",
  annotation_generate: "superpowers",
  duplicate_detector: "superpowers",
};

const CATEGORIES = [
  "layers",
  "text",
  "styling",
  "layout",
  "components",
  "pages",
  "vectors",
  "export",
  "variables",
  "reading",
  "superpowers",
] as const;

export type Category = (typeof CATEGORIES)[number];

export interface BatchInput {
  command: string;
  params: Record<string, unknown>;
}

export interface RouterResult {
  success: boolean;
  operations?: { command: string; nodeId?: string; status: string }[];
  summary?: string;
  nodeIds?: string[];
  error?: string;
  data?: unknown;
}

export class Router {
  constructor(private queue: CommandQueue) {}

  getCategory(command: string): string | undefined {
    return COMMAND_CATEGORIES[command];
  }

  isValidCommand(command: string): boolean {
    return command in COMMAND_CATEGORIES;
  }

  isCommandInCategory(command: string, category: string): boolean {
    return COMMAND_CATEGORIES[command] === category;
  }

  getCommandsForCategory(category: string): string[] {
    return Object.entries(COMMAND_CATEGORIES)
      .filter(([, cat]) => cat === category)
      .map(([cmd]) => cmd);
  }

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

    const timeout = this.getTimeout(command);
    return this.queue.enqueue(command, params, timeout);
  }

  async routeCategoryCommand(
    category: string,
    command: string,
    params: Record<string, unknown>
  ): Promise<CommandResponse> {
    if (!this.isCommandInCategory(command, category)) {
      return createErrorResponse(
        randomUUID(),
        `Command '${command}' does not belong to category '${category}'. ` +
          `Commands in '${category}': ${this.getCommandsForCategory(category).join(", ")}`
      );
    }

    return this.routeStructuredCommand(command, params);
  }

  async routeBatch(commands: BatchInput[]): Promise<RouterResult> {
    if (commands.length > MAX_BATCH_SIZE) {
      return {
        success: false,
        error: `Batch size ${commands.length} exceeds maximum of ${MAX_BATCH_SIZE}`,
      };
    }

    if (commands.length === 0) {
      return {
        success: false,
        error: "Batch must contain at least one command",
      };
    }

    // Validate all commands before sending
    for (const cmd of commands) {
      if (!this.isValidCommand(cmd.command)) {
        return {
          success: false,
          error: `Unknown command '${cmd.command}' in batch`,
        };
      }
    }

    // Send as batch to plugin
    const batchCommands = commands.map((cmd) => ({
      type: cmd.command,
      params: cmd.params,
    }));

    const response = await this.queue.enqueueBatch(batchCommands, BULK_TIMEOUT);

    if (!response.success) {
      return { success: false, error: response.error };
    }

    // Parse batch results
    const batchData = response.data as {
      batchResults?: { id: string; success: boolean; data?: unknown; error?: string }[];
    } | undefined;

    const batchResults = batchData?.batchResults ?? [];

    const operations = commands.map((cmd, i) => {
      const result = batchResults[i];
      const data = result?.data as Record<string, unknown> | undefined;
      return {
        command: cmd.command,
        nodeId: data?.nodeId as string | undefined,
        status: result?.success ? "ok" : (result?.error ?? "unknown error"),
      };
    });

    const nodeIds = operations
      .filter((op) => op.nodeId)
      .map((op) => op.nodeId!);

    const allOk = operations.every((op) => op.status === "ok");

    return {
      success: allOk,
      operations,
      nodeIds,
      summary: allOk
        ? `Successfully executed ${commands.length} commands`
        : `Batch partially failed: ${operations.filter((op) => op.status !== "ok").length}/${commands.length} commands failed`,
    };
  }

  substituteVariables(
    params: Record<string, unknown>,
    previousResults: Record<string, unknown>[]
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(params)) {
      if (typeof value === "string" && value.startsWith("$")) {
        result[key] = this.resolveVariable(value, previousResults);
      } else {
        result[key] = value;
      }
    }

    return result;
  }

  private resolveVariable(
    ref: string,
    previousResults: Record<string, unknown>[]
  ): unknown {
    // Match $N or $N.property
    const match = ref.match(/^\$(\d+)(?:\.(\w+))?$/);
    if (!match) return ref;

    const index = parseInt(match[1], 10);
    const property = match[2];

    if (index >= previousResults.length) {
      return ref; // Can't resolve, return as-is
    }

    const result = previousResults[index];

    if (property) {
      return result[property] ?? ref;
    }

    // Default: return nodeId
    return result.nodeId ?? ref;
  }

  private getTimeout(command: string): number {
    const category = COMMAND_CATEGORIES[command];
    if (
      category === "superpowers" ||
      category === "export" ||
      command === "find_replace_text"
    ) {
      return BULK_TIMEOUT;
    }
    return DEFAULT_TIMEOUT;
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/server/__tests__/router.test.ts`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/server/router.ts src/server/__tests__/router.test.ts
git commit -m "feat: add smart router with command categorization, batch support, and variable substitution"
```

---

## Task 6: MCP Server + Tool Registration

**Files:**
- Create: `src/server/mcp.ts`
- Create: `src/server/tools/status.ts`
- Create: `src/server/__tests__/mcp.test.ts`

**Step 1: Write the status tool**

```typescript
// src/server/tools/status.ts
import { WebSocketManager } from "../websocket.js";
import { Router } from "../router.js";

export interface ToolDef {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
  handler: (params: Record<string, unknown>) => Promise<unknown>;
}

export function createStatusTool(
  wsManager: WebSocketManager,
  router: Router
): ToolDef {
  return {
    name: "figma_status",
    description:
      "Check the connection status of the Figma plugin. Returns whether the plugin is connected, the current file name and ID, page list, and available commands. Call this first to verify the plugin is running before using other Figma tools.",
    inputSchema: {
      type: "object",
      properties: {},
    },
    handler: async () => {
      const connected = wsManager.isConnected;
      const fileInfo = wsManager.fileInfo;

      return {
        connected,
        file: connected
          ? {
              name: fileInfo?.name,
              id: fileInfo?.id,
              pages: fileInfo?.pages,
              nodeCount: fileInfo?.nodeCount,
            }
          : null,
        availableCategories: [
          "layers",
          "text",
          "styling",
          "layout",
          "components",
          "pages",
          "vectors",
          "export",
          "variables",
          "reading",
          "superpowers",
        ],
        toolCount: 68,
        message: connected
          ? `Connected to "${fileInfo?.name}" with ${fileInfo?.nodeCount} nodes`
          : "No Figma plugin connected. Open Figma and run the figma-mcp-write plugin.",
      };
    },
  };
}
```

**Step 2: Write the MCP server**

```typescript
// src/server/mcp.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { WebSocketManager } from "./websocket.js";
import { CommandQueue } from "./command-queue.js";
import { Router, Category } from "./router.js";
import { createStatusTool, ToolDef } from "./tools/status.js";
import {
  CommandResponse,
  isValidNodeId,
  isValidHexColor,
  SERVER_VERSION,
} from "../../shared/protocol.js";

export class FigmaMcpServer {
  private mcpServer: McpServer;
  private wsManager: WebSocketManager;
  private queue: CommandQueue;
  private router: Router;
  private tools: ToolDef[] = [];

  constructor(wsManager: WebSocketManager) {
    this.wsManager = wsManager;
    this.queue = new CommandQueue();
    this.router = new Router(this.queue);

    this.mcpServer = new McpServer({
      name: "figma-mcp-write",
      version: SERVER_VERSION,
    });

    // Wire up: when queue wants to send a command, send it over WebSocket
    this.queue.onCommand((command) => {
      try {
        this.wsManager.sendCommand(command);
      } catch {
        this.queue.reject(command.id, "No Figma plugin connected. Open Figma and run the figma-mcp-write plugin.");
      }
    });

    // Wire up: when WebSocket receives a response, resolve it in the queue
    this.wsManager.onResponse((response) => {
      this.queue.resolveWithResponse(response);
    });

    // Wire up: on disconnect, clear pending commands after buffer
    this.wsManager.onDisconnect(() => {
      setTimeout(() => {
        if (!this.wsManager.isConnected) {
          this.queue.clear();
        }
      }, 5000);
    });

    this.registerTools();
  }

  private registerTools(): void {
    // Status tool
    const statusTool = createStatusTool(this.wsManager, this.router);
    this.registerTool(statusTool);

    // Meta-tool (figma)
    this.registerMetaTool();

    // Category tools (11)
    this.registerCategoryTools();
  }

  private registerTool(tool: ToolDef): void {
    this.tools.push(tool);
    this.mcpServer.tool(
      tool.name,
      tool.description,
      tool.inputSchema,
      async (params) => {
        try {
          const result = await tool.handler(params as Record<string, unknown>);
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({ error: message }, null, 2),
              },
            ],
            isError: true,
          };
        }
      }
    );
  }

  private registerMetaTool(): void {
    this.registerTool({
      name: "figma",
      description:
        "Primary Figma tool. Send structured commands or batches of commands to manipulate Figma files. " +
        "For single operations, provide 'command' and 'params'. " +
        "For compound operations (e.g., create a card with title and CTA), provide 'commands' array. " +
        "Use $0, $1 etc. in params to reference nodeIds from previous commands in a batch. " +
        "Use $0.property to reference specific properties from previous results.",
      inputSchema: {
        type: "object",
        properties: {
          command: {
            type: "string",
            description:
              "Single command name (e.g., 'create_node', 'set_fill'). Use this for single operations.",
          },
          params: {
            type: "object",
            description: "Parameters for the single command.",
          },
          commands: {
            type: "array",
            description:
              "Array of commands for compound operations. Each item has 'command' (string) and 'params' (object). " +
              "Use $0, $1 to reference nodeIds from earlier commands. Use $0.property for specific properties.",
            items: {
              type: "object",
              properties: {
                command: { type: "string" },
                params: { type: "object" },
              },
              required: ["command", "params"],
            },
          },
        },
      },
      handler: async (args) => {
        const { command, params, commands } = args as {
          command?: string;
          params?: Record<string, unknown>;
          commands?: { command: string; params: Record<string, unknown> }[];
        };

        // Single command mode
        if (command && params) {
          const response = await this.router.routeStructuredCommand(
            command,
            params
          );
          return response;
        }

        // Batch mode
        if (commands && commands.length > 0) {
          return await this.router.routeBatch(commands);
        }

        return {
          error:
            "Provide either 'command' + 'params' for a single operation, or 'commands' array for compound operations.",
        };
      },
    });
  }

  private registerCategoryTools(): void {
    const categories: {
      name: string;
      tool: string;
      description: string;
    }[] = [
      {
        name: "layers",
        tool: "figma_layers",
        description:
          "Layer management: create_node, create_text, delete_node, duplicate_node, move_node, resize_node, rename_node, reorder_node. " +
          "Provide 'command' (one of the above) and 'params' object.",
      },
      {
        name: "text",
        tool: "figma_text",
        description:
          "Text operations: set_text_content, set_text_style, set_text_color, set_text_alignment, find_replace_text. " +
          "Provide 'command' and 'params'.",
      },
      {
        name: "styling",
        tool: "figma_styling",
        description:
          "Visual styling: set_fill, set_stroke, set_corner_radius, set_opacity, set_effects, set_blend_mode, set_constraints, apply_style. " +
          "Provide 'command' and 'params'.",
      },
      {
        name: "layout",
        tool: "figma_layout",
        description:
          "Layout management: set_auto_layout, add_to_auto_layout, set_layout_grid, group_nodes, ungroup_nodes. " +
          "Provide 'command' and 'params'.",
      },
      {
        name: "components",
        tool: "figma_components",
        description:
          "Component operations: create_component, create_component_set, create_instance, swap_instance, set_instance_override, detach_instance. " +
          "Provide 'command' and 'params'.",
      },
      {
        name: "pages",
        tool: "figma_pages",
        description:
          "Page management: create_page, switch_page, create_section, set_page_background. " +
          "Provide 'command' and 'params'.",
      },
      {
        name: "vectors",
        tool: "figma_vectors",
        description:
          "Boolean and vector operations: boolean_operation, flatten_node, set_mask. " +
          "Provide 'command' and 'params'.",
      },
      {
        name: "export",
        tool: "figma_export",
        description:
          "Export and assets: export_node, set_export_settings, set_image_fill, get_node_css. " +
          "Provide 'command' and 'params'.",
      },
      {
        name: "variables",
        tool: "figma_variables",
        description:
          "Design tokens and variables: create_variable, set_variable_value, create_variable_collection, bind_variable. " +
          "Provide 'command' and 'params'.",
      },
      {
        name: "reading",
        tool: "figma_reading",
        description:
          "Reading and navigation: get_node, get_selection, get_page_nodes, search_nodes, scroll_to_node. " +
          "Provide 'command' and 'params'.",
      },
      {
        name: "superpowers",
        tool: "figma_superpowers",
        description:
          "AI-only superpowers: bulk_rename, bulk_style, bulk_resize, smart_align, design_lint, accessibility_check, " +
          "design_system_scan, responsive_check, color_palette_extract, typography_audit, spacing_audit, component_coverage, " +
          "export_tokens, import_tokens, localize_text, annotation_generate, generate_layout, duplicate_detector. " +
          "Provide 'command' and 'params'.",
      },
    ];

    for (const cat of categories) {
      this.registerTool({
        name: cat.tool,
        description: cat.description,
        inputSchema: {
          type: "object",
          properties: {
            command: {
              type: "string",
              description: `The command to execute. Must be one of the commands listed in this tool's description.`,
            },
            params: {
              type: "object",
              description: "Parameters for the command.",
            },
          },
          required: ["command", "params"],
        },
        handler: async (args) => {
          const { command, params } = args as {
            command: string;
            params: Record<string, unknown>;
          };

          return await this.router.routeCategoryCommand(
            cat.name,
            command,
            params
          );
        },
      });
    }
  }

  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.mcpServer.connect(transport);
  }

  getToolCount(): number {
    return this.tools.length;
  }

  getRouter(): Router {
    return this.router;
  }

  getQueue(): CommandQueue {
    return this.queue;
  }
}
```

**Step 3: Write the test**

```typescript
// src/server/__tests__/mcp.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { FigmaMcpServer } from "../mcp.js";
import { WebSocketManager } from "../websocket.js";

// We can't easily test stdio transport, so test the tool registration and routing logic
describe("FigmaMcpServer", () => {
  let wsManager: WebSocketManager;
  let server: FigmaMcpServer;

  beforeEach(() => {
    wsManager = new WebSocketManager();
    server = new FigmaMcpServer(wsManager);
  });

  it("registers exactly 13 tools", () => {
    expect(server.getToolCount()).toBe(13);
  });

  it("has a working router with all 68 commands", () => {
    const router = server.getRouter();
    const allCommands = [
      // Layers
      "create_node", "create_text", "delete_node", "duplicate_node",
      "move_node", "resize_node", "rename_node", "reorder_node",
      // Text
      "set_text_content", "set_text_style", "set_text_color",
      "set_text_alignment", "find_replace_text",
      // Styling
      "set_fill", "set_stroke", "set_corner_radius", "set_opacity",
      "set_effects", "set_blend_mode", "set_constraints", "apply_style",
      // Layout
      "set_auto_layout", "add_to_auto_layout", "set_layout_grid",
      "group_nodes", "ungroup_nodes",
      // Components
      "create_component", "create_component_set", "create_instance",
      "swap_instance", "set_instance_override", "detach_instance",
      // Pages
      "create_page", "switch_page", "create_section", "set_page_background",
      // Vectors
      "boolean_operation", "flatten_node", "set_mask",
      // Export
      "export_node", "set_export_settings", "set_image_fill", "get_node_css",
      // Variables
      "create_variable", "set_variable_value", "create_variable_collection",
      "bind_variable",
      // Reading
      "get_node", "get_selection", "get_page_nodes", "search_nodes",
      "scroll_to_node",
      // Superpowers
      "bulk_rename", "bulk_style", "design_lint", "accessibility_check",
      "localize_text", "generate_layout", "design_system_scan",
      "responsive_check", "color_palette_extract", "typography_audit",
      "spacing_audit", "component_coverage", "bulk_resize", "smart_align",
      "export_tokens", "import_tokens", "annotation_generate",
      "duplicate_detector",
    ];

    expect(allCommands).toHaveLength(68);

    for (const cmd of allCommands) {
      expect(router.isValidCommand(cmd)).toBe(true);
    }
  });
});
```

**Step 4: Run tests**

Run: `npx vitest run src/server/__tests__/mcp.test.ts`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/server/mcp.ts src/server/tools/status.ts src/server/__tests__/mcp.test.ts
git commit -m "feat: add MCP server with 13 tools (meta + 11 categories + status) and full 68-command routing"
```

---

## Task 7: Entry Point

**Files:**
- Create: `src/server/index.ts`

**Step 1: Write the entry point**

```typescript
// src/server/index.ts
#!/usr/bin/env node

import { WebSocketManager } from "./websocket.js";
import { FigmaMcpServer } from "./mcp.js";
import { DEFAULT_PORT } from "../../shared/protocol.js";

async function main(): Promise<void> {
  const port = parseInt(process.env.FIGMA_MCP_PORT ?? "", 10) || DEFAULT_PORT;

  // Boot WebSocket server
  const wsManager = new WebSocketManager();
  await wsManager.start(port);
  console.error(`[figma-mcp-write] WebSocket server listening on ws://localhost:${port}`);

  // Boot MCP server (stdio)
  const mcpServer = new FigmaMcpServer(wsManager);
  await mcpServer.start();
  console.error(`[figma-mcp-write] MCP server started (stdio transport)`);

  // Log plugin connection events
  wsManager.onConnect(() => {
    const info = wsManager.fileInfo;
    console.error(`[figma-mcp-write] Plugin connected: "${info?.name}" (${info?.nodeCount} nodes)`);
  });

  wsManager.onDisconnect(() => {
    console.error(`[figma-mcp-write] Plugin disconnected`);
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

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --project tsconfig.json`
Expected: No errors

**Step 3: Commit**

```bash
git add src/server/index.ts
git commit -m "feat: add CLI entry point with WebSocket + MCP server boot and graceful shutdown"
```

---

## Task 8: Plugin Build Script

**Files:**
- Create: `scripts/build-plugin.js`

**Step 1: Write the build script**

```javascript
// scripts/build-plugin.js
import { build } from "esbuild";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

async function buildPlugin() {
  try {
    await build({
      entryPoints: [resolve(root, "plugin/code.ts")],
      bundle: true,
      outfile: resolve(root, "plugin/code.js"),
      format: "iife",
      target: "es2020",
      platform: "browser",
      sourcemap: true,
      minify: process.argv.includes("--minify"),
      define: {
        "process.env.NODE_ENV": JSON.stringify(
          process.argv.includes("--minify") ? "production" : "development"
        ),
      },
    });
    console.log("Plugin built successfully → plugin/code.js");
  } catch (error) {
    console.error("Plugin build failed:", error);
    process.exit(1);
  }
}

buildPlugin();
```

**Step 2: Commit**

```bash
git add scripts/build-plugin.js
git commit -m "chore: add esbuild plugin build script"
```

---

## Task 9: Figma Plugin Manifest

**Files:**
- Create: `plugin/manifest.json`

**Step 1: Create the manifest**

```json
{
  "name": "figma-mcp-write",
  "id": "figma-mcp-write-plugin",
  "api": "1.0.0",
  "main": "code.js",
  "ui": "ui.html",
  "capabilities": [],
  "enableProposedApi": false,
  "editorType": ["figma"],
  "networkAccess": {
    "allowedDomains": ["localhost"],
    "reasoning": "Connects to the local MCP server via WebSocket on localhost"
  }
}
```

**Step 2: Commit**

```bash
git add plugin/manifest.json
git commit -m "feat: add Figma plugin manifest with localhost network access"
```

---

## Task 10: Plugin UI

**Files:**
- Create: `plugin/ui.html`

**Step 1: Create the status panel UI**

```html
<!-- plugin/ui.html -->
<!DOCTYPE html>
<html>
<head>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: Inter, system-ui, -apple-system, sans-serif;
      font-size: 12px;
      color: #333;
      padding: 12px;
      background: #fff;
    }
    .header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 12px;
    }
    .header h1 {
      font-size: 14px;
      font-weight: 600;
    }
    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #ccc;
    }
    .status-dot.connected { background: #1bc47d; }
    .status-dot.connecting { background: #f5a623; animation: pulse 1s infinite; }
    .status-dot.error { background: #f24822; }
    @keyframes pulse { 50% { opacity: 0.5; } }
    .status-text {
      font-size: 11px;
      color: #666;
      margin-bottom: 8px;
    }
    .field {
      margin-bottom: 8px;
    }
    .field label {
      display: block;
      font-size: 10px;
      font-weight: 500;
      color: #999;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 2px;
    }
    .field .value {
      font-size: 12px;
      color: #333;
    }
    .server-url {
      display: flex;
      gap: 4px;
      margin-bottom: 12px;
    }
    .server-url input {
      flex: 1;
      padding: 6px 8px;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 11px;
      font-family: monospace;
    }
    .server-url button {
      padding: 6px 12px;
      border: none;
      border-radius: 4px;
      background: #18a0fb;
      color: #fff;
      font-size: 11px;
      cursor: pointer;
    }
    .server-url button:hover { background: #0d8ce0; }
    .server-url button:disabled { background: #ccc; cursor: not-allowed; }
    .log {
      margin-top: 12px;
      padding: 8px;
      background: #f5f5f5;
      border-radius: 4px;
      font-family: monospace;
      font-size: 10px;
      max-height: 120px;
      overflow-y: auto;
    }
    .log-entry { margin-bottom: 2px; }
    .log-entry.error { color: #f24822; }
    .log-entry.success { color: #1bc47d; }
  </style>
</head>
<body>
  <div class="header">
    <div class="status-dot" id="statusDot"></div>
    <h1>figma-mcp-write</h1>
  </div>

  <div class="status-text" id="statusText">Disconnected</div>

  <div class="server-url">
    <input type="text" id="serverUrl" value="ws://localhost:3846" placeholder="ws://localhost:3846" />
    <button id="connectBtn" onclick="handleConnect()">Connect</button>
  </div>

  <div id="fileInfo" style="display:none;">
    <div class="field">
      <label>File</label>
      <div class="value" id="fileName">—</div>
    </div>
    <div class="field">
      <label>Nodes</label>
      <div class="value" id="nodeCount">—</div>
    </div>
    <div class="field">
      <label>Commands Processed</label>
      <div class="value" id="commandCount">0</div>
    </div>
  </div>

  <div class="log" id="log"></div>

  <script>
    let commandCount = 0;

    function addLog(message, type = '') {
      const log = document.getElementById('log');
      const entry = document.createElement('div');
      entry.className = 'log-entry ' + type;
      entry.textContent = new Date().toLocaleTimeString() + ' ' + message;
      log.appendChild(entry);
      log.scrollTop = log.scrollHeight;
    }

    function setStatus(status, text) {
      const dot = document.getElementById('statusDot');
      const statusText = document.getElementById('statusText');
      dot.className = 'status-dot ' + status;
      statusText.textContent = text;
    }

    function handleConnect() {
      const url = document.getElementById('serverUrl').value;
      parent.postMessage({ pluginMessage: { type: 'connect', url } }, '*');
    }

    // Messages from plugin code
    window.onmessage = (event) => {
      const msg = event.data.pluginMessage;
      if (!msg) return;

      switch (msg.type) {
        case 'status':
          setStatus(msg.status, msg.text);
          if (msg.status === 'connected') {
            document.getElementById('fileInfo').style.display = 'block';
            document.getElementById('connectBtn').textContent = 'Disconnect';
          } else {
            document.getElementById('fileInfo').style.display = 'none';
            document.getElementById('connectBtn').textContent = 'Connect';
          }
          break;
        case 'fileInfo':
          document.getElementById('fileName').textContent = msg.name;
          document.getElementById('nodeCount').textContent = msg.nodeCount;
          break;
        case 'commandExecuted':
          commandCount++;
          document.getElementById('commandCount').textContent = commandCount;
          addLog('✓ ' + msg.command, 'success');
          break;
        case 'commandError':
          addLog('✗ ' + msg.command + ': ' + msg.error, 'error');
          break;
        case 'log':
          addLog(msg.message, msg.level);
          break;
      }
    };

    addLog('Plugin loaded. Click Connect to start.');
  </script>
</body>
</html>
```

**Step 2: Commit**

```bash
git add plugin/ui.html
git commit -m "feat: add Figma plugin status panel UI"
```

---

## Task 11: Plugin Main Code

**Files:**
- Create: `plugin/code.ts`

**Step 1: Write the plugin main**

```typescript
// plugin/code.ts

// ============================================================
// Types (duplicated from shared/protocol.ts for browser context)
// ============================================================

interface Command {
  id: string;
  type: string;
  params: Record<string, unknown>;
  batch?: Command[];
  contextRequest?: boolean;
}

interface CommandResponse {
  id: string;
  success: boolean;
  data?: unknown;
  error?: string;
  batchResults?: CommandResponse[];
  context?: unknown;
}

interface PluginEvent {
  event: string;
  data: unknown;
}

type WebSocketMessage =
  | { type: "command"; payload: Command }
  | { type: "handshake_ack"; serverVersion: string }
  | { type: "scan_design_system" };

// ============================================================
// Constants
// ============================================================

const RECONNECT_INTERVAL = 2000;
const DEFAULT_URL = "ws://localhost:3846";

// ============================================================
// State
// ============================================================

let ws: WebSocket | null = null;
let serverUrl = DEFAULT_URL;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let isIntentionalClose = false;

// ============================================================
// UI Communication
// ============================================================

figma.showUI(__html__, { width: 280, height: 320 });

function sendToUI(msg: Record<string, unknown>): void {
  figma.ui.postMessage(msg);
}

function log(message: string, level = ""): void {
  sendToUI({ type: "log", message, level });
}

function setStatus(status: string, text: string): void {
  sendToUI({ type: "status", status, text });
}

// ============================================================
// File Info
// ============================================================

function getFileInfo() {
  const pages = figma.root.children.map((page) => ({
    id: page.id,
    name: page.name,
  }));

  let nodeCount = 0;
  for (const page of figma.root.children) {
    nodeCount += countNodes(page);
  }

  return {
    name: figma.root.name,
    id: figma.root.id ?? "unknown",
    pages,
    nodeCount,
  };
}

function countNodes(node: BaseNode): number {
  let count = 1;
  if ("children" in node) {
    for (const child of (node as ChildrenMixin).children) {
      count += countNodes(child);
    }
  }
  return count;
}

// ============================================================
// WebSocket Connection
// ============================================================

function connect(url: string): void {
  serverUrl = url;
  isIntentionalClose = false;

  if (ws && ws.readyState === WebSocket.OPEN) {
    isIntentionalClose = true;
    ws.close();
  }

  setStatus("connecting", `Connecting to ${url}...`);

  try {
    ws = new WebSocket(url);
  } catch (error) {
    setStatus("error", `Failed to create WebSocket: ${error}`);
    scheduleReconnect();
    return;
  }

  ws.onopen = () => {
    log("WebSocket connected");
    // Send handshake
    const fileInfo = getFileInfo();
    ws!.send(JSON.stringify({ type: "handshake", fileInfo }));
    sendToUI({ type: "fileInfo", name: fileInfo.name, nodeCount: fileInfo.nodeCount });
  };

  ws.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data as string) as WebSocketMessage;
      handleMessage(message);
    } catch {
      log("Failed to parse message", "error");
    }
  };

  ws.onclose = () => {
    setStatus("", "Disconnected");
    ws = null;
    if (!isIntentionalClose) {
      scheduleReconnect();
    }
  };

  ws.onerror = () => {
    setStatus("error", "Connection error");
  };
}

function scheduleReconnect(): void {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(() => {
    log("Reconnecting...");
    connect(serverUrl);
  }, RECONNECT_INTERVAL);
}

function disconnect(): void {
  isIntentionalClose = true;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (ws) {
    ws.close();
    ws = null;
  }
  setStatus("", "Disconnected");
}

// ============================================================
// Message Handling
// ============================================================

function handleMessage(message: WebSocketMessage): void {
  switch (message.type) {
    case "handshake_ack":
      setStatus("connected", `Connected (server v${message.serverVersion})`);
      log(`Handshake complete. Server v${message.serverVersion}`);
      break;

    case "command":
      handleCommand(message.payload);
      break;

    case "scan_design_system":
      handleDesignSystemScan();
      break;
  }
}

async function handleCommand(command: Command): Promise<void> {
  try {
    // Handle batch commands
    if (command.type === "batch" && command.batch) {
      const batchResults: CommandResponse[] = [];
      for (const subCommand of command.batch) {
        const result = await executeCommand(subCommand);
        batchResults.push(result);
        if (!result.success) {
          // Rollback: undo all previous successful operations
          for (let i = 0; i < batchResults.length - 1; i++) {
            if (batchResults[i].success) {
              figma.undo();
            }
          }
          break;
        }
      }

      sendResponse({
        id: command.id,
        success: batchResults.every((r) => r.success),
        data: { batchResults },
        error: batchResults.find((r) => !r.success)?.error,
      });
      return;
    }

    // Single command
    const result = await executeCommand(command);
    sendResponse({
      id: command.id,
      success: result.success,
      data: result.data,
      error: result.error,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    sendResponse({
      id: command.id,
      success: false,
      error: errorMessage,
    });
    sendToUI({ type: "commandError", command: command.type, error: errorMessage });
  }
}

async function executeCommand(command: Command): Promise<CommandResponse> {
  // This will be filled in by executor imports in Phase 2+
  // For now, return a "not implemented" response
  sendToUI({ type: "commandExecuted", command: command.type });

  return {
    id: command.id,
    success: false,
    error: `Command '${command.type}' is not yet implemented. Available in a future phase.`,
  };
}

function sendResponse(response: CommandResponse): void {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: "response", payload: response }));
  }
}

// ============================================================
// Design System Scanner (stub for Phase 5)
// ============================================================

function handleDesignSystemScan(): void {
  // Stub — will be implemented in Phase 5
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(
      JSON.stringify({
        type: "design_system_result",
        payload: {
          variables: { collections: [], colorTokens: [], spacingTokens: [], typographyTokens: [] },
          styles: { textStyles: [], colorStyles: [], effectStyles: [], gridStyles: [] },
          components: { local: [], external: [] },
          conventions: { namingPattern: "unknown", spacingScale: [], colorPalette: [] },
        },
      })
    );
  }
}

// ============================================================
// Plugin Events
// ============================================================

figma.on("selectionchange", () => {
  const selectedNodes = figma.currentPage.selection.map((node) => ({
    id: node.id,
    name: node.name,
    type: node.type,
  }));

  sendPluginEvent("selection_changed", { nodes: selectedNodes });
});

figma.on("currentpagechange", () => {
  sendPluginEvent("page_changed", {
    pageId: figma.currentPage.id,
    pageName: figma.currentPage.name,
  });
});

function sendPluginEvent(event: string, data: unknown): void {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(
      JSON.stringify({
        type: "event",
        payload: { event, data },
      })
    );
  }
}

// ============================================================
// UI Message Handling
// ============================================================

figma.ui.onmessage = (msg: { type: string; url?: string }) => {
  switch (msg.type) {
    case "connect":
      if (ws && ws.readyState === WebSocket.OPEN) {
        disconnect();
      } else {
        connect(msg.url ?? DEFAULT_URL);
      }
      break;
  }
};

// ============================================================
// Auto-connect on launch
// ============================================================

connect(DEFAULT_URL);
```

**Step 2: Build the plugin**

Run: `node scripts/build-plugin.js`
Expected: "Plugin built successfully → plugin/code.js"

**Step 3: Commit**

```bash
git add plugin/code.ts
git commit -m "feat: add Figma plugin with WebSocket client, command routing, and auto-reconnect"
```

---

## Task 12: End-to-End Integration Test

**Files:**
- Create: `test/integration/e2e-status.test.ts`

**Step 1: Write the integration test**

```typescript
// test/integration/e2e-status.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { WebSocketManager } from "../../src/server/websocket.js";
import { FigmaMcpServer } from "../../src/server/mcp.js";
import WebSocket from "ws";

describe("End-to-end: figma_status", () => {
  let wsManager: WebSocketManager;
  let mcpServer: FigmaMcpServer;

  beforeEach(async () => {
    wsManager = new WebSocketManager();
    await wsManager.start(0); // random port
    mcpServer = new FigmaMcpServer(wsManager);
  });

  afterEach(async () => {
    await wsManager.close();
  });

  it("returns disconnected status when no plugin is connected", async () => {
    const queue = mcpServer.getQueue();
    const router = mcpServer.getRouter();

    // Directly test status — it doesn't go through the queue
    expect(wsManager.isConnected).toBe(false);
  });

  it("returns connected status after plugin handshake", async () => {
    const port = wsManager.port;

    // Simulate a plugin connecting
    const client = new WebSocket(`ws://localhost:${port}`);
    await new Promise<void>((resolve) => client.on("open", resolve));

    client.send(
      JSON.stringify({
        type: "handshake",
        fileInfo: {
          name: "Integration Test File",
          id: "file-integration-1",
          pages: [
            { id: "page-1", name: "Home" },
            { id: "page-2", name: "Settings" },
          ],
          nodeCount: 156,
        },
      })
    );

    // Wait for handshake ack
    await new Promise<void>((resolve) => {
      client.on("message", (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === "handshake_ack") resolve();
      });
    });

    expect(wsManager.isConnected).toBe(true);
    expect(wsManager.fileInfo?.name).toBe("Integration Test File");
    expect(wsManager.fileInfo?.pages).toHaveLength(2);
    expect(wsManager.fileInfo?.nodeCount).toBe(156);

    client.close();
  });

  it("sends commands to plugin and receives responses", async () => {
    const port = wsManager.port;
    const queue = mcpServer.getQueue();

    // Connect plugin
    const client = new WebSocket(`ws://localhost:${port}`);
    await new Promise<void>((resolve) => client.on("open", resolve));

    client.send(
      JSON.stringify({
        type: "handshake",
        fileInfo: { name: "Test", id: "f1", pages: [], nodeCount: 0 },
      })
    );

    await new Promise<void>((resolve) => {
      client.on("message", (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === "handshake_ack") resolve();
      });
    });

    // Plugin echoes back commands as success (simulating executor)
    client.on("message", (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === "command") {
        client.send(
          JSON.stringify({
            type: "response",
            payload: {
              id: msg.payload.id,
              success: true,
              data: { echo: msg.payload.type },
            },
          })
        );
      }
    });

    // Send a command through the queue
    const result = await queue.enqueue("get_selection", {});
    expect(result.success).toBe(true);
    expect((result.data as Record<string, unknown>).echo).toBe("get_selection");

    client.close();
  });
});
```

**Step 2: Run the integration test**

Run: `npx vitest run test/integration/e2e-status.test.ts`
Expected: All 3 tests PASS

**Step 3: Commit**

```bash
git add test/integration/e2e-status.test.ts
git commit -m "test: add end-to-end integration tests for status and command flow"
```

---

## Task 13: Run All Tests

**Step 1: Run the full test suite**

Run: `npx vitest run`
Expected: All tests pass

**Step 2: Run typecheck**

Run: `npx tsc --noEmit --project tsconfig.json`
Expected: No errors

**Step 3: Verify plugin builds**

Run: `node scripts/build-plugin.js`
Expected: Success

---

## Phase 1 Complete

At this point you have:
- ✅ Shared protocol types (`shared/protocol.ts`)
- ✅ Command queue with UUID pairing, timeouts, batch support
- ✅ WebSocket server with handshake, command routing, event handling
- ✅ Smart router with 68 command mappings, variable substitution, batch dispatch
- ✅ MCP server with 13 registered tools
- ✅ CLI entry point with graceful shutdown
- ✅ Figma plugin skeleton with auto-connect, command routing, event push
- ✅ Plugin UI with status panel
- ✅ Vitest configuration
- ✅ Unit tests for queue, WebSocket, router, MCP
- ✅ Integration test for end-to-end flow

**Next:** Phase 2 — implement reading tools (5), layer tools (8), and text tools (5) to make 18 tools functional.
