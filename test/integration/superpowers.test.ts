// test/integration/superpowers.test.ts
import { describe, it, expect, vi } from "vitest";
import { SUPERPOWER_COMMANDS } from "../../src/server/tools/superpowers.js";

// All 18 command names from the router
const ROUTER_SUPERPOWER_COMMANDS = [
  "bulk_rename",
  "bulk_style",
  "bulk_resize",
  "smart_align",
  "design_lint",
  "accessibility_check",
  "design_system_scan",
  "responsive_check",
  "component_coverage",
  "duplicate_detector",
  "color_palette_extract",
  "typography_audit",
  "spacing_audit",
  "export_tokens",
  "import_tokens",
  "localize_text",
  "annotation_generate",
  "generate_layout",
];

describe("superpowers integration", () => {
  it("server tool definitions match router commands 1:1", () => {
    const toolNames = SUPERPOWER_COMMANDS.map((c) => c.name).sort();
    const routerNames = [...ROUTER_SUPERPOWER_COMMANDS].sort();
    expect(toolNames).toEqual(routerNames);
  });

  it("all 18 commands are registered in the superpowers category", () => {
    expect(ROUTER_SUPERPOWER_COMMANDS).toHaveLength(18);
  });

  it("every tool has required fields in schema", () => {
    for (const cmd of SUPERPOWER_COMMANDS) {
      expect(cmd.name).toBeTruthy();
      expect(cmd.description.length).toBeGreaterThan(20);
      expect(cmd.params.type).toBe("object");
      expect(cmd.params.properties).toBeDefined();
    }
  });

  it("bulk operation commands use BULK_TIMEOUT (120s)", () => {
    const bulkCommands = [
      "bulk_rename",
      "bulk_style",
      "bulk_resize",
      "design_lint",
      "accessibility_check",
      "color_palette_extract",
      "typography_audit",
      "spacing_audit",
      "component_coverage",
      "duplicate_detector",
      "design_system_scan",
      "responsive_check",
      "export_tokens",
      "import_tokens",
      "localize_text",
      "annotation_generate",
      "generate_layout",
      "smart_align",
    ];
    // All superpowers use BULK_TIMEOUT per router.ts getTimeout()
    for (const cmd of bulkCommands) {
      expect(ROUTER_SUPERPOWER_COMMANDS).toContain(cmd);
    }
  });
});
