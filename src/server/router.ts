// src/server/router.ts
import {
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
