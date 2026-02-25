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
        toolCount: 70,
        message: connected
          ? `Connected to "${fileInfo?.name}" with ${fileInfo?.nodeCount} nodes`
          : "No Figma plugin connected. Open Figma and run the figma-mcp-write plugin.",
      };
    },
  };
}
