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
  private cachedFile: { key: string; document: FigmaNode; name: string; timestamp: number } | null = null;
  private static readonly CACHE_TTL_MS = 30_000;

  constructor(private client: FigmaApiClient) {}

  setFileKey(key: string): void {
    this.fileKey = key;
    this.cachedFile = null;
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
    const now = Date.now();
    if (this.cachedFile && this.cachedFile.key === this.fileKey
        && (now - this.cachedFile.timestamp) < RestReadAdapter.CACHE_TTL_MS) {
      return this.cachedFile;
    }
    const file = await this.client.getFile(this.fileKey!);
    if (!file) throw new Error(`Could not fetch file '${this.fileKey}'. Check the file key and token permissions.`);
    this.cachedFile = { key: this.fileKey!, document: file.document, name: file.name, timestamp: now };
    return this.cachedFile;
  }

  private async getPageNodes(id: string, params: Record<string, unknown>): Promise<CommandResponse> {
    const file = await this.ensureFile();
    const pages = file.document.children ?? [];
    const pageId = params.pageId as string | undefined;
    const page = pageId ? pages.find((p) => p.id === pageId) : pages[0];
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
    return createSuccessResponse(id, { nodes: results.map(simplifyNode), count: results.length, query });
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
