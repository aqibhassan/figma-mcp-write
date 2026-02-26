// test/e2e/setup.ts
//
// E2E test helpers: mock plugin that connects to the real WebSocket server
// and simulates Figma API responses.

import WebSocket from "ws";
import {
  Command,
  CommandResponse,
  WebSocketMessage,
  FileInfo,
  DesignSystemContext,
} from "../../shared/protocol.js";

// ============================================================
// Mock Plugin Client
// ============================================================

export class MockPluginClient {
  private ws: WebSocket | null = null;
  private commandHandlers = new Map<string, (params: Record<string, unknown>) => unknown>();
  private connected = false;

  constructor(
    private port: number = 3846,
    private fileInfo: FileInfo = DEFAULT_FILE_INFO
  ) {}

  get isConnected(): boolean {
    return this.connected;
  }

  /**
   * Register a handler for a specific command type.
   * When the server sends this command, the handler runs and its return
   * value is sent back as a success response.
   */
  onCommand(type: string, handler: (params: Record<string, unknown>) => unknown): void {
    this.commandHandlers.set(type, handler);
  }

  /**
   * Connect to the WebSocket server, send handshake, wait for ack.
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(`ws://localhost:${this.port}`);

      this.ws.on("open", () => {
        // Send handshake
        const handshake: WebSocketMessage = {
          type: "handshake",
          fileInfo: this.fileInfo,
        };
        this.ws!.send(JSON.stringify(handshake));
      });

      this.ws.on("message", (data) => {
        try {
          const message = JSON.parse(data.toString()) as WebSocketMessage;
          this.handleMessage(message, resolve);
        } catch {
          // Ignore malformed messages
        }
      });

      this.ws.on("error", reject);

      this.ws.on("close", () => {
        this.connected = false;
      });

      // Timeout after 5s
      setTimeout(() => {
        if (!this.connected) {
          reject(new Error("Mock plugin connection timed out after 5s"));
        }
      }, 5000);
    });
  }

  private handleMessage(message: WebSocketMessage, onReady?: (value: void) => void): void {
    switch (message.type) {
      case "handshake_ack":
        this.connected = true;
        if (onReady) onReady();
        break;

      case "command":
        this.handleCommand(message.payload);
        break;

      case "scan_design_system":
        this.sendDesignSystemResult(DEFAULT_DESIGN_SYSTEM_CONTEXT);
        break;
    }
  }

  private handleCommand(command: Command): void {
    const handler = this.commandHandlers.get(command.type);

    let response: CommandResponse;

    if (handler) {
      try {
        const data = handler(command.params);
        response = { id: command.id, success: true, data };
      } catch (err) {
        response = {
          id: command.id,
          success: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    } else {
      // Default: return success with echoed params
      response = {
        id: command.id,
        success: true,
        data: { ...command.params, _echoed: true },
      };
    }

    this.sendResponse(response);
  }

  private sendResponse(response: CommandResponse): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const message: WebSocketMessage = { type: "response", payload: response };
    this.ws.send(JSON.stringify(message));
  }

  private sendDesignSystemResult(context: DesignSystemContext): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const message: WebSocketMessage = {
      type: "design_system_result",
      payload: context,
    };
    this.ws.send(JSON.stringify(message));
  }

  async disconnect(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.ws) {
        resolve();
        return;
      }
      this.ws.on("close", () => resolve());
      this.ws.close();
      this.ws = null;
    });
  }
}

// ============================================================
// Default Fixtures
// ============================================================

export const DEFAULT_FILE_INFO: FileInfo = {
  name: "E2E Test File",
  id: "test-file-001",
  pages: [
    { id: "0:1", name: "Page 1" },
    { id: "0:2", name: "Page 2" },
  ],
  nodeCount: 42,
};

export const DEFAULT_DESIGN_SYSTEM_CONTEXT: DesignSystemContext = {
  variables: {
    collections: [
      { id: "vc:1", name: "Brand Colors", modes: [{ id: "m:1", name: "Default" }], variableCount: 8 },
    ],
    colorTokens: [
      { id: "v:1", name: "primary/500", type: "COLOR", value: "#3B82F6", collectionId: "vc:1" },
      { id: "v:2", name: "neutral/900", type: "COLOR", value: "#111827", collectionId: "vc:1" },
    ],
    spacingTokens: [
      { id: "v:3", name: "spacing/sm", type: "FLOAT", value: 8, collectionId: "vc:1" },
      { id: "v:4", name: "spacing/md", type: "FLOAT", value: 16, collectionId: "vc:1" },
    ],
    typographyTokens: [],
  },
  styles: {
    textStyles: [{ id: "s:1", name: "Heading/H1", type: "TEXT", description: "Main heading" }],
    colorStyles: [{ id: "s:2", name: "Primary", type: "PAINT", description: "Primary brand color" }],
    effectStyles: [],
    gridStyles: [],
  },
  components: {
    local: [
      { id: "c:1", name: "Button", description: "Primary button", variantProperties: { size: ["sm", "md", "lg"] } },
      { id: "c:2", name: "Card", description: "Content card" },
    ],
    external: [
      { name: "Material Design 3", componentCount: 156, enabled: true },
    ],
  },
  conventions: {
    namingPattern: "flat",
    spacingScale: [4, 8, 12, 16, 24, 32, 48, 64],
    colorPalette: [
      { name: "Primary", colors: ["#3B82F6", "#2563EB", "#1D4ED8"] },
      { name: "Neutral", colors: ["#F9FAFB", "#6B7280", "#111827"] },
    ],
  },
};

// ============================================================
// Helpers
// ============================================================

/**
 * Create a node ID counter for simulating Figma node creation.
 * Returns incrementing IDs like "100:1", "100:2", etc.
 */
export function createNodeIdGenerator(pageId: number = 100): () => string {
  let counter = 0;
  return () => {
    counter++;
    return `${pageId}:${counter}`;
  };
}

/**
 * Wait for a given number of milliseconds.
 */
export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
