// plugin/__tests__/superpower-helpers.test.ts
import { describe, it, expect } from "vitest";
import {
  hexToRgb,
  rgbToLab,
  deltaE,
  hexDeltaE,
  collectNodesInScope,
  extractColorsFromNode,
  isOnGrid,
  contrastRatio,
  relativeLuminance,
} from "../utils/superpower-helpers.js";

// ---- Mock Figma API ----
const mockTextNode = (overrides: Record<string, unknown> = {}) => ({
  type: "TEXT",
  id: "10:1",
  name: "Label",
  characters: "Hello",
  fontSize: 14,
  fills: [{ type: "SOLID", color: { r: 0, g: 0, b: 0 }, visible: true }],
  strokes: [],
  children: undefined,
  ...overrides,
});

const mockFrameNode = (overrides: Record<string, unknown> = {}) => ({
  type: "FRAME",
  id: "20:1",
  name: "Card",
  fills: [{ type: "SOLID", color: { r: 1, g: 1, b: 1 }, visible: true }],
  strokes: [],
  children: [],
  ...overrides,
});

describe("Color Utilities", () => {
  describe("hexToRgb", () => {
    it("parses 6-digit hex", () => {
      expect(hexToRgb("#FF0000")).toEqual({ r: 1, g: 0, b: 0 });
    });

    it("parses 8-digit hex (with alpha)", () => {
      const result = hexToRgb("#FF000080");
      expect(result.r).toBeCloseTo(1);
      expect(result.a).toBeCloseTo(0.502, 1);
    });

    it("handles lowercase", () => {
      expect(hexToRgb("#00ff00")).toEqual({ r: 0, g: 1, b: 0 });
    });
  });

  describe("deltaE (CIE76)", () => {
    it("returns 0 for identical colors", () => {
      expect(deltaE({ r: 1, g: 0, b: 0 }, { r: 1, g: 0, b: 0 })).toBeCloseTo(0, 0);
    });

    it("returns high value for very different colors", () => {
      const d = deltaE({ r: 1, g: 0, b: 0 }, { r: 0, g: 0, b: 1 });
      expect(d).toBeGreaterThan(100);
    });

    it("returns low value for similar colors", () => {
      const d = hexDeltaE("#3B82F6", "#3B80F0");
      expect(d).toBeLessThan(5);
    });
  });

  describe("contrastRatio", () => {
    it("returns 21 for black on white", () => {
      const ratio = contrastRatio({ r: 0, g: 0, b: 0 }, { r: 1, g: 1, b: 1 });
      expect(ratio).toBeCloseTo(21, 0);
    });

    it("returns 1 for same color", () => {
      const ratio = contrastRatio({ r: 0.5, g: 0.5, b: 0.5 }, { r: 0.5, g: 0.5, b: 0.5 });
      expect(ratio).toBeCloseTo(1, 0);
    });

    it("returns correct ratio for blue on white", () => {
      const ratio = contrastRatio({ r: 0, g: 0, b: 1 }, { r: 1, g: 1, b: 1 });
      expect(ratio).toBeGreaterThan(1);
      expect(ratio).toBeLessThan(10);
    });
  });

  describe("relativeLuminance", () => {
    it("returns 0 for black", () => {
      expect(relativeLuminance({ r: 0, g: 0, b: 0 })).toBeCloseTo(0);
    });

    it("returns 1 for white", () => {
      expect(relativeLuminance({ r: 1, g: 1, b: 1 })).toBeCloseTo(1);
    });
  });
});

describe("isOnGrid", () => {
  it("returns true for value on 8px grid", () => {
    expect(isOnGrid(16, 8)).toBe(true);
    expect(isOnGrid(24, 8)).toBe(true);
  });

  it("returns false for value off 8px grid", () => {
    expect(isOnGrid(13, 8)).toBe(false);
    expect(isOnGrid(7, 8)).toBe(false);
  });

  it("returns true for 0", () => {
    expect(isOnGrid(0, 8)).toBe(true);
  });
});

describe("collectNodesInScope", () => {
  it("returns single node when scope is a node ID", () => {
    const node = mockFrameNode({ id: "5:1" });
    const mockFigma = {
      getNodeById: (id: string) => (id === "5:1" ? node : null),
      currentPage: { children: [] },
      root: { children: [] },
    };
    const result = collectNodesInScope("5:1", mockFigma as unknown as PluginAPI);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("5:1");
  });

  it("returns page children when scope is 'page'", () => {
    const child1 = mockFrameNode({ id: "1:1" });
    const child2 = mockTextNode({ id: "1:2" });
    const mockFigma = {
      currentPage: { children: [child1, child2] },
      root: { children: [] },
    };
    const result = collectNodesInScope("page", mockFigma as unknown as PluginAPI);
    expect(result).toHaveLength(2);
  });
});

describe("extractColorsFromNode", () => {
  it("extracts solid fill colors", () => {
    const node = mockFrameNode({
      fills: [{ type: "SOLID", color: { r: 1, g: 0, b: 0 }, visible: true }],
    });
    const colors = extractColorsFromNode(node as unknown as SceneNode);
    expect(colors).toHaveLength(1);
    expect(colors[0].hex).toBe("#FF0000");
    expect(colors[0].source).toBe("fill");
  });

  it("extracts stroke colors", () => {
    const node = mockFrameNode({
      fills: [],
      strokes: [{ type: "SOLID", color: { r: 0, g: 0, b: 1 }, visible: true }],
    });
    const colors = extractColorsFromNode(node as unknown as SceneNode);
    expect(colors).toHaveLength(1);
    expect(colors[0].hex).toBe("#0000FF");
    expect(colors[0].source).toBe("stroke");
  });

  it("skips invisible fills", () => {
    const node = mockFrameNode({
      fills: [{ type: "SOLID", color: { r: 1, g: 0, b: 0 }, visible: false }],
    });
    const colors = extractColorsFromNode(node as unknown as SceneNode);
    expect(colors).toHaveLength(0);
  });
});
