// src/server/mcp.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { WebSocketManager } from "./websocket.js";
import { CommandQueue } from "./command-queue.js";
import { Router } from "./router.js";
import { createStatusTool, ToolDef } from "./tools/status.js";
import {
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
