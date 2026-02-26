// plugin/__tests__/styling.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// ============================================================
// Mock Figma API
// ============================================================

function createMockNode(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "1:2",
    type: "RECTANGLE",
    name: "Test Node",
    fills: [],
    strokes: [],
    strokeWeight: 0,
    strokeAlign: "INSIDE" as const,
    dashPattern: [],
    cornerRadius: 0,
    topLeftRadius: 0,
    topRightRadius: 0,
    bottomLeftRadius: 0,
    bottomRightRadius: 0,
    opacity: 1,
    effects: [],
    blendMode: "NORMAL",
    constraints: { horizontal: "MIN", vertical: "MIN" },
    fillStyleId: "",
    strokeStyleId: "",
    effectStyleId: "",
    ...overrides,
  };
}

const mockFigma = {
  getNodeById: vi.fn(),
  getLocalPaintStyles: vi.fn().mockReturnValue([]),
  getLocalEffectStyles: vi.fn().mockReturnValue([]),
  getLocalTextStyles: vi.fn().mockReturnValue([]),
  getLocalGridStyles: vi.fn().mockReturnValue([]),
};

// Set global figma mock
vi.stubGlobal("figma", mockFigma);

import {
  executeStylingCommand,
} from "../executors/styling.js";

describe("Styling Executors", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================
  // set_fill
  // ============================================================

  describe("set_fill", () => {
    it("sets a solid fill from hex color", async () => {
      const node = createMockNode();
      mockFigma.getNodeById.mockReturnValue(node);

      const result = await executeStylingCommand("set_fill", {
        nodeId: "1:2",
        type: "SOLID",
        color: "#FF0000",
      });

      expect(result.success).toBe(true);
      expect(node.fills).toEqual([
        {
          type: "SOLID",
          color: { r: 1, g: 0, b: 0 },
          opacity: 1,
        },
      ]);
    });

    it("sets a solid fill with alpha from 8-digit hex", async () => {
      const node = createMockNode();
      mockFigma.getNodeById.mockReturnValue(node);

      const result = await executeStylingCommand("set_fill", {
        nodeId: "1:2",
        type: "SOLID",
        color: "#FF000080",
      });

      expect(result.success).toBe(true);
      const fills = node.fills as { type: string; color: { r: number; g: number; b: number }; opacity: number }[];
      expect(fills[0].type).toBe("SOLID");
      expect(fills[0].color.r).toBeCloseTo(1, 2);
      expect(fills[0].opacity).toBeCloseTo(0.502, 2);
    });

    it("sets a linear gradient fill", async () => {
      const node = createMockNode();
      mockFigma.getNodeById.mockReturnValue(node);

      const result = await executeStylingCommand("set_fill", {
        nodeId: "1:2",
        type: "GRADIENT_LINEAR",
        gradient: {
          stops: [
            { color: "#FF0000", position: 0 },
            { color: "#0000FF", position: 1 },
          ],
        },
      });

      expect(result.success).toBe(true);
      const fills = node.fills as { type: string; gradientStops: unknown[] }[];
      expect(fills[0].type).toBe("GRADIENT_LINEAR");
      expect(fills[0].gradientStops).toHaveLength(2);
    });

    it("errors on missing nodeId", async () => {
      const result = await executeStylingCommand("set_fill", {
        type: "SOLID",
        color: "#FF0000",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("nodeId");
    });

    it("errors on node not found", async () => {
      mockFigma.getNodeById.mockReturnValue(null);

      const result = await executeStylingCommand("set_fill", {
        nodeId: "999:999",
        type: "SOLID",
        color: "#FF0000",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });

    it("errors on missing type", async () => {
      const node = createMockNode();
      mockFigma.getNodeById.mockReturnValue(node);

      const result = await executeStylingCommand("set_fill", {
        nodeId: "1:2",
        color: "#FF0000",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("type");
    });

    it("errors on SOLID fill without color", async () => {
      const node = createMockNode();
      mockFigma.getNodeById.mockReturnValue(node);

      const result = await executeStylingCommand("set_fill", {
        nodeId: "1:2",
        type: "SOLID",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("color");
    });

    it("errors on gradient fill without stops", async () => {
      const node = createMockNode();
      mockFigma.getNodeById.mockReturnValue(node);

      const result = await executeStylingCommand("set_fill", {
        nodeId: "1:2",
        type: "GRADIENT_LINEAR",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("gradient");
    });

    it("errors on node that does not support fills", async () => {
      const node = createMockNode({ type: "SLICE" });
      // Remove fills property to simulate unsupported node
      delete (node as Record<string, unknown>).fills;
      mockFigma.getNodeById.mockReturnValue(node);

      const result = await executeStylingCommand("set_fill", {
        nodeId: "1:2",
        type: "SOLID",
        color: "#FF0000",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("does not support fills");
    });
  });

  // ============================================================
  // set_stroke
  // ============================================================

  describe("set_stroke", () => {
    it("sets stroke color and weight", async () => {
      const node = createMockNode();
      mockFigma.getNodeById.mockReturnValue(node);

      const result = await executeStylingCommand("set_stroke", {
        nodeId: "1:2",
        color: "#0000FF",
        weight: 2,
      });

      expect(result.success).toBe(true);
      expect(node.strokes).toEqual([
        {
          type: "SOLID",
          color: { r: 0, g: 0, b: 1 },
          opacity: 1,
        },
      ]);
      expect(node.strokeWeight).toBe(2);
    });

    it("sets stroke alignment", async () => {
      const node = createMockNode();
      mockFigma.getNodeById.mockReturnValue(node);

      const result = await executeStylingCommand("set_stroke", {
        nodeId: "1:2",
        color: "#000000",
        alignment: "OUTSIDE",
      });

      expect(result.success).toBe(true);
      expect(node.strokeAlign).toBe("OUTSIDE");
    });

    it("sets dash pattern", async () => {
      const node = createMockNode();
      mockFigma.getNodeById.mockReturnValue(node);

      const result = await executeStylingCommand("set_stroke", {
        nodeId: "1:2",
        color: "#000000",
        dashPattern: [10, 5],
      });

      expect(result.success).toBe(true);
      expect(node.dashPattern).toEqual([10, 5]);
    });

    it("uses default weight of 1 when not specified", async () => {
      const node = createMockNode();
      mockFigma.getNodeById.mockReturnValue(node);

      await executeStylingCommand("set_stroke", {
        nodeId: "1:2",
        color: "#000000",
      });

      expect(node.strokeWeight).toBe(1);
    });

    it("errors on missing color", async () => {
      const node = createMockNode();
      mockFigma.getNodeById.mockReturnValue(node);

      const result = await executeStylingCommand("set_stroke", {
        nodeId: "1:2",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("color");
    });

    it("errors on invalid alignment", async () => {
      const node = createMockNode();
      mockFigma.getNodeById.mockReturnValue(node);

      const result = await executeStylingCommand("set_stroke", {
        nodeId: "1:2",
        color: "#000000",
        alignment: "INVALID",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("alignment");
    });
  });

  // ============================================================
  // set_corner_radius
  // ============================================================

  describe("set_corner_radius", () => {
    it("sets uniform corner radius", async () => {
      const node = createMockNode();
      mockFigma.getNodeById.mockReturnValue(node);

      const result = await executeStylingCommand("set_corner_radius", {
        nodeId: "1:2",
        radius: 8,
      });

      expect(result.success).toBe(true);
      expect(node.cornerRadius).toBe(8);
    });

    it("sets individual corner radii", async () => {
      const node = createMockNode();
      mockFigma.getNodeById.mockReturnValue(node);

      const result = await executeStylingCommand("set_corner_radius", {
        nodeId: "1:2",
        topLeft: 4,
        topRight: 8,
        bottomLeft: 12,
        bottomRight: 16,
      });

      expect(result.success).toBe(true);
      expect(node.topLeftRadius).toBe(4);
      expect(node.topRightRadius).toBe(8);
      expect(node.bottomLeftRadius).toBe(12);
      expect(node.bottomRightRadius).toBe(16);
    });

    it("sets partial individual corners (others default to 0)", async () => {
      const node = createMockNode();
      mockFigma.getNodeById.mockReturnValue(node);

      const result = await executeStylingCommand("set_corner_radius", {
        nodeId: "1:2",
        topLeft: 10,
        topRight: 10,
      });

      expect(result.success).toBe(true);
      expect(node.topLeftRadius).toBe(10);
      expect(node.topRightRadius).toBe(10);
    });

    it("errors when no radius values are provided", async () => {
      const node = createMockNode();
      mockFigma.getNodeById.mockReturnValue(node);

      const result = await executeStylingCommand("set_corner_radius", {
        nodeId: "1:2",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("radius");
    });

    it("errors on negative radius", async () => {
      const node = createMockNode();
      mockFigma.getNodeById.mockReturnValue(node);

      const result = await executeStylingCommand("set_corner_radius", {
        nodeId: "1:2",
        radius: -5,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("negative");
    });

    it("errors on node that does not support corner radius", async () => {
      const node = createMockNode({ type: "TEXT" });
      delete (node as Record<string, unknown>).cornerRadius;
      delete (node as Record<string, unknown>).topLeftRadius;
      mockFigma.getNodeById.mockReturnValue(node);

      const result = await executeStylingCommand("set_corner_radius", {
        nodeId: "1:2",
        radius: 8,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("does not support corner radius");
    });
  });

  // ============================================================
  // set_opacity
  // ============================================================

  describe("set_opacity", () => {
    it("sets opacity to 0.5", async () => {
      const node = createMockNode();
      mockFigma.getNodeById.mockReturnValue(node);

      const result = await executeStylingCommand("set_opacity", {
        nodeId: "1:2",
        opacity: 0.5,
      });

      expect(result.success).toBe(true);
      expect(node.opacity).toBe(0.5);
    });

    it("sets opacity to 0", async () => {
      const node = createMockNode();
      mockFigma.getNodeById.mockReturnValue(node);

      const result = await executeStylingCommand("set_opacity", {
        nodeId: "1:2",
        opacity: 0,
      });

      expect(result.success).toBe(true);
      expect(node.opacity).toBe(0);
    });

    it("sets opacity to 1", async () => {
      const node = createMockNode();
      mockFigma.getNodeById.mockReturnValue(node);

      const result = await executeStylingCommand("set_opacity", {
        nodeId: "1:2",
        opacity: 1,
      });

      expect(result.success).toBe(true);
      expect(node.opacity).toBe(1);
    });

    it("errors on opacity below 0", async () => {
      const node = createMockNode();
      mockFigma.getNodeById.mockReturnValue(node);

      const result = await executeStylingCommand("set_opacity", {
        nodeId: "1:2",
        opacity: -0.5,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("between 0 and 1");
    });

    it("errors on opacity above 1", async () => {
      const node = createMockNode();
      mockFigma.getNodeById.mockReturnValue(node);

      const result = await executeStylingCommand("set_opacity", {
        nodeId: "1:2",
        opacity: 1.5,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("between 0 and 1");
    });

    it("errors on missing opacity", async () => {
      const node = createMockNode();
      mockFigma.getNodeById.mockReturnValue(node);

      const result = await executeStylingCommand("set_opacity", {
        nodeId: "1:2",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("opacity");
    });
  });

  // ============================================================
  // set_effects
  // ============================================================

  describe("set_effects", () => {
    it("sets a drop shadow effect", async () => {
      const node = createMockNode();
      mockFigma.getNodeById.mockReturnValue(node);

      const result = await executeStylingCommand("set_effects", {
        nodeId: "1:2",
        effects: [
          {
            type: "DROP_SHADOW",
            color: "#00000040",
            offset: { x: 0, y: 4 },
            radius: 8,
            spread: 0,
            visible: true,
          },
        ],
      });

      expect(result.success).toBe(true);
      const effects = node.effects as { type: string; color: unknown; offset: unknown; radius: number }[];
      expect(effects).toHaveLength(1);
      expect(effects[0].type).toBe("DROP_SHADOW");
      expect(effects[0].radius).toBe(8);
    });

    it("sets an inner shadow effect", async () => {
      const node = createMockNode();
      mockFigma.getNodeById.mockReturnValue(node);

      const result = await executeStylingCommand("set_effects", {
        nodeId: "1:2",
        effects: [
          {
            type: "INNER_SHADOW",
            color: "#00000020",
            offset: { x: 0, y: 2 },
            radius: 4,
          },
        ],
      });

      expect(result.success).toBe(true);
      const effects = node.effects as { type: string }[];
      expect(effects[0].type).toBe("INNER_SHADOW");
    });

    it("sets a layer blur effect", async () => {
      const node = createMockNode();
      mockFigma.getNodeById.mockReturnValue(node);

      const result = await executeStylingCommand("set_effects", {
        nodeId: "1:2",
        effects: [
          {
            type: "LAYER_BLUR",
            radius: 10,
          },
        ],
      });

      expect(result.success).toBe(true);
      const effects = node.effects as { type: string; radius: number }[];
      expect(effects[0].type).toBe("LAYER_BLUR");
      expect(effects[0].radius).toBe(10);
    });

    it("sets a background blur effect", async () => {
      const node = createMockNode();
      mockFigma.getNodeById.mockReturnValue(node);

      const result = await executeStylingCommand("set_effects", {
        nodeId: "1:2",
        effects: [
          {
            type: "BACKGROUND_BLUR",
            radius: 20,
          },
        ],
      });

      expect(result.success).toBe(true);
      const effects = node.effects as { type: string; radius: number }[];
      expect(effects[0].type).toBe("BACKGROUND_BLUR");
      expect(effects[0].radius).toBe(20);
    });

    it("sets multiple effects", async () => {
      const node = createMockNode();
      mockFigma.getNodeById.mockReturnValue(node);

      const result = await executeStylingCommand("set_effects", {
        nodeId: "1:2",
        effects: [
          { type: "DROP_SHADOW", color: "#00000040", offset: { x: 0, y: 4 }, radius: 8 },
          { type: "LAYER_BLUR", radius: 2 },
        ],
      });

      expect(result.success).toBe(true);
      expect((node.effects as unknown[]).length).toBe(2);
    });

    it("errors on missing effects array", async () => {
      const node = createMockNode();
      mockFigma.getNodeById.mockReturnValue(node);

      const result = await executeStylingCommand("set_effects", {
        nodeId: "1:2",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("effects");
    });

    it("errors on invalid effect type", async () => {
      const node = createMockNode();
      mockFigma.getNodeById.mockReturnValue(node);

      const result = await executeStylingCommand("set_effects", {
        nodeId: "1:2",
        effects: [{ type: "INVALID_EFFECT", radius: 10 }],
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("type");
    });
  });

  // ============================================================
  // set_blend_mode
  // ============================================================

  describe("set_blend_mode", () => {
    it("sets blend mode to MULTIPLY", async () => {
      const node = createMockNode();
      mockFigma.getNodeById.mockReturnValue(node);

      const result = await executeStylingCommand("set_blend_mode", {
        nodeId: "1:2",
        blendMode: "MULTIPLY",
      });

      expect(result.success).toBe(true);
      expect(node.blendMode).toBe("MULTIPLY");
    });

    it("sets blend mode to SCREEN", async () => {
      const node = createMockNode();
      mockFigma.getNodeById.mockReturnValue(node);

      const result = await executeStylingCommand("set_blend_mode", {
        nodeId: "1:2",
        blendMode: "SCREEN",
      });

      expect(result.success).toBe(true);
      expect(node.blendMode).toBe("SCREEN");
    });

    it("sets blend mode to NORMAL", async () => {
      const node = createMockNode();
      mockFigma.getNodeById.mockReturnValue(node);

      const result = await executeStylingCommand("set_blend_mode", {
        nodeId: "1:2",
        blendMode: "NORMAL",
      });

      expect(result.success).toBe(true);
      expect(node.blendMode).toBe("NORMAL");
    });

    it("errors on missing blendMode", async () => {
      const node = createMockNode();
      mockFigma.getNodeById.mockReturnValue(node);

      const result = await executeStylingCommand("set_blend_mode", {
        nodeId: "1:2",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("blendMode");
    });

    it("errors on invalid blendMode", async () => {
      const node = createMockNode();
      mockFigma.getNodeById.mockReturnValue(node);

      const result = await executeStylingCommand("set_blend_mode", {
        nodeId: "1:2",
        blendMode: "INVALID_MODE",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("blendMode");
    });
  });

  // ============================================================
  // set_constraints
  // ============================================================

  describe("set_constraints", () => {
    it("sets horizontal constraint", async () => {
      const node = createMockNode();
      mockFigma.getNodeById.mockReturnValue(node);

      const result = await executeStylingCommand("set_constraints", {
        nodeId: "1:2",
        horizontal: "CENTER",
      });

      expect(result.success).toBe(true);
      expect((node.constraints as { horizontal: string; vertical: string }).horizontal).toBe("CENTER");
    });

    it("sets vertical constraint", async () => {
      const node = createMockNode();
      mockFigma.getNodeById.mockReturnValue(node);

      const result = await executeStylingCommand("set_constraints", {
        nodeId: "1:2",
        vertical: "STRETCH",
      });

      expect(result.success).toBe(true);
      expect((node.constraints as { horizontal: string; vertical: string }).vertical).toBe("STRETCH");
    });

    it("sets both constraints", async () => {
      const node = createMockNode();
      mockFigma.getNodeById.mockReturnValue(node);

      const result = await executeStylingCommand("set_constraints", {
        nodeId: "1:2",
        horizontal: "MAX",
        vertical: "SCALE",
      });

      expect(result.success).toBe(true);
      const constraints = node.constraints as { horizontal: string; vertical: string };
      expect(constraints.horizontal).toBe("MAX");
      expect(constraints.vertical).toBe("SCALE");
    });

    it("errors when neither constraint is provided", async () => {
      const node = createMockNode();
      mockFigma.getNodeById.mockReturnValue(node);

      const result = await executeStylingCommand("set_constraints", {
        nodeId: "1:2",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("horizontal");
    });

    it("errors on invalid horizontal constraint", async () => {
      const node = createMockNode();
      mockFigma.getNodeById.mockReturnValue(node);

      const result = await executeStylingCommand("set_constraints", {
        nodeId: "1:2",
        horizontal: "INVALID",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("horizontal");
    });

    it("errors on invalid vertical constraint", async () => {
      const node = createMockNode();
      mockFigma.getNodeById.mockReturnValue(node);

      const result = await executeStylingCommand("set_constraints", {
        nodeId: "1:2",
        vertical: "INVALID",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("vertical");
    });
  });

  // ============================================================
  // apply_style
  // ============================================================

  describe("apply_style", () => {
    it("applies a fill style by name", async () => {
      const node = createMockNode();
      mockFigma.getNodeById.mockReturnValue(node);
      mockFigma.getLocalPaintStyles.mockReturnValue([
        { id: "S:style1", name: "Brand/Primary", paints: [{ type: "SOLID", color: { r: 0, g: 0, b: 1 }, opacity: 1 }] },
      ]);

      const result = await executeStylingCommand("apply_style", {
        nodeId: "1:2",
        styleName: "Brand/Primary",
        styleType: "fill",
      });

      expect(result.success).toBe(true);
      expect(node.fillStyleId).toBe("S:style1");
    });

    it("applies a stroke style by name", async () => {
      const node = createMockNode();
      mockFigma.getNodeById.mockReturnValue(node);
      mockFigma.getLocalPaintStyles.mockReturnValue([
        { id: "S:style2", name: "Border/Default" },
      ]);

      const result = await executeStylingCommand("apply_style", {
        nodeId: "1:2",
        styleName: "Border/Default",
        styleType: "stroke",
      });

      expect(result.success).toBe(true);
      expect(node.strokeStyleId).toBe("S:style2");
    });

    it("applies an effect style by name", async () => {
      const node = createMockNode();
      mockFigma.getNodeById.mockReturnValue(node);
      mockFigma.getLocalEffectStyles.mockReturnValue([
        { id: "S:effect1", name: "Shadow/Medium" },
      ]);

      const result = await executeStylingCommand("apply_style", {
        nodeId: "1:2",
        styleName: "Shadow/Medium",
        styleType: "effect",
      });

      expect(result.success).toBe(true);
      expect(node.effectStyleId).toBe("S:effect1");
    });

    it("errors when style is not found", async () => {
      const node = createMockNode();
      mockFigma.getNodeById.mockReturnValue(node);
      mockFigma.getLocalPaintStyles.mockReturnValue([]);

      const result = await executeStylingCommand("apply_style", {
        nodeId: "1:2",
        styleName: "Nonexistent/Style",
        styleType: "fill",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });

    it("errors on missing styleName", async () => {
      const node = createMockNode();
      mockFigma.getNodeById.mockReturnValue(node);

      const result = await executeStylingCommand("apply_style", {
        nodeId: "1:2",
        styleType: "fill",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("styleName");
    });

    it("errors on missing styleType", async () => {
      const node = createMockNode();
      mockFigma.getNodeById.mockReturnValue(node);

      const result = await executeStylingCommand("apply_style", {
        nodeId: "1:2",
        styleName: "Brand/Primary",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("styleType");
    });

    it("errors on invalid styleType", async () => {
      const node = createMockNode();
      mockFigma.getNodeById.mockReturnValue(node);

      const result = await executeStylingCommand("apply_style", {
        nodeId: "1:2",
        styleName: "Brand/Primary",
        styleType: "invalid",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("styleType");
    });
  });
});
