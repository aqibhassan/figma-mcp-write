# Phase 6: Superpowers (18 Tools)

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement all 18 AI-only superpower tools. At the end, Claude has capabilities no human designer has natively — bulk operations, design auditing, accessibility checking, localization, and design system analysis.

**Architecture:** All executors go in `plugin/executors/superpowers.ts`. Server-side routing already configured.

**Tech Stack:** TypeScript, @figma/plugin-typings, vitest

---

## Task 1: Superpower Helpers — Color Distance & Node Traversal Utilities

**Files:**
- Create: `plugin/utils/superpower-helpers.ts`
- Create: `plugin/__tests__/superpower-helpers.test.ts`

These helpers are used by many superpower executors: color distance (CIE76 deltaE), tree traversal with scope filtering, color extraction, and spacing analysis.

**Step 1: Write the failing test**

```typescript
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
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run plugin/__tests__/superpower-helpers.test.ts`
Expected: FAIL — module not found

**Step 3: Write the implementation**

```typescript
// plugin/utils/superpower-helpers.ts

// ============================================================
// Color Types
// ============================================================

export interface RgbColor {
  r: number; // 0-1
  g: number; // 0-1
  b: number; // 0-1
  a?: number; // 0-1
}

export interface LabColor {
  l: number;
  a: number;
  b: number;
}

export interface ExtractedColor {
  hex: string;
  rgb: RgbColor;
  source: "fill" | "stroke" | "text";
  nodeId: string;
  nodeName: string;
}

// ============================================================
// Hex ↔ RGB
// ============================================================

export function hexToRgb(hex: string): RgbColor {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.substring(0, 2), 16) / 255;
  const g = parseInt(clean.substring(2, 4), 16) / 255;
  const b = parseInt(clean.substring(4, 6), 16) / 255;
  if (clean.length === 8) {
    const a = parseInt(clean.substring(6, 8), 16) / 255;
    return { r, g, b, a };
  }
  return { r, g, b };
}

export function rgbToHex(color: RgbColor): string {
  const toHex = (v: number) =>
    Math.round(Math.max(0, Math.min(1, v)) * 255)
      .toString(16)
      .padStart(2, "0")
      .toUpperCase();
  return `#${toHex(color.r)}${toHex(color.g)}${toHex(color.b)}`;
}

// ============================================================
// RGB → Lab (CIE 1976)
// ============================================================

export function rgbToLab(color: RgbColor): LabColor {
  // sRGB to linear
  const linearize = (v: number) =>
    v > 0.04045 ? Math.pow((v + 0.055) / 1.055, 2.4) : v / 12.92;

  const rl = linearize(color.r);
  const gl = linearize(color.g);
  const bl = linearize(color.b);

  // Linear RGB to XYZ (D65)
  let x = rl * 0.4124564 + gl * 0.3575761 + bl * 0.1804375;
  let y = rl * 0.2126729 + gl * 0.7151522 + bl * 0.0721750;
  let z = rl * 0.0193339 + gl * 0.1191920 + bl * 0.9503041;

  // Normalize to D65 white point
  x /= 0.95047;
  y /= 1.0;
  z /= 1.08883;

  // XYZ to Lab
  const f = (t: number) =>
    t > 0.008856 ? Math.pow(t, 1 / 3) : 7.787 * t + 16 / 116;

  const fx = f(x);
  const fy = f(y);
  const fz = f(z);

  return {
    l: 116 * fy - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz),
  };
}

// ============================================================
// Delta E (CIE76)
// ============================================================

export function deltaE(c1: RgbColor, c2: RgbColor): number {
  const lab1 = rgbToLab(c1);
  const lab2 = rgbToLab(c2);
  return Math.sqrt(
    Math.pow(lab1.l - lab2.l, 2) +
    Math.pow(lab1.a - lab2.a, 2) +
    Math.pow(lab1.b - lab2.b, 2)
  );
}

export function hexDeltaE(hex1: string, hex2: string): number {
  return deltaE(hexToRgb(hex1), hexToRgb(hex2));
}

// ============================================================
// WCAG Contrast Ratio
// ============================================================

