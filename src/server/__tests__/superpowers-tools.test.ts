// src/server/__tests__/superpowers-tools.test.ts
import { describe, it, expect } from "vitest";
import { SUPERPOWER_COMMANDS, getSuperPowerSchema } from "../tools/superpowers.js";

describe("superpowers tool definitions", () => {
  it("defines all 18 superpower commands", () => {
    expect(SUPERPOWER_COMMANDS).toHaveLength(18);
  });

  it("includes all expected command names", () => {
    const names = SUPERPOWER_COMMANDS.map((c) => c.name);
    expect(names).toContain("bulk_rename");
    expect(names).toContain("bulk_style");
    expect(names).toContain("bulk_resize");
    expect(names).toContain("smart_align");
    expect(names).toContain("design_lint");
    expect(names).toContain("accessibility_check");
    expect(names).toContain("design_system_scan");
    expect(names).toContain("responsive_check");
    expect(names).toContain("component_coverage");
    expect(names).toContain("duplicate_detector");
    expect(names).toContain("color_palette_extract");
    expect(names).toContain("typography_audit");
    expect(names).toContain("spacing_audit");
    expect(names).toContain("export_tokens");
    expect(names).toContain("import_tokens");
    expect(names).toContain("localize_text");
    expect(names).toContain("annotation_generate");
    expect(names).toContain("generate_layout");
  });

  it("every command has a description", () => {
    for (const cmd of SUPERPOWER_COMMANDS) {
      expect(cmd.description.length).toBeGreaterThan(20);
    }
  });

  it("every command has a params schema", () => {
    for (const cmd of SUPERPOWER_COMMANDS) {
      expect(cmd.params).toBeDefined();
      expect(cmd.params.type).toBe("object");
    }
  });

  it("getSuperPowerSchema returns the full MCP tool schema", () => {
    const schema = getSuperPowerSchema();
    expect(schema.name).toBe("figma_superpowers");
    expect(schema.description).toBeDefined();
    expect(schema.inputSchema.properties.command).toBeDefined();
    expect(schema.inputSchema.properties.params).toBeDefined();
  });
});
