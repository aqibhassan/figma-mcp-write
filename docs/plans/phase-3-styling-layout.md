# Phase 3: Styling + Layout (13 Tools)

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement styling tools (8) and layout tools (5). At the end, Claude can create styled, auto-laid-out designs.

**Architecture:** Server-side tool definitions are already registered. This phase adds plugin-side executors.

**Tech Stack:** TypeScript, @figma/plugin-typings, vitest

---

## Task 1: Color Utility

**Files:**
- Create: `plugin/utils/color.ts`
- Create: `plugin/__tests__/color.test.ts`

**Step 1: Write the failing test**

```typescript
// plugin/__tests__/color.test.ts
import { describe, it, expect } from "vitest";
import { hexToRgb, rgbToHex } from "../utils/color.js";

describe("hexToRgb", () => {
  it("parses 6-digit hex color", () => {
    const result = hexToRgb("#FF0000");
    expect(result).toEqual({ r: 1, g: 0, b: 0, a: 1 });
  });

  it("parses lowercase hex color", () => {
    const result = hexToRgb("#00ff00");
    expect(result).toEqual({ r: 0, g: 1, b: 0, a: 1 });
  });

  it("parses 8-digit hex color with alpha", () => {
    const result = hexToRgb("#FF000080");
    expect(result.r).toBeCloseTo(1, 2);
    expect(result.g).toBeCloseTo(0, 2);
    expect(result.b).toBeCloseTo(0, 2);
    expect(result.a).toBeCloseTo(0.502, 2);
  });

  it("parses white", () => {
    const result = hexToRgb("#FFFFFF");
    expect(result).toEqual({ r: 1, g: 1, b: 1, a: 1 });
  });

  it("parses black", () => {
    const result = hexToRgb("#000000");
    expect(result).toEqual({ r: 0, g: 0, b: 0, a: 1 });
  });

  it("parses mid-range color", () => {
    const result = hexToRgb("#808080");
    expect(result.r).toBeCloseTo(0.502, 2);
    expect(result.g).toBeCloseTo(0.502, 2);
    expect(result.b).toBeCloseTo(0.502, 2);
    expect(result.a).toBe(1);
  });

  it("handles hex without # prefix", () => {
    const result = hexToRgb("FF0000");
    expect(result).toEqual({ r: 1, g: 0, b: 0, a: 1 });
  });

  it("throws on invalid hex", () => {
    expect(() => hexToRgb("#GG0000")).toThrow("Invalid hex color");
    expect(() => hexToRgb("#FFF")).toThrow("Invalid hex color");
    expect(() => hexToRgb("")).toThrow("Invalid hex color");
    expect(() => hexToRgb("#12345")).toThrow("Invalid hex color");
  });
});

describe("rgbToHex", () => {
  it("converts red to hex", () => {
    expect(rgbToHex(1, 0, 0)).toBe("#FF0000");
  });

  it("converts green to hex", () => {
    expect(rgbToHex(0, 1, 0)).toBe("#00FF00");
  });

  it("converts blue to hex", () => {
    expect(rgbToHex(0, 0, 1)).toBe("#0000FF");
  });

  it("converts white to hex", () => {
    expect(rgbToHex(1, 1, 1)).toBe("#FFFFFF");
  });

  it("converts black to hex", () => {
    expect(rgbToHex(0, 0, 0)).toBe("#000000");
  });

  it("converts mid-range values", () => {
    expect(rgbToHex(0.5, 0.5, 0.5)).toBe("#808080");
  });

  it("clamps values above 1", () => {
    expect(rgbToHex(1.5, 0, 0)).toBe("#FF0000");
  });

  it("clamps values below 0", () => {
    expect(rgbToHex(-0.5, 0, 0)).toBe("#000000");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run plugin/__tests__/color.test.ts`
Expected: FAIL — module not found

**Step 3: Write the implementation**

```typescript
// plugin/utils/color.ts

/**
 * Parse a hex color string into Figma-compatible RGB values (0-1 range).
 * Accepts 6-digit (#RRGGBB) or 8-digit (#RRGGBBAA) hex strings.
 * The # prefix is optional.
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number; a: number } {
  // Strip # prefix if present
  let cleaned = hex.startsWith("#") ? hex.slice(1) : hex;

  // Validate
  if (!/^[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$/.test(cleaned)) {
    throw new Error(
      `Invalid hex color "${hex}". Expected format: #RRGGBB or #RRGGBBAA (e.g., #FF0000 or #FF000080).`
    );
  }

  const r = parseInt(cleaned.slice(0, 2), 16) / 255;
  const g = parseInt(cleaned.slice(2, 4), 16) / 255;
  const b = parseInt(cleaned.slice(4, 6), 16) / 255;
  const a = cleaned.length === 8 ? parseInt(cleaned.slice(6, 8), 16) / 255 : 1;

  return { r, g, b, a };
}

/**
 * Convert Figma RGB values (0-1 range) to a hex color string.
 * Returns uppercase 6-digit hex with # prefix.
 */
export function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(1, v));
  const toHex = (v: number) =>
    Math.round(clamp(v) * 255)
      .toString(16)
      .toUpperCase()
      .padStart(2, "0");

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Create a Figma SolidPaint from a hex color string.
 */
export function hexToSolidPaint(hex: string): { type: "SOLID"; color: { r: number; g: number; b: number }; opacity: number } {
  const { r, g, b, a } = hexToRgb(hex);
  return {
    type: "SOLID",
    color: { r, g, b },
    opacity: a,
  };
}

/**
 * Parse gradient stops from the command format into Figma gradient stops.
 * Each stop: { color: "#RRGGBB", position: 0-1 }
 */
