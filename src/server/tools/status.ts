// src/server/tools/status.ts
import { WebSocketManager } from "../websocket.js";
import { Router } from "../router.js";
import { RestReadAdapter } from "../rest-adapter.js";

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
  router: Router,
  restAdapter?: RestReadAdapter
): ToolDef {
  return {
    name: "figma_status",
    description:
      "Check the connection status. Returns mode (plugin/rest-api/disconnected), file info, and available commands. " +
      "Pass 'fileUrl' to set the target Figma file for REST API reads (e.g. 'https://www.figma.com/design/abc123/MyFile').",
    inputSchema: {
      type: "object",
      properties: {
        fileUrl: {
          type: "string",
          description: "Optional Figma file URL to set as the active file for REST API reads.",
        },
      },
    },
    handler: async (params) => {
      const connected = wsManager.isConnected;
      const fileInfo = wsManager.fileInfo;
      const hasRestApi = !!restAdapter;

      // Handle fileUrl parameter — set the REST API target file
      const fileUrl = params.fileUrl as string | undefined;
      if (fileUrl && restAdapter) {
        const ok = restAdapter.setFileUrl(fileUrl);
        if (!ok) {
          return { error: `Invalid Figma URL: ${fileUrl}` };
        }
      }

      const mode = connected ? "plugin" : hasRestApi ? "rest-api" : "disconnected";

      return {
        connected,
        mode,
        file: connected
          ? {
              name: fileInfo?.name,
              id: fileInfo?.id,
              pages: fileInfo?.pages,
              nodeCount: fileInfo?.nodeCount,
            }
          : restAdapter?.getFileKey()
            ? { key: restAdapter.getFileKey() }
            : null,
        restApiEnabled: hasRestApi,
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
          ? `Plugin connected to "${fileInfo?.name}" (full read/write access)`
          : hasRestApi
            ? `REST API mode — reads available${restAdapter?.getFileKey() ? ` for file ${restAdapter.getFileKey()}` : ". Set a file URL to begin."}`
            : "No connection. Run 'npx figma-mcp-write setup' to configure.",
      };
    },
  };
}
