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
  opacity?: number;
  cornerRadius?: number;
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

  static extractFileKey(urlOrKey: string): string | null {
    const match = urlOrKey.match(/figma\.com\/(?:design|file|proto|board)\/([a-zA-Z0-9]+)/);
    if (match) return match[1];
    if (/^[a-zA-Z0-9]+$/.test(urlOrKey)) return urlOrKey;
    return null;
  }
}