export function parseGradientStops(
  stops: { color: string; position: number }[]
): { color: { r: number; g: number; b: number; a: number }; position: number }[] {
  if (!stops || stops.length < 2) {
    throw new Error("Gradient requires at least 2 color stops.");
  }

  return stops.map((stop) => {
    if (stop.position < 0 || stop.position > 1) {
      throw new Error(
        `Gradient stop position must be between 0 and 1. Got: ${stop.position}`
      );
    }
    const { r, g, b, a } = hexToRgb(stop.color);
    return {
      color: { r, g, b, a },
      position: stop.position,
    };
  });
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run plugin/__tests__/color.test.ts`
Expected: All 16 tests PASS

**Step 5: Commit**

```bash
git add plugin/utils/color.ts plugin/__tests__/color.test.ts
git commit -m "feat: add hex-to-RGB color utility with parsing, conversion, and gradient support"
```

---

## Task 2: Styling Executors — set_fill

**Files:**
- Create: `plugin/executors/styling.ts`
- Create: `plugin/__tests__/styling.test.ts`

**Step 1: Write the failing test**

```typescript
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
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run plugin/__tests__/styling.test.ts`
Expected: FAIL — module not found

**Step 3: Write the implementation**

```typescript
// plugin/executors/styling.ts
import { hexToRgb, hexToSolidPaint, parseGradientStops } from "../utils/color.js";

// ============================================================
// Types
// ============================================================

interface CommandResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

interface GradientInput {
  stops: { color: string; position: number }[];
  transform?: number[][];
}

interface EffectInput {
  type: string;
  color?: string;
  offset?: { x: number; y: number };
  radius?: number;
  spread?: number;
  visible?: boolean;
}

// ============================================================
// Constants
// ============================================================

const VALID_BLEND_MODES = [
  "NORMAL",
  "DARKEN",
  "MULTIPLY",
  "LINEAR_BURN",
  "COLOR_BURN",
  "LIGHTEN",
  "SCREEN",
  "LINEAR_DODGE",
  "COLOR_DODGE",
  "OVERLAY",
  "SOFT_LIGHT",
  "HARD_LIGHT",
  "DIFFERENCE",
  "EXCLUSION",
  "HUE",
  "SATURATION",
  "COLOR",
  "LUMINOSITY",
];

const VALID_CONSTRAINTS = ["MIN", "CENTER", "MAX", "STRETCH", "SCALE"];

const VALID_STROKE_ALIGNS = ["INSIDE", "OUTSIDE", "CENTER"];

const VALID_EFFECT_TYPES = ["DROP_SHADOW", "INNER_SHADOW", "LAYER_BLUR", "BACKGROUND_BLUR"];

const VALID_STYLE_TYPES = ["fill", "stroke", "text", "effect", "grid"];

const VALID_FILL_TYPES = [
  "SOLID",
  "GRADIENT_LINEAR",
  "GRADIENT_RADIAL",
  "GRADIENT_ANGULAR",
  "GRADIENT_DIAMOND",
  "IMAGE",
];

// ============================================================
// Main Dispatcher
// ============================================================

export async function executeStylingCommand(
  command: string,
  params: Record<string, unknown>
): Promise<CommandResult> {
  switch (command) {
    case "set_fill":
      return executeSetFill(params);
    case "set_stroke":
      return executeSetStroke(params);
    case "set_corner_radius":
      return executeSetCornerRadius(params);
    case "set_opacity":
      return executeSetOpacity(params);
    case "set_effects":
      return executeSetEffects(params);
    case "set_blend_mode":
      return executeSetBlendMode(params);
    case "set_constraints":
      return executeSetConstraints(params);
    case "apply_style":
      return executeApplyStyle(params);
    default:
      return { success: false, error: `Unknown styling command: '${command}'` };
  }
}

// ============================================================
// Helpers
// ============================================================

function getNode(nodeId: unknown): { node: SceneNode; error?: string } | { node: null; error: string } {
  if (!nodeId || typeof nodeId !== "string") {
    return { node: null, error: "Missing required parameter 'nodeId' (string, e.g. '1:2')." };
  }

  const node = figma.getNodeById(nodeId as string);
  if (!node) {
    return { node: null, error: `Node '${nodeId}' not found. Verify the node ID exists in the current file.` };
  }

  return { node: node as SceneNode };
}

// Default gradient transform: top-left to bottom-right
const DEFAULT_GRADIENT_TRANSFORM: Transform = [
  [1, 0, 0],
  [0, 1, 0],
];

// ============================================================
// set_fill
// ============================================================

function executeSetFill(params: Record<string, unknown>): CommandResult {
  const { node, error } = getNode(params.nodeId);
  if (!node) return { success: false, error };

  const type = params.type as string | undefined;
  if (!type) {
    return {
      success: false,
      error: `Missing required parameter 'type'. Must be one of: ${VALID_FILL_TYPES.join(", ")}.`,
    };
  }

  if (!VALID_FILL_TYPES.includes(type)) {
    return {
      success: false,
      error: `Invalid fill type '${type}'. Must be one of: ${VALID_FILL_TYPES.join(", ")}.`,
    };
  }

  if (!("fills" in node)) {
    return {
      success: false,
      error: `Node '${params.nodeId}' (type: ${node.type}) does not support fills. Use a FRAME, RECTANGLE, ELLIPSE, POLYGON, STAR, VECTOR, or TEXT node.`,
    };
  }

  try {
    if (type === "SOLID") {
      if (!params.color) {
        return {
          success: false,
          error: "Missing required parameter 'color' for SOLID fill. Provide a hex color string (e.g., '#FF0000').",
        };
      }
      const paint = hexToSolidPaint(params.color as string);
      (node as GeometryMixin).fills = [paint as Paint];
    } else if (type.startsWith("GRADIENT_")) {
      const gradientInput = params.gradient as GradientInput | undefined;
      if (!gradientInput || !gradientInput.stops) {
        return {
          success: false,
          error: `Missing required parameter 'gradient' with 'stops' array for ${type} fill. Example: { stops: [{ color: "#FF0000", position: 0 }, { color: "#0000FF", position: 1 }] }`,
        };
      }

      const gradientStops = parseGradientStops(gradientInput.stops);
      const figmaStops = gradientStops.map((stop) => ({
        color: stop.color,
        position: stop.position,
      }));

      const transform: Transform = gradientInput.transform
        ? (gradientInput.transform as unknown as Transform)
        : DEFAULT_GRADIENT_TRANSFORM;

      const gradientPaint = {
        type,
        gradientStops: figmaStops,
        gradientTransform: transform,
      };

      (node as GeometryMixin).fills = [gradientPaint as Paint];
    } else if (type === "IMAGE") {
      // IMAGE fills require set_image_fill (Phase 5)
      return {
        success: false,
        error: "IMAGE fills should be set using the 'set_image_fill' command (available in Phase 5). Use set_fill for SOLID or GRADIENT types.",
      };
    }

    return {
      success: true,
      data: {
        nodeId: node.id,
        fillType: type,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: `Failed to set fill: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}

// ============================================================
// set_stroke
// ============================================================

function executeSetStroke(params: Record<string, unknown>): CommandResult {
  const { node, error } = getNode(params.nodeId);
  if (!node) return { success: false, error };

  if (!params.color || typeof params.color !== "string") {
    return {
      success: false,
      error: "Missing required parameter 'color' (hex string, e.g. '#0000FF').",
    };
  }

  if (params.alignment && !VALID_STROKE_ALIGNS.includes(params.alignment as string)) {
    return {
      success: false,
      error: `Invalid stroke alignment '${params.alignment}'. Must be one of: ${VALID_STROKE_ALIGNS.join(", ")}.`,
    };
  }

  if (!("strokes" in node)) {
    return {
      success: false,
      error: `Node '${params.nodeId}' (type: ${node.type}) does not support strokes.`,
    };
  }

  try {
    const paint = hexToSolidPaint(params.color as string);
    (node as GeometryMixin).strokes = [paint as Paint];

    const weight = typeof params.weight === "number" ? params.weight : 1;
    (node as GeometryMixin).strokeWeight = weight;

    if (params.alignment) {
      (node as GeometryMixin).strokeAlign = params.alignment as "INSIDE" | "OUTSIDE" | "CENTER";
    }

    if (params.dashPattern && Array.isArray(params.dashPattern)) {
      (node as GeometryMixin).dashPattern = params.dashPattern as number[];
    }

    return {
      success: true,
      data: {
        nodeId: node.id,
        strokeColor: params.color,
        strokeWeight: weight,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: `Failed to set stroke: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}

// ============================================================
// set_corner_radius
// ============================================================

function executeSetCornerRadius(params: Record<string, unknown>): CommandResult {
  const { node, error } = getNode(params.nodeId);
  if (!node) return { success: false, error };

  const hasUniformRadius = typeof params.radius === "number";
  const hasIndividualRadius =
    typeof params.topLeft === "number" ||
    typeof params.topRight === "number" ||
    typeof params.bottomLeft === "number" ||
    typeof params.bottomRight === "number";

  if (!hasUniformRadius && !hasIndividualRadius) {
    return {
      success: false,
      error: "Provide either 'radius' for uniform corners, or individual values: 'topLeft', 'topRight', 'bottomLeft', 'bottomRight'.",
    };
  }

  if (!("cornerRadius" in node)) {
    return {
      success: false,
      error: `Node '${params.nodeId}' (type: ${node.type}) does not support corner radius. Use RECTANGLE, FRAME, or COMPONENT nodes.`,
    };
  }

  if (hasUniformRadius && (params.radius as number) < 0) {
    return {
      success: false,
      error: "Corner radius cannot be negative. Provide a value >= 0.",
    };
  }

  if (hasIndividualRadius) {
    const values = [params.topLeft, params.topRight, params.bottomLeft, params.bottomRight];
    for (const v of values) {
      if (typeof v === "number" && v < 0) {
        return {
          success: false,
          error: "Corner radius cannot be negative. Provide values >= 0.",
        };
      }
    }
  }

  try {
    const cornerNode = node as RectangleNode;

    if (hasUniformRadius) {
      cornerNode.cornerRadius = params.radius as number;
    }

    if (hasIndividualRadius) {
      // When setting individual corners, we need to use the individual properties
      // Setting cornerRadius to figma.mixed first tells Figma we want individual control
      if (typeof params.topLeft === "number") {
        cornerNode.topLeftRadius = params.topLeft as number;
      }
      if (typeof params.topRight === "number") {
        cornerNode.topRightRadius = params.topRight as number;
      }
      if (typeof params.bottomLeft === "number") {
        cornerNode.bottomLeftRadius = params.bottomLeft as number;
      }
      if (typeof params.bottomRight === "number") {
        cornerNode.bottomRightRadius = params.bottomRight as number;
      }
    }

    return {
      success: true,
      data: {
        nodeId: node.id,
        cornerRadius: hasUniformRadius ? params.radius : {
          topLeft: cornerNode.topLeftRadius,
          topRight: cornerNode.topRightRadius,
          bottomLeft: cornerNode.bottomLeftRadius,
          bottomRight: cornerNode.bottomRightRadius,
        },
      },
    };
  } catch (e) {
    return {
      success: false,
      error: `Failed to set corner radius: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}

// ============================================================
// set_opacity
// ============================================================

function executeSetOpacity(params: Record<string, unknown>): CommandResult {
  const { node, error } = getNode(params.nodeId);
  if (!node) return { success: false, error };

  if (typeof params.opacity !== "number") {
    return {
      success: false,
      error: "Missing required parameter 'opacity' (number between 0 and 1).",
    };
  }

  const opacity = params.opacity as number;
  if (opacity < 0 || opacity > 1) {
    return {
      success: false,
      error: `Opacity must be between 0 and 1. Got: ${opacity}.`,
    };
  }

  try {
    (node as SceneNode).opacity = opacity;

    return {
      success: true,
      data: {
        nodeId: node.id,
        opacity,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: `Failed to set opacity: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}

// ============================================================
// set_effects
// ============================================================

function executeSetEffects(params: Record<string, unknown>): CommandResult {
  const { node, error } = getNode(params.nodeId);
  if (!node) return { success: false, error };

  if (!params.effects || !Array.isArray(params.effects)) {
    return {
      success: false,
      error: "Missing required parameter 'effects' (array of effect objects). Example: [{ type: 'DROP_SHADOW', color: '#00000040', offset: { x: 0, y: 4 }, radius: 8 }]",
    };
  }

  if (!("effects" in node)) {
    return {
      success: false,
      error: `Node '${params.nodeId}' (type: ${node.type}) does not support effects.`,
    };
  }

  const effectInputs = params.effects as EffectInput[];

  try {
    const figmaEffects: Effect[] = effectInputs.map((input) => {
      if (!VALID_EFFECT_TYPES.includes(input.type)) {
        throw new Error(
          `Invalid effect type '${input.type}'. Must be one of: ${VALID_EFFECT_TYPES.join(", ")}.`
        );
      }

      const visible = input.visible !== undefined ? input.visible : true;

      if (input.type === "DROP_SHADOW" || input.type === "INNER_SHADOW") {
        const colorHex = input.color || "#00000040";
        const { r, g, b, a } = hexToRgb(colorHex);
        const offset = input.offset || { x: 0, y: 4 };
        const radius = input.radius || 0;
        const spread = input.spread || 0;

        return {
          type: input.type,
          color: { r, g, b, a },
          offset: { x: offset.x, y: offset.y },
          radius,
          spread,
          visible,
        } as Effect;
      }

      if (input.type === "LAYER_BLUR" || input.type === "BACKGROUND_BLUR") {
        const radius = input.radius || 0;

        return {
          type: input.type,
          radius,
          visible,
        } as Effect;
      }

      throw new Error(`Unhandled effect type: ${input.type}`);
    });

    (node as BlendMixin).effects = figmaEffects;

    return {
      success: true,
      data: {
        nodeId: node.id,
        effectCount: figmaEffects.length,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: `Failed to set effects: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}

// ============================================================
// set_blend_mode
// ============================================================

function executeSetBlendMode(params: Record<string, unknown>): CommandResult {
  const { node, error } = getNode(params.nodeId);
  if (!node) return { success: false, error };

  if (!params.blendMode || typeof params.blendMode !== "string") {
    return {
      success: false,
      error: `Missing required parameter 'blendMode'. Must be one of: ${VALID_BLEND_MODES.join(", ")}.`,
    };
  }

  if (!VALID_BLEND_MODES.includes(params.blendMode as string)) {
    return {
      success: false,
      error: `Invalid blendMode '${params.blendMode}'. Must be one of: ${VALID_BLEND_MODES.join(", ")}.`,
    };
  }

  if (!("blendMode" in node)) {
    return {
      success: false,
      error: `Node '${params.nodeId}' (type: ${node.type}) does not support blend modes.`,
    };
  }

  try {
    (node as BlendMixin).blendMode = params.blendMode as BlendMode;

    return {
      success: true,
      data: {
        nodeId: node.id,
        blendMode: params.blendMode,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: `Failed to set blend mode: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}

// ============================================================
// set_constraints
// ============================================================

function executeSetConstraints(params: Record<string, unknown>): CommandResult {
  const { node, error } = getNode(params.nodeId);
  if (!node) return { success: false, error };

  const horizontal = params.horizontal as string | undefined;
  const vertical = params.vertical as string | undefined;

  if (!horizontal && !vertical) {
    return {
      success: false,
      error: `Provide at least one of 'horizontal' or 'vertical'. Valid values: ${VALID_CONSTRAINTS.join(", ")}.`,
    };
  }

  if (horizontal && !VALID_CONSTRAINTS.includes(horizontal)) {
    return {
      success: false,
      error: `Invalid horizontal constraint '${horizontal}'. Must be one of: ${VALID_CONSTRAINTS.join(", ")}.`,
    };
  }

  if (vertical && !VALID_CONSTRAINTS.includes(vertical)) {
    return {
      success: false,
      error: `Invalid vertical constraint '${vertical}'. Must be one of: ${VALID_CONSTRAINTS.join(", ")}.`,
    };
  }

  if (!("constraints" in node)) {
    return {
      success: false,
      error: `Node '${params.nodeId}' (type: ${node.type}) does not support constraints. Must be a direct child of a non-auto-layout frame.`,
    };
  }

  try {
    const constraintNode = node as ConstraintMixin;
    const current = constraintNode.constraints;

    constraintNode.constraints = {
      horizontal: (horizontal || current.horizontal) as Constraints["horizontal"],
      vertical: (vertical || current.vertical) as Constraints["vertical"],
    };

    return {
      success: true,
      data: {
        nodeId: node.id,
        constraints: constraintNode.constraints,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: `Failed to set constraints: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}

// ============================================================
// apply_style
// ============================================================

function executeApplyStyle(params: Record<string, unknown>): CommandResult {
  const { node, error } = getNode(params.nodeId);
  if (!node) return { success: false, error };

  if (!params.styleName || typeof params.styleName !== "string") {
    return {
      success: false,
      error: "Missing required parameter 'styleName' (string). Provide the name of the style to apply (e.g., 'Brand/Primary').",
    };
  }

  if (!params.styleType || typeof params.styleType !== "string") {
    return {
      success: false,
      error: `Missing required parameter 'styleType'. Must be one of: ${VALID_STYLE_TYPES.join(", ")}.`,
    };
  }

  if (!VALID_STYLE_TYPES.includes(params.styleType as string)) {
    return {
      success: false,
      error: `Invalid styleType '${params.styleType}'. Must be one of: ${VALID_STYLE_TYPES.join(", ")}.`,
    };
  }

  const styleName = params.styleName as string;
  const styleType = params.styleType as string;

  try {
    switch (styleType) {
      case "fill": {
        const styles = figma.getLocalPaintStyles();
        const style = styles.find((s) => s.name === styleName);
        if (!style) {
          return {
            success: false,
            error: `Fill style '${styleName}' not found. Available fill styles: ${styles.map((s) => s.name).join(", ") || "(none)"}`,
          };
        }
        if (!("fillStyleId" in node)) {
          return { success: false, error: `Node '${params.nodeId}' does not support fill styles.` };
        }
        (node as GeometryMixin).fillStyleId = style.id;
        break;
      }
      case "stroke": {
        const styles = figma.getLocalPaintStyles();
        const style = styles.find((s) => s.name === styleName);
        if (!style) {
          return {
            success: false,
            error: `Stroke style '${styleName}' not found. Available paint styles: ${styles.map((s) => s.name).join(", ") || "(none)"}`,
          };
        }
        if (!("strokeStyleId" in node)) {
          return { success: false, error: `Node '${params.nodeId}' does not support stroke styles.` };
        }
        (node as GeometryMixin).strokeStyleId = style.id;
        break;
      }
      case "text": {
        const styles = figma.getLocalTextStyles();
        const style = styles.find((s) => s.name === styleName);
        if (!style) {
          return {
            success: false,
            error: `Text style '${styleName}' not found. Available text styles: ${styles.map((s) => s.name).join(", ") || "(none)"}`,
          };
        }
        if (!("textStyleId" in node)) {
          return { success: false, error: `Node '${params.nodeId}' does not support text styles. Use a TEXT node.` };
        }
        (node as TextNode).textStyleId = style.id;
        break;
      }
      case "effect": {
        const styles = figma.getLocalEffectStyles();
        const style = styles.find((s) => s.name === styleName);
        if (!style) {
          return {
            success: false,
            error: `Effect style '${styleName}' not found. Available effect styles: ${styles.map((s) => s.name).join(", ") || "(none)"}`,
          };
        }
        if (!("effectStyleId" in node)) {
          return { success: false, error: `Node '${params.nodeId}' does not support effect styles.` };
        }
        (node as BlendMixin).effectStyleId = style.id;
        break;
      }
      case "grid": {
        const styles = figma.getLocalGridStyles();
        const style = styles.find((s) => s.name === styleName);
        if (!style) {
          return {
            success: false,
            error: `Grid style '${styleName}' not found. Available grid styles: ${styles.map((s) => s.name).join(", ") || "(none)"}`,
          };
        }
        if (!("gridStyleId" in node)) {
          return { success: false, error: `Node '${params.nodeId}' does not support grid styles. Use a FRAME node.` };
        }
        (node as FrameNode).gridStyleId = style.id;
        break;
      }
    }

    return {
      success: true,
      data: {
        nodeId: node.id,
        styleName,
        styleType,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: `Failed to apply style: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run plugin/__tests__/styling.test.ts`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add plugin/executors/styling.ts plugin/__tests__/styling.test.ts
git commit -m "feat: add 8 styling executors (fill, stroke, corners, opacity, effects, blend mode, constraints, apply style)"
```

---

## Task 3: Layout Executors

**Files:**
- Create: `plugin/executors/layout.ts`
- Create: `plugin/__tests__/layout.test.ts`

**Step 1: Write the failing test**

```typescript
// plugin/__tests__/layout.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// ============================================================
// Mock Figma API
// ============================================================

function createMockFrame(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "1:2",
    type: "FRAME",
    name: "Test Frame",
    layoutMode: "NONE",
    primaryAxisSizingMode: "FIXED",
    counterAxisSizingMode: "FIXED",
    primaryAxisAlignItems: "MIN",
    counterAxisAlignItems: "MIN",
    layoutWrap: "NO_WRAP",
    itemSpacing: 0,
    paddingTop: 0,
    paddingRight: 0,
    paddingBottom: 0,
    paddingLeft: 0,
    layoutGrids: [],
    children: [],
    parent: { id: "0:1", type: "PAGE", children: [] },
    appendChild: vi.fn(),
    insertChild: vi.fn(),
    ...overrides,
  };
}

function createMockNode(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "2:1",
    type: "RECTANGLE",
    name: "Test Node",
    parent: null,
    ...overrides,
  };
}

const mockFigma = {
  getNodeById: vi.fn(),
  group: vi.fn(),
  createFrame: vi.fn(),
  currentPage: {
    id: "0:1",
    type: "PAGE",
    children: [],
    appendChild: vi.fn(),
  },
};

vi.stubGlobal("figma", mockFigma);

import { executeLayoutCommand } from "../executors/layout.js";

describe("Layout Executors", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================
  // set_auto_layout
  // ============================================================

  describe("set_auto_layout", () => {
    it("sets auto-layout direction to VERTICAL", async () => {
      const frame = createMockFrame();
      mockFigma.getNodeById.mockReturnValue(frame);

      const result = await executeLayoutCommand("set_auto_layout", {
        nodeId: "1:2",
        direction: "VERTICAL",
      });

      expect(result.success).toBe(true);
      expect(frame.layoutMode).toBe("VERTICAL");
    });

    it("sets auto-layout direction to HORIZONTAL", async () => {
      const frame = createMockFrame();
      mockFigma.getNodeById.mockReturnValue(frame);

      const result = await executeLayoutCommand("set_auto_layout", {
        nodeId: "1:2",
        direction: "HORIZONTAL",
      });

      expect(result.success).toBe(true);
      expect(frame.layoutMode).toBe("HORIZONTAL");
    });

    it("sets spacing", async () => {
      const frame = createMockFrame();
      mockFigma.getNodeById.mockReturnValue(frame);

      const result = await executeLayoutCommand("set_auto_layout", {
        nodeId: "1:2",
        direction: "VERTICAL",
        spacing: 16,
      });

      expect(result.success).toBe(true);
      expect(frame.itemSpacing).toBe(16);
    });

    it("sets padding", async () => {
      const frame = createMockFrame();
      mockFigma.getNodeById.mockReturnValue(frame);

      const result = await executeLayoutCommand("set_auto_layout", {
        nodeId: "1:2",
        direction: "VERTICAL",
        paddingTop: 10,
        paddingRight: 20,
        paddingBottom: 10,
        paddingLeft: 20,
      });

      expect(result.success).toBe(true);
      expect(frame.paddingTop).toBe(10);
      expect(frame.paddingRight).toBe(20);
      expect(frame.paddingBottom).toBe(10);
      expect(frame.paddingLeft).toBe(20);
    });

    it("sets primary and counter axis sizing", async () => {
      const frame = createMockFrame();
      mockFigma.getNodeById.mockReturnValue(frame);

      const result = await executeLayoutCommand("set_auto_layout", {
        nodeId: "1:2",
        direction: "VERTICAL",
        primarySizing: "HUG",
        counterSizing: "FILL",
      });

      expect(result.success).toBe(true);
      expect(frame.primaryAxisSizingMode).toBe("AUTO");
      expect(frame.counterAxisSizingMode).toBe("AUTO");
    });

    it("sets wrap mode", async () => {
      const frame = createMockFrame();
      mockFigma.getNodeById.mockReturnValue(frame);

      const result = await executeLayoutCommand("set_auto_layout", {
        nodeId: "1:2",
        direction: "HORIZONTAL",
        wrap: true,
      });

      expect(result.success).toBe(true);
      expect(frame.layoutWrap).toBe("WRAP");
    });

    it("sets alignment", async () => {
      const frame = createMockFrame();
      mockFigma.getNodeById.mockReturnValue(frame);

      const result = await executeLayoutCommand("set_auto_layout", {
        nodeId: "1:2",
        direction: "VERTICAL",
        alignment: "CENTER",
      });

      expect(result.success).toBe(true);
      expect(frame.counterAxisAlignItems).toBe("CENTER");
    });

    it("errors on non-frame node", async () => {
      const node = createMockNode({ type: "RECTANGLE" });
      mockFigma.getNodeById.mockReturnValue(node);

      const result = await executeLayoutCommand("set_auto_layout", {
        nodeId: "2:1",
        direction: "VERTICAL",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("FRAME");
    });

    it("errors on invalid direction", async () => {
      const frame = createMockFrame();
      mockFigma.getNodeById.mockReturnValue(frame);

      const result = await executeLayoutCommand("set_auto_layout", {
        nodeId: "1:2",
        direction: "DIAGONAL",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("direction");
    });

    it("errors on missing nodeId", async () => {
      const result = await executeLayoutCommand("set_auto_layout", {
        direction: "VERTICAL",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("nodeId");
    });
  });

  // ============================================================
  // add_to_auto_layout
  // ============================================================

  describe("add_to_auto_layout", () => {
    it("adds a child to an auto-layout frame", async () => {
      const child = createMockNode({ id: "3:1" });
      const frame = createMockFrame({
        layoutMode: "VERTICAL",
        children: [],
      });

      mockFigma.getNodeById.mockImplementation((id: string) => {
        if (id === "1:2") return frame;
        if (id === "3:1") return child;
        return null;
      });

      const result = await executeLayoutCommand("add_to_auto_layout", {
        parentId: "1:2",
        childId: "3:1",
      });

      expect(result.success).toBe(true);
      expect(frame.appendChild).toHaveBeenCalledWith(child);
    });

    it("inserts a child at a specific index", async () => {
      const child = createMockNode({ id: "3:1" });
      const frame = createMockFrame({
        layoutMode: "VERTICAL",
        children: [{ id: "4:1" }],
      });

      mockFigma.getNodeById.mockImplementation((id: string) => {
        if (id === "1:2") return frame;
        if (id === "3:1") return child;
        return null;
      });

      const result = await executeLayoutCommand("add_to_auto_layout", {
        parentId: "1:2",
        childId: "3:1",
        index: 0,
      });

      expect(result.success).toBe(true);
      expect(frame.insertChild).toHaveBeenCalledWith(0, child);
    });

    it("errors on missing parentId", async () => {
      const result = await executeLayoutCommand("add_to_auto_layout", {
        childId: "3:1",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("parentId");
    });

    it("errors on missing childId", async () => {
      const result = await executeLayoutCommand("add_to_auto_layout", {
        parentId: "1:2",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("childId");
    });

    it("errors when parent is not found", async () => {
      mockFigma.getNodeById.mockReturnValue(null);

      const result = await executeLayoutCommand("add_to_auto_layout", {
        parentId: "999:999",
        childId: "3:1",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });

    it("errors when child is not found", async () => {
      const frame = createMockFrame();
      mockFigma.getNodeById.mockImplementation((id: string) => {
        if (id === "1:2") return frame;
        return null;
      });

      const result = await executeLayoutCommand("add_to_auto_layout", {
        parentId: "1:2",
        childId: "999:999",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });
  });

  // ============================================================
  // set_layout_grid
  // ============================================================

  describe("set_layout_grid", () => {
    it("sets a column layout grid", async () => {
      const frame = createMockFrame();
      mockFigma.getNodeById.mockReturnValue(frame);

      const result = await executeLayoutCommand("set_layout_grid", {
        nodeId: "1:2",
        grids: [
          {
            pattern: "COLUMNS",
            count: 12,
            gutterSize: 16,
            offset: 0,
            alignment: "STRETCH",
          },
        ],
      });

      expect(result.success).toBe(true);
      const grids = frame.layoutGrids as { pattern: string; count: number }[];
      expect(grids).toHaveLength(1);
      expect(grids[0].pattern).toBe("COLUMNS");
      expect(grids[0].count).toBe(12);
    });

    it("sets a row layout grid", async () => {
      const frame = createMockFrame();
      mockFigma.getNodeById.mockReturnValue(frame);

      const result = await executeLayoutCommand("set_layout_grid", {
        nodeId: "1:2",
        grids: [
          {
            pattern: "ROWS",
            count: 4,
            sectionSize: 100,
          },
        ],
      });

      expect(result.success).toBe(true);
      const grids = frame.layoutGrids as { pattern: string }[];
      expect(grids[0].pattern).toBe("ROWS");
    });

    it("sets a pixel grid", async () => {
      const frame = createMockFrame();
      mockFigma.getNodeById.mockReturnValue(frame);

      const result = await executeLayoutCommand("set_layout_grid", {
        nodeId: "1:2",
        grids: [
          {
            pattern: "GRID",
            sectionSize: 8,
          },
        ],
      });

      expect(result.success).toBe(true);
      const grids = frame.layoutGrids as { pattern: string; sectionSize: number }[];
      expect(grids[0].pattern).toBe("GRID");
      expect(grids[0].sectionSize).toBe(8);
    });

    it("sets multiple grids", async () => {
      const frame = createMockFrame();
      mockFigma.getNodeById.mockReturnValue(frame);

      const result = await executeLayoutCommand("set_layout_grid", {
        nodeId: "1:2",
        grids: [
          { pattern: "COLUMNS", count: 12, gutterSize: 16 },
          { pattern: "ROWS", count: 4, sectionSize: 100 },
        ],
      });

      expect(result.success).toBe(true);
      expect((frame.layoutGrids as unknown[]).length).toBe(2);
    });

    it("errors on missing grids", async () => {
      const frame = createMockFrame();
      mockFigma.getNodeById.mockReturnValue(frame);

      const result = await executeLayoutCommand("set_layout_grid", {
        nodeId: "1:2",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("grids");
    });

    it("errors on invalid pattern", async () => {
      const frame = createMockFrame();
      mockFigma.getNodeById.mockReturnValue(frame);

      const result = await executeLayoutCommand("set_layout_grid", {
        nodeId: "1:2",
        grids: [{ pattern: "INVALID" }],
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("pattern");
    });

    it("errors on non-frame node", async () => {
      const node = createMockNode({ type: "RECTANGLE" });
      mockFigma.getNodeById.mockReturnValue(node);

      const result = await executeLayoutCommand("set_layout_grid", {
        nodeId: "2:1",
        grids: [{ pattern: "COLUMNS", count: 12 }],
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("FRAME");
    });
  });

  // ============================================================
  // group_nodes
  // ============================================================

  describe("group_nodes", () => {
    it("groups nodes into a group", async () => {
      const node1 = createMockNode({ id: "2:1", parent: { id: "0:1", type: "PAGE" } });
      const node2 = createMockNode({ id: "2:2", parent: { id: "0:1", type: "PAGE" } });
      const mockGroup = { id: "5:1", type: "GROUP", name: "Group 1" };

      mockFigma.getNodeById.mockImplementation((id: string) => {
        if (id === "2:1") return node1;
        if (id === "2:2") return node2;
        if (id === "0:1") return mockFigma.currentPage;
        return null;
      });
      mockFigma.group.mockReturnValue(mockGroup);

      const result = await executeLayoutCommand("group_nodes", {
        nodeIds: ["2:1", "2:2"],
        type: "group",
      });

      expect(result.success).toBe(true);
      expect(mockFigma.group).toHaveBeenCalled();
      expect(result.data).toEqual(expect.objectContaining({ nodeId: "5:1" }));
    });

    it("groups nodes into a frame", async () => {
      const node1 = createMockNode({
        id: "2:1",
        x: 10, y: 10, width: 100, height: 50,
        parent: { id: "0:1", type: "PAGE", appendChild: vi.fn() },
      });
      const node2 = createMockNode({
        id: "2:2",
        x: 10, y: 70, width: 100, height: 50,
        parent: { id: "0:1", type: "PAGE", appendChild: vi.fn() },
      });

      const mockFrame = {
        id: "6:1",
        type: "FRAME",
        name: "Frame",
        x: 0, y: 0,
        resize: vi.fn(),
        appendChild: vi.fn(),
      };

      mockFigma.getNodeById.mockImplementation((id: string) => {
        if (id === "2:1") return node1;
        if (id === "2:2") return node2;
        return null;
      });
      mockFigma.createFrame.mockReturnValue(mockFrame);

      const result = await executeLayoutCommand("group_nodes", {
        nodeIds: ["2:1", "2:2"],
        type: "frame",
        name: "Container",
      });

      expect(result.success).toBe(true);
      expect(mockFigma.createFrame).toHaveBeenCalled();
      expect(mockFrame.name).toBe("Container");
    });

    it("errors on less than 2 nodeIds", async () => {
      const result = await executeLayoutCommand("group_nodes", {
        nodeIds: ["2:1"],
        type: "group",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("at least 2");
    });

    it("errors on missing nodeIds", async () => {
      const result = await executeLayoutCommand("group_nodes", {
        type: "group",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("nodeIds");
    });

    it("errors on missing type", async () => {
      const result = await executeLayoutCommand("group_nodes", {
        nodeIds: ["2:1", "2:2"],
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("type");
    });

    it("errors on invalid type", async () => {
      const result = await executeLayoutCommand("group_nodes", {
        nodeIds: ["2:1", "2:2"],
        type: "invalid",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("type");
    });

    it("errors when a node is not found", async () => {
      mockFigma.getNodeById.mockImplementation((id: string) => {
        if (id === "2:1") return createMockNode({ id: "2:1" });
        return null;
      });

      const result = await executeLayoutCommand("group_nodes", {
        nodeIds: ["2:1", "999:999"],
        type: "group",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("999:999");
    });
  });

  // ============================================================
  // ungroup_nodes
  // ============================================================

  describe("ungroup_nodes", () => {
    it("ungroups a group node", async () => {
      const child1 = createMockNode({ id: "3:1" });
      const child2 = createMockNode({ id: "3:2" });
      const parent = {
        id: "0:1",
        type: "PAGE",
        appendChild: vi.fn(),
        insertChild: vi.fn(),
        children: [],
      };
      const group = {
        id: "5:1",
        type: "GROUP",
        name: "Group 1",
        parent,
        children: [child1, child2],
        remove: vi.fn(),
      };

      mockFigma.getNodeById.mockReturnValue(group);

      // Mock parent.children.indexOf to return position
      parent.children = [group] as unknown[];

      const result = await executeLayoutCommand("ungroup_nodes", {
        nodeId: "5:1",
      });

      expect(result.success).toBe(true);
      expect(parent.appendChild).toHaveBeenCalledTimes(2);
      expect(group.remove).toHaveBeenCalled();
    });

    it("ungroups a frame node", async () => {
      const child1 = createMockNode({ id: "3:1" });
      const parent = {
        id: "0:1",
        type: "PAGE",
        appendChild: vi.fn(),
        insertChild: vi.fn(),
        children: [],
      };
      const frame = {
        id: "5:1",
        type: "FRAME",
        name: "Frame 1",
        parent,
        children: [child1],
        remove: vi.fn(),
      };

      mockFigma.getNodeById.mockReturnValue(frame);
      parent.children = [frame] as unknown[];

      const result = await executeLayoutCommand("ungroup_nodes", {
        nodeId: "5:1",
      });

      expect(result.success).toBe(true);
      expect(parent.appendChild).toHaveBeenCalledWith(child1);
      expect(frame.remove).toHaveBeenCalled();
    });

    it("errors on missing nodeId", async () => {
      const result = await executeLayoutCommand("ungroup_nodes", {});

      expect(result.success).toBe(false);
      expect(result.error).toContain("nodeId");
    });

    it("errors when node is not found", async () => {
      mockFigma.getNodeById.mockReturnValue(null);

      const result = await executeLayoutCommand("ungroup_nodes", {
        nodeId: "999:999",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });

    it("errors when node has no children", async () => {
      const node = createMockNode({
        id: "2:1",
        type: "RECTANGLE",
        parent: { id: "0:1", type: "PAGE" },
      });
      mockFigma.getNodeById.mockReturnValue(node);

      const result = await executeLayoutCommand("ungroup_nodes", {
        nodeId: "2:1",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("children");
    });

    it("errors when node has no parent", async () => {
      const group = {
        id: "5:1",
        type: "GROUP",
        parent: null,
        children: [createMockNode()],
        remove: vi.fn(),
      };
      mockFigma.getNodeById.mockReturnValue(group);

      const result = await executeLayoutCommand("ungroup_nodes", {
        nodeId: "5:1",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("parent");
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run plugin/__tests__/layout.test.ts`
Expected: FAIL — module not found

**Step 3: Write the implementation**

```typescript
// plugin/executors/layout.ts
import { hexToRgb } from "../utils/color.js";

// ============================================================
// Types
// ============================================================

interface CommandResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

interface GridInput {
  pattern: string;
  count?: number;
  sectionSize?: number;
  offset?: number;
  gutterSize?: number;
  alignment?: string;
  color?: string;
}

// ============================================================
// Constants
// ============================================================

const VALID_DIRECTIONS = ["HORIZONTAL", "VERTICAL"];
const VALID_SIZING = ["FIXED", "HUG", "FILL"];
const VALID_ALIGN = ["MIN", "CENTER", "MAX", "SPACE_BETWEEN"];
const VALID_GRID_PATTERNS = ["COLUMNS", "ROWS", "GRID"];
const VALID_GRID_ALIGNMENTS = ["MIN", "MAX", "CENTER", "STRETCH"];
const FRAME_LIKE_TYPES = ["FRAME", "COMPONENT", "COMPONENT_SET", "INSTANCE"];

// ============================================================
// Main Dispatcher
// ============================================================

export async function executeLayoutCommand(
  command: string,
  params: Record<string, unknown>
): Promise<CommandResult> {
  switch (command) {
    case "set_auto_layout":
      return executeSetAutoLayout(params);
    case "add_to_auto_layout":
      return executeAddToAutoLayout(params);
    case "set_layout_grid":
      return executeSetLayoutGrid(params);
    case "group_nodes":
      return executeGroupNodes(params);
    case "ungroup_nodes":
      return executeUngroupNodes(params);
    default:
      return { success: false, error: `Unknown layout command: '${command}'` };
  }
}

// ============================================================
// Helpers
// ============================================================

function getNode(nodeId: unknown): { node: SceneNode; error?: string } | { node: null; error: string } {
  if (!nodeId || typeof nodeId !== "string") {
    return { node: null, error: "Missing required parameter 'nodeId' (string, e.g. '1:2')." };
  }

  const node = figma.getNodeById(nodeId as string);
  if (!node) {
    return { node: null, error: `Node '${nodeId}' not found. Verify the node ID exists in the current file.` };
  }

  return { node: node as SceneNode };
}

function isFrameLike(node: SceneNode): boolean {
  return FRAME_LIKE_TYPES.includes(node.type);
}

// ============================================================
// set_auto_layout
// ============================================================

function executeSetAutoLayout(params: Record<string, unknown>): CommandResult {
  const { node, error } = getNode(params.nodeId);
  if (!node) return { success: false, error };

  if (!isFrameLike(node)) {
    return {
      success: false,
      error: `Node '${params.nodeId}' is type '${node.type}'. Auto-layout can only be set on FRAME, COMPONENT, or INSTANCE nodes. Convert to a frame first using 'group_nodes' with type 'frame'.`,
    };
  }

  const direction = params.direction as string | undefined;
  if (direction && !VALID_DIRECTIONS.includes(direction)) {
    return {
      success: false,
      error: `Invalid direction '${direction}'. Must be one of: ${VALID_DIRECTIONS.join(", ")}.`,
    };
  }

  const frame = node as FrameNode;

  try {
    // Set direction (also enables auto-layout if currently NONE)
    if (direction) {
      frame.layoutMode = direction as "HORIZONTAL" | "VERTICAL";
    } else if (frame.layoutMode === "NONE") {
      // If no direction specified and not already auto-layout, default to VERTICAL
      frame.layoutMode = "VERTICAL";
    }

    // Spacing
    if (typeof params.spacing === "number") {
      frame.itemSpacing = params.spacing as number;
    }

    // Padding
    if (typeof params.paddingTop === "number") {
      frame.paddingTop = params.paddingTop as number;
    }
    if (typeof params.paddingRight === "number") {
      frame.paddingRight = params.paddingRight as number;
    }
    if (typeof params.paddingBottom === "number") {
      frame.paddingBottom = params.paddingBottom as number;
    }
    if (typeof params.paddingLeft === "number") {
      frame.paddingLeft = params.paddingLeft as number;
    }

    // Primary axis sizing: HUG → AUTO, FIXED → FIXED, FILL → FIXED (FILL is for children)
    if (params.primarySizing) {
      const sizing = params.primarySizing as string;
      if (!VALID_SIZING.includes(sizing)) {
        return {
          success: false,
          error: `Invalid primarySizing '${sizing}'. Must be one of: ${VALID_SIZING.join(", ")}.`,
        };
      }
      frame.primaryAxisSizingMode = sizing === "HUG" ? "AUTO" : "FIXED";
    }

    // Counter axis sizing
    if (params.counterSizing) {
      const sizing = params.counterSizing as string;
      if (!VALID_SIZING.includes(sizing)) {
        return {
          success: false,
          error: `Invalid counterSizing '${sizing}'. Must be one of: ${VALID_SIZING.join(", ")}.`,
        };
      }
      frame.counterAxisSizingMode = sizing === "HUG" ? "AUTO" : "FIXED";
    }

    // Alignment (maps to counter axis alignment for simplicity)
    if (params.alignment) {
      const alignment = params.alignment as string;
      if (!VALID_ALIGN.includes(alignment)) {
        return {
          success: false,
          error: `Invalid alignment '${alignment}'. Must be one of: ${VALID_ALIGN.join(", ")}.`,
        };
      }
      frame.counterAxisAlignItems = alignment as "MIN" | "CENTER" | "MAX";
    }

    // Wrap
    if (typeof params.wrap === "boolean") {
      frame.layoutWrap = params.wrap ? "WRAP" : "NO_WRAP";
    }

    return {
      success: true,
      data: {
        nodeId: node.id,
        layoutMode: frame.layoutMode,
        itemSpacing: frame.itemSpacing,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: `Failed to set auto-layout: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}

// ============================================================
// add_to_auto_layout
// ============================================================

function executeAddToAutoLayout(params: Record<string, unknown>): CommandResult {
  if (!params.parentId || typeof params.parentId !== "string") {
    return {
      success: false,
      error: "Missing required parameter 'parentId' (string). The ID of the auto-layout frame to add the child to.",
    };
  }

  if (!params.childId || typeof params.childId !== "string") {
    return {
      success: false,
      error: "Missing required parameter 'childId' (string). The ID of the node to add to the auto-layout frame.",
    };
  }

  const parent = figma.getNodeById(params.parentId as string);
  if (!parent) {
    return {
      success: false,
      error: `Parent node '${params.parentId}' not found. Verify the node ID exists in the current file.`,
    };
  }

  const child = figma.getNodeById(params.childId as string);
  if (!child) {
    return {
      success: false,
      error: `Child node '${params.childId}' not found. Verify the node ID exists in the current file.`,
    };
  }

  if (!("appendChild" in parent)) {
    return {
      success: false,
      error: `Parent node '${params.parentId}' (type: ${parent.type}) cannot contain children. Use a FRAME or GROUP node.`,
    };
  }

  try {
    const parentNode = parent as FrameNode;

    if (typeof params.index === "number") {
      parentNode.insertChild(params.index as number, child as SceneNode);
    } else {
      parentNode.appendChild(child as SceneNode);
    }

    return {
      success: true,
      data: {
        parentId: parent.id,
        childId: child.id,
        index: params.index ?? "end",
      },
    };
  } catch (e) {
    return {
      success: false,
      error: `Failed to add to auto-layout: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}

// ============================================================
// set_layout_grid
// ============================================================

function executeSetLayoutGrid(params: Record<string, unknown>): CommandResult {
  const { node, error } = getNode(params.nodeId);
  if (!node) return { success: false, error };

  if (!isFrameLike(node)) {
    return {
      success: false,
      error: `Node '${params.nodeId}' is type '${node.type}'. Layout grids can only be set on FRAME, COMPONENT, or INSTANCE nodes.`,
    };
  }

  if (!params.grids || !Array.isArray(params.grids)) {
    return {
      success: false,
      error: "Missing required parameter 'grids' (array of grid objects). Example: [{ pattern: 'COLUMNS', count: 12, gutterSize: 16 }]",
    };
  }

  const gridInputs = params.grids as GridInput[];

  try {
    const figmaGrids: LayoutGrid[] = gridInputs.map((input) => {
      if (!VALID_GRID_PATTERNS.includes(input.pattern)) {
        throw new Error(
          `Invalid grid pattern '${input.pattern}'. Must be one of: ${VALID_GRID_PATTERNS.join(", ")}.`
        );
      }

      const color = input.color
        ? { ...hexToRgb(input.color) }
        : { r: 1, g: 0, b: 0, a: 0.1 };

      if (input.pattern === "GRID") {
        return {
          pattern: "GRID",
          sectionSize: input.sectionSize || 8,
          visible: true,
          color,
        } as LayoutGrid;
      }

      // COLUMNS or ROWS
      const alignment = input.alignment || "STRETCH";
      if (!VALID_GRID_ALIGNMENTS.includes(alignment)) {
        throw new Error(
          `Invalid grid alignment '${alignment}'. Must be one of: ${VALID_GRID_ALIGNMENTS.join(", ")}.`
        );
      }

      return {
        pattern: input.pattern,
        alignment: alignment as "MIN" | "MAX" | "CENTER" | "STRETCH",
        gutterSize: input.gutterSize || 0,
        count: input.count || 1,
        sectionSize: input.sectionSize || 0,
        offset: input.offset || 0,
        visible: true,
        color,
      } as LayoutGrid;
    });

    (node as FrameNode).layoutGrids = figmaGrids;

    return {
      success: true,
      data: {
        nodeId: node.id,
        gridCount: figmaGrids.length,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: `Failed to set layout grid: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}

// ============================================================
// group_nodes
// ============================================================

function executeGroupNodes(params: Record<string, unknown>): CommandResult {
  if (!params.nodeIds || !Array.isArray(params.nodeIds)) {
    return {
      success: false,
      error: "Missing required parameter 'nodeIds' (array of strings). Provide at least 2 node IDs to group.",
    };
  }

  const nodeIds = params.nodeIds as string[];

  if (nodeIds.length < 2) {
    return {
      success: false,
      error: "Grouping requires at least 2 nodes. Provide 2 or more node IDs.",
    };
  }

  const groupType = params.type as string | undefined;
  if (!groupType || (groupType !== "group" && groupType !== "frame")) {
    return {
      success: false,
      error: `Missing or invalid 'type'. Must be 'group' or 'frame'.`,
    };
  }

  // Resolve all nodes
  const nodes: SceneNode[] = [];
  for (const id of nodeIds) {
    const node = figma.getNodeById(id);
    if (!node) {
      return {
        success: false,
        error: `Node '${id}' not found. All nodes must exist in the current file.`,
      };
    }
    nodes.push(node as SceneNode);
  }

  // All nodes must share the same parent
  const firstParent = nodes[0].parent;
  if (!firstParent) {
    return {
      success: false,
      error: `Node '${nodeIds[0]}' has no parent. Cannot group root-level nodes.`,
    };
  }

  try {
    if (groupType === "group") {
      const group = figma.group(nodes, firstParent as BaseNode & ChildrenMixin);
      if (params.name && typeof params.name === "string") {
        group.name = params.name as string;
      }
      return {
        success: true,
        data: {
          nodeId: group.id,
          type: "GROUP",
          name: group.name,
          childCount: nodes.length,
        },
      };
    }

    // Frame mode: create a frame, position it to encompass all nodes, reparent
    const frame = figma.createFrame();
    frame.name = (params.name as string) || "Frame";

    // Calculate bounding box of all nodes
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const node of nodes) {
      const n = node as SceneNode & { x: number; y: number; width: number; height: number };
      minX = Math.min(minX, n.x);
      minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x + n.width);
      maxY = Math.max(maxY, n.y + n.height);
    }

    frame.x = minX;
    frame.y = minY;
    frame.resize(maxX - minX, maxY - minY);

    // Insert frame at the parent level
    if ("appendChild" in firstParent) {
      (firstParent as FrameNode).appendChild(frame);
    }

    // Reparent children into the frame, adjusting positions
    for (const node of nodes) {
      const n = node as SceneNode & { x: number; y: number };
      n.x -= minX;
      n.y -= minY;
      frame.appendChild(node);
    }

    return {
      success: true,
      data: {
        nodeId: frame.id,
        type: "FRAME",
        name: frame.name,
        childCount: nodes.length,
        bounds: { x: minX, y: minY, width: maxX - minX, height: maxY - minY },
      },
    };
  } catch (e) {
    return {
      success: false,
      error: `Failed to group nodes: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}

// ============================================================
// ungroup_nodes
// ============================================================

function executeUngroupNodes(params: Record<string, unknown>): CommandResult {
  const { node, error } = getNode(params.nodeId);
  if (!node) return { success: false, error };

  if (!("children" in node)) {
    return {
      success: false,
      error: `Node '${params.nodeId}' (type: ${node.type}) has no children and cannot be ungrouped. Use a GROUP or FRAME node.`,
    };
  }

  const containerNode = node as FrameNode | GroupNode;

  if (!containerNode.parent) {
    return {
      success: false,
      error: `Node '${params.nodeId}' has no parent. Cannot ungroup a root-level node.`,
    };
  }

  try {
    const parent = containerNode.parent as BaseNode & ChildrenMixin;
    const children = [...containerNode.children]; // Copy to avoid mutation during iteration

    // Move all children to the parent
    for (const child of children) {
      // Adjust position relative to the container's position in the parent
      if ("x" in containerNode && "x" in child) {
        (child as SceneNode & { x: number; y: number }).x += (containerNode as FrameNode).x;
        (child as SceneNode & { x: number; y: number }).y += (containerNode as FrameNode).y;
      }
      parent.appendChild(child);
    }

    // Remove the now-empty container
    containerNode.remove();

    return {
      success: true,
      data: {
        removedNodeId: params.nodeId,
        childrenMoved: children.map((c) => c.id),
      },
    };
  } catch (e) {
    return {
      success: false,
      error: `Failed to ungroup: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run plugin/__tests__/layout.test.ts`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add plugin/executors/layout.ts plugin/__tests__/layout.test.ts
git commit -m "feat: add 5 layout executors (auto-layout, add child, layout grid, group, ungroup)"
```

---

## Task 4: Wire Executors into Plugin Command Router

**Files:**
- Modify: `plugin/code.ts`

**Step 1: Update the executeCommand function in plugin/code.ts**

Find the `executeCommand` function and replace the stub with the real executor dispatch:

```typescript
// In plugin/code.ts — replace the executeCommand function

// Add these imports at the top of the file (after the type declarations):
// NOTE: Since plugin runs in browser context and is bundled by esbuild,
// these imports will be resolved at build time.

import { executeStylingCommand } from "./executors/styling.js";
import { executeLayoutCommand } from "./executors/layout.js";

// ... (keep all existing code above executeCommand)

async function executeCommand(command: Command): Promise<CommandResponse> {
  const { type, params } = command;

  try {
    let result: { success: boolean; data?: unknown; error?: string };

    // Route to the appropriate executor based on command type
    // Phase 2 executors (reading, layers, text) go here when implemented

    // Phase 3: Styling executors
    if (
      [
        "set_fill",
        "set_stroke",
        "set_corner_radius",
        "set_opacity",
        "set_effects",
        "set_blend_mode",
        "set_constraints",
        "apply_style",
      ].includes(type)
    ) {
      result = await executeStylingCommand(type, params);
    }
    // Phase 3: Layout executors
    else if (
      [
        "set_auto_layout",
        "add_to_auto_layout",
        "set_layout_grid",
        "group_nodes",
        "ungroup_nodes",
      ].includes(type)
    ) {
      result = await executeLayoutCommand(type, params);
    }
    // Not yet implemented
    else {
      result = {
        success: false,
        error: `Command '${type}' is not yet implemented. Available commands: set_fill, set_stroke, set_corner_radius, set_opacity, set_effects, set_blend_mode, set_constraints, apply_style, set_auto_layout, add_to_auto_layout, set_layout_grid, group_nodes, ungroup_nodes.`,
      };
    }

    if (result.success) {
      sendToUI({ type: "commandExecuted", command: type });
    } else {
      sendToUI({ type: "commandError", command: type, error: result.error });
    }

    return {
      id: command.id,
      success: result.success,
      data: result.data,
      error: result.error,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    sendToUI({ type: "commandError", command: type, error: errorMessage });
    return {
      id: command.id,
      success: false,
      error: errorMessage,
    };
  }
}
```

**Step 2: Build the plugin**

Run: `node scripts/build-plugin.js`
Expected: "Plugin built successfully -> plugin/code.js"

**Step 3: Commit**

```bash
git add plugin/code.ts
git commit -m "feat: wire styling and layout executors into plugin command router"
```

---

## Task 5: Integration Test for Styling + Layout

**Files:**
- Create: `test/integration/styling-layout.test.ts`

**Step 1: Write the integration test**

```typescript
// test/integration/styling-layout.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { WebSocketManager } from "../../src/server/websocket.js";
import { FigmaMcpServer } from "../../src/server/mcp.js";
import WebSocket from "ws";

/**
 * Integration test: Verifies that styling and layout commands flow
 * correctly from the MCP server through WebSocket to a simulated plugin.
 *
 * The simulated plugin echoes back success responses to verify the
 * routing chain works end-to-end.
 */
describe("Integration: Styling + Layout command flow", () => {
  let wsManager: WebSocketManager;
  let mcpServer: FigmaMcpServer;
  let client: WebSocket;

  beforeEach(async () => {
    wsManager = new WebSocketManager();
    await wsManager.start(0);
    mcpServer = new FigmaMcpServer(wsManager);

    // Connect a mock plugin
    client = new WebSocket(`ws://localhost:${wsManager.port}`);
    await new Promise<void>((resolve) => client.on("open", resolve));

    // Handshake
    client.send(
      JSON.stringify({
        type: "handshake",
        fileInfo: { name: "Style Test File", id: "style-test", pages: [], nodeCount: 50 },
      })
    );
    await new Promise<void>((resolve) => {
      client.on("message", (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === "handshake_ack") resolve();
      });
    });

    // Plugin: echo all commands as success
    client.on("message", (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === "command") {
        client.send(
          JSON.stringify({
            type: "response",
            payload: {
              id: msg.payload.id,
              success: true,
              data: { nodeId: "1:2", command: msg.payload.type },
            },
          })
        );
      }
    });
  });

  afterEach(async () => {
    client.close();
    await wsManager.close();
  });

  // Styling commands
  const stylingCommands = [
    { command: "set_fill", params: { nodeId: "1:2", type: "SOLID", color: "#FF0000" } },
    { command: "set_stroke", params: { nodeId: "1:2", color: "#0000FF", weight: 2 } },
    { command: "set_corner_radius", params: { nodeId: "1:2", radius: 8 } },
    { command: "set_opacity", params: { nodeId: "1:2", opacity: 0.5 } },
    { command: "set_effects", params: { nodeId: "1:2", effects: [{ type: "DROP_SHADOW", radius: 8 }] } },
    { command: "set_blend_mode", params: { nodeId: "1:2", blendMode: "MULTIPLY" } },
    { command: "set_constraints", params: { nodeId: "1:2", horizontal: "CENTER" } },
    { command: "apply_style", params: { nodeId: "1:2", styleName: "Brand/Primary", styleType: "fill" } },
  ];

  for (const { command, params } of stylingCommands) {
    it(`routes ${command} through the styling category`, async () => {
      const queue = mcpServer.getQueue();
      const result = await queue.enqueue(command, params);

      expect(result.success).toBe(true);
      expect((result.data as Record<string, unknown>).command).toBe(command);
    });
  }

  // Layout commands
  const layoutCommands = [
    { command: "set_auto_layout", params: { nodeId: "1:2", direction: "VERTICAL", spacing: 16 } },
    { command: "add_to_auto_layout", params: { parentId: "1:2", childId: "3:1" } },
    { command: "set_layout_grid", params: { nodeId: "1:2", grids: [{ pattern: "COLUMNS", count: 12 }] } },
    { command: "group_nodes", params: { nodeIds: ["1:2", "3:1"], type: "group" } },
    { command: "ungroup_nodes", params: { nodeId: "5:1" } },
  ];

  for (const { command, params } of layoutCommands) {
    it(`routes ${command} through the layout category`, async () => {
      const queue = mcpServer.getQueue();
      const result = await queue.enqueue(command, params);

      expect(result.success).toBe(true);
      expect((result.data as Record<string, unknown>).command).toBe(command);
    });
  }

  it("routes styling commands through the figma_styling category tool", async () => {
    const router = mcpServer.getRouter();

    const result = await router.routeCategoryCommand("styling", "set_fill", {
      nodeId: "1:2",
      type: "SOLID",
      color: "#FF0000",
    });

    expect(result.success).toBe(true);
  });

  it("routes layout commands through the figma_layout category tool", async () => {
    const router = mcpServer.getRouter();

    const result = await router.routeCategoryCommand("layout", "set_auto_layout", {
      nodeId: "1:2",
      direction: "VERTICAL",
    });

    expect(result.success).toBe(true);
  });

  it("rejects styling commands routed to wrong category", async () => {
    const router = mcpServer.getRouter();

    const result = await router.routeCategoryCommand("layout", "set_fill", {
      nodeId: "1:2",
      type: "SOLID",
      color: "#FF0000",
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("does not belong to category");
  });

  it("handles compound operations with styling + layout", async () => {
    const queue = mcpServer.getQueue();

    // Simulate a batch: create frame + set auto-layout + set fill
    const batchResult = await queue.enqueueBatch([
      { type: "set_auto_layout", params: { nodeId: "1:2", direction: "VERTICAL", spacing: 16 } },
      { type: "set_fill", params: { nodeId: "1:2", type: "SOLID", color: "#FFFFFF" } },
      { type: "set_corner_radius", params: { nodeId: "1:2", radius: 12 } },
    ]);

    expect(batchResult.success).toBe(true);
  });
});
```

**Step 2: Run the integration test**

Run: `npx vitest run test/integration/styling-layout.test.ts`
Expected: All tests PASS

**Step 3: Commit**

```bash
git add test/integration/styling-layout.test.ts
git commit -m "test: add integration tests for styling and layout command flow"
```

---

## Task 6: Run All Tests

**Step 1: Run the full test suite**

Run: `npx vitest run`
Expected: All tests pass (color, styling, layout, integration, plus all Phase 1-2 tests)

**Step 2: Run typecheck**

Run: `npx tsc --noEmit --project tsconfig.json`
Expected: No errors

**Step 3: Build plugin**

Run: `node scripts/build-plugin.js`
Expected: "Plugin built successfully -> plugin/code.js"

---

## Phase 3 Complete

At this point you have:
- Color utility (`plugin/utils/color.ts`) with hex-to-RGB, RGB-to-hex, gradient stop parsing
- 8 styling executors (`plugin/executors/styling.ts`):
  - `set_fill` — solid colors, linear/radial/angular/diamond gradients
  - `set_stroke` — color, weight, alignment, dash pattern
  - `set_corner_radius` — uniform or individual corners
  - `set_opacity` — node opacity (0-1)
  - `set_effects` — drop shadow, inner shadow, layer blur, background blur
  - `set_blend_mode` — 18 blend modes
  - `set_constraints` — horizontal and vertical constraints
  - `apply_style` — apply local styles by name (fill, stroke, text, effect, grid)
- 5 layout executors (`plugin/executors/layout.ts`):
  - `set_auto_layout` — direction, spacing, padding, sizing, wrap, alignment
  - `add_to_auto_layout` — insert child at index
  - `set_layout_grid` — columns, rows, pixel grid
  - `group_nodes` — group or frame with bounding box calculation
  - `ungroup_nodes` — reparent children, adjust positions, remove container
- Plugin command router wired to dispatch styling and layout commands
- Full unit test coverage for all 13 executors + color utility
- Integration test for end-to-end command flow

**Next:** Phase 4 — implement component tools (6), page tools (4), and vector tools (3) to make 26 more tools functional.
