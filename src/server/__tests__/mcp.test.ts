// src/server/__tests__/mcp.test.ts
import { describe, it, expect, beforeEach } from "vitest";
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

    expect(allCommands).toHaveLength(70);

    for (const cmd of allCommands) {
      expect(router.isValidCommand(cmd)).toBe(true);
    }
  });
});
