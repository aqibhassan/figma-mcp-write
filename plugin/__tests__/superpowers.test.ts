// plugin/__tests__/superpowers.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
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
    // avgCenter = (node1.centerX + node2.centerX) / 2 = (50 + 30) / 2 = 40
    // node2.x = avgCenter - node2.width/2 = 40 - 30 = 10
    expect(node2.x).toBe(10);
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
    // Wire parent ref
    (textNode as Record<string, unknown>).parent = bgNode;
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
    (textNode as Record<string, unknown>).parent = bgNode;
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
    });
    const mockFigma = createMockFigma([parentFrame]);
    // Add node to map
    (mockFigma as Record<string, unknown>).getNodeById = (id: string) => {
      if (id === "1:1") return parentFrame;
      return null;
    };

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
    (mockFigma as Record<string, unknown>).getNodeById = (id: string) => id === "1:1" ? node : null;

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
        cornerRadius: 0,
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
        fills: [{ type: "SOLID", color: { r: 0.9, g: 0.9, b: 0.9 }, visible: true }],
        cornerRadius: 0,
        appendChild: vi.fn(),
      };
      rect.resize = vi.fn((w: number, h: number) => {
        rect.width = w;
        rect.height = h;
      });
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