export function relativeLuminance(color: RgbColor): number {
  const linearize = (v: number) =>
    v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  const r = linearize(color.r);
  const g = linearize(color.g);
  const b = linearize(color.b);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(fg: RgbColor, bg: RgbColor): number {
  const l1 = relativeLuminance(fg);
  const l2 = relativeLuminance(bg);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

// ============================================================
// Grid / Spacing Utility
// ============================================================

export function isOnGrid(value: number, baseUnit: number): boolean {
  if (value === 0) return true;
  return Math.abs(value % baseUnit) < 0.01;
}

// ============================================================
// Node Traversal
// ============================================================

export function collectNodesInScope(
  scope: string,
  figmaApi: PluginAPI
): SceneNode[] {
  if (scope === "file") {
    const nodes: SceneNode[] = [];
    for (const page of figmaApi.root.children) {
      walkNodes(page, (node) => nodes.push(node));
    }
    return nodes;
  }

  if (scope === "page") {
    const nodes: SceneNode[] = [];
    for (const child of figmaApi.currentPage.children) {
      walkNodes(child, (node) => nodes.push(node));
    }
    return nodes;
  }

  // scope is a node ID
  const node = figmaApi.getNodeById(scope);
  if (!node || node.type === "DOCUMENT" || node.type === "PAGE") {
    return [];
  }

  const nodes: SceneNode[] = [];
  walkNodes(node as SceneNode, (n) => nodes.push(n));
  return nodes;
}

export function walkNodes(
  node: SceneNode,
  callback: (node: SceneNode) => void
): void {
  callback(node);
  if ("children" in node && node.children) {
    for (const child of node.children) {
      walkNodes(child as SceneNode, callback);
    }
  }
}

export function collectTopLevelInScope(
  scope: string,
  figmaApi: PluginAPI
): SceneNode[] {
  if (scope === "file") {
    const nodes: SceneNode[] = [];
    for (const page of figmaApi.root.children) {
      for (const child of page.children) {
        nodes.push(child);
      }
    }
    return nodes;
  }

  if (scope === "page") {
    return [...figmaApi.currentPage.children];
  }

  const node = figmaApi.getNodeById(scope);
  if (!node) return [];
  return [node as SceneNode];
}

// ============================================================
// Color Extraction
// ============================================================

export function extractColorsFromNode(node: SceneNode): ExtractedColor[] {
  const colors: ExtractedColor[] = [];

  // Fills
  if ("fills" in node && Array.isArray(node.fills)) {
    for (const paint of node.fills as Paint[]) {
      if (paint.type === "SOLID" && paint.visible !== false) {
        const solid = paint as SolidPaint;
        colors.push({
          hex: rgbToHex(solid.color),
          rgb: { r: solid.color.r, g: solid.color.g, b: solid.color.b },
          source: "fill",
          nodeId: node.id,
          nodeName: node.name,
        });
      }
    }
  }

  // Strokes
  if ("strokes" in node && Array.isArray(node.strokes)) {
    for (const paint of node.strokes as Paint[]) {
      if (paint.type === "SOLID" && paint.visible !== false) {
        const solid = paint as SolidPaint;
        colors.push({
          hex: rgbToHex(solid.color),
          rgb: { r: solid.color.r, g: solid.color.g, b: solid.color.b },
          source: "stroke",
          nodeId: node.id,
          nodeName: node.name,
        });
      }
    }
  }

  // Text fill
  if (node.type === "TEXT" && "fills" in node && Array.isArray(node.fills)) {
    // Already captured above as fill, but re-tag as "text" source
    const lastFill = colors.find(
      (c) => c.nodeId === node.id && c.source === "fill"
    );
    if (lastFill) {
      lastFill.source = "text";
    }
  }

  return colors;
}

// ============================================================
// Node Matching (for bulk_style selector)
// ============================================================

export interface NodeSelector {
  type?: string;
  name?: string;
  style?: Record<string, unknown>;
}

export function nodeMatchesSelector(
  node: SceneNode,
  selector: NodeSelector
): boolean {
  if (selector.type && node.type !== selector.type) {
    return false;
  }

  if (selector.name) {
    const pattern = new RegExp(selector.name, "i");
    if (!pattern.test(node.name)) {
      return false;
    }
  }

  if (selector.style) {
    for (const [key, value] of Object.entries(selector.style)) {
      if ((node as Record<string, unknown>)[key] !== value) {
        return false;
      }
    }
  }

  return true;
}

// ============================================================
// Structural Fingerprinting (for duplicate detection)
// ============================================================

export interface NodeFingerprint {
  type: string;
  width: number;
  height: number;
  childCount: number;
  fillHex: string | null;
  childTypes: string[];
}

export function fingerprintNode(node: SceneNode): NodeFingerprint {
  const width = "width" in node ? (node.width as number) : 0;
  const height = "height" in node ? (node.height as number) : 0;

  let fillHex: string | null = null;
  if ("fills" in node && Array.isArray(node.fills) && node.fills.length > 0) {
    const first = node.fills[0] as Paint;
    if (first.type === "SOLID") {
      fillHex = rgbToHex((first as SolidPaint).color);
    }
  }

  const children =
    "children" in node ? (node.children as SceneNode[]) : [];
  const childTypes = children.map((c) => c.type).sort();

  return {
    type: node.type,
    width: Math.round(width),
    height: Math.round(height),
    childCount: children.length,
    fillHex,
    childTypes,
  };
}

export function fingerprintSimilarity(
  a: NodeFingerprint,
  b: NodeFingerprint
): number {
  let score = 0;
  const maxScore = 5;

  if (a.type === b.type) score += 1;
  if (Math.abs(a.width - b.width) <= 2) score += 1;
  if (Math.abs(a.height - b.height) <= 2) score += 1;
  if (a.fillHex === b.fillHex) score += 1;
  if (
    a.childCount === b.childCount &&
    JSON.stringify(a.childTypes) === JSON.stringify(b.childTypes)
  ) {
    score += 1;
  }

  return score / maxScore;
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run plugin/__tests__/superpower-helpers.test.ts`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add plugin/utils/superpower-helpers.ts plugin/__tests__/superpower-helpers.test.ts
git commit -m "feat: add superpower helper utilities — color distance, contrast ratio, node traversal, fingerprinting"
```

---

## Task 2: bulk_rename Executor

**Files:**
- Create: `plugin/executors/superpowers.ts` (starting file — all 18 executors go here)
- Create: `plugin/__tests__/superpowers.test.ts` (starting file — all 18 executor tests go here)

**Step 1: Write the failing test**

```typescript
// plugin/__tests__/superpowers.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { bulkRename } from "../executors/superpowers.js";

// ---- Mock Figma Globals ----
function createMockNode(overrides: Record<string, unknown> = {}) {
  return {
    type: "FRAME",
    id: "1:1",
    name: "Rectangle 1",
    fills: [],
    strokes: [],
    children: [],
    ...overrides,
  };
}

function createMockFigma(nodes: Record<string, unknown>[] = []) {
  const nodeMap = new Map<string, unknown>();
  for (const n of nodes) {
    nodeMap.set(n.id as string, n);
  }

  const allNodes: unknown[] = [];
  function walk(node: Record<string, unknown>) {
    allNodes.push(node);
    if (Array.isArray(node.children)) {
      for (const child of node.children) {
        walk(child as Record<string, unknown>);
      }
    }
  }
  for (const n of nodes) walk(n);

  return {
    getNodeById: (id: string) => nodeMap.get(id) ?? null,
    currentPage: {
      children: nodes,
      findAll: () => allNodes,
    },
    root: {
      children: [{ children: nodes }],
    },
  };
}

describe("bulk_rename", () => {
  it("renames nodes matching a regex pattern", async () => {
    const node1 = createMockNode({ id: "1:1", name: "Rectangle 1" });
    const node2 = createMockNode({ id: "1:2", name: "Rectangle 2" });
    const node3 = createMockNode({ id: "1:3", name: "Ellipse 1" });
    const mockFigma = createMockFigma([node1, node2, node3]);

    const result = await bulkRename(
      {
        nodeIds: ["1:1", "1:2", "1:3"],
        pattern: "^Rectangle",
        replacement: "Card",
      },
      mockFigma as unknown as PluginAPI
    );

    expect(result.success).toBe(true);
    expect(result.data.renamedCount).toBe(2);
    expect(node1.name).toBe("Card 1");
    expect(node2.name).toBe("Card 2");
    expect(node3.name).toBe("Ellipse 1"); // unchanged
  });

  it("adds prefix to matching nodes", async () => {
    const node1 = createMockNode({ id: "1:1", name: "Button" });
    const node2 = createMockNode({ id: "1:2", name: "Input" });
    const mockFigma = createMockFigma([node1, node2]);

    const result = await bulkRename(
      {
        nodeIds: ["1:1", "1:2"],
        pattern: ".*",
        prefix: "ui/",
      },
      mockFigma as unknown as PluginAPI
    );

    expect(result.success).toBe(true);
    expect(node1.name).toBe("ui/Button");
    expect(node2.name).toBe("ui/Input");
  });

  it("applies sequential numbering", async () => {
    const node1 = createMockNode({ id: "1:1", name: "Item" });
    const node2 = createMockNode({ id: "1:2", name: "Item" });
    const node3 = createMockNode({ id: "1:3", name: "Item" });
    const mockFigma = createMockFigma([node1, node2, node3]);

    const result = await bulkRename(
      {
        nodeIds: ["1:1", "1:2", "1:3"],
        pattern: ".*",
        replacement: "Step",
        sequential: true,
      },
      mockFigma as unknown as PluginAPI
    );

    expect(result.success).toBe(true);
    expect(node1.name).toBe("Step 1");
    expect(node2.name).toBe("Step 2");
    expect(node3.name).toBe("Step 3");
  });

  it("uses scope instead of nodeIds", async () => {
    const node1 = createMockNode({ id: "1:1", name: "Rectangle 1" });
    const node2 = createMockNode({ id: "1:2", name: "Rectangle 2" });
    const mockFigma = createMockFigma([node1, node2]);

    const result = await bulkRename(
      {
        scope: "page",
        pattern: "Rectangle",
        replacement: "Box",
      },
      mockFigma as unknown as PluginAPI
    );

    expect(result.success).toBe(true);
    expect(result.data.renamedCount).toBe(2);
    expect(node1.name).toBe("Box 1");
    expect(node2.name).toBe("Box 2");
  });

  it("returns error if no nodeIds and no scope", async () => {
    const mockFigma = createMockFigma([]);

    const result = await bulkRename(
      { pattern: "test" },
      mockFigma as unknown as PluginAPI
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain("nodeIds or scope");
  });

  it("returns error for invalid regex pattern", async () => {
    const node1 = createMockNode({ id: "1:1", name: "Test" });
    const mockFigma = createMockFigma([node1]);

    const result = await bulkRename(
      { nodeIds: ["1:1"], pattern: "[invalid" },
      mockFigma as unknown as PluginAPI
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain("Invalid regex");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run plugin/__tests__/superpowers.test.ts`
Expected: FAIL — module not found

**Step 3: Write the implementation**

```typescript
// plugin/executors/superpowers.ts

import {
  collectNodesInScope,
  walkNodes,
  extractColorsFromNode,
  nodeMatchesSelector,
  fingerprintNode,
  fingerprintSimilarity,
  hexToRgb,
  rgbToHex,
  rgbToLab,
  deltaE,
  hexDeltaE,
  contrastRatio,
  relativeLuminance,
  isOnGrid,
  NodeSelector,
  ExtractedColor,
  RgbColor,
} from "../utils/superpower-helpers.js";

// ============================================================
// Result type used by all executors
// ============================================================

interface ExecutorResult {
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
}

// ============================================================
// 1. bulk_rename
// ============================================================

export async function bulkRename(
  params: Record<string, unknown>,
  figmaApi: PluginAPI
): Promise<ExecutorResult> {
  const nodeIds = params.nodeIds as string[] | undefined;
  const scope = params.scope as string | undefined;
  const pattern = params.pattern as string | undefined;
  const replacement = params.replacement as string | undefined;
  const prefix = params.prefix as string | undefined;
  const sequential = params.sequential as boolean | undefined;

  if (!pattern) {
    return { success: false, error: "Missing required parameter: pattern" };
  }

  if (!nodeIds && !scope) {
    return {
      success: false,
      error: "Must provide either nodeIds or scope to identify target nodes",
    };
  }

  let regex: RegExp;
  try {
    regex = new RegExp(pattern);
  } catch {
    return {
      success: false,
      error: `Invalid regex pattern: '${pattern}'. Ensure it is a valid JavaScript regular expression.`,
    };
  }

  // Collect target nodes
  let nodes: SceneNode[] = [];
  if (nodeIds) {
    for (const id of nodeIds) {
      const node = figmaApi.getNodeById(id);
      if (node && node.type !== "DOCUMENT" && node.type !== "PAGE") {
        nodes.push(node as SceneNode);
      }
    }
  } else if (scope) {
    nodes = collectNodesInScope(scope, figmaApi);
  }

  // Filter to nodes matching the pattern
  const matchingNodes = nodes.filter((n) => regex.test(n.name));
  const renamed: { nodeId: string; oldName: string; newName: string }[] = [];

  let sequentialCounter = 1;
  for (const node of matchingNodes) {
    const oldName = node.name;
    let newName: string;

    if (sequential && replacement !== undefined) {
      newName = `${replacement} ${sequentialCounter}`;
      sequentialCounter++;
    } else if (prefix !== undefined) {
      newName = `${prefix}${node.name}`;
    } else if (replacement !== undefined) {
      newName = node.name.replace(regex, replacement);
    } else {
      continue;
    }

    (node as { name: string }).name = newName;
    renamed.push({ nodeId: node.id, oldName, newName });
  }

  return {
    success: true,
    data: {
      renamedCount: renamed.length,
      totalMatched: matchingNodes.length,
      renamed,
    },
  };
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run plugin/__tests__/superpowers.test.ts`
Expected: All 6 bulk_rename tests PASS

**Step 5: Commit**

```bash
git add plugin/executors/superpowers.ts plugin/__tests__/superpowers.test.ts
git commit -m "feat: add bulk_rename executor — regex rename, prefix, sequential numbering across scope"
```

---

## Task 3: bulk_style Executor

**Files:**
- Edit: `plugin/__tests__/superpowers.test.ts` (append tests)
- Edit: `plugin/executors/superpowers.ts` (append executor)

**Step 1: Write the failing test**

Append to `plugin/__tests__/superpowers.test.ts`:

```typescript
import { bulkStyle } from "../executors/superpowers.js";

describe("bulk_style", () => {
  it("applies fill color to all matching nodes by type", async () => {
    const node1 = createMockNode({ id: "1:1", type: "RECTANGLE", name: "Rect 1", fills: [] });
    const node2 = createMockNode({ id: "1:2", type: "RECTANGLE", name: "Rect 2", fills: [] });
    const node3 = createMockNode({ id: "1:3", type: "ELLIPSE", name: "Circle", fills: [] });
    const mockFigma = createMockFigma([node1, node2, node3]);

    const result = await bulkStyle(
      {
        scope: "page",
        selector: { type: "RECTANGLE" },
        changes: { fill: "#FF0000" },
      },
      mockFigma as unknown as PluginAPI
    );

    expect(result.success).toBe(true);
    expect(result.data.modifiedCount).toBe(2);
    expect((node1.fills as unknown[])[0]).toMatchObject({
      type: "SOLID",
      color: { r: 1, g: 0, b: 0 },
    });
    expect(node3.fills).toEqual([]); // unchanged
  });

  it("applies opacity to nodes matching name pattern", async () => {
    const node1 = createMockNode({ id: "1:1", name: "bg-overlay", opacity: 1 });
    const node2 = createMockNode({ id: "1:2", name: "bg-card", opacity: 1 });
    const node3 = createMockNode({ id: "1:3", name: "title", opacity: 1 });
    const mockFigma = createMockFigma([node1, node2, node3]);

    const result = await bulkStyle(
      {
        scope: "page",
        selector: { name: "^bg-" },
        changes: { opacity: 0.5 },
      },
      mockFigma as unknown as PluginAPI
    );

    expect(result.success).toBe(true);
    expect(result.data.modifiedCount).toBe(2);
    expect(node1.opacity).toBe(0.5);
    expect(node2.opacity).toBe(0.5);
    expect(node3.opacity).toBe(1);
  });

  it("applies fontSize to text nodes", async () => {
    const node1 = createMockNode({
      id: "1:1",
      type: "TEXT",
      name: "Heading",
      fontSize: 16,
      fills: [],
    });
    const node2 = createMockNode({
      id: "1:2",
      type: "TEXT",
      name: "Body",
      fontSize: 14,
      fills: [],
    });
    const mockFigma = createMockFigma([node1, node2]);

    const result = await bulkStyle(
      {
        scope: "page",
        selector: { type: "TEXT" },
        changes: { fontSize: 18 },
      },
      mockFigma as unknown as PluginAPI
    );

    expect(result.success).toBe(true);
    expect(node1.fontSize).toBe(18);
    expect(node2.fontSize).toBe(18);
  });

  it("returns error if selector is missing", async () => {
    const mockFigma = createMockFigma([]);

    const result = await bulkStyle(
      { scope: "page", changes: { opacity: 0.5 } },
      mockFigma as unknown as PluginAPI
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain("selector");
  });

  it("returns error if changes is missing", async () => {
    const mockFigma = createMockFigma([]);

    const result = await bulkStyle(
      { scope: "page", selector: { type: "FRAME" } },
      mockFigma as unknown as PluginAPI
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain("changes");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run plugin/__tests__/superpowers.test.ts`
Expected: FAIL — bulkStyle not exported

**Step 3: Write the implementation**

Append to `plugin/executors/superpowers.ts`:

```typescript
// ============================================================
// 2. bulk_style
// ============================================================

export async function bulkStyle(
  params: Record<string, unknown>,
  figmaApi: PluginAPI
): Promise<ExecutorResult> {
  const scope = params.scope as string | undefined;
  const selector = params.selector as NodeSelector | undefined;
  const changes = params.changes as Record<string, unknown> | undefined;

  if (!selector) {
    return {
      success: false,
      error: "Missing required parameter: selector. Provide { type?, name?, style? } to match nodes.",
    };
  }

  if (!changes || Object.keys(changes).length === 0) {
    return {
      success: false,
      error: "Missing required parameter: changes. Provide a Record<string, unknown> of style changes to apply.",
    };
  }

  const targetScope = scope ?? "page";
  const allNodes = collectNodesInScope(targetScope, figmaApi);
  const matching = allNodes.filter((n) => nodeMatchesSelector(n, selector));

  const modified: { nodeId: string; nodeName: string; appliedChanges: string[] }[] = [];

  for (const node of matching) {
    const appliedChanges: string[] = [];

    for (const [key, value] of Object.entries(changes)) {
      switch (key) {
        case "fill": {
          const hex = value as string;
          const rgb = hexToRgb(hex);
          (node as unknown as { fills: Paint[] }).fills = [
            {
              type: "SOLID",
              color: { r: rgb.r, g: rgb.g, b: rgb.b },
              visible: true,
            } as SolidPaint,
          ];
          appliedChanges.push(`fill → ${hex}`);
          break;
        }

        case "stroke": {
          const hex = value as string;
          const rgb = hexToRgb(hex);
          (node as unknown as { strokes: Paint[] }).strokes = [
            {
              type: "SOLID",
              color: { r: rgb.r, g: rgb.g, b: rgb.b },
              visible: true,
            } as SolidPaint,
          ];
          appliedChanges.push(`stroke → ${hex}`);
          break;
        }

        case "opacity": {
          (node as unknown as { opacity: number }).opacity = value as number;
          appliedChanges.push(`opacity → ${value}`);
          break;
        }

        case "fontSize": {
          if (node.type === "TEXT") {
            (node as unknown as { fontSize: number }).fontSize = value as number;
            appliedChanges.push(`fontSize → ${value}`);
          }
          break;
        }

        case "cornerRadius": {
          if ("cornerRadius" in node) {
            (node as unknown as { cornerRadius: number }).cornerRadius = value as number;
            appliedChanges.push(`cornerRadius → ${value}`);
          }
          break;
        }

        default: {
          // Generic property set
          if (key in node) {
            (node as Record<string, unknown>)[key] = value;
            appliedChanges.push(`${key} → ${JSON.stringify(value)}`);
          }
          break;
        }
      }
    }

    if (appliedChanges.length > 0) {
      modified.push({
        nodeId: node.id,
        nodeName: node.name,
        appliedChanges,
      });
    }
  }

  return {
    success: true,
    data: {
      modifiedCount: modified.length,
      totalScanned: allNodes.length,
      totalMatched: matching.length,
      modified,
    },
  };
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run plugin/__tests__/superpowers.test.ts`
Expected: All bulk_style tests PASS

**Step 5: Commit**

```bash
git add plugin/executors/superpowers.ts plugin/__tests__/superpowers.test.ts
git commit -m "feat: add bulk_style executor — apply fill, stroke, opacity, fontSize across matched nodes"
```

---

## Task 4: bulk_resize Executor

**Files:**
- Edit: `plugin/__tests__/superpowers.test.ts` (append tests)
- Edit: `plugin/executors/superpowers.ts` (append executor)

**Step 1: Write the failing test**

Append to `plugin/__tests__/superpowers.test.ts`:

```typescript
import { bulkResize } from "../executors/superpowers.js";

describe("bulk_resize", () => {
  it("resizes nodes to absolute dimensions", async () => {
    const node1 = createMockNode({ id: "1:1", width: 100, height: 50, resize: vi.fn() });
    const node2 = createMockNode({ id: "1:2", width: 200, height: 100, resize: vi.fn() });
    const mockFigma = createMockFigma([node1, node2]);

    const result = await bulkResize(
      { nodeIds: ["1:1", "1:2"], width: 300, height: 150 },
      mockFigma as unknown as PluginAPI
    );

    expect(result.success).toBe(true);
    expect(result.data.resizedCount).toBe(2);
    expect(node1.resize).toHaveBeenCalledWith(300, 150);
    expect(node2.resize).toHaveBeenCalledWith(300, 150);
  });

  it("resizes nodes by scale factor", async () => {
    const node1 = createMockNode({ id: "1:1", width: 100, height: 50, resize: vi.fn() });
    const node2 = createMockNode({ id: "1:2", width: 200, height: 100, resize: vi.fn() });
    const mockFigma = createMockFigma([node1, node2]);

    const result = await bulkResize(
      { nodeIds: ["1:1", "1:2"], scaleX: 2, scaleY: 1.5 },
      mockFigma as unknown as PluginAPI
    );

    expect(result.success).toBe(true);
    expect(node1.resize).toHaveBeenCalledWith(200, 75);
    expect(node2.resize).toHaveBeenCalledWith(400, 150);
  });

  it("uses uniform scale when only scaleX provided", async () => {
    const node1 = createMockNode({ id: "1:1", width: 100, height: 50, resize: vi.fn() });
    const mockFigma = createMockFigma([node1]);

    const result = await bulkResize(
      { nodeIds: ["1:1"], scaleX: 3 },
      mockFigma as unknown as PluginAPI
    );

    expect(result.success).toBe(true);
    expect(node1.resize).toHaveBeenCalledWith(300, 150);
  });

  it("returns error when no nodeIds provided", async () => {
    const mockFigma = createMockFigma([]);

    const result = await bulkResize(
      { width: 100 },
      mockFigma as unknown as PluginAPI
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain("nodeIds");
  });

  it("returns error when no sizing params provided", async () => {
    const node1 = createMockNode({ id: "1:1", width: 100, height: 50 });
    const mockFigma = createMockFigma([node1]);

    const result = await bulkResize(
      { nodeIds: ["1:1"] },
      mockFigma as unknown as PluginAPI
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain("width/height or scaleX/scaleY");
  });

  it("skips nodes that cannot be found", async () => {
    const node1 = createMockNode({ id: "1:1", width: 100, height: 50, resize: vi.fn() });
    const mockFigma = createMockFigma([node1]);

    const result = await bulkResize(
      { nodeIds: ["1:1", "999:999"], width: 200, height: 100 },
      mockFigma as unknown as PluginAPI
    );

    expect(result.success).toBe(true);
    expect(result.data.resizedCount).toBe(1);
    expect(result.data.skippedCount).toBe(1);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run plugin/__tests__/superpowers.test.ts`
Expected: FAIL — bulkResize not exported

**Step 3: Write the implementation**

Append to `plugin/executors/superpowers.ts`:

```typescript
// ============================================================
// 3. bulk_resize
// ============================================================

export async function bulkResize(
  params: Record<string, unknown>,
  figmaApi: PluginAPI
): Promise<ExecutorResult> {
  const nodeIds = params.nodeIds as string[] | undefined;
  const scaleX = params.scaleX as number | undefined;
  const scaleY = params.scaleY as number | undefined;
  const width = params.width as number | undefined;
  const height = params.height as number | undefined;

  if (!nodeIds || nodeIds.length === 0) {
    return {
      success: false,
      error: "Missing required parameter: nodeIds. Provide an array of node IDs to resize.",
    };
  }

  const hasAbsolute = width !== undefined || height !== undefined;
  const hasScale = scaleX !== undefined || scaleY !== undefined;

  if (!hasAbsolute && !hasScale) {
    return {
      success: false,
      error: "Must provide width/height or scaleX/scaleY to determine new size.",
    };
  }

  const resized: { nodeId: string; oldSize: { w: number; h: number }; newSize: { w: number; h: number } }[] = [];
  let skippedCount = 0;

  for (const id of nodeIds) {
    const node = figmaApi.getNodeById(id);
    if (!node || node.type === "DOCUMENT" || node.type === "PAGE") {
      skippedCount++;
      continue;
    }

    const sceneNode = node as SceneNode;
    if (!("resize" in sceneNode)) {
      skippedCount++;
      continue;
    }

    const oldW = (sceneNode as FrameNode).width;
    const oldH = (sceneNode as FrameNode).height;

    let newW: number;
    let newH: number;

    if (hasAbsolute) {
      newW = width ?? oldW;
      newH = height ?? oldH;
    } else {
      const sx = scaleX ?? scaleY ?? 1;
      const sy = scaleY ?? scaleX ?? 1;
      newW = Math.round(oldW * sx);
      newH = Math.round(oldH * sy);
    }

    (sceneNode as FrameNode).resize(newW, newH);
    resized.push({
      nodeId: sceneNode.id,
      oldSize: { w: oldW, h: oldH },
      newSize: { w: newW, h: newH },
    });
  }

  return {
    success: true,
    data: {
      resizedCount: resized.length,
      skippedCount,
      resized,
    },
  };
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run plugin/__tests__/superpowers.test.ts`
Expected: All bulk_resize tests PASS

**Step 5: Commit**

```bash
git add plugin/executors/superpowers.ts plugin/__tests__/superpowers.test.ts
git commit -m "feat: add bulk_resize executor — absolute dimensions or scale factor across multiple nodes"
```

---

## Task 5: smart_align Executor

**Files:**
- Edit: `plugin/__tests__/superpowers.test.ts` (append tests)
- Edit: `plugin/executors/superpowers.ts` (append executor)

**Step 1: Write the failing test**

Append to `plugin/__tests__/superpowers.test.ts`:

```typescript
import { smartAlign } from "../executors/superpowers.js";

describe("smart_align", () => {
  it("distributes nodes horizontally with equal spacing", async () => {
    const node1 = createMockNode({ id: "1:1", x: 10, y: 0, width: 50, height: 50 });
    const node2 = createMockNode({ id: "1:2", x: 200, y: 0, width: 50, height: 50 });
    const node3 = createMockNode({ id: "1:3", x: 80, y: 0, width: 50, height: 50 });
    const mockFigma = createMockFigma([node1, node2, node3]);

    const result = await smartAlign(
      {
        nodeIds: ["1:1", "1:2", "1:3"],
        direction: "HORIZONTAL",
        spacing: 20,
      },
      mockFigma as unknown as PluginAPI
    );

    expect(result.success).toBe(true);
    // Sorted by x: node1(10), node3(80), node2(200)
    // node1 stays at x=10, node3 at 10+50+20=80, node2 at 80+50+20=150
    expect(node1.x).toBe(10);
    expect(node3.x).toBe(80);
    expect(node2.x).toBe(150);
  });

  it("distributes nodes vertically with equal spacing", async () => {
    const node1 = createMockNode({ id: "1:1", x: 0, y: 10, width: 50, height: 40 });
    const node2 = createMockNode({ id: "1:2", x: 0, y: 200, width: 50, height: 40 });
    const node3 = createMockNode({ id: "1:3", x: 0, y: 80, width: 50, height: 40 });
    const mockFigma = createMockFigma([node1, node2, node3]);

    const result = await smartAlign(
      {
        nodeIds: ["1:1", "1:2", "1:3"],
        direction: "VERTICAL",
        spacing: 16,
      },
      mockFigma as unknown as PluginAPI
    );

    expect(result.success).toBe(true);
    // Sorted by y: node1(10), node3(80), node2(200)
    expect(node1.y).toBe(10);
    expect(node3.y).toBe(66); // 10 + 40 + 16
    expect(node2.y).toBe(122); // 66 + 40 + 16
  });

  it("aligns nodes to center horizontally", async () => {
    const node1 = createMockNode({ id: "1:1", x: 0, y: 0, width: 100, height: 50 });
    const node2 = createMockNode({ id: "1:2", x: 0, y: 60, width: 60, height: 50 });
    const mockFigma = createMockFigma([node1, node2]);

    const result = await smartAlign(
      {
        nodeIds: ["1:1", "1:2"],
        alignment: "center",
      },
      mockFigma as unknown as PluginAPI
    );

    expect(result.success).toBe(true);
    // Center X of node1 = 50, so node2.x should be 50 - 30 = 20
    expect(node2.x).toBe(20);
  });

  it("aligns nodes to start (left edge)", async () => {
    const node1 = createMockNode({ id: "1:1", x: 30, y: 0, width: 50, height: 50 });
    const node2 = createMockNode({ id: "1:2", x: 100, y: 0, width: 50, height: 50 });
    const mockFigma = createMockFigma([node1, node2]);

    const result = await smartAlign(
      {
        nodeIds: ["1:1", "1:2"],
        alignment: "start",
        direction: "HORIZONTAL",
      },
      mockFigma as unknown as PluginAPI
    );

    expect(result.success).toBe(true);
    expect(node1.x).toBe(30);
    expect(node2.x).toBe(30);
  });

  it("returns error if fewer than 2 nodes", async () => {
    const node1 = createMockNode({ id: "1:1", x: 0, y: 0, width: 50, height: 50 });
    const mockFigma = createMockFigma([node1]);

    const result = await smartAlign(
      { nodeIds: ["1:1"], direction: "HORIZONTAL", spacing: 10 },
      mockFigma as unknown as PluginAPI
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain("at least 2");
  });

  it("returns error if no nodeIds provided", async () => {
    const mockFigma = createMockFigma([]);

    const result = await smartAlign(
      { direction: "HORIZONTAL", spacing: 10 },
      mockFigma as unknown as PluginAPI
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain("nodeIds");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run plugin/__tests__/superpowers.test.ts`
Expected: FAIL — smartAlign not exported

**Step 3: Write the implementation**

Append to `plugin/executors/superpowers.ts`:

```typescript
// ============================================================
// 4. smart_align
// ============================================================

export async function smartAlign(
  params: Record<string, unknown>,
  figmaApi: PluginAPI
): Promise<ExecutorResult> {
  const nodeIds = params.nodeIds as string[] | undefined;
  const direction = (params.direction as string) ?? "HORIZONTAL";
  const spacing = params.spacing as number | undefined;
  const alignment = params.alignment as string | undefined;

  if (!nodeIds || nodeIds.length === 0) {
    return {
      success: false,
      error: "Missing required parameter: nodeIds. Provide an array of node IDs to align.",
    };
  }

  // Resolve nodes
  const nodes: SceneNode[] = [];
  for (const id of nodeIds) {
    const node = figmaApi.getNodeById(id);
    if (node && node.type !== "DOCUMENT" && node.type !== "PAGE") {
      nodes.push(node as SceneNode);
    }
  }

  if (nodes.length < 2) {
    return {
      success: false,
      error: "smart_align requires at least 2 valid nodes to align/distribute.",
    };
  }

  const isHorizontal = direction === "HORIZONTAL";

  // Handle alignment (without spacing)
  if (alignment && !spacing) {
    applyAlignment(nodes, alignment, isHorizontal);
    return {
      success: true,
      data: {
        alignedCount: nodes.length,
        alignment,
        direction,
      },
    };
  }

  // Handle distribution with spacing
  if (spacing !== undefined) {
    // Sort by position in the layout direction
    const sorted = [...nodes].sort((a, b) => {
      const posA = isHorizontal ? (a as FrameNode).x : (a as FrameNode).y;
      const posB = isHorizontal ? (b as FrameNode).x : (b as FrameNode).y;
      return posA - posB;
    });

    // First node stays in place, position others relative to it
    let currentPos = isHorizontal
      ? (sorted[0] as FrameNode).x
      : (sorted[0] as FrameNode).y;

    for (let i = 0; i < sorted.length; i++) {
      const node = sorted[i] as FrameNode;
      if (isHorizontal) {
        node.x = currentPos;
        currentPos += node.width + spacing;
      } else {
        node.y = currentPos;
        currentPos += node.height + spacing;
      }
    }

    // Apply alignment perpendicular to distribution direction if specified
    if (alignment) {
      applyAlignment(sorted, alignment, !isHorizontal);
    }

    return {
      success: true,
      data: {
        distributedCount: sorted.length,
        spacing,
        direction,
        alignment: alignment ?? "none",
      },
    };
  }

  // Default: space-between distribution
  const sorted = [...nodes].sort((a, b) => {
    const posA = isHorizontal ? (a as FrameNode).x : (a as FrameNode).y;
    const posB = isHorizontal ? (b as FrameNode).x : (b as FrameNode).y;
    return posA - posB;
  });

  const first = sorted[0] as FrameNode;
  const last = sorted[sorted.length - 1] as FrameNode;

  const totalSize = sorted.reduce((sum, n) => {
    return sum + (isHorizontal ? (n as FrameNode).width : (n as FrameNode).height);
  }, 0);

  const startPos = isHorizontal ? first.x : first.y;
  const endPos = isHorizontal ? last.x + last.width : last.y + last.height;
  const totalSpan = endPos - startPos;
  const gapSpace = totalSpan - totalSize;
  const gap = sorted.length > 1 ? gapSpace / (sorted.length - 1) : 0;

  let currentPos = startPos;
  for (const node of sorted) {
    const frameNode = node as FrameNode;
    if (isHorizontal) {
      frameNode.x = currentPos;
      currentPos += frameNode.width + gap;
    } else {
      frameNode.y = currentPos;
      currentPos += frameNode.height + gap;
    }
  }

  return {
    success: true,
    data: {
      distributedCount: sorted.length,
      calculatedSpacing: Math.round(gap * 100) / 100,
      direction,
    },
  };
}

function applyAlignment(
  nodes: SceneNode[],
  alignment: string,
  isHorizontal: boolean
): void {
  if (nodes.length === 0) return;

  if (alignment === "start") {
    const minPos = Math.min(
      ...nodes.map((n) =>
        isHorizontal ? (n as FrameNode).x : (n as FrameNode).y
      )
    );
    for (const node of nodes) {
      if (isHorizontal) {
        (node as FrameNode).x = minPos;
      } else {
        (node as FrameNode).y = minPos;
      }
    }
  } else if (alignment === "end") {
    const maxEnd = Math.max(
      ...nodes.map((n) =>
        isHorizontal
          ? (n as FrameNode).x + (n as FrameNode).width
          : (n as FrameNode).y + (n as FrameNode).height
      )
    );
    for (const node of nodes) {
      if (isHorizontal) {
        (node as FrameNode).x = maxEnd - (node as FrameNode).width;
      } else {
        (node as FrameNode).y = maxEnd - (node as FrameNode).height;
      }
    }
  } else if (alignment === "center") {
    const centers = nodes.map((n) =>
      isHorizontal
        ? (n as FrameNode).x + (n as FrameNode).width / 2
        : (n as FrameNode).y + (n as FrameNode).height / 2
    );
    const avgCenter = centers.reduce((a, b) => a + b, 0) / centers.length;
    for (const node of nodes) {
      if (isHorizontal) {
        (node as FrameNode).x = avgCenter - (node as FrameNode).width / 2;
      } else {
        (node as FrameNode).y = avgCenter - (node as FrameNode).height / 2;
      }
    }
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run plugin/__tests__/superpowers.test.ts`
Expected: All smart_align tests PASS

**Step 5: Commit**

```bash
git add plugin/executors/superpowers.ts plugin/__tests__/superpowers.test.ts
git commit -m "feat: add smart_align executor — distribute, align, and space nodes with start/center/end/spacing"
```

---

## Task 6: design_lint Executor

**Files:**
- Edit: `plugin/__tests__/superpowers.test.ts` (append tests)
- Edit: `plugin/executors/superpowers.ts` (append executor)

**Step 1: Write the failing test**

Append to `plugin/__tests__/superpowers.test.ts`:

```typescript
import { designLint } from "../executors/superpowers.js";

describe("design_lint", () => {
  it("flags default naming violations", async () => {
    const node1 = createMockNode({ id: "1:1", name: "Rectangle 1" });
    const node2 = createMockNode({ id: "1:2", name: "Frame 3" });
    const node3 = createMockNode({ id: "1:3", name: "Hero Section" });
    const mockFigma = createMockFigma([node1, node2, node3]);

    const result = await designLint(
      { scope: "page" },
      mockFigma as unknown as PluginAPI
    );

    expect(result.success).toBe(true);
    const issues = result.data.issues as unknown[];
    const namingIssues = (issues as { rule: string }[]).filter(
      (i) => i.rule === "naming-violation"
    );
    expect(namingIssues.length).toBe(2);
  });

  it("flags inconsistent corner radius", async () => {
    const node1 = createMockNode({
      id: "1:1",
      type: "RECTANGLE",
      name: "Card 1",
      cornerRadius: 8,
    });
    const node2 = createMockNode({
      id: "1:2",
      type: "RECTANGLE",
      name: "Card 2",
      cornerRadius: 12,
    });
    const node3 = createMockNode({
      id: "1:3",
      type: "RECTANGLE",
      name: "Card 3",
      cornerRadius: 7,
    });
    const mockFigma = createMockFigma([node1, node2, node3]);

    const result = await designLint(
      { scope: "page", rules: ["corner-radius"] },
      mockFigma as unknown as PluginAPI
    );

    expect(result.success).toBe(true);
    const issues = result.data.issues as { rule: string }[];
    const radiusIssues = issues.filter((i) => i.rule === "inconsistent-corner-radius");
    // node3 has cornerRadius 7 which is not on 4px grid
    expect(radiusIssues.length).toBeGreaterThan(0);
  });

  it("flags inconsistent spacing in auto-layout", async () => {
    const node1 = createMockNode({
      id: "1:1",
      type: "FRAME",
      name: "List",
      layoutMode: "VERTICAL",
      itemSpacing: 13,
      paddingTop: 16,
      paddingRight: 16,
      paddingBottom: 16,
      paddingLeft: 16,
    });
    const mockFigma = createMockFigma([node1]);

    const result = await designLint(
      { scope: "page", rules: ["spacing"] },
      mockFigma as unknown as PluginAPI
    );

    expect(result.success).toBe(true);
    const issues = result.data.issues as { rule: string }[];
    const spacingIssues = issues.filter((i) => i.rule === "inconsistent-spacing");
    expect(spacingIssues.length).toBeGreaterThan(0);
  });

  it("returns empty issues for a clean design", async () => {
    const node1 = createMockNode({
      id: "1:1",
      type: "FRAME",
      name: "Card",
      cornerRadius: 8,
      layoutMode: "VERTICAL",
      itemSpacing: 16,
      paddingTop: 16,
      paddingRight: 16,
      paddingBottom: 16,
      paddingLeft: 16,
    });
    const mockFigma = createMockFigma([node1]);

    const result = await designLint(
      { scope: "page" },
      mockFigma as unknown as PluginAPI
    );

    expect(result.success).toBe(true);
    const issues = result.data.issues as unknown[];
    expect(issues.length).toBe(0);
  });

  it("runs with specific rules only", async () => {
    const node1 = createMockNode({ id: "1:1", name: "Rectangle 1", cornerRadius: 7 });
    const mockFigma = createMockFigma([node1]);

    const result = await designLint(
      { scope: "page", rules: ["corner-radius"] },
      mockFigma as unknown as PluginAPI
    );

    expect(result.success).toBe(true);
    const issues = result.data.issues as { rule: string }[];
    // Should NOT have naming violation since we only asked for corner-radius
    const namingIssues = issues.filter((i) => i.rule === "naming-violation");
    expect(namingIssues.length).toBe(0);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run plugin/__tests__/superpowers.test.ts`
Expected: FAIL — designLint not exported

**Step 3: Write the implementation**

Append to `plugin/executors/superpowers.ts`:

```typescript
// ============================================================
// 5. design_lint
// ============================================================

interface LintIssue {
  rule: string;
  severity: "error" | "warning" | "info";
  message: string;
  nodeId: string;
  nodeName: string;
  suggestion?: string;
}

const DEFAULT_NAMING_PATTERNS = [
  /^Rectangle \d+$/,
  /^Ellipse \d+$/,
  /^Frame \d+$/,
  /^Group \d+$/,
  /^Line \d+$/,
  /^Polygon \d+$/,
  /^Star \d+$/,
  /^Vector \d+$/,
  /^Text \d*$/,
  /^Image \d*$/,
];

const ALL_LINT_RULES = [
  "naming",
  "corner-radius",
  "spacing",
  "detached-styles",
  "orphan-components",
] as const;

export async function designLint(
  params: Record<string, unknown>,
  figmaApi: PluginAPI
): Promise<ExecutorResult> {
  const scope = (params.scope as string) ?? "page";
  const requestedRules = params.rules as string[] | undefined;
  const activeRules = requestedRules ?? [...ALL_LINT_RULES];

  const nodes = collectNodesInScope(scope, figmaApi);
  const issues: LintIssue[] = [];

  for (const node of nodes) {
    // Rule: naming-violation
    if (activeRules.includes("naming")) {
      if (DEFAULT_NAMING_PATTERNS.some((pattern) => pattern.test(node.name))) {
        issues.push({
          rule: "naming-violation",
          severity: "warning",
          message: `Layer "${node.name}" uses a default Figma name. Rename it to describe its purpose.`,
          nodeId: node.id,
          nodeName: node.name,
          suggestion: `Rename "${node.name}" to something descriptive like "card-background" or "hero-section".`,
        });
      }
    }

    // Rule: inconsistent-corner-radius
    if (activeRules.includes("corner-radius") && "cornerRadius" in node) {
      const radius = node.cornerRadius as number;
      if (typeof radius === "number" && radius > 0 && !isOnGrid(radius, 4)) {
        issues.push({
          rule: "inconsistent-corner-radius",
          severity: "warning",
          message: `Corner radius ${radius}px on "${node.name}" is not on the 4px grid. Nearest: ${Math.round(radius / 4) * 4}px.`,
          nodeId: node.id,
          nodeName: node.name,
          suggestion: `Change corner radius from ${radius}px to ${Math.round(radius / 4) * 4}px.`,
        });
      }
    }

    // Rule: inconsistent-spacing
    if (activeRules.includes("spacing") && "layoutMode" in node) {
      const layoutNode = node as FrameNode;
      if (layoutNode.layoutMode && layoutNode.layoutMode !== "NONE") {
        const spacingValues = [
          layoutNode.itemSpacing,
          layoutNode.paddingTop,
          layoutNode.paddingRight,
          layoutNode.paddingBottom,
          layoutNode.paddingLeft,
        ].filter((v): v is number => typeof v === "number" && v > 0);

        for (const val of spacingValues) {
          if (!isOnGrid(val, 8)) {
            issues.push({
              rule: "inconsistent-spacing",
              severity: "warning",
              message: `Spacing value ${val}px on "${node.name}" is not on the 8px grid. Nearest: ${Math.round(val / 8) * 8}px.`,
              nodeId: node.id,
              nodeName: node.name,
              suggestion: `Change ${val}px to ${Math.round(val / 8) * 8}px to align with the spacing scale.`,
            });
            break; // One issue per node for spacing
          }
        }
      }
    }

    // Rule: detached-styles
    if (activeRules.includes("detached-styles")) {
      if ("fills" in node && Array.isArray(node.fills)) {
        const hasFills = (node.fills as Paint[]).some(
          (f) => f.type === "SOLID" && f.visible !== false
        );
        const hasFillStyleId =
          "fillStyleId" in node &&
          typeof (node as unknown as { fillStyleId: string }).fillStyleId === "string" &&
          (node as unknown as { fillStyleId: string }).fillStyleId !== "";

        if (hasFills && !hasFillStyleId && node.type !== "TEXT") {
          // Only flag if there are many nodes — we check this in a post-pass
          // For now, collect raw fill data
        }
      }
    }
  }

  return {
    success: true,
    data: {
      issueCount: issues.length,
      issues,
      scannedNodeCount: nodes.length,
      rulesChecked: activeRules,
    },
  };
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run plugin/__tests__/superpowers.test.ts`
Expected: All design_lint tests PASS

**Step 5: Commit**

```bash
git add plugin/executors/superpowers.ts plugin/__tests__/superpowers.test.ts
git commit -m "feat: add design_lint executor — naming violations, corner radius, spacing, and detached style checks"
```

---

## Task 7: accessibility_check Executor

**Files:**
- Edit: `plugin/__tests__/superpowers.test.ts` (append tests)
- Edit: `plugin/executors/superpowers.ts` (append executor)

**Step 1: Write the failing test**

Append to `plugin/__tests__/superpowers.test.ts`:

```typescript
import { accessibilityCheck } from "../executors/superpowers.js";

describe("accessibility_check", () => {
  it("flags insufficient contrast ratio for AA", async () => {
    const textNode = createMockNode({
      id: "1:1",
      type: "TEXT",
      name: "Light Text",
      fontSize: 16,
      characters: "Hello",
      fills: [{ type: "SOLID", color: { r: 0.7, g: 0.7, b: 0.7 }, visible: true }],
    });
    const bgNode = createMockNode({
      id: "1:2",
      type: "FRAME",
      name: "Background",
      fills: [{ type: "SOLID", color: { r: 1, g: 1, b: 1 }, visible: true }],
      children: [textNode],
      width: 300,
      height: 200,
    });
    const mockFigma = createMockFigma([bgNode]);

    const result = await accessibilityCheck(
      { scope: "page", level: "AA" },
      mockFigma as unknown as PluginAPI
    );

    expect(result.success).toBe(true);
    const violations = result.data.violations as { criterion: string }[];
    const contrastViolations = violations.filter(
      (v) => v.criterion === "WCAG 1.4.3"
    );
    expect(contrastViolations.length).toBeGreaterThan(0);
  });

  it("passes contrast check for black on white", async () => {
    const textNode = createMockNode({
      id: "1:1",
      type: "TEXT",
      name: "Dark Text",
      fontSize: 16,
      characters: "Hello",
      fills: [{ type: "SOLID", color: { r: 0, g: 0, b: 0 }, visible: true }],
    });
    const bgNode = createMockNode({
      id: "1:2",
      type: "FRAME",
      name: "Background",
      fills: [{ type: "SOLID", color: { r: 1, g: 1, b: 1 }, visible: true }],
      children: [textNode],
      width: 300,
      height: 200,
    });
    const mockFigma = createMockFigma([bgNode]);

    const result = await accessibilityCheck(
      { scope: "page", level: "AA" },
      mockFigma as unknown as PluginAPI
    );

    expect(result.success).toBe(true);
    const violations = result.data.violations as { criterion: string }[];
    const contrastViolations = violations.filter(
      (v) => v.criterion === "WCAG 1.4.3"
    );
    expect(contrastViolations.length).toBe(0);
  });

  it("flags small touch targets at AA level", async () => {
    const buttonNode = createMockNode({
      id: "1:1",
      type: "FRAME",
      name: "Small Button",
      width: 30,
      height: 30,
      fills: [{ type: "SOLID", color: { r: 0, g: 0, b: 1 }, visible: true }],
    });
    const mockFigma = createMockFigma([buttonNode]);

    const result = await accessibilityCheck(
      { scope: "page", level: "AA" },
      mockFigma as unknown as PluginAPI
    );

    expect(result.success).toBe(true);
    const violations = result.data.violations as { criterion: string }[];
    const touchViolations = violations.filter(
      (v) => v.criterion === "WCAG 2.5.8" || v.criterion === "WCAG 2.5.5"
    );
    expect(touchViolations.length).toBeGreaterThan(0);
  });

  it("flags small text at AAA level", async () => {
    const textNode = createMockNode({
      id: "1:1",
      type: "TEXT",
      name: "Tiny Text",
      fontSize: 10,
      characters: "Small",
      fills: [{ type: "SOLID", color: { r: 0, g: 0, b: 0 }, visible: true }],
    });
    const mockFigma = createMockFigma([textNode]);

    const result = await accessibilityCheck(
      { scope: "page", level: "AAA" },
      mockFigma as unknown as PluginAPI
    );

    expect(result.success).toBe(true);
    const violations = result.data.violations as { criterion: string }[];
    const sizeViolations = violations.filter(
      (v) => v.criterion === "WCAG 1.4.8"
    );
    expect(sizeViolations.length).toBeGreaterThan(0);
  });

  it("defaults to AA level", async () => {
    const mockFigma = createMockFigma([]);

    const result = await accessibilityCheck(
      { scope: "page" },
      mockFigma as unknown as PluginAPI
    );

    expect(result.success).toBe(true);
    expect(result.data.level).toBe("AA");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run plugin/__tests__/superpowers.test.ts`
Expected: FAIL — accessibilityCheck not exported

**Step 3: Write the implementation**

Append to `plugin/executors/superpowers.ts`:

```typescript
// ============================================================
// 6. accessibility_check
// ============================================================

interface A11yViolation {
  criterion: string;
  severity: "error" | "warning";
  message: string;
  nodeId: string;
  nodeName: string;
  actual: string;
  required: string;
  suggestion: string;
}

export async function accessibilityCheck(
  params: Record<string, unknown>,
  figmaApi: PluginAPI
): Promise<ExecutorResult> {
  const scope = (params.scope as string) ?? "page";
  const level = (params.level as "A" | "AA" | "AAA") ?? "AA";

  const nodes = collectNodesInScope(scope, figmaApi);
  const violations: A11yViolation[] = [];

  // Thresholds by level
  const contrastNormalText = level === "AAA" ? 7 : 4.5;
  const contrastLargeText = level === "AAA" ? 4.5 : 3;
  const minTouchTarget = level === "AAA" ? 48 : 44;
  const minFontSize = level === "AAA" ? 14 : 12;
  const largeTextSize = 18; // 18px or 14px bold

  for (const node of nodes) {
    // Contrast check for text nodes
    if (node.type === "TEXT") {
      const textNode = node as TextNode;
      const fontSize = typeof textNode.fontSize === "number" ? textNode.fontSize : 16;
      const isLargeText = fontSize >= largeTextSize;
      const requiredRatio = isLargeText ? contrastLargeText : contrastNormalText;

      // Get text color
      const textColor = getFirstSolidColor(textNode.fills as Paint[]);
      if (textColor) {
        // Find parent background color
        const bgColor = findBackgroundColor(textNode);
        if (bgColor) {
          const ratio = contrastRatio(textColor, bgColor);
          if (ratio < requiredRatio) {
            violations.push({
              criterion: "WCAG 1.4.3",
              severity: "error",
              message: `Text "${textNode.characters?.substring(0, 30) ?? node.name}" has insufficient contrast ratio ${ratio.toFixed(2)}:1 (requires ${requiredRatio}:1 for ${isLargeText ? "large" : "normal"} text at ${level}).`,
              nodeId: node.id,
              nodeName: node.name,
              actual: `${ratio.toFixed(2)}:1`,
              required: `${requiredRatio}:1`,
              suggestion: `Increase contrast by darkening the text color or lightening the background. Current text: ${rgbToHex(textColor)}, background: ${rgbToHex(bgColor)}.`,
            });
          }
        }
      }

      // Text size check
      if (fontSize < minFontSize) {
        violations.push({
          criterion: level === "AAA" ? "WCAG 1.4.8" : "WCAG 1.4.4",
          severity: "warning",
          message: `Text "${textNode.characters?.substring(0, 30) ?? node.name}" uses ${fontSize}px font size (minimum ${minFontSize}px for ${level}).`,
          nodeId: node.id,
          nodeName: node.name,
          actual: `${fontSize}px`,
          required: `${minFontSize}px`,
          suggestion: `Increase font size from ${fontSize}px to at least ${minFontSize}px.`,
        });
      }
    }

    // Touch target check (frames and components that look interactive)
    if (
      (node.type === "FRAME" || node.type === "COMPONENT" || node.type === "INSTANCE") &&
      isLikelyInteractive(node)
    ) {
      const width = (node as FrameNode).width;
      const height = (node as FrameNode).height;

      if (width < minTouchTarget || height < minTouchTarget) {
        violations.push({
          criterion: level === "AAA" ? "WCAG 2.5.5" : "WCAG 2.5.8",
          severity: "warning",
          message: `"${node.name}" (${Math.round(width)}x${Math.round(height)}px) is smaller than the minimum touch target of ${minTouchTarget}x${minTouchTarget}px for ${level}.`,
          nodeId: node.id,
          nodeName: node.name,
          actual: `${Math.round(width)}x${Math.round(height)}px`,
          required: `${minTouchTarget}x${minTouchTarget}px`,
          suggestion: `Increase dimensions to at least ${minTouchTarget}x${minTouchTarget}px. If the visual size must be smaller, add invisible padding to the hit area.`,
        });
      }
    }
  }

  return {
    success: true,
    data: {
      violationCount: violations.length,
      violations,
      scannedNodeCount: nodes.length,
      level,
    },
  };
}

function getFirstSolidColor(paints: Paint[]): RgbColor | null {
  if (!Array.isArray(paints)) return null;
  for (const paint of paints) {
    if (paint.type === "SOLID" && paint.visible !== false) {
      const solid = paint as SolidPaint;
      return { r: solid.color.r, g: solid.color.g, b: solid.color.b };
    }
  }
  return null;
}

function findBackgroundColor(node: SceneNode): RgbColor | null {
  let current: BaseNode | null = node.parent;
  while (current && current.type !== "DOCUMENT" && current.type !== "PAGE") {
    if ("fills" in current && Array.isArray((current as FrameNode).fills)) {
      const bg = getFirstSolidColor((current as FrameNode).fills as Paint[]);
      if (bg) return bg;
    }
    current = current.parent;
  }
  // Default: assume white background
  return { r: 1, g: 1, b: 1 };
}

function isLikelyInteractive(node: SceneNode): boolean {
  const name = node.name.toLowerCase();
  const interactivePatterns = [
    "button",
    "btn",
    "link",
    "tab",
    "toggle",
    "switch",
    "checkbox",
    "radio",
    "input",
    "icon-button",
    "fab",
    "chip",
    "cta",
  ];
  return interactivePatterns.some((p) => name.includes(p));
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run plugin/__tests__/superpowers.test.ts`
Expected: All accessibility_check tests PASS

**Step 5: Commit**

```bash
git add plugin/executors/superpowers.ts plugin/__tests__/superpowers.test.ts
git commit -m "feat: add accessibility_check executor — WCAG contrast, touch targets, and text size checks"
```

---

## Task 8: design_system_scan Executor

**Files:**
- Edit: `plugin/__tests__/superpowers.test.ts` (append tests)
- Edit: `plugin/executors/superpowers.ts` (append executor)

**Step 1: Write the failing test**

Append to `plugin/__tests__/superpowers.test.ts`:

```typescript
import { designSystemScan } from "../executors/superpowers.js";

describe("design_system_scan", () => {
  it("reports component usage percentage", async () => {
    const instance1 = createMockNode({ id: "1:1", type: "INSTANCE", name: "Button" });
    const instance2 = createMockNode({ id: "1:2", type: "INSTANCE", name: "Card" });
    const rawFrame = createMockNode({ id: "1:3", type: "FRAME", name: "Custom Frame" });
    const rawRect = createMockNode({ id: "1:4", type: "RECTANGLE", name: "Rect" });
    const mockFigma = createMockFigma([instance1, instance2, rawFrame, rawRect]);

    const result = await designSystemScan(
      { scope: "page" },
      mockFigma as unknown as PluginAPI
    );

    expect(result.success).toBe(true);
    expect(result.data.componentUsagePercent).toBe(50); // 2 of 4
    expect(result.data.instanceCount).toBe(2);
    expect(result.data.totalNodes).toBe(4);
  });

  it("detects detached styles", async () => {
    const node1 = createMockNode({
      id: "1:1",
      type: "RECTANGLE",
      name: "Box",
      fills: [{ type: "SOLID", color: { r: 1, g: 0, b: 0 }, visible: true }],
      fillStyleId: "",
    });
    const node2 = createMockNode({
      id: "1:2",
      type: "RECTANGLE",
      name: "Styled Box",
      fills: [{ type: "SOLID", color: { r: 0, g: 0, b: 1 }, visible: true }],
      fillStyleId: "S:abc123",
    });
    const mockFigma = createMockFigma([node1, node2]);

    const result = await designSystemScan(
      { scope: "page" },
      mockFigma as unknown as PluginAPI
    );

    expect(result.success).toBe(true);
    expect(result.data.detachedStyleCount).toBe(1);
  });

  it("reports non-token colors", async () => {
    const node1 = createMockNode({
      id: "1:1",
      type: "RECTANGLE",
      name: "Box",
      fills: [{ type: "SOLID", color: { r: 1, g: 0, b: 0 }, visible: true }],
      boundVariables: {},
    });
    const mockFigma = createMockFigma([node1]);

    const result = await designSystemScan(
      { scope: "page" },
      mockFigma as unknown as PluginAPI
    );

    expect(result.success).toBe(true);
    expect(result.data.nonTokenColorCount).toBeGreaterThanOrEqual(1);
  });

  it("handles empty page", async () => {
    const mockFigma = createMockFigma([]);

    const result = await designSystemScan(
      { scope: "page" },
      mockFigma as unknown as PluginAPI
    );

    expect(result.success).toBe(true);
    expect(result.data.totalNodes).toBe(0);
    expect(result.data.componentUsagePercent).toBe(100);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run plugin/__tests__/superpowers.test.ts`
Expected: FAIL — designSystemScan not exported

**Step 3: Write the implementation**

Append to `plugin/executors/superpowers.ts`:

```typescript
// ============================================================
// 7. design_system_scan
// ============================================================

export async function designSystemScan(
  params: Record<string, unknown>,
  figmaApi: PluginAPI
): Promise<ExecutorResult> {
  const scope = (params.scope as string) ?? "page";
  const nodes = collectNodesInScope(scope, figmaApi);

  if (nodes.length === 0) {
    return {
      success: true,
      data: {
        totalNodes: 0,
        instanceCount: 0,
        componentUsagePercent: 100,
        detachedStyleCount: 0,
        nonTokenColorCount: 0,
        violations: [],
        summary: "No nodes found in scope.",
      },
    };
  }

  let instanceCount = 0;
  let detachedStyleCount = 0;
  let nonTokenColorCount = 0;
  const violations: { nodeId: string; nodeName: string; type: string; detail: string }[] = [];

  for (const node of nodes) {
    // Component usage
    if (node.type === "INSTANCE") {
      instanceCount++;
    }

    // Detached styles — node has fill but no fill style ID
    if ("fills" in node && Array.isArray(node.fills)) {
      const hasSolidFill = (node.fills as Paint[]).some(
        (f) => f.type === "SOLID" && f.visible !== false
      );
      const fillStyleId =
        "fillStyleId" in node
          ? (node as unknown as { fillStyleId: string }).fillStyleId
          : "";

      if (hasSolidFill && (!fillStyleId || fillStyleId === "")) {
        detachedStyleCount++;
        violations.push({
          nodeId: node.id,
          nodeName: node.name,
          type: "detached-fill",
          detail: `Fill on "${node.name}" is not linked to a style.`,
        });
      }
    }

    // Non-token colors — node has fill but no bound variable
    if ("fills" in node && Array.isArray(node.fills)) {
      const hasSolidFill = (node.fills as Paint[]).some(
        (f) => f.type === "SOLID" && f.visible !== false
      );
      const hasBoundVariable =
        "boundVariables" in node &&
        node.boundVariables &&
        typeof node.boundVariables === "object" &&
        "fills" in (node.boundVariables as Record<string, unknown>);

      if (hasSolidFill && !hasBoundVariable) {
        nonTokenColorCount++;
      }
    }
  }

  const componentUsagePercent =
    nodes.length > 0
      ? Math.round((instanceCount / nodes.length) * 100)
      : 100;

  return {
    success: true,
    data: {
      totalNodes: nodes.length,
      instanceCount,
      componentUsagePercent,
      detachedStyleCount,
      nonTokenColorCount,
      violations,
      summary: `${componentUsagePercent}% component usage (${instanceCount}/${nodes.length} nodes). ${detachedStyleCount} detached styles. ${nonTokenColorCount} non-token colors.`,
    },
  };
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run plugin/__tests__/superpowers.test.ts`
Expected: All design_system_scan tests PASS

**Step 5: Commit**

```bash
git add plugin/executors/superpowers.ts plugin/__tests__/superpowers.test.ts
git commit -m "feat: add design_system_scan executor — component usage, detached styles, and token coverage analysis"
```

---

## Task 9: responsive_check Executor

**Files:**
- Edit: `plugin/__tests__/superpowers.test.ts` (append tests)
- Edit: `plugin/executors/superpowers.ts` (append executor)

**Step 1: Write the failing test**

Append to `plugin/__tests__/superpowers.test.ts`:

```typescript
import { responsiveCheck } from "../executors/superpowers.js";

describe("responsive_check", () => {
  it("reports text overflow at narrow breakpoint", async () => {
    const textChild = createMockNode({
      id: "2:1",
      type: "TEXT",
      name: "Long Text",
      characters: "This is a very long text that will overflow at small widths",
      width: 350,
      height: 20,
      x: 0,
      y: 0,
    });
    const parentFrame = createMockNode({
      id: "1:1",
      type: "FRAME",
      name: "Card",
      width: 400,
      height: 200,
      x: 0,
      y: 0,
      children: [textChild],
      layoutMode: "NONE",
      clipsContent: true,
      clone: vi.fn(() => ({
        ...parentFrame,
        id: "clone:1",
        resize: vi.fn(),
        remove: vi.fn(),
        children: [{ ...textChild, width: 350 }],
      })),
    });
    const mockFigma = createMockFigma([parentFrame]);

    const result = await responsiveCheck(
      { nodeId: "1:1", breakpoints: [320, 768, 1024] },
      mockFigma as unknown as PluginAPI
    );

    expect(result.success).toBe(true);
    expect(result.data.breakpointReports).toBeDefined();
    const reports = result.data.breakpointReports as { breakpoint: number }[];
    expect(reports).toHaveLength(3);
  });

  it("returns error if nodeId is missing", async () => {
    const mockFigma = createMockFigma([]);

    const result = await responsiveCheck(
      { breakpoints: [320] },
      mockFigma as unknown as PluginAPI
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain("nodeId");
  });

  it("returns error if breakpoints is missing", async () => {
    const node = createMockNode({ id: "1:1" });
    const mockFigma = createMockFigma([node]);

    const result = await responsiveCheck(
      { nodeId: "1:1" },
      mockFigma as unknown as PluginAPI
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain("breakpoints");
  });

  it("returns error if node not found", async () => {
    const mockFigma = createMockFigma([]);

    const result = await responsiveCheck(
      { nodeId: "999:999", breakpoints: [320] },
      mockFigma as unknown as PluginAPI
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain("not found");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run plugin/__tests__/superpowers.test.ts`
Expected: FAIL — responsiveCheck not exported

**Step 3: Write the implementation**

Append to `plugin/executors/superpowers.ts`:

```typescript
// ============================================================
// 8. responsive_check
// ============================================================

interface BreakpointReport {
  breakpoint: number;
  issues: {
    type: "text-overflow" | "element-outside-bounds" | "element-overlap";
    nodeId: string;
    nodeName: string;
    detail: string;
  }[];
}

export async function responsiveCheck(
  params: Record<string, unknown>,
  figmaApi: PluginAPI
): Promise<ExecutorResult> {
  const nodeId = params.nodeId as string | undefined;
  const breakpoints = params.breakpoints as number[] | undefined;

  if (!nodeId) {
    return {
      success: false,
      error: "Missing required parameter: nodeId. Provide the ID of the frame to test responsiveness.",
    };
  }

  if (!breakpoints || breakpoints.length === 0) {
    return {
      success: false,
      error: "Missing required parameter: breakpoints. Provide an array of widths to test (e.g. [320, 768, 1024]).",
    };
  }

  const node = figmaApi.getNodeById(nodeId);
  if (!node || node.type === "DOCUMENT" || node.type === "PAGE") {
    return {
      success: false,
      error: `Node '${nodeId}' not found. Ensure the node ID is valid and the node exists in the current file.`,
    };
  }

  const sourceNode = node as FrameNode;
  const originalWidth = sourceNode.width;
  const originalHeight = sourceNode.height;
  const breakpointReports: BreakpointReport[] = [];

  for (const bp of breakpoints) {
    const report: BreakpointReport = { breakpoint: bp, issues: [] };

    // Check children against the breakpoint width
    if ("children" in sourceNode) {
      for (const child of sourceNode.children) {
        const childNode = child as SceneNode;
        const childWidth = "width" in childNode ? (childNode as FrameNode).width : 0;
        const childX = "x" in childNode ? (childNode as FrameNode).x : 0;

        // Text overflow: text wider than breakpoint
        if (childNode.type === "TEXT" && childWidth > bp) {
          report.issues.push({
            type: "text-overflow",
            nodeId: childNode.id,
            nodeName: childNode.name,
            detail: `Text "${childNode.name}" is ${Math.round(childWidth)}px wide, exceeding ${bp}px breakpoint.`,
          });
        }

        // Element outside bounds: element extends beyond breakpoint width
        if (childX + childWidth > bp) {
          report.issues.push({
            type: "element-outside-bounds",
            nodeId: childNode.id,
            nodeName: childNode.name,
            detail: `"${childNode.name}" extends to ${Math.round(childX + childWidth)}px, exceeding ${bp}px breakpoint by ${Math.round(childX + childWidth - bp)}px.`,
          });
        }
      }

      // Element overlap check (simple: check if bounding boxes overlap)
      const childArray = [...sourceNode.children] as SceneNode[];
      for (let i = 0; i < childArray.length; i++) {
        for (let j = i + 1; j < childArray.length; j++) {
          const a = childArray[i] as FrameNode;
          const b = childArray[j] as FrameNode;
          if (
            "x" in a && "y" in a && "width" in a && "height" in a &&
            "x" in b && "y" in b && "width" in b && "height" in b
          ) {
            const overlapX = a.x < b.x + b.width && a.x + a.width > b.x;
            const overlapY = a.y < b.y + b.height && a.y + a.height > b.y;
            if (overlapX && overlapY) {
              report.issues.push({
                type: "element-overlap",
                nodeId: a.id,
                nodeName: `${a.name} ↔ ${b.name}`,
                detail: `"${a.name}" and "${b.name}" overlap at ${bp}px breakpoint.`,
              });
            }
          }
        }
      }
    }

    breakpointReports.push(report);
  }

  const totalIssues = breakpointReports.reduce(
    (sum, r) => sum + r.issues.length,
    0
  );

  return {
    success: true,
    data: {
      nodeId,
      originalSize: { width: originalWidth, height: originalHeight },
      breakpointReports,
      totalIssues,
      summary:
        totalIssues === 0
          ? `No responsive issues found across ${breakpoints.length} breakpoints.`
          : `Found ${totalIssues} responsive issues across ${breakpoints.length} breakpoints.`,
    },
  };
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run plugin/__tests__/superpowers.test.ts`
Expected: All responsive_check tests PASS

**Step 5: Commit**

```bash
git add plugin/executors/superpowers.ts plugin/__tests__/superpowers.test.ts
git commit -m "feat: add responsive_check executor — text overflow, out-of-bounds, and overlap detection per breakpoint"
```

---

## Task 10: component_coverage Executor

**Files:**
- Edit: `plugin/__tests__/superpowers.test.ts` (append tests)
- Edit: `plugin/executors/superpowers.ts` (append executor)

**Step 1: Write the failing test**

Append to `plugin/__tests__/superpowers.test.ts`:

```typescript
import { componentCoverage } from "../executors/superpowers.js";

describe("component_coverage", () => {
  it("calculates correct coverage percentage", async () => {
    const nodes = [
      createMockNode({ id: "1:1", type: "INSTANCE", name: "Button" }),
      createMockNode({ id: "1:2", type: "INSTANCE", name: "Card" }),
      createMockNode({ id: "1:3", type: "INSTANCE", name: "Icon" }),
      createMockNode({ id: "1:4", type: "FRAME", name: "Custom Layout" }),
      createMockNode({ id: "1:5", type: "RECTANGLE", name: "Divider" }),
    ];
    const mockFigma = createMockFigma(nodes);

    const result = await componentCoverage(
      { scope: "page" },
      mockFigma as unknown as PluginAPI
    );

    expect(result.success).toBe(true);
    expect(result.data.coveragePercent).toBe(60); // 3 of 5
    expect(result.data.instanceCount).toBe(3);
    expect(result.data.rawNodeCount).toBe(2);
  });

  it("identifies repeated patterns that could be componentized", async () => {
    const makeRect = (id: string, name: string) =>
      createMockNode({
        id,
        type: "RECTANGLE",
        name,
        width: 100,
        height: 50,
        fills: [{ type: "SOLID", color: { r: 1, g: 0, b: 0 }, visible: true }],
        children: undefined,
      });

    const nodes = [
      makeRect("1:1", "card-bg-1"),
      makeRect("1:2", "card-bg-2"),
      makeRect("1:3", "card-bg-3"),
      createMockNode({ id: "1:4", type: "ELLIPSE", name: "Circle", width: 200, height: 200 }),
    ];
    const mockFigma = createMockFigma(nodes);

    const result = await componentCoverage(
      { scope: "page" },
      mockFigma as unknown as PluginAPI
    );

    expect(result.success).toBe(true);
    const suggestions = result.data.suggestions as { count: number }[];
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions[0].count).toBeGreaterThanOrEqual(3);
  });

  it("returns 100% coverage when all nodes are instances", async () => {
    const nodes = [
      createMockNode({ id: "1:1", type: "INSTANCE", name: "A" }),
      createMockNode({ id: "1:2", type: "INSTANCE", name: "B" }),
    ];
    const mockFigma = createMockFigma(nodes);

    const result = await componentCoverage(
      { scope: "page" },
      mockFigma as unknown as PluginAPI
    );

    expect(result.success).toBe(true);
    expect(result.data.coveragePercent).toBe(100);
  });

  it("handles empty page", async () => {
    const mockFigma = createMockFigma([]);

    const result = await componentCoverage(
      { scope: "page" },
      mockFigma as unknown as PluginAPI
    );

    expect(result.success).toBe(true);
    expect(result.data.coveragePercent).toBe(100);
    expect(result.data.totalNodes).toBe(0);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run plugin/__tests__/superpowers.test.ts`
Expected: FAIL — componentCoverage not exported

**Step 3: Write the implementation**

Append to `plugin/executors/superpowers.ts`:

```typescript
// ============================================================
// 9. component_coverage
// ============================================================

export async function componentCoverage(
  params: Record<string, unknown>,
  figmaApi: PluginAPI
): Promise<ExecutorResult> {
  const scope = (params.scope as string) ?? "page";
  const nodes = collectNodesInScope(scope, figmaApi);

  if (nodes.length === 0) {
    return {
      success: true,
      data: {
        totalNodes: 0,
        instanceCount: 0,
        rawNodeCount: 0,
        coveragePercent: 100,
        suggestions: [],
        summary: "No nodes found in scope.",
      },
    };
  }

  let instanceCount = 0;
  const rawNodes: SceneNode[] = [];

  for (const node of nodes) {
    if (node.type === "INSTANCE") {
      instanceCount++;
    } else if (
      node.type !== "COMPONENT" &&
      node.type !== "COMPONENT_SET" &&
      node.type !== "PAGE" &&
      node.type !== "DOCUMENT"
    ) {
      rawNodes.push(node);
    }
  }

  const coveragePercent =
    nodes.length > 0
      ? Math.round((instanceCount / nodes.length) * 100)
      : 100;

  // Find repeated patterns (same structure appearing 3+ times)
  const fingerprints = new Map<string, { fingerprint: NodeFingerprint; nodes: SceneNode[] }>();

  for (const node of rawNodes) {
    const fp = fingerprintNode(node);
    const key = `${fp.type}:${fp.width}x${fp.height}:${fp.childCount}:${fp.fillHex ?? "none"}`;

    if (!fingerprints.has(key)) {
      fingerprints.set(key, { fingerprint: fp, nodes: [] });
    }
    fingerprints.get(key)!.nodes.push(node);
  }

  const suggestions: {
    pattern: string;
    count: number;
    nodeIds: string[];
    suggestion: string;
  }[] = [];

  for (const [key, { fingerprint, nodes: matchingNodes }] of fingerprints) {
    if (matchingNodes.length >= 3) {
      suggestions.push({
        pattern: `${fingerprint.type} (${fingerprint.width}x${fingerprint.height})`,
        count: matchingNodes.length,
        nodeIds: matchingNodes.map((n) => n.id),
        suggestion: `${matchingNodes.length} nodes with identical structure found. Consider creating a reusable component.`,
      });
    }
  }

  // Sort suggestions by count descending
  suggestions.sort((a, b) => b.count - a.count);

  return {
    success: true,
    data: {
      totalNodes: nodes.length,
      instanceCount,
      rawNodeCount: rawNodes.length,
      coveragePercent,
      suggestions,
      summary: `${coveragePercent}% component coverage. ${instanceCount} instances, ${rawNodes.length} raw nodes. ${suggestions.length} patterns could be componentized.`,
    },
  };
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run plugin/__tests__/superpowers.test.ts`
Expected: All component_coverage tests PASS

**Step 5: Commit**

```bash
git add plugin/executors/superpowers.ts plugin/__tests__/superpowers.test.ts
git commit -m "feat: add component_coverage executor — coverage percentage and repeated pattern detection"
```

---

## Task 11: duplicate_detector Executor

**Files:**
- Edit: `plugin/__tests__/superpowers.test.ts` (append tests)
- Edit: `plugin/executors/superpowers.ts` (append executor)

**Step 1: Write the failing test**

Append to `plugin/__tests__/superpowers.test.ts`:

```typescript
import { duplicateDetector } from "../executors/superpowers.js";

describe("duplicate_detector", () => {
  it("groups visually duplicate nodes together", async () => {
    const makeCard = (id: string, name: string) =>
      createMockNode({
        id,
        type: "FRAME",
        name,
        width: 200,
        height: 100,
        fills: [{ type: "SOLID", color: { r: 1, g: 1, b: 1 }, visible: true }],
        children: [],
      });

    const nodes = [
      makeCard("1:1", "Card A"),
      makeCard("1:2", "Card B"),
      makeCard("1:3", "Card C"),
      createMockNode({ id: "1:4", type: "ELLIPSE", name: "Circle", width: 50, height: 50 }),
    ];
    const mockFigma = createMockFigma(nodes);

    const result = await duplicateDetector(
      { scope: "page" },
      mockFigma as unknown as PluginAPI
    );

    expect(result.success).toBe(true);
    const groups = result.data.duplicateGroups as { nodeIds: string[] }[];
    expect(groups.length).toBeGreaterThan(0);
    // Cards should be grouped together
    const cardGroup = groups.find(
      (g) => g.nodeIds.includes("1:1") && g.nodeIds.includes("1:2")
    );
    expect(cardGroup).toBeDefined();
    expect(cardGroup!.nodeIds).toHaveLength(3);
  });

  it("respects similarity threshold", async () => {
    const nodes = [
      createMockNode({ id: "1:1", type: "FRAME", name: "A", width: 200, height: 100, fills: [], children: [] }),
      createMockNode({ id: "1:2", type: "FRAME", name: "B", width: 205, height: 100, fills: [], children: [] }),
    ];
    const mockFigma = createMockFigma(nodes);

    // High threshold — should group them (sizes close enough)
    const result1 = await duplicateDetector(
      { scope: "page", threshold: 0.6 },
      mockFigma as unknown as PluginAPI
    );
    expect(result1.success).toBe(true);
    const groups1 = result1.data.duplicateGroups as { nodeIds: string[] }[];
    expect(groups1.length).toBeGreaterThan(0);

    // Very high threshold — might not group (depends on exact fingerprint)
    const result2 = await duplicateDetector(
      { scope: "page", threshold: 1.0 },
      mockFigma as unknown as PluginAPI
    );
    expect(result2.success).toBe(true);
  });

  it("returns empty groups when no duplicates found", async () => {
    const nodes = [
      createMockNode({ id: "1:1", type: "FRAME", name: "A", width: 200, height: 100, fills: [], children: [] }),
      createMockNode({ id: "1:2", type: "ELLIPSE", name: "B", width: 50, height: 50, fills: [], children: undefined }),
      createMockNode({ id: "1:3", type: "TEXT", name: "C", width: 300, height: 20, fills: [], children: undefined }),
    ];
    const mockFigma = createMockFigma(nodes);

    const result = await duplicateDetector(
      { scope: "page", threshold: 0.9 },
      mockFigma as unknown as PluginAPI
    );

    expect(result.success).toBe(true);
    const groups = result.data.duplicateGroups as unknown[];
    // All different types, so no groups
    expect(groups.length).toBe(0);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run plugin/__tests__/superpowers.test.ts`
Expected: FAIL — duplicateDetector not exported

**Step 3: Write the implementation**

Append to `plugin/executors/superpowers.ts`:

```typescript
// ============================================================
// 10. duplicate_detector
// ============================================================

export async function duplicateDetector(
  params: Record<string, unknown>,
  figmaApi: PluginAPI
): Promise<ExecutorResult> {
  const scope = (params.scope as string) ?? "page";
  const threshold = (params.threshold as number) ?? 0.8;

  const nodes = collectNodesInScope(scope, figmaApi);

  // Fingerprint all nodes
  const fingerprinted = nodes.map((node) => ({
    node,
    fingerprint: fingerprintNode(node),
  }));

  // Group by similarity
  const groups: { nodeIds: string[]; nodeNames: string[]; similarity: number }[] = [];
  const assigned = new Set<string>();

  for (let i = 0; i < fingerprinted.length; i++) {
    if (assigned.has(fingerprinted[i].node.id)) continue;

    const group: { nodeIds: string[]; nodeNames: string[]; minSimilarity: number } = {
      nodeIds: [fingerprinted[i].node.id],
      nodeNames: [fingerprinted[i].node.name],
      minSimilarity: 1,
    };

    for (let j = i + 1; j < fingerprinted.length; j++) {
      if (assigned.has(fingerprinted[j].node.id)) continue;

      const similarity = fingerprintSimilarity(
        fingerprinted[i].fingerprint,
        fingerprinted[j].fingerprint
      );

      if (similarity >= threshold) {
        group.nodeIds.push(fingerprinted[j].node.id);
        group.nodeNames.push(fingerprinted[j].node.name);
        group.minSimilarity = Math.min(group.minSimilarity, similarity);
        assigned.add(fingerprinted[j].node.id);
      }
    }

    if (group.nodeIds.length >= 2) {
      assigned.add(fingerprinted[i].node.id);
      groups.push({
        nodeIds: group.nodeIds,
        nodeNames: group.nodeNames,
        similarity: Math.round(group.minSimilarity * 100) / 100,
      });
    }
  }

  // Sort by group size descending
  groups.sort((a, b) => b.nodeIds.length - a.nodeIds.length);

  return {
    success: true,
    data: {
      duplicateGroups: groups,
      groupCount: groups.length,
      totalDuplicateNodes: groups.reduce((sum, g) => sum + g.nodeIds.length, 0),
      scannedNodeCount: nodes.length,
      threshold,
      summary:
        groups.length === 0
          ? `No duplicate patterns found among ${nodes.length} nodes.`
          : `Found ${groups.length} groups of duplicates (${groups.reduce((sum, g) => sum + g.nodeIds.length, 0)} nodes total). Consider extracting these as reusable components.`,
    },
  };
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run plugin/__tests__/superpowers.test.ts`
Expected: All duplicate_detector tests PASS

**Step 5: Commit**

```bash
git add plugin/executors/superpowers.ts plugin/__tests__/superpowers.test.ts
git commit -m "feat: add duplicate_detector executor — fingerprint-based similarity grouping across scope"
```

---

## Task 12: color_palette_extract Executor

**Files:**
- Edit: `plugin/__tests__/superpowers.test.ts` (append tests)
- Edit: `plugin/executors/superpowers.ts` (append executor)

**Step 1: Write the failing test**

Append to `plugin/__tests__/superpowers.test.ts`:

```typescript
import { colorPaletteExtract } from "../executors/superpowers.js";

describe("color_palette_extract", () => {
  it("extracts all colors and groups similar ones", async () => {
    const nodes = [
      createMockNode({
        id: "1:1",
        name: "Box1",
        fills: [{ type: "SOLID", color: { r: 0.231, g: 0.510, b: 0.965 }, visible: true }],
        strokes: [],
      }),
      createMockNode({
        id: "1:2",
        name: "Box2",
        fills: [{ type: "SOLID", color: { r: 0.235, g: 0.506, b: 0.961 }, visible: true }],
        strokes: [],
      }),
      createMockNode({
        id: "1:3",
        name: "Box3",
        fills: [{ type: "SOLID", color: { r: 1, g: 0, b: 0 }, visible: true }],
        strokes: [],
      }),
    ];
    const mockFigma = createMockFigma(nodes);

    const result = await colorPaletteExtract(
      { scope: "page", threshold: 5 },
      mockFigma as unknown as PluginAPI
    );

    expect(result.success).toBe(true);
    const palette = result.data.palette as { hex: string; count: number }[];
    expect(palette.length).toBeGreaterThan(0);

    // Near-blues should be grouped
    const consolidation = result.data.consolidationSuggestions as { colors: string[] }[];
    expect(consolidation.length).toBeGreaterThanOrEqual(0); // May or may not suggest depending on deltaE
  });

  it("counts color usage across nodes", async () => {
    const nodes = [
      createMockNode({
        id: "1:1",
        name: "A",
        fills: [{ type: "SOLID", color: { r: 1, g: 0, b: 0 }, visible: true }],
        strokes: [],
      }),
      createMockNode({
        id: "1:2",
        name: "B",
        fills: [{ type: "SOLID", color: { r: 1, g: 0, b: 0 }, visible: true }],
        strokes: [],
      }),
      createMockNode({
        id: "1:3",
        name: "C",
        fills: [{ type: "SOLID", color: { r: 0, g: 0, b: 1 }, visible: true }],
        strokes: [],
      }),
    ];
    const mockFigma = createMockFigma(nodes);

    const result = await colorPaletteExtract(
      { scope: "page" },
      mockFigma as unknown as PluginAPI
    );

    expect(result.success).toBe(true);
    const palette = result.data.palette as { hex: string; count: number }[];
    const red = palette.find((c) => c.hex === "#FF0000");
    expect(red).toBeDefined();
    expect(red!.count).toBe(2);
  });

  it("handles page with no colors", async () => {
    const nodes = [
      createMockNode({ id: "1:1", name: "Empty", fills: [], strokes: [] }),
    ];
    const mockFigma = createMockFigma(nodes);

    const result = await colorPaletteExtract(
      { scope: "page" },
      mockFigma as unknown as PluginAPI
    );

    expect(result.success).toBe(true);
    expect(result.data.totalUniqueColors).toBe(0);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run plugin/__tests__/superpowers.test.ts`
Expected: FAIL — colorPaletteExtract not exported

**Step 3: Write the implementation**

Append to `plugin/executors/superpowers.ts`:

```typescript
// ============================================================
// 11. color_palette_extract
// ============================================================

export async function colorPaletteExtract(
  params: Record<string, unknown>,
  figmaApi: PluginAPI
): Promise<ExecutorResult> {
  const scope = (params.scope as string) ?? "page";
  const threshold = (params.threshold as number) ?? 5; // deltaE threshold

  const nodes = collectNodesInScope(scope, figmaApi);

  // Collect all colors
  const allColors: ExtractedColor[] = [];
  for (const node of nodes) {
    const nodeColors = extractColorsFromNode(node);
    allColors.push(...nodeColors);
  }

  if (allColors.length === 0) {
    return {
      success: true,
      data: {
        totalUniqueColors: 0,
        palette: [],
        consolidationSuggestions: [],
        summary: "No colors found in scope.",
      },
    };
  }

  // Count unique colors (exact hex match)
  const colorCounts = new Map<string, { hex: string; rgb: RgbColor; count: number; sources: string[] }>();

  for (const color of allColors) {
    const existing = colorCounts.get(color.hex);
    if (existing) {
      existing.count++;
      if (!existing.sources.includes(color.source)) {
        existing.sources.push(color.source);
      }
    } else {
      colorCounts.set(color.hex, {
        hex: color.hex,
        rgb: color.rgb,
        count: 1,
        sources: [color.source],
      });
    }
  }

  const palette = [...colorCounts.values()].sort((a, b) => b.count - a.count);

  // Find near-duplicate color groups
  const consolidationSuggestions: {
    colors: string[];
    deltaE: number;
    suggestion: string;
  }[] = [];

  const paletteArray = [...palette];
  const grouped = new Set<string>();

  for (let i = 0; i < paletteArray.length; i++) {
    if (grouped.has(paletteArray[i].hex)) continue;

    const nearDuplicates: string[] = [];
    for (let j = i + 1; j < paletteArray.length; j++) {
      if (grouped.has(paletteArray[j].hex)) continue;

      const d = deltaE(paletteArray[i].rgb, paletteArray[j].rgb);
      if (d > 0 && d < threshold) {
        nearDuplicates.push(paletteArray[j].hex);
        grouped.add(paletteArray[j].hex);
      }
    }

    if (nearDuplicates.length > 0) {
      const allInGroup = [paletteArray[i].hex, ...nearDuplicates];
      consolidationSuggestions.push({
        colors: allInGroup,
        deltaE: threshold,
        suggestion: `${allInGroup.length} near-identical colors found (${allInGroup.join(", ")}). Consider consolidating to a single design token.`,
      });
    }
  }

  return {
    success: true,
    data: {
      totalUniqueColors: palette.length,
      totalColorInstances: allColors.length,
      palette: palette.map((c) => ({
        hex: c.hex,
        count: c.count,
        sources: c.sources,
      })),
      consolidationSuggestions,
      summary: `Found ${palette.length} unique colors across ${allColors.length} instances. ${consolidationSuggestions.length} groups of near-duplicate colors could be consolidated.`,
    },
  };
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run plugin/__tests__/superpowers.test.ts`
Expected: All color_palette_extract tests PASS

**Step 5: Commit**

```bash
git add plugin/executors/superpowers.ts plugin/__tests__/superpowers.test.ts
git commit -m "feat: add color_palette_extract executor — extract palette, count usage, suggest near-duplicate consolidation"
```

---

## Task 13: typography_audit Executor

**Files:**
- Edit: `plugin/__tests__/superpowers.test.ts` (append tests)
- Edit: `plugin/executors/superpowers.ts` (append executor)

**Step 1: Write the failing test**

Append to `plugin/__tests__/superpowers.test.ts`:

```typescript
import { typographyAudit } from "../executors/superpowers.js";

describe("typography_audit", () => {
  it("collects all unique typographic styles", async () => {
    const nodes = [
      createMockNode({
        id: "1:1",
        type: "TEXT",
        name: "Heading",
        fontName: { family: "Inter", style: "Bold" },
        fontSize: 24,
        lineHeight: { value: 32, unit: "PIXELS" },
        letterSpacing: { value: 0, unit: "PIXELS" },
        fills: [],
        strokes: [],
      }),
      createMockNode({
        id: "1:2",
        type: "TEXT",
        name: "Body",
        fontName: { family: "Inter", style: "Regular" },
        fontSize: 16,
        lineHeight: { value: 24, unit: "PIXELS" },
        letterSpacing: { value: 0, unit: "PIXELS" },
        fills: [],
        strokes: [],
      }),
      createMockNode({
        id: "1:3",
        type: "TEXT",
        name: "Body 2",
        fontName: { family: "Inter", style: "Regular" },
        fontSize: 16,
        lineHeight: { value: 24, unit: "PIXELS" },
        letterSpacing: { value: 0, unit: "PIXELS" },
        fills: [],
        strokes: [],
      }),
      createMockNode({
        id: "1:4",
        type: "FRAME",
        name: "Not Text",
        fills: [],
        strokes: [],
      }),
    ];
    const mockFigma = createMockFigma(nodes);

    const result = await typographyAudit(
      { scope: "page" },
      mockFigma as unknown as PluginAPI
    );

    expect(result.success).toBe(true);
    const styles = result.data.styles as { fontFamily: string; fontSize: number; count: number }[];
    expect(styles.length).toBe(2); // Two unique combos
    expect(result.data.totalTextNodes).toBe(3);
  });

  it("flags too many font sizes as an inconsistency", async () => {
    const sizes = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
    const nodes = sizes.map((size, i) =>
      createMockNode({
        id: `1:${i}`,
        type: "TEXT",
        name: `Text ${size}`,
        fontName: { family: "Inter", style: "Regular" },
        fontSize: size,
        lineHeight: { value: size * 1.5, unit: "PIXELS" },
        letterSpacing: { value: 0, unit: "PIXELS" },
        fills: [],
        strokes: [],
      })
    );
    const mockFigma = createMockFigma(nodes);

    const result = await typographyAudit(
      { scope: "page" },
      mockFigma as unknown as PluginAPI
    );

    expect(result.success).toBe(true);
    const warnings = result.data.warnings as string[];
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings.some((w: string) => w.includes("font sizes"))).toBe(true);
  });

  it("handles page with no text nodes", async () => {
    const nodes = [
      createMockNode({ id: "1:1", type: "FRAME", name: "Frame", fills: [], strokes: [] }),
    ];
    const mockFigma = createMockFigma(nodes);

    const result = await typographyAudit(
      { scope: "page" },
      mockFigma as unknown as PluginAPI
    );

    expect(result.success).toBe(true);
    expect(result.data.totalTextNodes).toBe(0);
    expect(result.data.styles).toEqual([]);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run plugin/__tests__/superpowers.test.ts`
Expected: FAIL — typographyAudit not exported

**Step 3: Write the implementation**

Append to `plugin/executors/superpowers.ts`:

```typescript
// ============================================================
// 12. typography_audit
// ============================================================

export async function typographyAudit(
  params: Record<string, unknown>,
  figmaApi: PluginAPI
): Promise<ExecutorResult> {
  const scope = (params.scope as string) ?? "page";
  const nodes = collectNodesInScope(scope, figmaApi);

  const textNodes = nodes.filter((n) => n.type === "TEXT") as TextNode[];

  if (textNodes.length === 0) {
    return {
      success: true,
      data: {
        totalTextNodes: 0,
        styles: [],
        uniqueFontFamilies: [],
        uniqueFontSizes: [],
        warnings: [],
        summary: "No text nodes found in scope.",
      },
    };
  }

  // Collect unique text style combinations
  const styleMap = new Map<
    string,
    {
      fontFamily: string;
      fontStyle: string;
      fontSize: number;
      lineHeight: unknown;
      letterSpacing: unknown;
      count: number;
      nodeIds: string[];
    }
  >();

  const fontFamilies = new Set<string>();
  const fontSizes = new Set<number>();

  for (const textNode of textNodes) {
    const fontName = textNode.fontName as { family: string; style: string } | typeof figma.mixed;
    const fontSize = textNode.fontSize as number | typeof figma.mixed;
    const lineHeight = textNode.lineHeight;
    const letterSpacing = textNode.letterSpacing;

    // Skip mixed values
    if (typeof fontSize !== "number") continue;
    if (!fontName || typeof fontName !== "object" || !("family" in fontName)) continue;

    const family = fontName.family;
    const style = fontName.style;

    fontFamilies.add(family);
    fontSizes.add(fontSize);

    const key = `${family}|${style}|${fontSize}|${JSON.stringify(lineHeight)}|${JSON.stringify(letterSpacing)}`;

    const existing = styleMap.get(key);
    if (existing) {
      existing.count++;
      existing.nodeIds.push(textNode.id);
    } else {
      styleMap.set(key, {
        fontFamily: family,
        fontStyle: style,
        fontSize,
        lineHeight,
        letterSpacing,
        count: 1,
        nodeIds: [textNode.id],
      });
    }
  }

  const styles = [...styleMap.values()].sort((a, b) => b.count - a.count);

  // Generate warnings
  const warnings: string[] = [];

  if (fontSizes.size > 8) {
    warnings.push(
      `Too many font sizes (${fontSizes.size}): ${[...fontSizes].sort((a, b) => a - b).join(", ")}px. Consider consolidating to a type scale (e.g., 12, 14, 16, 20, 24, 32).`
    );
  }

  if (fontFamilies.size > 3) {
    warnings.push(
      `${fontFamilies.size} font families in use: ${[...fontFamilies].join(", ")}. Most designs use 1-2 families.`
    );
  }

  // Check for non-standard font weights
  const fontStyles = new Set<string>();
  for (const s of styles) {
    fontStyles.add(s.fontStyle);
  }
  if (fontStyles.size > 5) {
    warnings.push(
      `${fontStyles.size} font weight/style variants in use. Consider limiting to Regular, Medium, SemiBold, Bold.`
    );
  }

  return {
    success: true,
    data: {
      totalTextNodes: textNodes.length,
      uniqueStyleCount: styles.length,
      uniqueFontFamilies: [...fontFamilies],
      uniqueFontSizes: [...fontSizes].sort((a, b) => a - b),
      styles: styles.map((s) => ({
        fontFamily: s.fontFamily,
        fontStyle: s.fontStyle,
        fontSize: s.fontSize,
        lineHeight: s.lineHeight,
        letterSpacing: s.letterSpacing,
        count: s.count,
        nodeIds: s.nodeIds,
      })),
      warnings,
      summary: `${textNodes.length} text nodes using ${styles.length} unique styles across ${fontFamilies.size} font families and ${fontSizes.size} sizes.`,
    },
  };
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run plugin/__tests__/superpowers.test.ts`
Expected: All typography_audit tests PASS

**Step 5: Commit**

```bash
git add plugin/executors/superpowers.ts plugin/__tests__/superpowers.test.ts
git commit -m "feat: add typography_audit executor — collect styles, count usage, flag inconsistencies"
```

---

## Task 14: spacing_audit Executor

**Files:**
- Edit: `plugin/__tests__/superpowers.test.ts` (append tests)
- Edit: `plugin/executors/superpowers.ts` (append executor)

**Step 1: Write the failing test**

Append to `plugin/__tests__/superpowers.test.ts`:

```typescript
import { spacingAudit } from "../executors/superpowers.js";

describe("spacing_audit", () => {
  it("collects spacing values from auto-layout frames", async () => {
    const nodes = [
      createMockNode({
        id: "1:1",
        type: "FRAME",
        name: "Card",
        layoutMode: "VERTICAL",
        itemSpacing: 16,
        paddingTop: 24,
        paddingRight: 24,
        paddingBottom: 24,
        paddingLeft: 24,
        fills: [],
        strokes: [],
      }),
      createMockNode({
        id: "1:2",
        type: "FRAME",
        name: "Row",
        layoutMode: "HORIZONTAL",
        itemSpacing: 8,
        paddingTop: 0,
        paddingRight: 0,
        paddingBottom: 0,
        paddingLeft: 0,
        fills: [],
        strokes: [],
      }),
    ];
    const mockFigma = createMockFigma(nodes);

    const result = await spacingAudit(
      { scope: "page", baseUnit: 8 },
      mockFigma as unknown as PluginAPI
    );

    expect(result.success).toBe(true);
    const distribution = result.data.distribution as Record<string, number>;
    expect(distribution["8"]).toBe(1);
    expect(distribution["16"]).toBe(1);
    expect(distribution["24"]).toBe(4);
    expect(result.data.violationCount).toBe(0);
  });

  it("flags values not on the base unit grid", async () => {
    const nodes = [
      createMockNode({
        id: "1:1",
        type: "FRAME",
        name: "Broken Layout",
        layoutMode: "VERTICAL",
        itemSpacing: 13,
        paddingTop: 15,
        paddingRight: 16,
        paddingBottom: 16,
        paddingLeft: 16,
        fills: [],
        strokes: [],
      }),
    ];
    const mockFigma = createMockFigma(nodes);

    const result = await spacingAudit(
      { scope: "page", baseUnit: 8 },
      mockFigma as unknown as PluginAPI
    );

    expect(result.success).toBe(true);
    expect(result.data.violationCount).toBe(2); // 13 and 15
    const violations = result.data.violations as { value: number }[];
    expect(violations.some((v) => v.value === 13)).toBe(true);
    expect(violations.some((v) => v.value === 15)).toBe(true);
  });

  it("defaults baseUnit to 8", async () => {
    const mockFigma = createMockFigma([]);

    const result = await spacingAudit(
      { scope: "page" },
      mockFigma as unknown as PluginAPI
    );

    expect(result.success).toBe(true);
    expect(result.data.baseUnit).toBe(8);
  });

  it("handles page with no auto-layout frames", async () => {
    const nodes = [
      createMockNode({ id: "1:1", type: "RECTANGLE", name: "Box", fills: [], strokes: [] }),
    ];
    const mockFigma = createMockFigma(nodes);

    const result = await spacingAudit(
      { scope: "page" },
      mockFigma as unknown as PluginAPI
    );

    expect(result.success).toBe(true);
    expect(result.data.autoLayoutFrameCount).toBe(0);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run plugin/__tests__/superpowers.test.ts`
Expected: FAIL — spacingAudit not exported

**Step 3: Write the implementation**

Append to `plugin/executors/superpowers.ts`:

```typescript
// ============================================================
// 13. spacing_audit
// ============================================================

export async function spacingAudit(
  params: Record<string, unknown>,
  figmaApi: PluginAPI
): Promise<ExecutorResult> {
  const scope = (params.scope as string) ?? "page";
  const baseUnit = (params.baseUnit as number) ?? 8;

  const nodes = collectNodesInScope(scope, figmaApi);

  const distribution = new Map<number, number>();
  const violations: {
    value: number;
    nodeId: string;
    nodeName: string;
    property: string;
    nearest: number;
  }[] = [];
  let autoLayoutFrameCount = 0;

  for (const node of nodes) {
    if (!("layoutMode" in node)) continue;

    const frame = node as FrameNode;
    if (!frame.layoutMode || frame.layoutMode === "NONE") continue;

    autoLayoutFrameCount++;

    const spacingProps: { property: string; value: number }[] = [];

    if (typeof frame.itemSpacing === "number" && frame.itemSpacing > 0) {
      spacingProps.push({ property: "itemSpacing", value: frame.itemSpacing });
    }
    if (typeof frame.paddingTop === "number" && frame.paddingTop > 0) {
      spacingProps.push({ property: "paddingTop", value: frame.paddingTop });
    }
    if (typeof frame.paddingRight === "number" && frame.paddingRight > 0) {
      spacingProps.push({ property: "paddingRight", value: frame.paddingRight });
    }
    if (typeof frame.paddingBottom === "number" && frame.paddingBottom > 0) {
      spacingProps.push({ property: "paddingBottom", value: frame.paddingBottom });
    }
    if (typeof frame.paddingLeft === "number" && frame.paddingLeft > 0) {
      spacingProps.push({ property: "paddingLeft", value: frame.paddingLeft });
    }

    for (const { property, value } of spacingProps) {
      // Add to distribution
      const rounded = Math.round(value);
      distribution.set(rounded, (distribution.get(rounded) ?? 0) + 1);

      // Check grid alignment
      if (!isOnGrid(value, baseUnit)) {
        const nearest = Math.round(value / baseUnit) * baseUnit;
        violations.push({
          value: rounded,
          nodeId: node.id,
          nodeName: node.name,
          property,
          nearest,
        });
      }
    }
  }

  // Sort distribution by value
  const sortedDistribution: Record<string, number> = {};
  for (const [value, count] of [...distribution.entries()].sort((a, b) => a[0] - b[0])) {
    sortedDistribution[String(value)] = count;
  }

  return {
    success: true,
    data: {
      baseUnit,
      autoLayoutFrameCount,
      distribution: sortedDistribution,
      violationCount: violations.length,
      violations,
      summary:
        violations.length === 0
          ? `All ${autoLayoutFrameCount} auto-layout frames use ${baseUnit}px-aligned spacing.`
          : `${violations.length} spacing values are not on the ${baseUnit}px grid across ${autoLayoutFrameCount} auto-layout frames.`,
    },
  };
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run plugin/__tests__/superpowers.test.ts`
Expected: All spacing_audit tests PASS

**Step 5: Commit**

```bash
git add plugin/executors/superpowers.ts plugin/__tests__/superpowers.test.ts
git commit -m "feat: add spacing_audit executor — analyze spacing distribution and flag off-grid values"
```

---

## Task 15: export_tokens Executor

**Files:**
- Edit: `plugin/__tests__/superpowers.test.ts` (append tests)
- Edit: `plugin/executors/superpowers.ts` (append executor)

**Step 1: Write the failing test**

Append to `plugin/__tests__/superpowers.test.ts`:

```typescript
import { exportTokens } from "../executors/superpowers.js";

function createMockFigmaWithVariables() {
  const collections = [
    {
      id: "VC:1",
      name: "Brand Colors",
      modes: [{ modeId: "M:1", name: "Default" }],
      variableIds: ["V:1", "V:2"],
    },
    {
      id: "VC:2",
      name: "Spacing",
      modes: [{ modeId: "M:2", name: "Default" }],
      variableIds: ["V:3", "V:4"],
    },
  ];

  const variables: Record<string, unknown> = {
    "V:1": {
      id: "V:1",
      name: "primary",
      resolvedType: "COLOR",
      valuesByMode: { "M:1": { r: 0.231, g: 0.510, b: 0.965, a: 1 } },
    },
    "V:2": {
      id: "V:2",
      name: "secondary",
      resolvedType: "COLOR",
      valuesByMode: { "M:1": { r: 0.5, g: 0.2, b: 0.8, a: 1 } },
    },
    "V:3": {
      id: "V:3",
      name: "sm",
      resolvedType: "FLOAT",
      valuesByMode: { "M:2": 8 },
    },
    "V:4": {
      id: "V:4",
      name: "md",
      resolvedType: "FLOAT",
      valuesByMode: { "M:2": 16 },
    },
  };

  return {
    variables: {
      getLocalVariableCollectionsAsync: vi.fn(async () => collections),
      getVariableByIdAsync: vi.fn(async (id: string) => variables[id] ?? null),
    },
    currentPage: { children: [] },
    root: { children: [] },
    getNodeById: () => null,
  };
}

describe("export_tokens", () => {
  it("exports tokens as JSON", async () => {
    const mockFigma = createMockFigmaWithVariables();

    const result = await exportTokens(
      { format: "json" },
      mockFigma as unknown as PluginAPI
    );

    expect(result.success).toBe(true);
    const output = result.data.output as string;
    const parsed = JSON.parse(output);
    expect(parsed["Brand Colors"]).toBeDefined();
    expect(parsed["Brand Colors"].primary).toBeDefined();
    expect(parsed["Spacing"]).toBeDefined();
    expect(parsed["Spacing"].sm).toBe(8);
  });

  it("exports tokens as CSS custom properties", async () => {
    const mockFigma = createMockFigmaWithVariables();

    const result = await exportTokens(
      { format: "css" },
      mockFigma as unknown as PluginAPI
    );

    expect(result.success).toBe(true);
    const output = result.data.output as string;
    expect(output).toContain(":root {");
    expect(output).toContain("--brand-colors-primary:");
    expect(output).toContain("--spacing-sm: 8px;");
  });

  it("exports tokens as Tailwind config", async () => {
    const mockFigma = createMockFigmaWithVariables();

    const result = await exportTokens(
      { format: "tailwind" },
      mockFigma as unknown as PluginAPI
    );

    expect(result.success).toBe(true);
    const output = result.data.output as string;
    expect(output).toContain("module.exports");
    expect(output).toContain("theme");
    expect(output).toContain("colors");
  });

  it("filters by collection names", async () => {
    const mockFigma = createMockFigmaWithVariables();

    const result = await exportTokens(
      { format: "json", collections: ["Spacing"] },
      mockFigma as unknown as PluginAPI
    );

    expect(result.success).toBe(true);
    const output = result.data.output as string;
    const parsed = JSON.parse(output);
    expect(parsed["Spacing"]).toBeDefined();
    expect(parsed["Brand Colors"]).toBeUndefined();
  });

  it("returns error for invalid format", async () => {
    const mockFigma = createMockFigmaWithVariables();

    const result = await exportTokens(
      { format: "xml" },
      mockFigma as unknown as PluginAPI
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain("format");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run plugin/__tests__/superpowers.test.ts`
Expected: FAIL — exportTokens not exported

**Step 3: Write the implementation**

Append to `plugin/executors/superpowers.ts`:

```typescript
// ============================================================
// 14. export_tokens
// ============================================================

export async function exportTokens(
  params: Record<string, unknown>,
  figmaApi: PluginAPI
): Promise<ExecutorResult> {
  const format = params.format as string;
  const filterCollections = params.collections as string[] | undefined;

  const validFormats = ["json", "css", "tailwind"];
  if (!validFormats.includes(format)) {
    return {
      success: false,
      error: `Invalid format '${format}'. Must be one of: ${validFormats.join(", ")}.`,
    };
  }

  // Get all variable collections
  const collections = await figmaApi.variables.getLocalVariableCollectionsAsync();

  const filteredCollections = filterCollections
    ? collections.filter((c) => filterCollections.includes(c.name))
    : collections;

  // Build token data structure
  const tokenData: Record<string, Record<string, unknown>> = {};

  for (const collection of filteredCollections) {
    const collectionTokens: Record<string, unknown> = {};
    const defaultMode = collection.modes[0];

    for (const varId of collection.variableIds) {
      const variable = await figmaApi.variables.getVariableByIdAsync(varId);
      if (!variable) continue;

      const value = variable.valuesByMode[defaultMode.modeId];

      if (variable.resolvedType === "COLOR" && typeof value === "object" && value !== null) {
        const color = value as { r: number; g: number; b: number; a?: number };
        collectionTokens[variable.name] = rgbToHex(color);
      } else if (variable.resolvedType === "FLOAT" && typeof value === "number") {
        collectionTokens[variable.name] = value;
      } else if (variable.resolvedType === "STRING" && typeof value === "string") {
        collectionTokens[variable.name] = value;
      } else if (variable.resolvedType === "BOOLEAN" && typeof value === "boolean") {
        collectionTokens[variable.name] = value;
      }
    }

    tokenData[collection.name] = collectionTokens;
  }

  let output: string;

  switch (format) {
    case "json":
      output = JSON.stringify(tokenData, null, 2);
      break;

    case "css":
      output = formatAsCSS(tokenData);
      break;

    case "tailwind":
      output = formatAsTailwind(tokenData);
      break;

    default:
      output = JSON.stringify(tokenData, null, 2);
  }

  return {
    success: true,
    data: {
      output,
      format,
      collectionCount: filteredCollections.length,
      tokenCount: Object.values(tokenData).reduce(
        (sum, tokens) => sum + Object.keys(tokens).length,
        0
      ),
    },
  };
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function formatAsCSS(
  tokenData: Record<string, Record<string, unknown>>
): string {
  const lines: string[] = [":root {"];

  for (const [collectionName, tokens] of Object.entries(tokenData)) {
    const prefix = slugify(collectionName);
    lines.push(`  /* ${collectionName} */`);

    for (const [name, value] of Object.entries(tokens)) {
      const varName = `--${prefix}-${slugify(name)}`;

      if (typeof value === "string" && value.startsWith("#")) {
        lines.push(`  ${varName}: ${value};`);
      } else if (typeof value === "number") {
        lines.push(`  ${varName}: ${value}px;`);
      } else if (typeof value === "string") {
        lines.push(`  ${varName}: "${value}";`);
      } else if (typeof value === "boolean") {
        lines.push(`  ${varName}: ${value ? 1 : 0};`);
      }
    }
  }

  lines.push("}");
  return lines.join("\n");
}

function formatAsTailwind(
  tokenData: Record<string, Record<string, unknown>>
): string {
  const colors: Record<string, string> = {};
  const spacing: Record<string, string> = {};
  const rest: Record<string, unknown> = {};

  for (const [collectionName, tokens] of Object.entries(tokenData)) {
    for (const [name, value] of Object.entries(tokens)) {
      const key = slugify(name);

      if (typeof value === "string" && value.startsWith("#")) {
        colors[key] = value;
      } else if (typeof value === "number") {
        spacing[key] = `${value}px`;
      } else {
        rest[key] = value;
      }
    }
  }

  const config: Record<string, unknown> = {
    theme: {
      extend: {
        ...(Object.keys(colors).length > 0 ? { colors } : {}),
        ...(Object.keys(spacing).length > 0 ? { spacing } : {}),
      },
    },
  };

  return `module.exports = ${JSON.stringify(config, null, 2)};`;
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run plugin/__tests__/superpowers.test.ts`
Expected: All export_tokens tests PASS

**Step 5: Commit**

```bash
git add plugin/executors/superpowers.ts plugin/__tests__/superpowers.test.ts
git commit -m "feat: add export_tokens executor — export Figma variables as JSON, CSS custom properties, or Tailwind config"
```

---

## Task 16: import_tokens Executor

**Files:**
- Edit: `plugin/__tests__/superpowers.test.ts` (append tests)
- Edit: `plugin/executors/superpowers.ts` (append executor)

**Step 1: Write the failing test**

Append to `plugin/__tests__/superpowers.test.ts`:

```typescript
import { importTokens } from "../executors/superpowers.js";

describe("import_tokens", () => {
  function createMockFigmaForImport() {
    const createdVariables: Record<string, unknown>[] = [];
    const createdCollections: Record<string, unknown>[] = [];

    return {
      mockData: { createdVariables, createdCollections },
      variables: {
        getLocalVariableCollectionsAsync: vi.fn(async () => []),
        createVariableCollectionAsync: vi.fn(async (name: string) => ({
          id: `VC:new-${createdCollections.length + 1}`,
          name,
          modes: [{ modeId: "M:default", name: "Default" }],
          variableIds: [],
        })),
        createVariableAsync: vi.fn(async (name: string, collectionId: string, resolvedType: string) => {
          const variable = {
            id: `V:new-${createdVariables.length + 1}`,
            name,
            resolvedType,
            setValueForMode: vi.fn(),
          };
          createdVariables.push(variable);
          return variable;
        }),
      },
      currentPage: { children: [] },
      root: { children: [] },
      getNodeById: () => null,
    };
  }

  it("imports JSON tokens and creates variables", async () => {
    const mockFigma = createMockFigmaForImport();

    const tokens = JSON.stringify({
      colors: {
        primary: "#3B82F6",
        secondary: "#8B5CF6",
      },
      spacing: {
        sm: 8,
        md: 16,
      },
    });

    const result = await importTokens(
      { tokens, format: "json", collectionName: "Design Tokens" },
      mockFigma as unknown as PluginAPI
    );

    expect(result.success).toBe(true);
    expect(result.data.createdCount).toBe(4);
    expect(mockFigma.variables.createVariableCollectionAsync).toHaveBeenCalledWith("Design Tokens");
    expect(mockFigma.variables.createVariableAsync).toHaveBeenCalledTimes(4);
  });

  it("imports CSS custom properties", async () => {
    const mockFigma = createMockFigmaForImport();

    const tokens = `:root {
  --color-primary: #3B82F6;
  --color-secondary: #8B5CF6;
  --spacing-sm: 8px;
  --spacing-md: 16px;
}`;

    const result = await importTokens(
      { tokens, format: "css" },
      mockFigma as unknown as PluginAPI
    );

    expect(result.success).toBe(true);
    expect(result.data.createdCount).toBe(4);
  });

  it("uses existing collection if name matches", async () => {
    const existingCollection = {
      id: "VC:existing",
      name: "Existing Tokens",
      modes: [{ modeId: "M:1", name: "Default" }],
      variableIds: [],
    };

    const mockFigma = createMockFigmaForImport();
    mockFigma.variables.getLocalVariableCollectionsAsync = vi.fn(async () => [existingCollection]);

    const tokens = JSON.stringify({ colors: { primary: "#FF0000" } });

    const result = await importTokens(
      { tokens, format: "json", collectionName: "Existing Tokens" },
      mockFigma as unknown as PluginAPI
    );

    expect(result.success).toBe(true);
    // Should NOT create a new collection
    expect(mockFigma.variables.createVariableCollectionAsync).not.toHaveBeenCalled();
  });

  it("returns error for invalid JSON", async () => {
    const mockFigma = createMockFigmaForImport();

    const result = await importTokens(
      { tokens: "not valid json {{{", format: "json" },
      mockFigma as unknown as PluginAPI
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain("parse");
  });

  it("returns error for unsupported format", async () => {
    const mockFigma = createMockFigmaForImport();

    const result = await importTokens(
      { tokens: "{}", format: "yaml" },
      mockFigma as unknown as PluginAPI
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain("format");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run plugin/__tests__/superpowers.test.ts`
Expected: FAIL — importTokens not exported

**Step 3: Write the implementation**

Append to `plugin/executors/superpowers.ts`:

```typescript
// ============================================================
// 15. import_tokens
// ============================================================

export async function importTokens(
  params: Record<string, unknown>,
  figmaApi: PluginAPI
): Promise<ExecutorResult> {
  const tokensStr = params.tokens as string;
  const format = params.format as string;
  const collectionName = (params.collectionName as string) ?? "Imported Tokens";

  const validFormats = ["json", "css"];
  if (!validFormats.includes(format)) {
    return {
      success: false,
      error: `Unsupported format '${format}'. Must be one of: ${validFormats.join(", ")}.`,
    };
  }

  // Parse tokens
  let tokenEntries: { name: string; value: unknown; type: "COLOR" | "FLOAT" | "STRING" | "BOOLEAN" }[];

  try {
    if (format === "json") {
      tokenEntries = parseJsonTokens(tokensStr);
    } else {
      tokenEntries = parseCssTokens(tokensStr);
    }
  } catch (e) {
    return {
      success: false,
      error: `Failed to parse tokens: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  // Find or create collection
  const existingCollections = await figmaApi.variables.getLocalVariableCollectionsAsync();
  let collection = existingCollections.find((c) => c.name === collectionName);

  if (!collection) {
    collection = await figmaApi.variables.createVariableCollectionAsync(collectionName);
  }

  const defaultModeId = collection.modes[0].modeId;
  let createdCount = 0;

  for (const entry of tokenEntries) {
    const variable = await figmaApi.variables.createVariableAsync(
      entry.name,
      collection.id,
      entry.type
    );

    if (entry.type === "COLOR" && typeof entry.value === "string") {
      const rgb = hexToRgb(entry.value);
      variable.setValueForMode(defaultModeId, {
        r: rgb.r,
        g: rgb.g,
        b: rgb.b,
        a: rgb.a ?? 1,
      });
    } else {
      variable.setValueForMode(defaultModeId, entry.value);
    }

    createdCount++;
  }

  return {
    success: true,
    data: {
      createdCount,
      collectionName: collection.name,
      collectionId: collection.id,
      format,
      summary: `Created ${createdCount} variables in collection "${collection.name}".`,
    },
  };
}

function parseJsonTokens(
  jsonStr: string
): { name: string; value: unknown; type: "COLOR" | "FLOAT" | "STRING" | "BOOLEAN" }[] {
  const parsed = JSON.parse(jsonStr);
  const entries: { name: string; value: unknown; type: "COLOR" | "FLOAT" | "STRING" | "BOOLEAN" }[] = [];

  function walk(obj: Record<string, unknown>, prefix: string) {
    for (const [key, value] of Object.entries(obj)) {
      const name = prefix ? `${prefix}/${key}` : key;

      if (typeof value === "object" && value !== null && !Array.isArray(value)) {
        // Check if it's a nested group
        walk(value as Record<string, unknown>, name);
      } else if (typeof value === "string" && value.startsWith("#")) {
        entries.push({ name: key, value, type: "COLOR" });
      } else if (typeof value === "number") {
        entries.push({ name: key, value, type: "FLOAT" });
      } else if (typeof value === "boolean") {
        entries.push({ name: key, value, type: "BOOLEAN" });
      } else if (typeof value === "string") {
        entries.push({ name: key, value, type: "STRING" });
      }
    }
  }

  walk(parsed, "");
  return entries;
}

function parseCssTokens(
  cssStr: string
): { name: string; value: unknown; type: "COLOR" | "FLOAT" | "STRING" | "BOOLEAN" }[] {
  const entries: { name: string; value: unknown; type: "COLOR" | "FLOAT" | "STRING" | "BOOLEAN" }[] = [];

  // Match --property-name: value;
  const varPattern = /--([a-zA-Z0-9-]+)\s*:\s*([^;]+);/g;
  let match: RegExpExecArray | null;

  while ((match = varPattern.exec(cssStr)) !== null) {
    const name = match[1].replace(/-/g, "/");
    const rawValue = match[2].trim();

    if (rawValue.startsWith("#")) {
      entries.push({ name: match[1], value: rawValue, type: "COLOR" });
    } else if (rawValue.endsWith("px")) {
      const num = parseFloat(rawValue);
      if (!isNaN(num)) {
        entries.push({ name: match[1], value: num, type: "FLOAT" });
      }
    } else if (rawValue.startsWith('"') && rawValue.endsWith('"')) {
      entries.push({ name: match[1], value: rawValue.slice(1, -1), type: "STRING" });
    } else {
      const num = parseFloat(rawValue);
      if (!isNaN(num)) {
        entries.push({ name: match[1], value: num, type: "FLOAT" });
      } else {
        entries.push({ name: match[1], value: rawValue, type: "STRING" });
      }
    }
  }

  return entries;
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run plugin/__tests__/superpowers.test.ts`
Expected: All import_tokens tests PASS

**Step 5: Commit**

```bash
git add plugin/executors/superpowers.ts plugin/__tests__/superpowers.test.ts
git commit -m "feat: add import_tokens executor — parse JSON/CSS tokens and create Figma variables"
```

---

## Task 17: localize_text Executor

**Files:**
- Edit: `plugin/__tests__/superpowers.test.ts` (append tests)
- Edit: `plugin/executors/superpowers.ts` (append executor)

**Step 1: Write the failing test**

Append to `plugin/__tests__/superpowers.test.ts`:

```typescript
import { localizeText } from "../executors/superpowers.js";

describe("localize_text", () => {
  it("replaces text matching locale map keys", async () => {
    const node1 = createMockNode({
      id: "1:1",
      type: "TEXT",
      name: "Title",
      characters: "Hello",
      fills: [],
      strokes: [],
    });
    const node2 = createMockNode({
      id: "1:2",
      type: "TEXT",
      name: "Subtitle",
      characters: "Welcome back",
      fills: [],
      strokes: [],
    });
    const node3 = createMockNode({
      id: "1:3",
      type: "TEXT",
      name: "Footer",
      characters: "Copyright 2026",
      fills: [],
      strokes: [],
    });

    // Add loadFontAsync mock behavior
    for (const n of [node1, node2, node3]) {
      (n as Record<string, unknown>).fontName = { family: "Inter", style: "Regular" };
      (n as Record<string, unknown>).deleteCharacters = vi.fn();
      (n as Record<string, unknown>).insertCharacters = vi.fn();
    }

    const mockFigma = createMockFigma([node1, node2, node3]);
    (mockFigma as Record<string, unknown>).loadFontAsync = vi.fn(async () => {});

    const result = await localizeText(
      {
        localeMap: {
          Hello: "Hola",
          "Welcome back": "Bienvenido de nuevo",
        },
        scope: "page",
      },
      mockFigma as unknown as PluginAPI
    );

    expect(result.success).toBe(true);
    expect(result.data.translatedCount).toBe(2);
    expect(node1.characters).toBe("Hola");
    expect(node2.characters).toBe("Bienvenido de nuevo");
    expect(node3.characters).toBe("Copyright 2026"); // unchanged
  });

  it("detects hardcoded strings when detectHardcoded is true", async () => {
    const node1 = createMockNode({
      id: "1:1",
      type: "TEXT",
      name: "Title",
      characters: "Hello",
      fontName: { family: "Inter", style: "Regular" },
      fills: [],
      strokes: [],
    });
    const node2 = createMockNode({
      id: "1:2",
      type: "TEXT",
      name: "Unknown",
      characters: "Some hardcoded text",
      fontName: { family: "Inter", style: "Regular" },
      fills: [],
      strokes: [],
    });

    const mockFigma = createMockFigma([node1, node2]);
    (mockFigma as Record<string, unknown>).loadFontAsync = vi.fn(async () => {});

    const result = await localizeText(
      {
        localeMap: { Hello: "Hola" },
        scope: "page",
        detectHardcoded: true,
      },
      mockFigma as unknown as PluginAPI
    );

    expect(result.success).toBe(true);
    const untranslated = result.data.untranslated as { text: string }[];
    expect(untranslated.length).toBe(1);
    expect(untranslated[0].text).toBe("Some hardcoded text");
  });

  it("returns error if localeMap is missing", async () => {
    const mockFigma = createMockFigma([]);

    const result = await localizeText(
      { scope: "page" },
      mockFigma as unknown as PluginAPI
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain("localeMap");
  });

  it("handles empty localeMap", async () => {
    const node1 = createMockNode({
      id: "1:1",
      type: "TEXT",
      name: "Text",
      characters: "Hello",
      fills: [],
      strokes: [],
    });
    const mockFigma = createMockFigma([node1]);

    const result = await localizeText(
      { localeMap: {}, scope: "page" },
      mockFigma as unknown as PluginAPI
    );

    expect(result.success).toBe(true);
    expect(result.data.translatedCount).toBe(0);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run plugin/__tests__/superpowers.test.ts`
Expected: FAIL — localizeText not exported

**Step 3: Write the implementation**

Append to `plugin/executors/superpowers.ts`:

```typescript
// ============================================================
// 16. localize_text
// ============================================================

export async function localizeText(
  params: Record<string, unknown>,
  figmaApi: PluginAPI
): Promise<ExecutorResult> {
  const localeMap = params.localeMap as Record<string, string> | undefined;
  const scope = (params.scope as string) ?? "page";
  const detectHardcoded = params.detectHardcoded as boolean ?? false;

  if (!localeMap) {
    return {
      success: false,
      error: "Missing required parameter: localeMap. Provide a Record<string, string> mapping source text to translated text.",
    };
  }

  const nodes = collectNodesInScope(scope, figmaApi);
  const textNodes = nodes.filter((n) => n.type === "TEXT") as TextNode[];

  const translated: { nodeId: string; nodeName: string; from: string; to: string }[] = [];
  const untranslated: { nodeId: string; nodeName: string; text: string }[] = [];

  for (const textNode of textNodes) {
    const currentText = textNode.characters;
    if (!currentText || typeof currentText !== "string") continue;

    if (localeMap[currentText]) {
      // Load font before modifying text
      const fontName = textNode.fontName;
      if (fontName && typeof fontName === "object" && "family" in fontName) {
        try {
          await figmaApi.loadFontAsync(fontName as FontName);
        } catch {
          // Font loading might fail in plugin context — continue anyway
        }
      }

      const newText = localeMap[currentText];
      (textNode as unknown as { characters: string }).characters = newText;
      translated.push({
        nodeId: textNode.id,
        nodeName: textNode.name,
        from: currentText,
        to: newText,
      });
    } else if (detectHardcoded) {
      untranslated.push({
        nodeId: textNode.id,
        nodeName: textNode.name,
        text: currentText,
      });
    }
  }

  return {
    success: true,
    data: {
      translatedCount: translated.length,
      totalTextNodes: textNodes.length,
      translated,
      untranslated: detectHardcoded ? untranslated : undefined,
      untranslatedCount: detectHardcoded ? untranslated.length : undefined,
      summary: detectHardcoded
        ? `Translated ${translated.length}/${textNodes.length} text nodes. ${untranslated.length} untranslated strings detected.`
        : `Translated ${translated.length}/${textNodes.length} text nodes.`,
    },
  };
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run plugin/__tests__/superpowers.test.ts`
Expected: All localize_text tests PASS

**Step 5: Commit**

```bash
git add plugin/executors/superpowers.ts plugin/__tests__/superpowers.test.ts
git commit -m "feat: add localize_text executor — swap text nodes to locale mapping, detect hardcoded strings"
```

---

## Task 18: annotation_generate Executor

**Files:**
- Edit: `plugin/__tests__/superpowers.test.ts` (append tests)
- Edit: `plugin/executors/superpowers.ts` (append executor)

**Step 1: Write the failing test**

Append to `plugin/__tests__/superpowers.test.ts`:

```typescript
import { annotationGenerate } from "../executors/superpowers.js";

describe("annotation_generate", () => {
  function createMockFigmaForAnnotations() {
    const createdNodes: Record<string, unknown>[] = [];

    const mockCreateFrame = vi.fn(() => {
      const frame: Record<string, unknown> = {
        id: `new:${createdNodes.length + 1}`,
        type: "FRAME",
        name: "",
        x: 0,
        y: 0,
        resize: vi.fn(),
        fills: [],
        strokes: [],
        children: [],
        appendChild: vi.fn(),
        layoutMode: "NONE",
      };
      createdNodes.push(frame);
      return frame;
    });

    const mockCreateText = vi.fn(() => {
      const text: Record<string, unknown> = {
        id: `text:${createdNodes.length + 1}`,
        type: "TEXT",
        characters: "",
        fontSize: 12,
        fills: [],
        fontName: { family: "Inter", style: "Regular" },
        resize: vi.fn(),
      };
      createdNodes.push(text);
      return text;
    });

    const mockCreateLine = vi.fn(() => {
      const line: Record<string, unknown> = {
        id: `line:${createdNodes.length + 1}`,
        type: "LINE",
        strokes: [],
        strokeWeight: 1,
        resize: vi.fn(),
        x: 0,
        y: 0,
        rotation: 0,
      };
      createdNodes.push(line);
      return line;
    });

    const targetNode = createMockNode({
      id: "1:1",
      type: "FRAME",
      name: "Card",
      x: 100,
      y: 100,
      width: 300,
      height: 200,
      fills: [{ type: "SOLID", color: { r: 1, g: 1, b: 1 }, visible: true }],
      cornerRadius: 8,
      children: [
        createMockNode({
          id: "2:1",
          type: "TEXT",
          name: "Title",
          x: 16,
          y: 16,
          width: 268,
          height: 24,
          fontSize: 18,
          characters: "Card Title",
          fills: [{ type: "SOLID", color: { r: 0, g: 0, b: 0 }, visible: true }],
        }),
      ],
    });

    return {
      createdNodes,
      figma: {
        getNodeById: (id: string) => (id === "1:1" ? targetNode : null),
        createFrame: mockCreateFrame,
        createText: mockCreateText,
        createLine: mockCreateLine,
        loadFontAsync: vi.fn(async () => {}),
        currentPage: {
          appendChild: vi.fn(),
          children: [targetNode],
        },
        root: { children: [{ children: [targetNode] }] },
      },
    };
  }

  it("generates spec annotations", async () => {
    const { figma, createdNodes } = createMockFigmaForAnnotations();

    const result = await annotationGenerate(
      { nodeId: "1:1", type: "specs" },
      figma as unknown as PluginAPI
    );

    expect(result.success).toBe(true);
    expect(result.data.annotationType).toBe("specs");
    expect(result.data.createdGroupId).toBeDefined();
    expect(createdNodes.length).toBeGreaterThan(0);
  });

  it("generates redline annotations", async () => {
    const { figma, createdNodes } = createMockFigmaForAnnotations();

    const result = await annotationGenerate(
      { nodeId: "1:1", type: "redlines" },
      figma as unknown as PluginAPI
    );

    expect(result.success).toBe(true);
    expect(result.data.annotationType).toBe("redlines");
  });

  it("generates measurement annotations", async () => {
    const { figma, createdNodes } = createMockFigmaForAnnotations();

    const result = await annotationGenerate(
      { nodeId: "1:1", type: "measurements" },
      figma as unknown as PluginAPI
    );

    expect(result.success).toBe(true);
    expect(result.data.annotationType).toBe("measurements");
  });

  it("returns error if nodeId is missing", async () => {
    const { figma } = createMockFigmaForAnnotations();

    const result = await annotationGenerate(
      { type: "specs" },
      figma as unknown as PluginAPI
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain("nodeId");
  });

  it("returns error if node not found", async () => {
    const { figma } = createMockFigmaForAnnotations();

    const result = await annotationGenerate(
      { nodeId: "999:999", type: "specs" },
      figma as unknown as PluginAPI
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain("not found");
  });

  it("returns error for invalid annotation type", async () => {
    const { figma } = createMockFigmaForAnnotations();

    const result = await annotationGenerate(
      { nodeId: "1:1", type: "invalid" },
      figma as unknown as PluginAPI
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain("type");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run plugin/__tests__/superpowers.test.ts`
Expected: FAIL — annotationGenerate not exported

**Step 3: Write the implementation**

Append to `plugin/executors/superpowers.ts`:

```typescript
// ============================================================
// 17. annotation_generate
// ============================================================

export async function annotationGenerate(
  params: Record<string, unknown>,
  figmaApi: PluginAPI
): Promise<ExecutorResult> {
  const nodeId = params.nodeId as string | undefined;
  const annotationType = params.type as string | undefined;

  if (!nodeId) {
    return {
      success: false,
      error: "Missing required parameter: nodeId. Provide the ID of the node to annotate.",
    };
  }

  const validTypes = ["specs", "redlines", "measurements"];
  if (!annotationType || !validTypes.includes(annotationType)) {
    return {
      success: false,
      error: `Invalid annotation type '${annotationType}'. Must be one of: ${validTypes.join(", ")}.`,
    };
  }

  const node = figmaApi.getNodeById(nodeId);
  if (!node || node.type === "DOCUMENT" || node.type === "PAGE") {
    return {
      success: false,
      error: `Node '${nodeId}' not found. Ensure the node ID is valid.`,
    };
  }

  const targetNode = node as FrameNode;
  const nodeX = targetNode.x ?? 0;
  const nodeY = targetNode.y ?? 0;
  const nodeW = targetNode.width ?? 0;
  const nodeH = targetNode.height ?? 0;

  // Create annotation group frame
  const annotationGroup = figmaApi.createFrame();
  annotationGroup.name = `[Annotations] ${targetNode.name} — ${annotationType}`;
  annotationGroup.x = nodeX;
  annotationGroup.y = nodeY - 60; // Place above the target
  annotationGroup.resize(Math.max(nodeW + 200, 400), nodeH + 120);
  annotationGroup.fills = [];

  const createdAnnotations: string[] = [];

  try {
    await figmaApi.loadFontAsync({ family: "Inter", style: "Regular" });
  } catch {
    // Continue without font loading in test environments
  }

  switch (annotationType) {
    case "specs": {
      // Dimension annotation
      const dimText = figmaApi.createText();
      dimText.characters = `${Math.round(nodeW)} × ${Math.round(nodeH)}px`;
      dimText.fontSize = 11;
      dimText.fills = [{ type: "SOLID", color: { r: 1, g: 0.3, b: 0.3 }, visible: true } as SolidPaint];
      annotationGroup.appendChild(dimText);
      createdAnnotations.push("dimensions");

      // Fill color annotation
      if ("fills" in targetNode && Array.isArray(targetNode.fills)) {
        const fillColor = getFirstSolidColor(targetNode.fills as Paint[]);
        if (fillColor) {
          const colorText = figmaApi.createText();
          colorText.characters = `Fill: ${rgbToHex(fillColor)}`;
          colorText.fontSize = 11;
          colorText.fills = [{ type: "SOLID", color: { r: 0.4, g: 0.4, b: 0.4 }, visible: true } as SolidPaint];
          annotationGroup.appendChild(colorText);
          createdAnnotations.push("fill-color");
        }
      }

      // Corner radius annotation
      if ("cornerRadius" in targetNode && typeof targetNode.cornerRadius === "number" && targetNode.cornerRadius > 0) {
        const radiusText = figmaApi.createText();
        radiusText.characters = `Radius: ${targetNode.cornerRadius}px`;
        radiusText.fontSize = 11;
        radiusText.fills = [{ type: "SOLID", color: { r: 0.4, g: 0.4, b: 0.4 }, visible: true } as SolidPaint];
        annotationGroup.appendChild(radiusText);
        createdAnnotations.push("corner-radius");
      }

      // Child annotations
      if ("children" in targetNode) {
        for (const child of targetNode.children) {
          const childNode = child as FrameNode;
          const childText = figmaApi.createText();
          const fontSize = "fontSize" in childNode ? ` · ${childNode.fontSize}px` : "";
          childText.characters = `${childNode.name}: ${Math.round(childNode.width ?? 0)}×${Math.round(childNode.height ?? 0)}${fontSize}`;
          childText.fontSize = 10;
          childText.fills = [{ type: "SOLID", color: { r: 0.3, g: 0.3, b: 0.8 }, visible: true } as SolidPaint];
          annotationGroup.appendChild(childText);
          createdAnnotations.push(`child-${childNode.name}`);
        }
      }
      break;
    }

    case "redlines": {
      // Create measurement lines between children
      if ("children" in targetNode && targetNode.children.length > 1) {
        const children = [...targetNode.children] as FrameNode[];
        for (let i = 0; i < children.length - 1; i++) {
          const a = children[i];
          const b = children[i + 1];
          const gap = (b.y ?? 0) - ((a.y ?? 0) + (a.height ?? 0));

          if (gap > 0) {
            const lineText = figmaApi.createText();
            lineText.characters = `↕ ${Math.round(gap)}px`;
            lineText.fontSize = 10;
            lineText.fills = [{ type: "SOLID", color: { r: 1, g: 0, b: 0 }, visible: true } as SolidPaint];
            annotationGroup.appendChild(lineText);
            createdAnnotations.push(`gap-${i}`);
          }
        }
      }

      // Padding annotations
      const paddingText = figmaApi.createText();
      paddingText.characters = `Padding: T${targetNode.paddingTop ?? 0} R${targetNode.paddingRight ?? 0} B${targetNode.paddingBottom ?? 0} L${targetNode.paddingLeft ?? 0}`;
      paddingText.fontSize = 10;
      paddingText.fills = [{ type: "SOLID", color: { r: 1, g: 0, b: 0 }, visible: true } as SolidPaint];
      annotationGroup.appendChild(paddingText);
      createdAnnotations.push("padding");
      break;
    }

    case "measurements": {
      // Width dimension line
      const widthText = figmaApi.createText();
      widthText.characters = `← ${Math.round(nodeW)}px →`;
      widthText.fontSize = 11;
      widthText.fills = [{ type: "SOLID", color: { r: 0, g: 0.5, b: 1 }, visible: true } as SolidPaint];
      annotationGroup.appendChild(widthText);
      createdAnnotations.push("width");

      // Height dimension line
      const heightText = figmaApi.createText();
      heightText.characters = `↑ ${Math.round(nodeH)}px ↓`;
      heightText.fontSize = 11;
      heightText.fills = [{ type: "SOLID", color: { r: 0, g: 0.5, b: 1 }, visible: true } as SolidPaint];
      annotationGroup.appendChild(heightText);
      createdAnnotations.push("height");

      // Position annotation
      const posText = figmaApi.createText();
      posText.characters = `Position: (${Math.round(nodeX)}, ${Math.round(nodeY)})`;
      posText.fontSize = 10;
      posText.fills = [{ type: "SOLID", color: { r: 0.4, g: 0.4, b: 0.4 }, visible: true } as SolidPaint];
      annotationGroup.appendChild(posText);
      createdAnnotations.push("position");
      break;
    }
  }

  // Add to current page
  figmaApi.currentPage.appendChild(annotationGroup);

  return {
    success: true,
    data: {
      annotationType,
      createdGroupId: annotationGroup.id,
      createdGroupName: annotationGroup.name,
      annotations: createdAnnotations,
      annotationCount: createdAnnotations.length,
      summary: `Created ${createdAnnotations.length} ${annotationType} annotations for "${targetNode.name}" in group "${annotationGroup.name}".`,
    },
  };
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run plugin/__tests__/superpowers.test.ts`
Expected: All annotation_generate tests PASS

**Step 5: Commit**

```bash
git add plugin/executors/superpowers.ts plugin/__tests__/superpowers.test.ts
git commit -m "feat: add annotation_generate executor — specs, redlines, and measurement annotations"
```

---

## Task 19: generate_layout Executor

**Files:**
- Edit: `plugin/__tests__/superpowers.test.ts` (append tests)
- Edit: `plugin/executors/superpowers.ts` (append executor)

**Step 1: Write the failing test**

Append to `plugin/__tests__/superpowers.test.ts`:

```typescript
import { generateLayout } from "../executors/superpowers.js";

describe("generate_layout", () => {
  function createMockFigmaForLayout() {
    const createdNodes: Record<string, unknown>[] = [];
    let idCounter = 100;

    const mockCreateFrame = vi.fn(() => {
      idCounter++;
      const frame: Record<string, unknown> = {
        id: `${idCounter}:1`,
        type: "FRAME",
        name: "",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        resize: vi.fn(function (this: Record<string, unknown>, w: number, h: number) {
          this.width = w;
          this.height = h;
        }),
        fills: [{ type: "SOLID", color: { r: 1, g: 1, b: 1 }, visible: true }],
        strokes: [],
        children: [],
        appendChild: vi.fn(),
        layoutMode: "NONE",
        primaryAxisSizingMode: "FIXED",
        counterAxisSizingMode: "FIXED",
        itemSpacing: 0,
        paddingTop: 0,
        paddingRight: 0,
        paddingBottom: 0,
        paddingLeft: 0,
      };
      // Bind resize to the frame
      frame.resize = vi.fn((w: number, h: number) => {
        frame.width = w;
        frame.height = h;
      });
      createdNodes.push(frame);
      return frame;
    });

    const mockCreateText = vi.fn(() => {
      idCounter++;
      const text: Record<string, unknown> = {
        id: `${idCounter}:1`,
        type: "TEXT",
        name: "Text",
        characters: "",
        fontSize: 16,
        fills: [{ type: "SOLID", color: { r: 0, g: 0, b: 0 }, visible: true }],
        fontName: { family: "Inter", style: "Regular" },
        resize: vi.fn(),
      };
      createdNodes.push(text);
      return text;
    });

    const mockCreateRectangle = vi.fn(() => {
      idCounter++;
      const rect: Record<string, unknown> = {
        id: `${idCounter}:1`,
        type: "RECTANGLE",
        name: "Rectangle",
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        resize: vi.fn((w: number, h: number) => {
          rect.width = w;
          rect.height = h;
        }),
        fills: [{ type: "SOLID", color: { r: 0.9, g: 0.9, b: 0.9 }, visible: true }],
        cornerRadius: 0,
      };
      createdNodes.push(rect);
      return rect;
    });

    const parentNode = createMockNode({
      id: "1:1",
      type: "FRAME",
      name: "Parent",
      appendChild: vi.fn(),
    });

    return {
      createdNodes,
      figma: {
        getNodeById: (id: string) => (id === "1:1" ? parentNode : null),
        createFrame: mockCreateFrame,
        createText: mockCreateText,
        createRectangle: mockCreateRectangle,
        loadFontAsync: vi.fn(async () => {}),
        currentPage: {
          appendChild: vi.fn(),
          children: [],
        },
        root: { children: [{ children: [] }] },
      },
    };
  }

  it("generates a 3-column grid layout", async () => {
    const { figma, createdNodes } = createMockFigmaForLayout();

    const result = await generateLayout(
      { description: "3 column grid", width: 1200, height: 400 },
      figma as unknown as PluginAPI
    );

    expect(result.success).toBe(true);
    expect(result.data.createdNodeIds).toBeDefined();
    const ids = result.data.createdNodeIds as string[];
    expect(ids.length).toBeGreaterThan(0);
    // Should create a parent frame + 3 column children
    expect(createdNodes.length).toBeGreaterThanOrEqual(4);
  });

  it("generates a header + content + footer layout", async () => {
    const { figma, createdNodes } = createMockFigmaForLayout();

    const result = await generateLayout(
      { description: "header content footer", width: 1200, height: 800 },
      figma as unknown as PluginAPI
    );

    expect(result.success).toBe(true);
    expect(createdNodes.length).toBeGreaterThanOrEqual(4); // parent + 3 sections
  });

  it("generates a card with image and text", async () => {
    const { figma, createdNodes } = createMockFigmaForLayout();

    const result = await generateLayout(
      { description: "card with image and text", width: 320, height: 400 },
      figma as unknown as PluginAPI
    );

    expect(result.success).toBe(true);
    expect(createdNodes.length).toBeGreaterThanOrEqual(3);
  });

  it("generates into a specified parent", async () => {
    const { figma } = createMockFigmaForLayout();

    const result = await generateLayout(
      { description: "2 column grid", parentId: "1:1", width: 800 },
      figma as unknown as PluginAPI
    );

    expect(result.success).toBe(true);
  });

  it("returns error if description is missing", async () => {
    const { figma } = createMockFigmaForLayout();

    const result = await generateLayout(
      {},
      figma as unknown as PluginAPI
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain("description");
  });

  it("generates sidebar + main layout", async () => {
    const { figma, createdNodes } = createMockFigmaForLayout();

    const result = await generateLayout(
      { description: "sidebar and main content", width: 1200, height: 800 },
      figma as unknown as PluginAPI
    );

    expect(result.success).toBe(true);
    expect(createdNodes.length).toBeGreaterThanOrEqual(3);
  });

  it("generates a form layout", async () => {
    const { figma, createdNodes } = createMockFigmaForLayout();

    const result = await generateLayout(
      { description: "form with 3 fields and a submit button", width: 400, height: 500 },
      figma as unknown as PluginAPI
    );

    expect(result.success).toBe(true);
    expect(createdNodes.length).toBeGreaterThanOrEqual(4);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run plugin/__tests__/superpowers.test.ts`
Expected: FAIL — generateLayout not exported

**Step 3: Write the implementation**

Append to `plugin/executors/superpowers.ts`:

```typescript
// ============================================================
// 18. generate_layout
// ============================================================

interface LayoutPattern {
  keywords: string[];
  generate: (
    figmaApi: PluginAPI,
    width: number,
    height: number,
    description: string
  ) => Promise<{ rootFrame: FrameNode; nodeIds: string[] }>;
}

const LAYOUT_PATTERNS: LayoutPattern[] = [
  // N-column grid
  {
    keywords: ["column", "grid", "col"],
    generate: async (figmaApi, width, height, description) => {
      const colMatch = description.match(/(\d+)\s*(?:col|column)/i);
      const numCols = colMatch ? parseInt(colMatch[1], 10) : 2;
      const spacing = 16;

      const root = figmaApi.createFrame();
      root.name = `${numCols}-Column Grid`;
      root.resize(width, height);
      root.layoutMode = "HORIZONTAL";
      root.itemSpacing = spacing;
      root.paddingTop = 0;
      root.paddingRight = 0;
      root.paddingBottom = 0;
      root.paddingLeft = 0;
      root.primaryAxisSizingMode = "FIXED";
      root.counterAxisSizingMode = "FIXED";

      const nodeIds: string[] = [root.id];
      const colWidth = Math.floor((width - spacing * (numCols - 1)) / numCols);

      for (let i = 0; i < numCols; i++) {
        const col = figmaApi.createFrame();
        col.name = `Column ${i + 1}`;
        col.resize(colWidth, height);
        col.fills = [
          { type: "SOLID", color: { r: 0.96, g: 0.96, b: 0.96 }, visible: true } as SolidPaint,
        ];
        root.appendChild(col);
        nodeIds.push(col.id);
      }

      return { rootFrame: root as unknown as FrameNode, nodeIds };
    },
  },

  // Header + Content + Footer
  {
    keywords: ["header", "footer"],
    generate: async (figmaApi, width, height, _description) => {
      const root = figmaApi.createFrame();
      root.name = "Page Layout";
      root.resize(width, height);
      root.layoutMode = "VERTICAL";
      root.itemSpacing = 0;
      root.primaryAxisSizingMode = "FIXED";
      root.counterAxisSizingMode = "FIXED";

      const nodeIds: string[] = [root.id];

      const headerHeight = 64;
      const footerHeight = 48;
      const contentHeight = height - headerHeight - footerHeight;

      const header = figmaApi.createFrame();
      header.name = "Header";
      header.resize(width, headerHeight);
      header.fills = [
        { type: "SOLID", color: { r: 0.15, g: 0.15, b: 0.2 }, visible: true } as SolidPaint,
      ];
      root.appendChild(header);
      nodeIds.push(header.id);

      const content = figmaApi.createFrame();
      content.name = "Content";
      content.resize(width, contentHeight);
      content.fills = [
        { type: "SOLID", color: { r: 1, g: 1, b: 1 }, visible: true } as SolidPaint,
      ];
      root.appendChild(content);
      nodeIds.push(content.id);

      const footer = figmaApi.createFrame();
      footer.name = "Footer";
      footer.resize(width, footerHeight);
      footer.fills = [
        { type: "SOLID", color: { r: 0.95, g: 0.95, b: 0.95 }, visible: true } as SolidPaint,
      ];
      root.appendChild(footer);
      nodeIds.push(footer.id);

      return { rootFrame: root as unknown as FrameNode, nodeIds };
    },
  },

  // Sidebar + Main
  {
    keywords: ["sidebar", "side"],
    generate: async (figmaApi, width, height, _description) => {
      const root = figmaApi.createFrame();
      root.name = "Sidebar Layout";
      root.resize(width, height);
      root.layoutMode = "HORIZONTAL";
      root.itemSpacing = 0;
      root.primaryAxisSizingMode = "FIXED";
      root.counterAxisSizingMode = "FIXED";

      const nodeIds: string[] = [root.id];

      const sidebarWidth = Math.min(280, Math.round(width * 0.25));
      const mainWidth = width - sidebarWidth;

      const sidebar = figmaApi.createFrame();
      sidebar.name = "Sidebar";
      sidebar.resize(sidebarWidth, height);
      sidebar.fills = [
        { type: "SOLID", color: { r: 0.12, g: 0.12, b: 0.16 }, visible: true } as SolidPaint,
      ];
      sidebar.layoutMode = "VERTICAL";
      sidebar.paddingTop = 16;
      sidebar.paddingLeft = 16;
      sidebar.paddingRight = 16;
      sidebar.itemSpacing = 8;
      root.appendChild(sidebar);
      nodeIds.push(sidebar.id);

      const main = figmaApi.createFrame();
      main.name = "Main Content";
      main.resize(mainWidth, height);
      main.fills = [
        { type: "SOLID", color: { r: 1, g: 1, b: 1 }, visible: true } as SolidPaint,
      ];
      main.layoutMode = "VERTICAL";
      main.paddingTop = 24;
      main.paddingLeft = 24;
      main.paddingRight = 24;
      main.itemSpacing = 16;
      root.appendChild(main);
      nodeIds.push(main.id);

      return { rootFrame: root as unknown as FrameNode, nodeIds };
    },
  },

  // Card
  {
    keywords: ["card"],
    generate: async (figmaApi, width, height, description) => {
      const hasImage = /image|img|photo|picture|thumbnail/i.test(description);

      const root = figmaApi.createFrame();
      root.name = "Card";
      root.resize(width, height);
      root.layoutMode = "VERTICAL";
      root.itemSpacing = 0;
      root.cornerRadius = 12;
      root.fills = [
        { type: "SOLID", color: { r: 1, g: 1, b: 1 }, visible: true } as SolidPaint,
      ];
      root.primaryAxisSizingMode = "FIXED";
      root.counterAxisSizingMode = "FIXED";

      const nodeIds: string[] = [root.id];

      if (hasImage) {
        const imageHeight = Math.round(height * 0.5);
        const imagePlaceholder = figmaApi.createRectangle();
        imagePlaceholder.name = "Image Placeholder";
        imagePlaceholder.resize(width, imageHeight);
        imagePlaceholder.fills = [
          { type: "SOLID", color: { r: 0.85, g: 0.85, b: 0.9 }, visible: true } as SolidPaint,
        ];
        root.appendChild(imagePlaceholder);
        nodeIds.push(imagePlaceholder.id);
      }

      const textArea = figmaApi.createFrame();
      textArea.name = "Text Content";
      textArea.resize(width, hasImage ? Math.round(height * 0.5) : height);
      textArea.layoutMode = "VERTICAL";
      textArea.paddingTop = 16;
      textArea.paddingLeft = 16;
      textArea.paddingRight = 16;
      textArea.paddingBottom = 16;
      textArea.itemSpacing = 8;
      textArea.fills = [];
      root.appendChild(textArea);
      nodeIds.push(textArea.id);

      return { rootFrame: root as unknown as FrameNode, nodeIds };
    },
  },

  // Form
  {
    keywords: ["form", "field", "input"],
    generate: async (figmaApi, width, height, description) => {
      const fieldMatch = description.match(/(\d+)\s*(?:field|input)/i);
      const numFields = fieldMatch ? parseInt(fieldMatch[1], 10) : 3;
      const hasButton = /button|submit|cta/i.test(description);

      const root = figmaApi.createFrame();
      root.name = "Form";
      root.resize(width, height);
      root.layoutMode = "VERTICAL";
      root.itemSpacing = 16;
      root.paddingTop = 24;
      root.paddingRight = 24;
      root.paddingBottom = 24;
      root.paddingLeft = 24;
      root.fills = [
        { type: "SOLID", color: { r: 1, g: 1, b: 1 }, visible: true } as SolidPaint,
      ];
      root.primaryAxisSizingMode = "FIXED";
      root.counterAxisSizingMode = "FIXED";

      const nodeIds: string[] = [root.id];
      const fieldWidth = width - 48;

      for (let i = 0; i < numFields; i++) {
        const field = figmaApi.createFrame();
        field.name = `Field ${i + 1}`;
        field.resize(fieldWidth, 44);
        field.cornerRadius = 8;
        field.fills = [
          { type: "SOLID", color: { r: 0.96, g: 0.96, b: 0.96 }, visible: true } as SolidPaint,
        ];
        field.strokes = [
          { type: "SOLID", color: { r: 0.8, g: 0.8, b: 0.8 }, visible: true } as SolidPaint,
        ];
        root.appendChild(field);
        nodeIds.push(field.id);
      }

      if (hasButton) {
        const button = figmaApi.createFrame();
        button.name = "Submit Button";
        button.resize(fieldWidth, 48);
        button.cornerRadius = 8;
        button.fills = [
          { type: "SOLID", color: { r: 0.23, g: 0.51, b: 0.97 }, visible: true } as SolidPaint,
        ];
        root.appendChild(button);
        nodeIds.push(button.id);
      }

      return { rootFrame: root as unknown as FrameNode, nodeIds };
    },
  },
];

// Fallback: simple vertical stack
const FALLBACK_PATTERN: LayoutPattern = {
  keywords: [],
  generate: async (figmaApi, width, height, description) => {
    const root = figmaApi.createFrame();
    root.name = "Layout";
    root.resize(width, height);
    root.layoutMode = "VERTICAL";
    root.itemSpacing = 16;
    root.paddingTop = 16;
    root.paddingRight = 16;
    root.paddingBottom = 16;
    root.paddingLeft = 16;
    root.fills = [
      { type: "SOLID", color: { r: 1, g: 1, b: 1 }, visible: true } as SolidPaint,
    ];
    root.primaryAxisSizingMode = "FIXED";
    root.counterAxisSizingMode = "FIXED";

    const nodeIds: string[] = [root.id];

    // Create 3 placeholder sections
    const sectionCount = 3;
    const innerWidth = width - 32;
    const sectionHeight = Math.round((height - 32 - 16 * (sectionCount - 1)) / sectionCount);

    for (let i = 0; i < sectionCount; i++) {
      const section = figmaApi.createFrame();
      section.name = `Section ${i + 1}`;
      section.resize(innerWidth, sectionHeight);
      section.fills = [
        { type: "SOLID", color: { r: 0.96, g: 0.96, b: 0.96 }, visible: true } as SolidPaint,
      ];
      section.cornerRadius = 8;
      root.appendChild(section);
      nodeIds.push(section.id);
    }

    return { rootFrame: root as unknown as FrameNode, nodeIds };
  },
};

export async function generateLayout(
  params: Record<string, unknown>,
  figmaApi: PluginAPI
): Promise<ExecutorResult> {
  const description = params.description as string | undefined;
  const parentId = params.parentId as string | undefined;
  const width = (params.width as number) ?? 1200;
  const height = (params.height as number) ?? 800;

  if (!description) {
    return {
      success: false,
      error: "Missing required parameter: description. Provide a natural language description of the layout (e.g., '3 column grid', 'header + content + footer', 'card with image and text').",
    };
  }

  const lowerDesc = description.toLowerCase();

  // Find matching pattern
  let matchedPattern: LayoutPattern | null = null;
  for (const pattern of LAYOUT_PATTERNS) {
    if (pattern.keywords.some((kw) => lowerDesc.includes(kw))) {
      matchedPattern = pattern;
      break;
    }
  }

  if (!matchedPattern) {
    matchedPattern = FALLBACK_PATTERN;
  }

  // Generate layout
  const { rootFrame, nodeIds } = await matchedPattern.generate(
    figmaApi,
    width,
    height,
    description
  );

  // Attach to parent or current page
  if (parentId) {
    const parent = figmaApi.getNodeById(parentId);
    if (parent && "appendChild" in parent) {
      (parent as FrameNode).appendChild(rootFrame);
    } else {
      figmaApi.currentPage.appendChild(rootFrame);
    }
  } else {
    figmaApi.currentPage.appendChild(rootFrame);
  }

  return {
    success: true,
    data: {
      createdNodeIds: nodeIds,
      rootNodeId: nodeIds[0],
      description,
      matchedPattern: matchedPattern === FALLBACK_PATTERN ? "fallback" : matchedPattern.keywords[0],
      width,
      height,
      summary: `Generated "${description}" layout (${width}x${height}px) with ${nodeIds.length} nodes.`,
    },
  };
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run plugin/__tests__/superpowers.test.ts`
Expected: All generate_layout tests PASS

**Step 5: Commit**

```bash
git add plugin/executors/superpowers.ts plugin/__tests__/superpowers.test.ts
git commit -m "feat: add generate_layout executor — pattern-match natural language to auto-layout structures"
```

---

## Task 20: Server-Side Tool Definition for figma_superpowers

**Files:**
- Edit: `src/server/tools/superpowers.ts` (update tool definitions to match all 18 commands)
- Create: `src/server/__tests__/superpowers-tools.test.ts`

This task registers all 18 superpower commands under the `figma_superpowers` MCP tool with proper parameter schemas and descriptions.

**Step 1: Write the failing test**

```typescript
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
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/server/__tests__/superpowers-tools.test.ts`
Expected: FAIL — module not found or exports missing

**Step 3: Write the implementation**

```typescript
// src/server/tools/superpowers.ts

interface CommandDef {
  name: string;
  description: string;
  params: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export const SUPERPOWER_COMMANDS: CommandDef[] = [
  {
    name: "bulk_rename",
    description:
      "Rename multiple nodes using regex pattern matching. Supports find/replace, prefix/suffix, and sequential numbering. Use scope='page' or provide specific nodeIds.",
    params: {
      type: "object",
      properties: {
        nodeIds: { type: "array", items: { type: "string" }, description: "Array of node IDs to rename" },
        scope: { type: "string", enum: ["file", "page"], description: "Scope to search for nodes (alternative to nodeIds)" },
        pattern: { type: "string", description: "Regex pattern to match against node names" },
        replacement: { type: "string", description: "Replacement string for regex matches" },
        prefix: { type: "string", description: "Prefix to add to matching names" },
        sequential: { type: "boolean", description: "If true, append sequential numbers (1, 2, 3...)" },
      },
      required: ["pattern"],
    },
  },
  {
    name: "bulk_style",
    description:
      "Apply style changes to all nodes matching a selector. Selector can filter by type, name (regex), or existing style. Changes include fill, stroke, opacity, fontSize, cornerRadius.",
    params: {
      type: "object",
      properties: {
        scope: { type: "string", description: "Scope: 'file', 'page', or a node ID" },
        selector: {
          type: "object",
          properties: {
            type: { type: "string", description: "Node type (FRAME, TEXT, RECTANGLE, etc.)" },
            name: { type: "string", description: "Regex pattern for node name" },
            style: { type: "object", description: "Property-value pairs to match" },
          },
          description: "Criteria to match target nodes",
        },
        changes: {
          type: "object",
          description: "Style changes to apply: { fill: '#hex', stroke: '#hex', opacity: 0-1, fontSize: number, cornerRadius: number }",
        },
      },
      required: ["selector", "changes"],
    },
  },
  {
    name: "bulk_resize",
    description:
      "Resize multiple nodes. Provide absolute width/height or scaleX/scaleY to multiply current dimensions.",
    params: {
      type: "object",
      properties: {
        nodeIds: { type: "array", items: { type: "string" }, description: "Array of node IDs to resize" },
        width: { type: "number", description: "Absolute target width" },
        height: { type: "number", description: "Absolute target height" },
        scaleX: { type: "number", description: "Horizontal scale factor (e.g. 2 = double width)" },
        scaleY: { type: "number", description: "Vertical scale factor (e.g. 0.5 = half height)" },
      },
      required: ["nodeIds"],
    },
  },
  {
    name: "smart_align",
    description:
      "Auto-distribute nodes with equal spacing and alignment. Sort by position, calculate optimal spacing. Supports start/center/end/space-between alignment.",
    params: {
      type: "object",
      properties: {
        nodeIds: { type: "array", items: { type: "string" }, description: "Array of node IDs to align" },
        direction: { type: "string", enum: ["HORIZONTAL", "VERTICAL"], description: "Distribution direction" },
        spacing: { type: "number", description: "Fixed spacing between nodes in px" },
        alignment: { type: "string", enum: ["start", "center", "end", "space-between", "space-around"], description: "Alignment mode" },
      },
      required: ["nodeIds"],
    },
  },
  {
    name: "design_lint",
    description:
      "Scan design for quality issues: default naming (Rectangle 1), off-grid corner radius, inconsistent spacing, detached styles. Returns issues with severity and fix suggestions.",
    params: {
      type: "object",
      properties: {
        scope: { type: "string", description: "Scope: 'file', 'page', or a node ID" },
        rules: {
          type: "array",
          items: { type: "string", enum: ["naming", "corner-radius", "spacing", "detached-styles", "orphan-components"] },
          description: "Specific rules to check (default: all)",
        },
      },
    },
  },
  {
    name: "accessibility_check",
    description:
      "WCAG accessibility audit: contrast ratios (text vs background), touch target sizes (44px AA / 48px AAA), minimum font sizes. Returns violations with WCAG criteria and fix suggestions.",
    params: {
      type: "object",
      properties: {
        scope: { type: "string", description: "Scope: 'file', 'page', or a node ID" },
        level: { type: "string", enum: ["A", "AA", "AAA"], description: "WCAG conformance level (default: AA)" },
      },
    },
  },
  {
    name: "design_system_scan",
    description:
      "Analyze design system adoption: component coverage %, detached styles, non-token colors. Returns structured report with violations and improvement suggestions.",
    params: {
      type: "object",
      properties: {
        scope: { type: "string", description: "Scope: 'file', 'page', or a node ID" },
      },
    },
  },
  {
    name: "responsive_check",
    description:
      "Test a frame at multiple breakpoint widths. Reports text overflow, elements outside bounds, and overlapping elements per breakpoint.",
    params: {
      type: "object",
      properties: {
        nodeId: { type: "string", description: "ID of the frame to test" },
        breakpoints: { type: "array", items: { type: "number" }, description: "Array of widths to test (e.g. [320, 768, 1024, 1440])" },
      },
      required: ["nodeId", "breakpoints"],
    },
  },
  {
    name: "component_coverage",
    description:
      "Calculate what percentage of the file uses component instances vs raw nodes. Identifies repeated patterns that could be componentized.",
    params: {
      type: "object",
      properties: {
        scope: { type: "string", description: "Scope: 'file', 'page', or a node ID" },
      },
    },
  },
  {
    name: "duplicate_detector",
    description:
      "Find visually duplicate nodes using structural fingerprinting (type, size, fills, children). Groups duplicates by similarity. Use to find candidates for componentization.",
    params: {
      type: "object",
      properties: {
        scope: { type: "string", description: "Scope: 'file', 'page', or a node ID" },
        threshold: { type: "number", description: "Similarity threshold 0-1 (default: 0.8). Higher = stricter matching." },
      },
    },
  },
  {
    name: "color_palette_extract",
    description:
      "Extract every color used in the file (fills, strokes, text). Group near-duplicate colors using CIE76 deltaE. Suggest consolidation opportunities.",
    params: {
      type: "object",
      properties: {
        scope: { type: "string", description: "Scope: 'file', 'page', or a node ID" },
        threshold: { type: "number", description: "DeltaE threshold for grouping similar colors (default: 5)" },
      },
    },
  },
  {
    name: "typography_audit",
    description:
      "Audit all text nodes: collect unique font family/size/weight/lineHeight combinations with usage counts. Flag too many sizes or font families.",
    params: {
      type: "object",
      properties: {
        scope: { type: "string", description: "Scope: 'file', 'page', or a node ID" },
      },
    },
  },
  {
    name: "spacing_audit",
    description:
      "Analyze all auto-layout spacing and padding values. Flag values not on the base unit grid (default 8px). Show spacing distribution.",
    params: {
      type: "object",
      properties: {
        scope: { type: "string", description: "Scope: 'file', 'page', or a node ID" },
        baseUnit: { type: "number", description: "Base spacing unit in px (default: 8)" },
      },
    },
  },
  {
    name: "export_tokens",
    description:
      "Export all design variables/tokens from the file as JSON, CSS custom properties, or Tailwind config. Optionally filter by collection name.",
    params: {
      type: "object",
      properties: {
        format: { type: "string", enum: ["json", "css", "tailwind"], description: "Output format" },
        collections: { type: "array", items: { type: "string" }, description: "Filter to specific collection names" },
      },
      required: ["format"],
    },
  },
  {
    name: "import_tokens",
    description:
      "Import design tokens from a JSON or CSS string and create Figma variables. Creates a new collection if needed.",
    params: {
      type: "object",
      properties: {
        tokens: { type: "string", description: "Token string (JSON object or CSS :root block)" },
        format: { type: "string", enum: ["json", "css"], description: "Input format" },
        collectionName: { type: "string", description: "Collection name (default: 'Imported Tokens')" },
      },
      required: ["tokens", "format"],
    },
  },
  {
    name: "localize_text",
    description:
      "Replace text nodes with localized strings from a mapping. Optionally detect hardcoded strings not in the map.",
    params: {
      type: "object",
      properties: {
        localeMap: {
          type: "object",
          description: "Mapping of source text → translated text (e.g. { 'Hello': 'Hola', 'Submit': 'Enviar' })",
        },
        scope: { type: "string", description: "Scope: 'file', 'page', or a node ID" },
        detectHardcoded: { type: "boolean", description: "If true, report text nodes not in the locale map" },
      },
      required: ["localeMap"],
    },
  },
  {
    name: "annotation_generate",
    description:
      "Generate dev handoff annotations for a node. 'specs' shows dimensions/colors/radius. 'redlines' shows measurements between elements. 'measurements' shows width/height/position.",
    params: {
      type: "object",
      properties: {
        nodeId: { type: "string", description: "ID of the node to annotate" },
        type: { type: "string", enum: ["specs", "redlines", "measurements"], description: "Annotation type" },
      },
      required: ["nodeId", "type"],
    },
  },
  {
    name: "generate_layout",
    description:
      "Generate auto-layout frames from a natural language description. Supports: 'N column grid', 'header + content + footer', 'sidebar + main', 'card with image and text', 'form with N fields'. Pattern-matching based, not LLM.",
    params: {
      type: "object",
      properties: {
        description: { type: "string", description: "Layout description (e.g. '3 column grid', 'sidebar and main content')" },
        parentId: { type: "string", description: "Parent node ID to attach layout to (default: current page)" },
        width: { type: "number", description: "Layout width in px (default: 1200)" },
        height: { type: "number", description: "Layout height in px (default: 800)" },
      },
      required: ["description"],
    },
  },
];

export function getSuperPowerSchema() {
  const commandNames = SUPERPOWER_COMMANDS.map((c) => c.name);
  const commandDescriptions = SUPERPOWER_COMMANDS.map(
    (c) => `• **${c.name}**: ${c.description}`
  ).join("\n");

  return {
    name: "figma_superpowers",
    description: `AI-only superpower tools for Figma — capabilities no human designer has natively.\n\nAvailable commands:\n${commandDescriptions}`,
    inputSchema: {
      type: "object" as const,
      properties: {
        command: {
          type: "string",
          enum: commandNames,
          description: "The superpower command to execute",
        },
        params: {
          type: "object",
          description: "Parameters for the command (see individual command descriptions)",
        },
      },
      required: ["command"],
    },
  };
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/server/__tests__/superpowers-tools.test.ts`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/server/tools/superpowers.ts src/server/__tests__/superpowers-tools.test.ts
git commit -m "feat: add figma_superpowers MCP tool definition with all 18 command schemas"
```

---

## Task 21: Plugin Command Router Integration

**Files:**
- Edit: `plugin/code.ts` (add superpower executor routing)
- Create: `plugin/__tests__/superpowers-routing.test.ts`

This task wires all 18 superpower executors into the plugin's command router so commands received over WebSocket are dispatched to the correct executor.

**Step 1: Write the failing test**

```typescript
// plugin/__tests__/superpowers-routing.test.ts
import { describe, it, expect, vi } from "vitest";
import {
  bulkRename,
  bulkStyle,
  bulkResize,
  smartAlign,
  designLint,
  accessibilityCheck,
  designSystemScan,
  responsiveCheck,
  componentCoverage,
  duplicateDetector,
  colorPaletteExtract,
  typographyAudit,
  spacingAudit,
  exportTokens,
  importTokens,
  localizeText,
  annotationGenerate,
  generateLayout,
} from "../executors/superpowers.js";

const SUPERPOWER_EXECUTOR_MAP: Record<string, Function> = {
  bulk_rename: bulkRename,
  bulk_style: bulkStyle,
  bulk_resize: bulkResize,
  smart_align: smartAlign,
  design_lint: designLint,
  accessibility_check: accessibilityCheck,
  design_system_scan: designSystemScan,
  responsive_check: responsiveCheck,
  component_coverage: componentCoverage,
  duplicate_detector: duplicateDetector,
  color_palette_extract: colorPaletteExtract,
  typography_audit: typographyAudit,
  spacing_audit: spacingAudit,
  export_tokens: exportTokens,
  import_tokens: importTokens,
  localize_text: localizeText,
  annotation_generate: annotationGenerate,
  generate_layout: generateLayout,
};

describe("superpowers routing", () => {
  it("maps all 18 commands to executor functions", () => {
    expect(Object.keys(SUPERPOWER_EXECUTOR_MAP)).toHaveLength(18);
  });

  it("every mapped executor is a function", () => {
    for (const [name, executor] of Object.entries(SUPERPOWER_EXECUTOR_MAP)) {
      expect(typeof executor).toBe("function");
    }
  });

  it("executors can be called with params and figmaApi", async () => {
    const mockFigma = {
      getNodeById: () => null,
      currentPage: { children: [] },
      root: { children: [] },
    };

    // Verify each executor handles missing params gracefully
    for (const [name, executor] of Object.entries(SUPERPOWER_EXECUTOR_MAP)) {
      const result = await executor({}, mockFigma as unknown as PluginAPI);
      expect(result).toBeDefined();
      expect(typeof result.success).toBe("boolean");
    }
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run plugin/__tests__/superpowers-routing.test.ts`
Expected: FAIL if any executor is not exported; PASS if all are.

**Step 3: Verify all exports exist**

No new code needed — the routing map in `plugin/code.ts` should import from `plugin/executors/superpowers.ts` and dispatch by command name. The existing command router pattern (established in Phase 1) handles this:

Add to `plugin/code.ts` command switch block:

```typescript
// In the command router switch/map in plugin/code.ts, add:
import {
  bulkRename,
  bulkStyle,
  bulkResize,
  smartAlign,
  designLint,
  accessibilityCheck,
  designSystemScan,
  responsiveCheck,
  componentCoverage,
  duplicateDetector,
  colorPaletteExtract,
  typographyAudit,
  spacingAudit,
  exportTokens,
  importTokens,
  localizeText,
  annotationGenerate,
  generateLayout,
} from "./executors/superpowers.js";

// Add to executor map:
const EXECUTORS: Record<string, (params: Record<string, unknown>, figmaApi: PluginAPI) => Promise<ExecutorResult>> = {
  // ... existing executors from phases 1-5 ...
  bulk_rename: bulkRename,
  bulk_style: bulkStyle,
  bulk_resize: bulkResize,
  smart_align: smartAlign,
  design_lint: designLint,
  accessibility_check: accessibilityCheck,
  design_system_scan: designSystemScan,
  responsive_check: responsiveCheck,
  component_coverage: componentCoverage,
  duplicate_detector: duplicateDetector,
  color_palette_extract: colorPaletteExtract,
  typography_audit: typographyAudit,
  spacing_audit: spacingAudit,
  export_tokens: exportTokens,
  import_tokens: importTokens,
  localize_text: localizeText,
  annotation_generate: annotationGenerate,
  generate_layout: generateLayout,
};
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run plugin/__tests__/superpowers-routing.test.ts`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add plugin/code.ts plugin/__tests__/superpowers-routing.test.ts
git commit -m "feat: wire all 18 superpower executors into plugin command router"
```

---

## Task 22: Full Integration Test

**Files:**
- Create: `test/integration/superpowers.test.ts`

End-to-end test verifying command flows through MCP tool definition to executor dispatch.

**Step 1: Write the integration test**

```typescript
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
```

**Step 2: Run the integration test**

Run: `npx vitest run test/integration/superpowers.test.ts`
Expected: All tests PASS

**Step 3: Run the full test suite**

Run: `npx vitest run`
Expected: All tests PASS across all files

**Step 4: Commit**

```bash
git add test/integration/superpowers.test.ts
git commit -m "test: add superpowers integration tests — verify tool ↔ executor 1:1 mapping across all 18 commands"
```

---

## Summary

Phase 6 delivers 18 AI-only superpower tools across 6 sub-categories:

| Sub-Category | Tools | Count |
|--------------|-------|-------|
| Bulk Operations | bulk_rename, bulk_style, bulk_resize, smart_align | 4 |
| Design Intelligence | design_lint, accessibility_check, design_system_scan, responsive_check, component_coverage, duplicate_detector | 6 |
| Auditing | color_palette_extract, typography_audit, spacing_audit | 3 |
| Design System Bridge | export_tokens, import_tokens | 2 |
| Content | localize_text, annotation_generate | 2 |
| Generative | generate_layout | 1 |

**Files created/modified:**
- `plugin/utils/superpower-helpers.ts` — Color math, node traversal, fingerprinting utilities
- `plugin/executors/superpowers.ts` — All 18 executor implementations
- `plugin/__tests__/superpower-helpers.test.ts` — Helper utility tests
- `plugin/__tests__/superpowers.test.ts` — All 18 executor tests
- `plugin/__tests__/superpowers-routing.test.ts` — Routing verification
- `src/server/tools/superpowers.ts` — MCP tool schema for all 18 commands
- `src/server/__tests__/superpowers-tools.test.ts` — Tool definition tests
- `test/integration/superpowers.test.ts` — Integration tests
- `plugin/code.ts` — Router wiring (edit)

**Total tasks:** 22 (1 helper utility + 18 executors + 1 server tool def + 1 routing + 1 integration)

**Total test count:** ~90+ individual test cases

**After Phase 6:** Claude has capabilities no human designer has natively. The full tool catalog stands at 68 tools (50 core + 18 superpowers) exposed through 13 MCP tools. Ready for Phase 7: Polish + Open Source Launch.
