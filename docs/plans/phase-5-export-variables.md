# Phase 5: Export + Variables + Design System Context (8 Tools + Context)

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement export tools (4), variable tools (4), and the design system auto-scan/context injection system. At the end, Claude can export assets, manage design tokens, and leverage design system intelligence.

**Architecture:** Server-side tool definitions + plugin-side executors + design system context manager (server) + design system scanner (plugin)

**Tech Stack:** TypeScript, @figma/plugin-typings, vitest

---

## Task 1: Figma API Mock for Export, Variables, and Design System

**Files:**
- Create: `test/mocks/figma-api-phase5.ts`

**Step 1: Create the mock**

This mock extends existing Figma API mocks with export, variable, and design system scanning support needed for Phase 5 tests.

```typescript
// test/mocks/figma-api-phase5.ts
import { vi } from "vitest";

// ============================================================
// Mock Node Types (extend from Phase 4 where needed)
// ============================================================

export interface MockBaseNode {
  id: string;
  name: string;
  type: string;
  parent: MockBaseNode | null;
  removed: boolean;
  remove: () => void;
}

export interface MockSceneNode extends MockBaseNode {
  x: number;
  y: number;
  width: number;
  height: number;
  visible: boolean;
  opacity: number;
  fills: unknown[];
  strokes: unknown[];
  effects: unknown[];
  cornerRadius: number;
  children?: MockSceneNode[];
  appendChild?: (child: MockSceneNode) => void;
  insertChild?: (index: number, child: MockSceneNode) => void;
  exportAsync: (settings?: MockExportSettings) => Promise<Uint8Array>;
  exportSettings: MockExportSetting[];
  setBoundVariable: (field: string, variable: MockVariable) => void;
  boundVariables: Record<string, { id: string }>;
  cssText?: string;
}

export interface MockExportSettings {
  format?: "PNG" | "SVG" | "PDF" | "JPG";
  constraint?: { type: "SCALE" | "WIDTH" | "HEIGHT"; value: number };
}

export interface MockExportSetting {
  format: "PNG" | "SVG" | "PDF" | "JPG";
  suffix: string;
  constraint: { type: "SCALE" | "WIDTH" | "HEIGHT"; value: number };
}

export interface MockFrameNode extends MockSceneNode {
  type: "FRAME";
  children: MockSceneNode[];
  appendChild: (child: MockSceneNode) => void;
  insertChild: (index: number, child: MockSceneNode) => void;
  layoutMode: "NONE" | "HORIZONTAL" | "VERTICAL";
  primaryAxisAlignItems: string;
  counterAxisAlignItems: string;
  paddingTop: number;
  paddingRight: number;
  paddingBottom: number;
  paddingLeft: number;
  itemSpacing: number;
  clipsContent: boolean;
}

export interface MockRectangleNode extends MockSceneNode {
  type: "RECTANGLE";
}

export interface MockEllipseNode extends MockSceneNode {
  type: "ELLIPSE";
}

export interface MockTextNode extends MockSceneNode {
  type: "TEXT";
  characters: string;
  fontSize: number;
  fontName: { family: string; style: string };
  fontWeight: number;
  lineHeight: { value: number; unit: string } | { unit: "AUTO" };
  letterSpacing: { value: number; unit: string };
  textAlignHorizontal: string;
  textAlignVertical: string;
  textDecoration: string;
}

export interface MockComponentNode extends MockSceneNode {
  type: "COMPONENT";
  children: MockSceneNode[];
  appendChild: (child: MockSceneNode) => void;
  insertChild: (index: number, child: MockSceneNode) => void;
  createInstance: () => MockSceneNode;
  description: string;
  key: string;
}

// ============================================================
// Mock Variable Types
// ============================================================

export interface MockVariable {
  id: string;
  name: string;
  resolvedType: "COLOR" | "FLOAT" | "STRING" | "BOOLEAN";
  valuesByMode: Record<string, unknown>;
  variableCollectionId: string;
  description: string;
  setValueForMode: (modeId: string, value: unknown) => void;
}

export interface MockVariableCollection {
  id: string;
  name: string;
  modes: Array<{ modeId: string; name: string }>;
  variableIds: string[];
  addMode: (name: string) => { modeId: string; name: string };
  removeMode: (modeId: string) => void;
}

// ============================================================
// Mock Style Types
// ============================================================

export interface MockPaintStyle {
  id: string;
  name: string;
  type: "PAINT";
  description: string;
  paints: unknown[];
}

export interface MockTextStyle {
  id: string;
  name: string;
  type: "TEXT";
  description: string;
  fontName: { family: string; style: string };
  fontSize: number;
  fontWeight: number;
  lineHeight: { value: number; unit: string } | { unit: "AUTO" };
  letterSpacing: { value: number; unit: string };
}

export interface MockEffectStyle {
  id: string;
  name: string;
  type: "EFFECT";
  description: string;
  effects: unknown[];
}

export interface MockGridStyle {
  id: string;
  name: string;
  type: "GRID";
  description: string;
  layoutGrids: unknown[];
}

// ============================================================
// Mock Page Node
// ============================================================

export interface MockPageNode extends MockBaseNode {
  type: "PAGE";
  children: MockSceneNode[];
  appendChild: (child: MockSceneNode) => void;
  insertChild: (index: number, child: MockSceneNode) => void;
  backgrounds: unknown[];
  selection: MockSceneNode[];
}

export interface MockDocumentNode extends MockBaseNode {
  type: "DOCUMENT";
  children: MockPageNode[];
}

// ============================================================
// Node Factory
// ============================================================

let nodeIdCounter = 100;

function nextId(): string {
  nodeIdCounter++;
  return `${nodeIdCounter}:1`;
}

export function resetIdCounter(): void {
  nodeIdCounter = 100;
}

function createBaseNode(type: string, name: string): MockBaseNode {
  return {
    id: nextId(),
    name,
    type,
    parent: null,
    removed: false,
    remove() {
      this.removed = true;
      if (this.parent && "children" in this.parent) {
        const parent = this.parent as unknown as { children: MockBaseNode[] };
        parent.children = parent.children.filter((c) => c.id !== this.id);
      }
    },
  };
}

function addSceneNodeDefaults(node: Record<string, unknown>): void {
  node.exportAsync = vi.fn(async (_settings?: MockExportSettings) => {
    // Return a fake PNG byte array (minimal valid data)
    return new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  });
  node.exportSettings = [];
  node.boundVariables = {};
  node.setBoundVariable = vi.fn(
    (field: string, variable: MockVariable) => {
      (node.boundVariables as Record<string, { id: string }>)[field] = {
        id: variable.id,
      };
    }
  );
}

function createChildrenMixin(node: MockSceneNode): void {
  node.children = node.children ?? [];
  node.appendChild = (child: MockSceneNode) => {
    child.parent = node;
    node.children!.push(child);
  };
  node.insertChild = (index: number, child: MockSceneNode) => {
    child.parent = node;
    node.children!.splice(index, 0, child);
  };
}

export function createMockFrame(name = "Frame"): MockFrameNode {
  const base = createBaseNode("FRAME", name);
  const node = {
    ...base,
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    visible: true,
    opacity: 1,
    fills: [{ type: "SOLID", color: { r: 1, g: 1, b: 1 }, opacity: 1 }],
    strokes: [],
    effects: [],
    cornerRadius: 0,
    children: [] as MockSceneNode[],
    layoutMode: "NONE" as const,
    primaryAxisAlignItems: "MIN",
    counterAxisAlignItems: "MIN",
    paddingTop: 0,
    paddingRight: 0,
    paddingBottom: 0,
    paddingLeft: 0,
    itemSpacing: 0,
    clipsContent: true,
  } as unknown as MockFrameNode;
  addSceneNodeDefaults(node as unknown as Record<string, unknown>);
  createChildrenMixin(node);
  return node;
}

export function createMockRectangle(name = "Rectangle"): MockRectangleNode {
  const base = createBaseNode("RECTANGLE", name);
  const node = {
    ...base,
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    visible: true,
    opacity: 1,
    fills: [{ type: "SOLID", color: { r: 0.2, g: 0.4, b: 0.8 }, opacity: 1 }],
    strokes: [],
    effects: [],
    cornerRadius: 8,
  } as unknown as MockRectangleNode;
  addSceneNodeDefaults(node as unknown as Record<string, unknown>);
  return node;
}

export function createMockEllipse(name = "Ellipse"): MockEllipseNode {
  const base = createBaseNode("ELLIPSE", name);
  const node = {
    ...base,
    x: 0,
    y: 0,
    width: 50,
    height: 50,
    visible: true,
    opacity: 1,
    fills: [{ type: "SOLID", color: { r: 1, g: 0, b: 0 }, opacity: 1 }],
    strokes: [],
    effects: [],
    cornerRadius: 0,
  } as unknown as MockEllipseNode;
  addSceneNodeDefaults(node as unknown as Record<string, unknown>);
  return node;
}

export function createMockText(
  name = "Text",
  characters = "Hello"
): MockTextNode {
  const base = createBaseNode("TEXT", name);
  const node = {
    ...base,
    x: 0,
    y: 0,
    width: 100,
    height: 20,
    visible: true,
    opacity: 1,
    fills: [{ type: "SOLID", color: { r: 0, g: 0, b: 0 }, opacity: 1 }],
    strokes: [],
    effects: [],
    cornerRadius: 0,
    characters,
    fontSize: 16,
    fontName: { family: "Inter", style: "Regular" },
    fontWeight: 400,
    lineHeight: { value: 24, unit: "PIXELS" },
    letterSpacing: { value: 0, unit: "PIXELS" },
    textAlignHorizontal: "LEFT",
    textAlignVertical: "TOP",
    textDecoration: "NONE",
  } as unknown as MockTextNode;
  addSceneNodeDefaults(node as unknown as Record<string, unknown>);
  return node;
}

export function createMockComponent(name = "Component"): MockComponentNode {
  const base = createBaseNode("COMPONENT", name);
  const node = {
    ...base,
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    visible: true,
    opacity: 1,
    fills: [],
    strokes: [],
    effects: [],
    cornerRadius: 0,
    children: [] as MockSceneNode[],
    description: "",
    key: `component-key-${base.id}`,
    createInstance: vi.fn(),
  } as unknown as MockComponentNode;
  addSceneNodeDefaults(node as unknown as Record<string, unknown>);
  createChildrenMixin(node as unknown as MockSceneNode);
  return node;
}

export function createMockPage(name = "Page 1"): MockPageNode {
  const base = createBaseNode("PAGE", name);
  return {
    ...base,
    children: [] as MockSceneNode[],
    appendChild(child: MockSceneNode) {
      child.parent = this as unknown as MockBaseNode;
      this.children.push(child);
    },
    insertChild(index: number, child: MockSceneNode) {
      child.parent = this as unknown as MockBaseNode;
      this.children.splice(index, 0, child);
    },
    backgrounds: [
      { type: "SOLID", color: { r: 0.96, g: 0.96, b: 0.96 }, visible: true },
    ],
    selection: [],
  } as MockPageNode;
}

// ============================================================
// Mock Variable Factory
// ============================================================

let varIdCounter = 0;

export function resetVarIdCounter(): void {
  varIdCounter = 0;
}

export function createMockVariable(
  name: string,
  resolvedType: "COLOR" | "FLOAT" | "STRING" | "BOOLEAN",
  collectionId: string,
  defaultValue: unknown
): MockVariable {
  varIdCounter++;
  const id = `VariableID:${varIdCounter}:1`;
  const variable: MockVariable = {
    id,
    name,
    resolvedType,
    valuesByMode: { "mode-default": defaultValue },
    variableCollectionId: collectionId,
    description: "",
    setValueForMode: vi.fn((modeId: string, value: unknown) => {
      variable.valuesByMode[modeId] = value;
    }),
  };
  return variable;
}

let collectionIdCounter = 0;

export function resetCollectionIdCounter(): void {
  collectionIdCounter = 0;
}

export function createMockVariableCollection(
  name: string,
  modes: string[] = ["Default"]
): MockVariableCollection {
  collectionIdCounter++;
  const id = `VariableCollectionID:${collectionIdCounter}:1`;
  const modeList = modes.map((modeName, i) => ({
    modeId: `mode-${i}`,
    name: modeName,
  }));
  const collection: MockVariableCollection = {
    id,
    name,
    modes: modeList,
    variableIds: [],
    addMode: vi.fn((modeName: string) => {
      const mode = { modeId: `mode-${collection.modes.length}`, name: modeName };
      collection.modes.push(mode);
      return mode;
    }),
    removeMode: vi.fn((modeId: string) => {
      collection.modes = collection.modes.filter((m) => m.modeId !== modeId);
    }),
  };
  return collection;
}

// ============================================================
// Mock Style Factory
// ============================================================

let styleIdCounter = 0;

export function resetStyleIdCounter(): void {
  styleIdCounter = 0;
}

export function createMockPaintStyle(
  name: string,
  color: { r: number; g: number; b: number } = { r: 0.2, g: 0.4, b: 0.8 }
): MockPaintStyle {
  styleIdCounter++;
  return {
    id: `S:paint-${styleIdCounter}:1`,
    name,
    type: "PAINT",
    description: "",
    paints: [{ type: "SOLID", color, opacity: 1 }],
  };
}

export function createMockTextStyle(
  name: string,
  fontSize = 16,
  fontFamily = "Inter"
): MockTextStyle {
  styleIdCounter++;
  return {
    id: `S:text-${styleIdCounter}:1`,
    name,
    type: "TEXT",
    description: "",
    fontName: { family: fontFamily, style: "Regular" },
    fontSize,
    fontWeight: 400,
    lineHeight: { value: fontSize * 1.5, unit: "PIXELS" },
    letterSpacing: { value: 0, unit: "PIXELS" },
  };
}

export function createMockEffectStyle(
  name: string,
  effects: unknown[] = []
): MockEffectStyle {
  styleIdCounter++;
  return {
    id: `S:effect-${styleIdCounter}:1`,
    name,
    type: "EFFECT",
    description: "",
    effects:
      effects.length > 0
        ? effects
        : [
            {
              type: "DROP_SHADOW",
              color: { r: 0, g: 0, b: 0, a: 0.25 },
              offset: { x: 0, y: 4 },
              radius: 8,
              visible: true,
            },
          ],
  };
}

export function createMockGridStyle(
  name: string,
  grids: unknown[] = []
): MockGridStyle {
  styleIdCounter++;
  return {
    id: `S:grid-${styleIdCounter}:1`,
    name,
    type: "GRID",
    description: "",
    layoutGrids:
      grids.length > 0
        ? grids
        : [
            {
              pattern: "COLUMNS",
              alignment: "STRETCH",
              gutterSize: 20,
              count: 12,
              sectionSize: 60,
              offset: 0,
              visible: true,
            },
          ],
  };
}

// ============================================================
// Mock Figma Global
// ============================================================

export interface MockFigmaGlobal {
  root: MockDocumentNode;
  currentPage: MockPageNode;
  getNodeById: (id: string) => MockBaseNode | null;
  createPage: () => MockPageNode;
  createRectangle: () => MockRectangleNode;
  createFrame: () => MockFrameNode;
  notify: (message: string) => void;
  // Variable API
  variables: {
    createVariable: (
      name: string,
      collectionId: string,
      resolvedType: "COLOR" | "FLOAT" | "STRING" | "BOOLEAN"
    ) => MockVariable;
    createVariableCollection: (name: string) => MockVariableCollection;
    getVariableById: (id: string) => MockVariable | null;
    getVariableCollectionById: (id: string) => MockVariableCollection | null;
    getLocalVariables: (type?: string) => MockVariable[];
    getLocalVariableCollections: () => MockVariableCollection[];
  };
  // Style API
  getLocalPaintStyles: () => MockPaintStyle[];
  getLocalTextStyles: () => MockTextStyle[];
  getLocalEffectStyles: () => MockEffectStyle[];
  getLocalGridStyles: () => MockGridStyle[];
  // Image API
  createImage: (data: Uint8Array) => { hash: string };
}

export function createMockFigma(): MockFigmaGlobal {
  const page1 = createMockPage("Page 1");
  const allNodes = new Map<string, MockBaseNode>();
  const allVariables = new Map<string, MockVariable>();
  const allCollections = new Map<string, MockVariableCollection>();
  const paintStyles: MockPaintStyle[] = [];
  const textStyles: MockTextStyle[] = [];
  const effectStyles: MockEffectStyle[] = [];
  const gridStyles: MockGridStyle[] = [];

  const doc: MockDocumentNode = {
    id: "0:0",
    name: "Test Document",
    type: "DOCUMENT",
    parent: null,
    removed: false,
    remove() {},
    children: [page1],
  };

  page1.parent = doc as unknown as MockBaseNode;
  allNodes.set(doc.id, doc);
  allNodes.set(page1.id, page1);

  function registerNode(node: MockBaseNode): void {
    allNodes.set(node.id, node);
    if ("children" in node) {
      const withChildren = node as unknown as { children: MockBaseNode[] };
      for (const child of withChildren.children) {
        registerNode(child);
      }
    }
  }

  const mockFigma: MockFigmaGlobal = {
    root: doc,
    currentPage: page1,

    getNodeById: (id: string) => {
      return allNodes.get(id) ?? null;
    },

    createPage: vi.fn(() => {
      const page = createMockPage("New Page");
      page.parent = doc as unknown as MockBaseNode;
      doc.children.push(page);
      allNodes.set(page.id, page);
      return page;
    }),

    createRectangle: vi.fn(() => {
      const rect = createMockRectangle("Rectangle");
      allNodes.set(rect.id, rect as unknown as MockBaseNode);
      return rect;
    }),

    createFrame: vi.fn(() => {
      const frame = createMockFrame("Frame");
      allNodes.set(frame.id, frame as unknown as MockBaseNode);
      return frame;
    }),

    notify: vi.fn(),

    // Variable API
    variables: {
      createVariable: vi.fn(
        (
          name: string,
          collectionId: string,
          resolvedType: "COLOR" | "FLOAT" | "STRING" | "BOOLEAN"
        ) => {
          const collection = allCollections.get(collectionId);
          const defaultMode = collection?.modes[0]?.modeId ?? "mode-default";
          let defaultValue: unknown;
          switch (resolvedType) {
            case "COLOR":
              defaultValue = { r: 0, g: 0, b: 0, a: 1 };
              break;
            case "FLOAT":
              defaultValue = 0;
              break;
            case "STRING":
              defaultValue = "";
              break;
            case "BOOLEAN":
              defaultValue = false;
              break;
          }
          const variable = createMockVariable(
            name,
            resolvedType,
            collectionId,
            defaultValue
          );
          variable.valuesByMode = { [defaultMode]: defaultValue };
          allVariables.set(variable.id, variable);
          if (collection) {
            collection.variableIds.push(variable.id);
          }
          return variable;
        }
      ),

      createVariableCollection: vi.fn((name: string) => {
        const collection = createMockVariableCollection(name);
        allCollections.set(collection.id, collection);
        return collection;
      }),

      getVariableById: (id: string) => {
        return allVariables.get(id) ?? null;
      },

      getVariableCollectionById: (id: string) => {
        return allCollections.get(id) ?? null;
      },

      getLocalVariables: (type?: string) => {
        const vars = Array.from(allVariables.values());
        if (type) {
          return vars.filter((v) => v.resolvedType === type);
        }
        return vars;
      },

      getLocalVariableCollections: () => {
        return Array.from(allCollections.values());
      },
    },

    // Style APIs
    getLocalPaintStyles: () => [...paintStyles],
    getLocalTextStyles: () => [...textStyles],
    getLocalEffectStyles: () => [...effectStyles],
    getLocalGridStyles: () => [...gridStyles],

    // Image API
    createImage: vi.fn((data: Uint8Array) => {
      return { hash: `image-hash-${data.length}` };
    }),
  };

  // Helper: register nodes added to pages
  const origAppendChild = page1.appendChild.bind(page1);
  page1.appendChild = (child: MockSceneNode) => {
    origAppendChild(child);
    registerNode(child as unknown as MockBaseNode);
  };

  // Helper: add styles to the mock
  (mockFigma as unknown as Record<string, unknown>).addPaintStyle = (
    style: MockPaintStyle
  ) => {
    paintStyles.push(style);
  };
  (mockFigma as unknown as Record<string, unknown>).addTextStyle = (
    style: MockTextStyle
  ) => {
    textStyles.push(style);
  };
  (mockFigma as unknown as Record<string, unknown>).addEffectStyle = (
    style: MockEffectStyle
  ) => {
    effectStyles.push(style);
  };
  (mockFigma as unknown as Record<string, unknown>).addGridStyle = (
    style: MockGridStyle
  ) => {
    gridStyles.push(style);
  };

  return mockFigma;
}
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --project tsconfig.json`
Expected: No errors

**Step 3: Commit**

```bash
git add test/mocks/figma-api-phase5.ts
git commit -m "test: add Figma API mock for Phase 5 (export, variables, design system)"
```

---

## Task 2: Export Executors — Tests

**Files:**
- Create: `plugin/__tests__/export.test.ts`

**Step 1: Write the failing tests**

```typescript
// plugin/__tests__/export.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createMockFigma,
  createMockFrame,
  createMockRectangle,
  createMockText,
  createMockEllipse,
  resetIdCounter,
  type MockFigmaGlobal,
  type MockSceneNode,
  type MockFrameNode,
} from "../../test/mocks/figma-api-phase5.js";
import {
  exportNode,
  setExportSettings,
  setImageFill,
  getNodeCss,
} from "../executors/export.js";

describe("Export Executors", () => {
  let mockFigma: MockFigmaGlobal;

  beforeEach(() => {
    resetIdCounter();
    mockFigma = createMockFigma();
    (globalThis as unknown as { figma: MockFigmaGlobal }).figma = mockFigma;
  });

  // ============================================================
  // export_node
  // ============================================================

  describe("export_node", () => {
    it("exports a node as PNG with default scale", async () => {
      const rect = createMockRectangle("Icon");
      mockFigma.currentPage.appendChild(rect as unknown as MockSceneNode);

      const result = await exportNode({
        nodeId: rect.id,
        format: "PNG",
      });

      expect(result.success).toBe(true);
      const data = result.data as Record<string, unknown>;
      expect(data.format).toBe("PNG");
      expect(data.base64).toBeDefined();
      expect(typeof data.base64).toBe("string");
      expect(rect.exportAsync).toHaveBeenCalledWith(
        expect.objectContaining({ format: "PNG" })
      );
    });

    it("exports a node as SVG", async () => {
      const rect = createMockRectangle("Logo");
      mockFigma.currentPage.appendChild(rect as unknown as MockSceneNode);

      const result = await exportNode({
        nodeId: rect.id,
        format: "SVG",
      });

      expect(result.success).toBe(true);
      expect((result.data as Record<string, unknown>).format).toBe("SVG");
    });

    it("exports a node as PDF", async () => {
      const frame = createMockFrame("Page Layout");
      mockFigma.currentPage.appendChild(frame as unknown as MockSceneNode);

      const result = await exportNode({
        nodeId: frame.id,
        format: "PDF",
      });

      expect(result.success).toBe(true);
      expect((result.data as Record<string, unknown>).format).toBe("PDF");
    });

    it("exports a node as JPG", async () => {
      const rect = createMockRectangle("Photo");
      mockFigma.currentPage.appendChild(rect as unknown as MockSceneNode);

      const result = await exportNode({
        nodeId: rect.id,
        format: "JPG",
      });

      expect(result.success).toBe(true);
      expect((result.data as Record<string, unknown>).format).toBe("JPG");
    });

    it("exports with a custom scale", async () => {
      const rect = createMockRectangle("HiRes");
      mockFigma.currentPage.appendChild(rect as unknown as MockSceneNode);

      const result = await exportNode({
        nodeId: rect.id,
        format: "PNG",
        scale: 2,
      });

      expect(result.success).toBe(true);
      expect(rect.exportAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          format: "PNG",
          constraint: { type: "SCALE", value: 2 },
        })
      );
    });

    it("exports with a width constraint", async () => {
      const rect = createMockRectangle("Thumb");
      mockFigma.currentPage.appendChild(rect as unknown as MockSceneNode);

      const result = await exportNode({
        nodeId: rect.id,
        format: "PNG",
        constraint: { type: "WIDTH", value: 200 },
      });

      expect(result.success).toBe(true);
      expect(rect.exportAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          constraint: { type: "WIDTH", value: 200 },
        })
      );
    });

    it("fails if nodeId is missing", async () => {
      const result = await exportNode({ format: "PNG" });

      expect(result.success).toBe(false);
      expect(result.error).toContain("nodeId");
    });

    it("fails if format is missing", async () => {
      const rect = createMockRectangle("Shape");
      mockFigma.currentPage.appendChild(rect as unknown as MockSceneNode);

      const result = await exportNode({ nodeId: rect.id });

      expect(result.success).toBe(false);
      expect(result.error).toContain("format");
    });

    it("fails if format is invalid", async () => {
      const rect = createMockRectangle("Shape");
      mockFigma.currentPage.appendChild(rect as unknown as MockSceneNode);

      const result = await exportNode({
        nodeId: rect.id,
        format: "GIF",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid format");
    });

    it("fails if node is not found", async () => {
      const result = await exportNode({
        nodeId: "999:999",
        format: "PNG",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });

    it("fails if scale is out of range", async () => {
      const rect = createMockRectangle("Shape");
      mockFigma.currentPage.appendChild(rect as unknown as MockSceneNode);

      const result = await exportNode({
        nodeId: rect.id,
        format: "PNG",
        scale: 10,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("scale");
    });
  });

  // ============================================================
  // set_export_settings
  // ============================================================

  describe("set_export_settings", () => {
    it("sets a single export setting on a node", async () => {
      const rect = createMockRectangle("Icon");
      mockFigma.currentPage.appendChild(rect as unknown as MockSceneNode);

      const result = await setExportSettings({
        nodeId: rect.id,
        settings: [
          {
            format: "PNG",
            suffix: "@2x",
            constraint: { type: "SCALE", value: 2 },
          },
        ],
      });

      expect(result.success).toBe(true);
      expect(rect.exportSettings).toHaveLength(1);
      expect(rect.exportSettings[0].format).toBe("PNG");
      expect(rect.exportSettings[0].suffix).toBe("@2x");
    });

    it("sets multiple export settings on a node", async () => {
      const rect = createMockRectangle("Multi Export");
      mockFigma.currentPage.appendChild(rect as unknown as MockSceneNode);

      const result = await setExportSettings({
        nodeId: rect.id,
        settings: [
          {
            format: "PNG",
            suffix: "@1x",
            constraint: { type: "SCALE", value: 1 },
          },
          {
            format: "PNG",
            suffix: "@2x",
            constraint: { type: "SCALE", value: 2 },
          },
          {
            format: "SVG",
            suffix: "",
            constraint: { type: "SCALE", value: 1 },
          },
        ],
      });

      expect(result.success).toBe(true);
      expect(rect.exportSettings).toHaveLength(3);
    });

    it("replaces existing export settings", async () => {
      const rect = createMockRectangle("Replace");
      rect.exportSettings = [
        {
          format: "JPG",
          suffix: "",
          constraint: { type: "SCALE", value: 1 },
        },
      ];
      mockFigma.currentPage.appendChild(rect as unknown as MockSceneNode);

      const result = await setExportSettings({
        nodeId: rect.id,
        settings: [
          {
            format: "PNG",
            suffix: "@2x",
            constraint: { type: "SCALE", value: 2 },
          },
        ],
      });

      expect(result.success).toBe(true);
      expect(rect.exportSettings).toHaveLength(1);
      expect(rect.exportSettings[0].format).toBe("PNG");
    });

    it("fails if nodeId is missing", async () => {
      const result = await setExportSettings({
        settings: [{ format: "PNG" }],
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("nodeId");
    });

    it("fails if settings is missing or empty", async () => {
      const rect = createMockRectangle("No Settings");
      mockFigma.currentPage.appendChild(rect as unknown as MockSceneNode);

      const result1 = await setExportSettings({ nodeId: rect.id });
      expect(result1.success).toBe(false);
      expect(result1.error).toContain("settings");

      const result2 = await setExportSettings({
        nodeId: rect.id,
        settings: [],
      });
      expect(result2.success).toBe(false);
      expect(result2.error).toContain("at least one");
    });

    it("fails if node is not found", async () => {
      const result = await setExportSettings({
        nodeId: "999:999",
        settings: [{ format: "PNG" }],
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });
  });

  // ============================================================
  // set_image_fill
  // ============================================================

  describe("set_image_fill", () => {
    it("sets an image fill from base64 data", async () => {
      const rect = createMockRectangle("Image Holder");
      mockFigma.currentPage.appendChild(rect as unknown as MockSceneNode);

      const result = await setImageFill({
        nodeId: rect.id,
        imageBase64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      });

      expect(result.success).toBe(true);
      expect(mockFigma.createImage).toHaveBeenCalledOnce();
      const data = result.data as Record<string, unknown>;
      expect(data.imageHash).toBeDefined();
    });

    it("sets an image fill with FILL scale mode", async () => {
      const rect = createMockRectangle("Cover Image");
      mockFigma.currentPage.appendChild(rect as unknown as MockSceneNode);

      const result = await setImageFill({
        nodeId: rect.id,
        imageBase64: "iVBORw0KGgoAAAANSUhEUg==",
        scaleMode: "FILL",
      });

      expect(result.success).toBe(true);
    });

    it("sets an image fill with FIT scale mode", async () => {
      const rect = createMockRectangle("Fit Image");
      mockFigma.currentPage.appendChild(rect as unknown as MockSceneNode);

      const result = await setImageFill({
        nodeId: rect.id,
        imageBase64: "iVBORw0KGgoAAAANSUhEUg==",
        scaleMode: "FIT",
      });

      expect(result.success).toBe(true);
    });

    it("sets an image fill with CROP scale mode", async () => {
      const rect = createMockRectangle("Crop Image");
      mockFigma.currentPage.appendChild(rect as unknown as MockSceneNode);

      const result = await setImageFill({
        nodeId: rect.id,
        imageBase64: "iVBORw0KGgoAAAANSUhEUg==",
        scaleMode: "CROP",
      });

      expect(result.success).toBe(true);
    });

    it("sets an image fill with TILE scale mode", async () => {
      const rect = createMockRectangle("Tile Image");
      mockFigma.currentPage.appendChild(rect as unknown as MockSceneNode);

      const result = await setImageFill({
        nodeId: rect.id,
        imageBase64: "iVBORw0KGgoAAAANSUhEUg==",
        scaleMode: "TILE",
      });

      expect(result.success).toBe(true);
    });

    it("fails if nodeId is missing", async () => {
      const result = await setImageFill({
        imageBase64: "iVBORw0KGgoAAAANSUhEUg==",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("nodeId");
    });

    it("fails if neither imageBase64 nor imageUrl is provided", async () => {
      const rect = createMockRectangle("Empty");
      mockFigma.currentPage.appendChild(rect as unknown as MockSceneNode);

      const result = await setImageFill({ nodeId: rect.id });

      expect(result.success).toBe(false);
      expect(result.error).toContain("imageBase64 or imageUrl");
    });

    it("fails if node is not found", async () => {
      const result = await setImageFill({
        nodeId: "999:999",
        imageBase64: "iVBORw0KGgoAAAANSUhEUg==",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });

    it("fails if node does not support fills", async () => {
      const text = createMockText("Label", "Hello");
      // Remove fills property to simulate a node without fill support
      delete (text as unknown as Record<string, unknown>).fills;
      mockFigma.currentPage.appendChild(text as unknown as MockSceneNode);

      const result = await setImageFill({
        nodeId: text.id,
        imageBase64: "iVBORw0KGgoAAAANSUhEUg==",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("does not support fills");
    });

    it("fails if scaleMode is invalid", async () => {
      const rect = createMockRectangle("Bad Scale");
      mockFigma.currentPage.appendChild(rect as unknown as MockSceneNode);

      const result = await setImageFill({
        nodeId: rect.id,
        imageBase64: "iVBORw0KGgoAAAANSUhEUg==",
        scaleMode: "STRETCH",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid scaleMode");
    });
  });

  // ============================================================
  // get_node_css
  // ============================================================

  describe("get_node_css", () => {
    it("extracts CSS properties from a rectangle", async () => {
      const rect = createMockRectangle("Box");
      rect.width = 200;
      rect.height = 100;
      rect.cornerRadius = 8;
      rect.opacity = 0.9;
      mockFigma.currentPage.appendChild(rect as unknown as MockSceneNode);

      const result = await getNodeCss({ nodeId: rect.id });

      expect(result.success).toBe(true);
      const data = result.data as Record<string, unknown>;
      expect(data.css).toBeDefined();
      expect(typeof data.css).toBe("string");
      const css = data.css as string;
      expect(css).toContain("width");
      expect(css).toContain("height");
      expect(css).toContain("border-radius");
    });

    it("extracts CSS from a text node", async () => {
      const text = createMockText("Heading", "Welcome");
      text.fontSize = 24;
      text.fontName = { family: "Inter", style: "Bold" };
      text.fontWeight = 700;
      mockFigma.currentPage.appendChild(text as unknown as MockSceneNode);

      const result = await getNodeCss({ nodeId: text.id });

      expect(result.success).toBe(true);
      const css = (result.data as Record<string, unknown>).css as string;
      expect(css).toContain("font-family");
      expect(css).toContain("font-size");
    });

    it("extracts CSS from a frame with auto-layout", async () => {
      const frame = createMockFrame("Container");
      frame.layoutMode = "VERTICAL";
      frame.itemSpacing = 16;
      frame.paddingTop = 24;
      frame.paddingRight = 24;
      frame.paddingBottom = 24;
      frame.paddingLeft = 24;
      mockFigma.currentPage.appendChild(frame as unknown as MockSceneNode);

      const result = await getNodeCss({ nodeId: frame.id });

      expect(result.success).toBe(true);
      const css = (result.data as Record<string, unknown>).css as string;
      expect(css).toContain("display: flex");
      expect(css).toContain("flex-direction: column");
      expect(css).toContain("gap: 16px");
    });

    it("returns Tailwind classes when format is tailwind", async () => {
      const rect = createMockRectangle("TW Box");
      rect.width = 200;
      rect.height = 100;
      rect.cornerRadius = 8;
      mockFigma.currentPage.appendChild(rect as unknown as MockSceneNode);

      const result = await getNodeCss({
        nodeId: rect.id,
        format: "tailwind",
      });

      expect(result.success).toBe(true);
      const data = result.data as Record<string, unknown>;
      expect(data.tailwind).toBeDefined();
      expect(typeof data.tailwind).toBe("string");
    });

    it("fails if nodeId is missing", async () => {
      const result = await getNodeCss({});

      expect(result.success).toBe(false);
      expect(result.error).toContain("nodeId");
    });

    it("fails if node is not found", async () => {
      const result = await getNodeCss({ nodeId: "999:999" });

      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run plugin/__tests__/export.test.ts`
Expected: FAIL — module `../executors/export.js` not found

**Step 3: Commit**

```bash
git add plugin/__tests__/export.test.ts
git commit -m "test: add failing tests for export executors (export_node, set_export_settings, set_image_fill, get_node_css)"
```

---

## Task 3: Export Executors — Implementation

**Files:**
- Create: `plugin/executors/export.ts`

**Step 1: Write the implementation**

```typescript
// plugin/executors/export.ts

interface CommandResponse {
  id?: string;
  success: boolean;
  data?: unknown;
  error?: string;
}

// ============================================================
// Helpers
// ============================================================

function getNode(nodeId: string): SceneNode | null {
  return figma.getNodeById(nodeId) as SceneNode | null;
}

function errorResponse(error: string): CommandResponse {
  return { success: false, error };
}

function successResponse(data: unknown): CommandResponse {
  return { success: true, data };
}

const VALID_FORMATS = ["PNG", "SVG", "PDF", "JPG"] as const;
type ExportFormat = (typeof VALID_FORMATS)[number];

const VALID_SCALE_MODES = ["FILL", "FIT", "CROP", "TILE"] as const;
type ScaleMode = (typeof VALID_SCALE_MODES)[number];

// ============================================================
// export_node
// ============================================================

export async function exportNode(
  params: Record<string, unknown>
): Promise<CommandResponse> {
  const nodeId = params.nodeId as string | undefined;
  const format = params.format as string | undefined;
  const scale = params.scale as number | undefined;
  const constraint = params.constraint as
    | { type: "SCALE" | "WIDTH" | "HEIGHT"; value: number }
    | undefined;

  if (!nodeId) {
    return errorResponse("Missing required parameter: nodeId");
  }

  if (!format) {
    return errorResponse(
      "Missing required parameter: format (PNG, SVG, PDF, or JPG)"
    );
  }

  if (!VALID_FORMATS.includes(format as ExportFormat)) {
    return errorResponse(
      `Invalid format '${format}'. Must be one of: ${VALID_FORMATS.join(", ")}`
    );
  }

  if (scale !== undefined) {
    if (typeof scale !== "number" || scale < 0.5 || scale > 4) {
      return errorResponse(
        `Invalid scale '${scale}'. Must be a number between 0.5 and 4. ` +
          `Common values: 1 (1x), 2 (2x/Retina), 3 (3x), 4 (4x).`
      );
    }
  }

  const node = getNode(nodeId);
  if (!node) {
    return errorResponse(
      `Node '${nodeId}' not found. Verify the node ID is correct and the node exists on the current page.`
    );
  }

  // Build export settings
  const exportSettings: ExportSettings = {
    format: format as ExportFormat,
  };

  if (constraint) {
    exportSettings.constraint = constraint;
  } else if (scale !== undefined) {
    exportSettings.constraint = { type: "SCALE", value: scale };
  }

  try {
    const bytes = await node.exportAsync(exportSettings);

    // Convert Uint8Array to base64
    const base64 = uint8ArrayToBase64(bytes);

    return successResponse({
      nodeId: node.id,
      name: node.name,
      format,
      base64,
      byteLength: bytes.length,
    });
  } catch (err) {
    return errorResponse(
      `Export failed for node '${nodeId}': ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

// ============================================================
// set_export_settings
// ============================================================

export async function setExportSettings(
  params: Record<string, unknown>
): Promise<CommandResponse> {
  const nodeId = params.nodeId as string | undefined;
  const settings = params.settings as
    | Array<{
        format: string;
        suffix?: string;
        constraint?: { type: string; value: number };
      }>
    | undefined;

  if (!nodeId) {
    return errorResponse("Missing required parameter: nodeId");
  }

  if (!settings || !Array.isArray(settings)) {
    return errorResponse(
      "Missing required parameter: settings (array of export setting objects)"
    );
  }

  if (settings.length === 0) {
    return errorResponse(
      "settings array must contain at least one export setting. " +
        `Each setting needs: format (PNG/SVG/PDF/JPG), optional suffix, optional constraint.`
    );
  }

  const node = getNode(nodeId);
  if (!node) {
    return errorResponse(
      `Node '${nodeId}' not found. Verify the node ID is correct and the node exists on the current page.`
    );
  }

  // Validate and build export settings
  const exportSettings: ExportSettings[] = [];

  for (const setting of settings) {
    const fmt = setting.format?.toUpperCase();
    if (!VALID_FORMATS.includes(fmt as ExportFormat)) {
      return errorResponse(
        `Invalid format '${setting.format}' in export settings. ` +
          `Must be one of: ${VALID_FORMATS.join(", ")}`
      );
    }

    exportSettings.push({
      format: fmt as ExportFormat,
      suffix: setting.suffix ?? "",
      constraint: setting.constraint
        ? {
            type: setting.constraint.type as "SCALE" | "WIDTH" | "HEIGHT",
            value: setting.constraint.value,
          }
        : { type: "SCALE", value: 1 },
    } as ExportSettings);
  }

  node.exportSettings = exportSettings;

  return successResponse({
    nodeId: node.id,
    name: node.name,
    exportSettings: exportSettings.map((s) => ({
      format: s.format,
      suffix: (s as ExportSettingsImage).suffix ?? "",
      constraint: (s as ExportSettingsImage).constraint,
    })),
  });
}

// ============================================================
// set_image_fill
// ============================================================

export async function setImageFill(
  params: Record<string, unknown>
): Promise<CommandResponse> {
  const nodeId = params.nodeId as string | undefined;
  const imageBase64 = params.imageBase64 as string | undefined;
  const imageUrl = params.imageUrl as string | undefined;
  const scaleMode = params.scaleMode as string | undefined;

  if (!nodeId) {
    return errorResponse("Missing required parameter: nodeId");
  }

  if (!imageBase64 && !imageUrl) {
    return errorResponse(
      "Missing required parameter: provide either imageBase64 or imageUrl to set the image fill"
    );
  }

  if (scaleMode && !VALID_SCALE_MODES.includes(scaleMode as ScaleMode)) {
    return errorResponse(
      `Invalid scaleMode '${scaleMode}'. Must be one of: ${VALID_SCALE_MODES.join(", ")}`
    );
  }

  const node = getNode(nodeId);
  if (!node) {
    return errorResponse(
      `Node '${nodeId}' not found. Verify the node ID is correct and the node exists on the current page.`
    );
  }

  if (!("fills" in node)) {
    return errorResponse(
      `Node '${nodeId}' (${node.name}) of type ${node.type} does not support fills. ` +
        `Use a rectangle, frame, or ellipse for image fills.`
    );
  }

  let imageData: Uint8Array;

  if (imageBase64) {
    // Decode base64 to Uint8Array
    imageData = base64ToUint8Array(imageBase64);
  } else {
    // URL-based image loading would require network access from the plugin
    // For now, return an error asking to use base64 instead
    return errorResponse(
      "imageUrl is not yet supported in the plugin environment. " +
        "Please provide imageBase64 instead. Convert the image to base64 first."
    );
  }

  const image = figma.createImage(imageData);

  const fillNode = node as GeometryMixin;
  fillNode.fills = [
    {
      type: "IMAGE",
      imageHash: image.hash,
      scaleMode: (scaleMode as ScaleMode) ?? "FILL",
    },
  ];

  return successResponse({
    nodeId: node.id,
    name: node.name,
    imageHash: image.hash,
    scaleMode: scaleMode ?? "FILL",
  });
}

// ============================================================
// get_node_css
// ============================================================

export async function getNodeCss(
  params: Record<string, unknown>
): Promise<CommandResponse> {
  const nodeId = params.nodeId as string | undefined;
  const format = (params.format as string | undefined) ?? "css";

  if (!nodeId) {
    return errorResponse("Missing required parameter: nodeId");
  }

  const node = getNode(nodeId);
  if (!node) {
    return errorResponse(
      `Node '${nodeId}' not found. Verify the node ID is correct and the node exists on the current page.`
    );
  }

  const cssProperties: string[] = [];
  const tailwindClasses: string[] = [];

  // Dimensions
  if ("width" in node && "height" in node) {
    cssProperties.push(`width: ${Math.round(node.width)}px`);
    cssProperties.push(`height: ${Math.round(node.height)}px`);
    tailwindClasses.push(`w-[${Math.round(node.width)}px]`);
    tailwindClasses.push(`h-[${Math.round(node.height)}px]`);
  }

  // Border radius
  if ("cornerRadius" in node) {
    const radius = (node as unknown as { cornerRadius: number }).cornerRadius;
    if (typeof radius === "number" && radius > 0) {
      cssProperties.push(`border-radius: ${radius}px`);
      tailwindClasses.push(`rounded-[${radius}px]`);
    }
  }

  // Opacity
  if ("opacity" in node && (node as SceneNode).opacity < 1) {
    const op = (node as SceneNode).opacity;
    cssProperties.push(`opacity: ${op}`);
    tailwindClasses.push(`opacity-${Math.round(op * 100)}`);
  }

  // Fills (first solid fill → background-color)
  if ("fills" in node) {
    const fills = (node as unknown as { fills: unknown[] }).fills;
    if (Array.isArray(fills) && fills.length > 0) {
      const firstFill = fills[0] as {
        type: string;
        color?: { r: number; g: number; b: number };
        opacity?: number;
      };
      if (firstFill.type === "SOLID" && firstFill.color) {
        const { r, g, b } = firstFill.color;
        const hex = rgbToHex(r, g, b);
        cssProperties.push(`background-color: ${hex}`);
        tailwindClasses.push(`bg-[${hex}]`);
      }
    }
  }

  // Strokes
  if ("strokes" in node) {
    const strokes = (node as unknown as { strokes: unknown[] }).strokes;
    if (Array.isArray(strokes) && strokes.length > 0) {
      const stroke = strokes[0] as {
        type: string;
        color?: { r: number; g: number; b: number };
      };
      if (stroke.type === "SOLID" && stroke.color) {
        const hex = rgbToHex(stroke.color.r, stroke.color.g, stroke.color.b);
        cssProperties.push(`border-color: ${hex}`);
        tailwindClasses.push(`border-[${hex}]`);
      }
    }
  }

  // Effects (drop shadow)
  if ("effects" in node) {
    const effects = (node as unknown as { effects: unknown[] }).effects;
    if (Array.isArray(effects)) {
      for (const effect of effects) {
        const e = effect as {
          type: string;
          color?: { r: number; g: number; b: number; a: number };
          offset?: { x: number; y: number };
          radius?: number;
          visible?: boolean;
        };
        if (e.type === "DROP_SHADOW" && e.visible !== false) {
          const c = e.color ?? { r: 0, g: 0, b: 0, a: 0.25 };
          const ox = e.offset?.x ?? 0;
          const oy = e.offset?.y ?? 4;
          const r = e.radius ?? 8;
          cssProperties.push(
            `box-shadow: ${ox}px ${oy}px ${r}px rgba(${Math.round(c.r * 255)}, ${Math.round(c.g * 255)}, ${Math.round(c.b * 255)}, ${c.a ?? 0.25})`
          );
          tailwindClasses.push("shadow");
        }
      }
    }
  }

  // Text properties
  if (node.type === "TEXT") {
    const textNode = node as TextNode;

    if ("fontName" in textNode) {
      const fontName = textNode.fontName as { family: string; style: string };
      if (fontName && typeof fontName === "object") {
        cssProperties.push(`font-family: '${fontName.family}', sans-serif`);
        tailwindClasses.push(`font-['${fontName.family}']`);
      }
    }

    if ("fontSize" in textNode) {
      const size = textNode.fontSize as number;
      if (typeof size === "number") {
        cssProperties.push(`font-size: ${size}px`);
        tailwindClasses.push(`text-[${size}px]`);
      }
    }

    if ("fontWeight" in textNode) {
      const weight = (textNode as unknown as { fontWeight: number }).fontWeight;
      if (typeof weight === "number" && weight !== 400) {
        cssProperties.push(`font-weight: ${weight}`);
        tailwindClasses.push(`font-[${weight}]`);
      }
    }

    if ("lineHeight" in textNode) {
      const lh = textNode.lineHeight as
        | { value: number; unit: string }
        | { unit: "AUTO" };
      if (lh && "value" in lh) {
        cssProperties.push(`line-height: ${lh.value}px`);
        tailwindClasses.push(`leading-[${lh.value}px]`);
      }
    }

    if ("letterSpacing" in textNode) {
      const ls = textNode.letterSpacing as { value: number; unit: string };
      if (ls && ls.value !== 0) {
        cssProperties.push(`letter-spacing: ${ls.value}px`);
        tailwindClasses.push(`tracking-[${ls.value}px]`);
      }
    }
  }

  // Auto-layout (frame)
  if ("layoutMode" in node) {
    const frameNode = node as FrameNode;
    if (frameNode.layoutMode !== "NONE") {
      cssProperties.push("display: flex");
      tailwindClasses.push("flex");

      if (frameNode.layoutMode === "VERTICAL") {
        cssProperties.push("flex-direction: column");
        tailwindClasses.push("flex-col");
      } else {
        cssProperties.push("flex-direction: row");
        tailwindClasses.push("flex-row");
      }

      if ("itemSpacing" in frameNode) {
        const spacing = frameNode.itemSpacing;
        cssProperties.push(`gap: ${spacing}px`);
        tailwindClasses.push(`gap-[${spacing}px]`);
      }

      if ("paddingTop" in frameNode) {
        const pt = frameNode.paddingTop;
        const pr = frameNode.paddingRight;
        const pb = frameNode.paddingBottom;
        const pl = frameNode.paddingLeft;
        cssProperties.push(`padding: ${pt}px ${pr}px ${pb}px ${pl}px`);

        if (pt === pr && pr === pb && pb === pl) {
          tailwindClasses.push(`p-[${pt}px]`);
        } else {
          tailwindClasses.push(`pt-[${pt}px]`);
          tailwindClasses.push(`pr-[${pr}px]`);
          tailwindClasses.push(`pb-[${pb}px]`);
          tailwindClasses.push(`pl-[${pl}px]`);
        }
      }
    }
  }

  const cssString = cssProperties.join(";\n") + ";";
  const tailwindString = tailwindClasses.join(" ");

  if (format === "tailwind") {
    return successResponse({
      nodeId: node.id,
      name: node.name,
      tailwind: tailwindString,
    });
  }

  return successResponse({
    nodeId: node.id,
    name: node.name,
    css: cssString,
  });
}

// ============================================================
// Utility: Base64 Encoding/Decoding
// ============================================================

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  // In Figma plugin environment, btoa is available
  if (typeof btoa === "function") {
    return btoa(binary);
  }
  // Fallback for Node.js test environment
  return Buffer.from(bytes).toString("base64");
}

function base64ToUint8Array(base64: string): Uint8Array {
  // In Figma plugin environment, atob is available
  if (typeof atob === "function") {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
  // Fallback for Node.js test environment
  return new Uint8Array(Buffer.from(base64, "base64"));
}

// ============================================================
// Utility: Color Conversion
// ============================================================

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (c: number) =>
    Math.round(c * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}
```

**Step 2: Run tests to verify they pass**

Run: `npx vitest run plugin/__tests__/export.test.ts`
Expected: All tests PASS

**Step 3: Commit**

```bash
git add plugin/executors/export.ts
git commit -m "feat: add export executors (export_node, set_export_settings, set_image_fill, get_node_css)"
```

---

## Task 4: Variable Executors — Tests

**Files:**
- Create: `plugin/__tests__/variables.test.ts`

**Step 1: Write the failing tests**

```typescript
// plugin/__tests__/variables.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createMockFigma,
  createMockFrame,
  createMockRectangle,
  resetIdCounter,
  resetVarIdCounter,
  resetCollectionIdCounter,
  type MockFigmaGlobal,
  type MockSceneNode,
} from "../../test/mocks/figma-api-phase5.js";
import {
  createVariable,
  setVariableValue,
  createVariableCollection,
  bindVariable,
} from "../executors/variables.js";

describe("Variable Executors", () => {
  let mockFigma: MockFigmaGlobal;

  beforeEach(() => {
    resetIdCounter();
    resetVarIdCounter();
    resetCollectionIdCounter();
    mockFigma = createMockFigma();
    (globalThis as unknown as { figma: MockFigmaGlobal }).figma = mockFigma;
  });

  // ============================================================
  // create_variable_collection
  // ============================================================

  describe("create_variable_collection", () => {
    it("creates a collection with a single default mode", async () => {
      const result = await createVariableCollection({
        name: "Brand Colors",
      });

      expect(result.success).toBe(true);
      const data = result.data as Record<string, unknown>;
      expect(data.name).toBe("Brand Colors");
      expect(data.collectionId).toBeDefined();
      expect(mockFigma.variables.createVariableCollection).toHaveBeenCalledWith(
        "Brand Colors"
      );
    });

    it("creates a collection with multiple modes", async () => {
      const result = await createVariableCollection({
        name: "Theme",
        modes: ["Light", "Dark"],
      });

      expect(result.success).toBe(true);
      const data = result.data as Record<string, unknown>;
      expect(data.name).toBe("Theme");
      expect((data.modes as unknown[]).length).toBeGreaterThanOrEqual(1);
    });

    it("fails if name is missing", async () => {
      const result = await createVariableCollection({});

      expect(result.success).toBe(false);
      expect(result.error).toContain("name");
    });

    it("fails if name is empty string", async () => {
      const result = await createVariableCollection({ name: "" });

      expect(result.success).toBe(false);
      expect(result.error).toContain("name");
    });
  });

  // ============================================================
  // create_variable
  // ============================================================

  describe("create_variable", () => {
    it("creates a COLOR variable", async () => {
      // First create a collection
      const collResult = await createVariableCollection({
        name: "Colors",
      });
      const collectionId = (collResult.data as Record<string, unknown>)
        .collectionId as string;

      const result = await createVariable({
        name: "primary/500",
        collectionId,
        resolvedType: "COLOR",
        value: { r: 0.2, g: 0.4, b: 0.8, a: 1 },
      });

      expect(result.success).toBe(true);
      const data = result.data as Record<string, unknown>;
      expect(data.name).toBe("primary/500");
      expect(data.resolvedType).toBe("COLOR");
      expect(data.variableId).toBeDefined();
    });

    it("creates a FLOAT variable", async () => {
      const collResult = await createVariableCollection({
        name: "Spacing",
      });
      const collectionId = (collResult.data as Record<string, unknown>)
        .collectionId as string;

      const result = await createVariable({
        name: "spacing/md",
        collectionId,
        resolvedType: "FLOAT",
        value: 16,
      });

      expect(result.success).toBe(true);
      expect(
        (result.data as Record<string, unknown>).resolvedType
      ).toBe("FLOAT");
    });

    it("creates a STRING variable", async () => {
      const collResult = await createVariableCollection({
        name: "Strings",
      });
      const collectionId = (collResult.data as Record<string, unknown>)
        .collectionId as string;

      const result = await createVariable({
        name: "label/ok",
        collectionId,
        resolvedType: "STRING",
        value: "OK",
      });

      expect(result.success).toBe(true);
      expect(
        (result.data as Record<string, unknown>).resolvedType
      ).toBe("STRING");
    });

    it("creates a BOOLEAN variable", async () => {
      const collResult = await createVariableCollection({
        name: "Flags",
      });
      const collectionId = (collResult.data as Record<string, unknown>)
        .collectionId as string;

      const result = await createVariable({
        name: "feature/darkMode",
        collectionId,
        resolvedType: "BOOLEAN",
        value: true,
      });

      expect(result.success).toBe(true);
      expect(
        (result.data as Record<string, unknown>).resolvedType
      ).toBe("BOOLEAN");
    });

    it("fails if name is missing", async () => {
      const result = await createVariable({
        collectionId: "VariableCollectionID:1:1",
        resolvedType: "COLOR",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("name");
    });

    it("fails if collectionId is missing", async () => {
      const result = await createVariable({
        name: "test",
        resolvedType: "COLOR",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("collectionId");
    });

    it("fails if resolvedType is missing", async () => {
      const result = await createVariable({
        name: "test",
        collectionId: "VariableCollectionID:1:1",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("resolvedType");
    });

    it("fails if resolvedType is invalid", async () => {
      const result = await createVariable({
        name: "test",
        collectionId: "VariableCollectionID:1:1",
        resolvedType: "INTEGER",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid resolvedType");
    });

    it("fails if collection is not found", async () => {
      const result = await createVariable({
        name: "test",
        collectionId: "VariableCollectionID:999:1",
        resolvedType: "COLOR",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });
  });

  // ============================================================
  // set_variable_value
  // ============================================================

  describe("set_variable_value", () => {
    it("sets a variable value for the default mode", async () => {
      // Setup: collection + variable
      const collResult = await createVariableCollection({
        name: "Colors",
      });
      const collectionId = (collResult.data as Record<string, unknown>)
        .collectionId as string;

      const varResult = await createVariable({
        name: "primary",
        collectionId,
        resolvedType: "COLOR",
      });
      const variableId = (varResult.data as Record<string, unknown>)
        .variableId as string;

      // Get the default mode ID
      const collection =
        mockFigma.variables.getVariableCollectionById(collectionId);
      const modeId = collection!.modes[0].modeId;

      const result = await setVariableValue({
        variableId,
        modeId,
        value: { r: 0, g: 0.5, b: 1, a: 1 },
      });

      expect(result.success).toBe(true);
      const variable = mockFigma.variables.getVariableById(variableId);
      expect(variable!.setValueForMode).toHaveBeenCalledWith(modeId, {
        r: 0,
        g: 0.5,
        b: 1,
        a: 1,
      });
    });

    it("sets a FLOAT variable value", async () => {
      const collResult = await createVariableCollection({
        name: "Spacing",
      });
      const collectionId = (collResult.data as Record<string, unknown>)
        .collectionId as string;

      const varResult = await createVariable({
        name: "gap",
        collectionId,
        resolvedType: "FLOAT",
      });
      const variableId = (varResult.data as Record<string, unknown>)
        .variableId as string;

      const collection =
        mockFigma.variables.getVariableCollectionById(collectionId);
      const modeId = collection!.modes[0].modeId;

      const result = await setVariableValue({
        variableId,
        modeId,
        value: 24,
      });

      expect(result.success).toBe(true);
    });

    it("fails if variableId is missing", async () => {
      const result = await setVariableValue({
        modeId: "mode-0",
        value: 10,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("variableId");
    });

    it("fails if modeId is missing", async () => {
      const result = await setVariableValue({
        variableId: "VariableID:1:1",
        value: 10,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("modeId");
    });

    it("fails if value is missing", async () => {
      const result = await setVariableValue({
        variableId: "VariableID:1:1",
        modeId: "mode-0",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("value");
    });

    it("fails if variable is not found", async () => {
      const result = await setVariableValue({
        variableId: "VariableID:999:1",
        modeId: "mode-0",
        value: 10,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });
  });

  // ============================================================
  // bind_variable
  // ============================================================

  describe("bind_variable", () => {
    it("binds a COLOR variable to a node fill", async () => {
      // Setup: collection + variable + node
      const collResult = await createVariableCollection({
        name: "Colors",
      });
      const collectionId = (collResult.data as Record<string, unknown>)
        .collectionId as string;

      const varResult = await createVariable({
        name: "primary",
        collectionId,
        resolvedType: "COLOR",
      });
      const variableId = (varResult.data as Record<string, unknown>)
        .variableId as string;

      const rect = createMockRectangle("Button BG");
      mockFigma.currentPage.appendChild(rect as unknown as MockSceneNode);

      const result = await bindVariable({
        nodeId: rect.id,
        property: "fills",
        variableId,
      });

      expect(result.success).toBe(true);
      expect(rect.setBoundVariable).toHaveBeenCalledWith(
        "fills",
        expect.objectContaining({ id: variableId })
      );
    });

    it("binds a FLOAT variable to corner radius", async () => {
      const collResult = await createVariableCollection({
        name: "Radii",
      });
      const collectionId = (collResult.data as Record<string, unknown>)
        .collectionId as string;

      const varResult = await createVariable({
        name: "radius/md",
        collectionId,
        resolvedType: "FLOAT",
      });
      const variableId = (varResult.data as Record<string, unknown>)
        .variableId as string;

      const rect = createMockRectangle("Card");
      mockFigma.currentPage.appendChild(rect as unknown as MockSceneNode);

      const result = await bindVariable({
        nodeId: rect.id,
        property: "cornerRadius",
        variableId,
      });

      expect(result.success).toBe(true);
    });

    it("binds a FLOAT variable to item spacing", async () => {
      const collResult = await createVariableCollection({
        name: "Spacing",
      });
      const collectionId = (collResult.data as Record<string, unknown>)
        .collectionId as string;

      const varResult = await createVariable({
        name: "spacing/md",
        collectionId,
        resolvedType: "FLOAT",
      });
      const variableId = (varResult.data as Record<string, unknown>)
        .variableId as string;

      const frame = createMockFrame("Container");
      mockFigma.currentPage.appendChild(frame as unknown as MockSceneNode);

      const result = await bindVariable({
        nodeId: frame.id,
        property: "itemSpacing",
        variableId,
      });

      expect(result.success).toBe(true);
    });

    it("fails if nodeId is missing", async () => {
      const result = await bindVariable({
        property: "fills",
        variableId: "VariableID:1:1",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("nodeId");
    });

    it("fails if property is missing", async () => {
      const rect = createMockRectangle("Rect");
      mockFigma.currentPage.appendChild(rect as unknown as MockSceneNode);

      const result = await bindVariable({
        nodeId: rect.id,
        variableId: "VariableID:1:1",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("property");
    });

    it("fails if variableId is missing", async () => {
      const rect = createMockRectangle("Rect");
      mockFigma.currentPage.appendChild(rect as unknown as MockSceneNode);

      const result = await bindVariable({
        nodeId: rect.id,
        property: "fills",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("variableId");
    });

    it("fails if node is not found", async () => {
      const result = await bindVariable({
        nodeId: "999:999",
        property: "fills",
        variableId: "VariableID:1:1",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });

    it("fails if variable is not found", async () => {
      const rect = createMockRectangle("Rect");
      mockFigma.currentPage.appendChild(rect as unknown as MockSceneNode);

      const result = await bindVariable({
        nodeId: rect.id,
        property: "fills",
        variableId: "VariableID:999:1",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Variable");
      expect(result.error).toContain("not found");
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run plugin/__tests__/variables.test.ts`
Expected: FAIL — module `../executors/variables.js` not found

**Step 3: Commit**

```bash
git add plugin/__tests__/variables.test.ts
git commit -m "test: add failing tests for variable executors (create_variable, set_variable_value, create_variable_collection, bind_variable)"
```

---

## Task 5: Variable Executors — Implementation

**Files:**
- Create: `plugin/executors/variables.ts`

**Step 1: Write the implementation**

```typescript
// plugin/executors/variables.ts

interface CommandResponse {
  id?: string;
  success: boolean;
  data?: unknown;
  error?: string;
}

// ============================================================
// Helpers
// ============================================================

function getNode(nodeId: string): SceneNode | null {
  return figma.getNodeById(nodeId) as SceneNode | null;
}

function errorResponse(error: string): CommandResponse {
  return { success: false, error };
}

function successResponse(data: unknown): CommandResponse {
  return { success: true, data };
}

const VALID_RESOLVED_TYPES = [
  "COLOR",
  "FLOAT",
  "STRING",
  "BOOLEAN",
] as const;
type ResolvedType = (typeof VALID_RESOLVED_TYPES)[number];

// ============================================================
// create_variable_collection
// ============================================================

export async function createVariableCollection(
  params: Record<string, unknown>
): Promise<CommandResponse> {
  const name = params.name as string | undefined;
  const modes = params.modes as string[] | undefined;

  if (!name || typeof name !== "string" || name.trim() === "") {
    return errorResponse(
      "Missing required parameter: name (non-empty string for the variable collection)"
    );
  }

  const collection = figma.variables.createVariableCollection(name.trim());

  // If additional modes are requested, add them
  // Note: Figma creates a default mode automatically
  if (modes && Array.isArray(modes) && modes.length > 0) {
    // Rename the first/default mode
    if (collection.modes.length > 0) {
      // In Figma API, we can rename the default mode by renaming it
      // For the mock, the first mode is already created
    }

    // Add remaining modes
    for (let i = 1; i < modes.length; i++) {
      collection.addMode(modes[i]);
    }
  }

  return successResponse({
    collectionId: collection.id,
    name: collection.name,
    modes: collection.modes.map((m) => ({
      modeId: m.modeId,
      name: m.name,
    })),
  });
}

// ============================================================
// create_variable
// ============================================================

export async function createVariable(
  params: Record<string, unknown>
): Promise<CommandResponse> {
  const name = params.name as string | undefined;
  const collectionId = params.collectionId as string | undefined;
  const resolvedType = params.resolvedType as string | undefined;
  const value = params.value;

  if (!name || typeof name !== "string" || name.trim() === "") {
    return errorResponse(
      "Missing required parameter: name (non-empty string for the variable name)"
    );
  }

  if (!collectionId) {
    return errorResponse(
      "Missing required parameter: collectionId (ID of the variable collection)"
    );
  }

  if (!resolvedType) {
    return errorResponse(
      "Missing required parameter: resolvedType (COLOR, FLOAT, STRING, or BOOLEAN)"
    );
  }

  if (!VALID_RESOLVED_TYPES.includes(resolvedType as ResolvedType)) {
    return errorResponse(
      `Invalid resolvedType '${resolvedType}'. Must be one of: ${VALID_RESOLVED_TYPES.join(", ")}`
    );
  }

  // Verify collection exists
  const collection =
    figma.variables.getVariableCollectionById(collectionId);
  if (!collection) {
    return errorResponse(
      `Variable collection '${collectionId}' not found. ` +
        `Create a collection first with create_variable_collection, or verify the collection ID.`
    );
  }

  const variable = figma.variables.createVariable(
    name.trim(),
    collectionId,
    resolvedType as ResolvedType
  );

  // Set initial value if provided
  if (value !== undefined && collection.modes.length > 0) {
    const defaultModeId = collection.modes[0].modeId;
    variable.setValueForMode(defaultModeId, value);
  }

  return successResponse({
    variableId: variable.id,
    name: variable.name,
    resolvedType: variable.resolvedType,
    collectionId: variable.variableCollectionId,
  });
}

// ============================================================
// set_variable_value
// ============================================================

export async function setVariableValue(
  params: Record<string, unknown>
): Promise<CommandResponse> {
  const variableId = params.variableId as string | undefined;
  const modeId = params.modeId as string | undefined;
  const value = params.value;

  if (!variableId) {
    return errorResponse(
      "Missing required parameter: variableId (ID of the variable to update)"
    );
  }

  if (!modeId) {
    return errorResponse(
      "Missing required parameter: modeId (ID of the mode to set the value for)"
    );
  }

  if (value === undefined) {
    return errorResponse(
      "Missing required parameter: value (the value to set for this variable in the specified mode)"
    );
  }

  const variable = figma.variables.getVariableById(variableId);
  if (!variable) {
    return errorResponse(
      `Variable '${variableId}' not found. Verify the variable ID is correct. ` +
        `Use figma_variables with command 'create_variable' to create one first.`
    );
  }

  variable.setValueForMode(modeId, value);

  return successResponse({
    variableId: variable.id,
    name: variable.name,
    modeId,
    value,
  });
}

// ============================================================
// bind_variable
// ============================================================

export async function bindVariable(
  params: Record<string, unknown>
): Promise<CommandResponse> {
  const nodeId = params.nodeId as string | undefined;
  const property = params.property as string | undefined;
  const variableId = params.variableId as string | undefined;

  if (!nodeId) {
    return errorResponse("Missing required parameter: nodeId");
  }

  if (!property) {
    return errorResponse(
      "Missing required parameter: property (the node property to bind, e.g., 'fills', 'cornerRadius', 'itemSpacing', 'opacity')"
    );
  }

  if (!variableId) {
    return errorResponse(
      "Missing required parameter: variableId (ID of the variable to bind)"
    );
  }

  const node = getNode(nodeId);
  if (!node) {
    return errorResponse(
      `Node '${nodeId}' not found. Verify the node ID is correct and the node exists on the current page.`
    );
  }

  const variable = figma.variables.getVariableById(variableId);
  if (!variable) {
    return errorResponse(
      `Variable '${variableId}' not found. Verify the variable ID is correct. ` +
        `Use figma_variables with command 'create_variable' to create one first.`
    );
  }

  try {
    (node as SceneNode & { setBoundVariable: (field: string, variable: Variable) => void })
      .setBoundVariable(property, variable as unknown as Variable);
  } catch (err) {
    return errorResponse(
      `Failed to bind variable '${variable.name}' to property '${property}' on node '${nodeId}': ` +
        `${err instanceof Error ? err.message : String(err)}. ` +
        `Ensure the property exists on this node type and the variable type is compatible.`
    );
  }

  return successResponse({
    nodeId: node.id,
    name: node.name,
    property,
    variableId: variable.id,
    variableName: variable.name,
  });
}
```

**Step 2: Run tests to verify they pass**

Run: `npx vitest run plugin/__tests__/variables.test.ts`
Expected: All tests PASS

**Step 3: Commit**

```bash
git add plugin/executors/variables.ts
git commit -m "feat: add variable executors (create_variable, set_variable_value, create_variable_collection, bind_variable)"
```

---

## Task 6: Design System Scanner (Plugin-Side)

**Files:**
- Create: `plugin/__tests__/design-system-scanner.test.ts`
- Create: `plugin/utils/design-system-scanner.ts`

**Step 1: Write the failing tests**

```typescript
// plugin/__tests__/design-system-scanner.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createMockFigma,
  createMockFrame,
  createMockComponent,
  createMockRectangle,
  createMockText,
  createMockPaintStyle,
  createMockTextStyle,
  createMockEffectStyle,
  createMockGridStyle,
  createMockVariable,
  createMockVariableCollection,
  resetIdCounter,
  resetVarIdCounter,
  resetCollectionIdCounter,
  resetStyleIdCounter,
  type MockFigmaGlobal,
  type MockSceneNode,
  type MockPaintStyle,
  type MockTextStyle,
  type MockEffectStyle,
  type MockGridStyle,
} from "../../test/mocks/figma-api-phase5.js";
import { scanDesignSystem } from "../utils/design-system-scanner.js";

describe("Design System Scanner", () => {
  let mockFigma: MockFigmaGlobal;

  beforeEach(() => {
    resetIdCounter();
    resetVarIdCounter();
    resetCollectionIdCounter();
    resetStyleIdCounter();
    mockFigma = createMockFigma();
    (globalThis as unknown as { figma: MockFigmaGlobal }).figma = mockFigma;
  });

  it("returns a complete DesignSystemContext structure", async () => {
    const result = await scanDesignSystem();

    expect(result).toBeDefined();
    expect(result.variables).toBeDefined();
    expect(result.variables.collections).toBeDefined();
    expect(result.variables.colorTokens).toBeDefined();
    expect(result.variables.spacingTokens).toBeDefined();
    expect(result.variables.typographyTokens).toBeDefined();
    expect(result.styles).toBeDefined();
    expect(result.styles.textStyles).toBeDefined();
    expect(result.styles.colorStyles).toBeDefined();
    expect(result.styles.effectStyles).toBeDefined();
    expect(result.styles.gridStyles).toBeDefined();
    expect(result.components).toBeDefined();
    expect(result.components.local).toBeDefined();
    expect(result.conventions).toBeDefined();
  });

  it("scans local paint styles", async () => {
    const style1 = createMockPaintStyle("Brand/Primary", {
      r: 0.2,
      g: 0.4,
      b: 0.8,
    });
    const style2 = createMockPaintStyle("Brand/Secondary", {
      r: 0.9,
      g: 0.3,
      b: 0.1,
    });
    const addPaintStyle = (mockFigma as unknown as Record<string, unknown>)
      .addPaintStyle as (s: MockPaintStyle) => void;
    addPaintStyle(style1);
    addPaintStyle(style2);

    const result = await scanDesignSystem();

    expect(result.styles.colorStyles).toHaveLength(2);
    expect(result.styles.colorStyles[0].name).toBe("Brand/Primary");
    expect(result.styles.colorStyles[1].name).toBe("Brand/Secondary");
  });

  it("scans local text styles", async () => {
    const style1 = createMockTextStyle("Heading/H1", 32, "Inter");
    const style2 = createMockTextStyle("Body/Regular", 16, "Inter");
    const addTextStyle = (mockFigma as unknown as Record<string, unknown>)
      .addTextStyle as (s: MockTextStyle) => void;
    addTextStyle(style1);
    addTextStyle(style2);

    const result = await scanDesignSystem();

    expect(result.styles.textStyles).toHaveLength(2);
    expect(result.styles.textStyles[0].name).toBe("Heading/H1");
  });

  it("scans local effect styles", async () => {
    const style = createMockEffectStyle("Elevation/Medium");
    const addEffectStyle = (mockFigma as unknown as Record<string, unknown>)
      .addEffectStyle as (s: MockEffectStyle) => void;
    addEffectStyle(style);

    const result = await scanDesignSystem();

    expect(result.styles.effectStyles).toHaveLength(1);
    expect(result.styles.effectStyles[0].name).toBe("Elevation/Medium");
  });

  it("scans local grid styles", async () => {
    const style = createMockGridStyle("Layout/12-Column");
    const addGridStyle = (mockFigma as unknown as Record<string, unknown>)
      .addGridStyle as (s: MockGridStyle) => void;
    addGridStyle(style);

    const result = await scanDesignSystem();

    expect(result.styles.gridStyles).toHaveLength(1);
    expect(result.styles.gridStyles[0].name).toBe("Layout/12-Column");
  });

  it("scans variable collections and variables", async () => {
    // Create collection and variables via the mock API
    const collection =
      mockFigma.variables.createVariableCollection("Brand Colors");
    mockFigma.variables.createVariable(
      "primary/500",
      collection.id,
      "COLOR"
    );
    mockFigma.variables.createVariable(
      "spacing/md",
      collection.id,
      "FLOAT"
    );

    const result = await scanDesignSystem();

    expect(result.variables.collections).toHaveLength(1);
    expect(result.variables.collections[0].name).toBe("Brand Colors");
    expect(result.variables.colorTokens.length).toBeGreaterThanOrEqual(1);
    expect(result.variables.spacingTokens.length).toBeGreaterThanOrEqual(1);
  });

  it("scans local components", async () => {
    const comp1 = createMockComponent("Button/Primary");
    comp1.description = "Primary action button";
    const comp2 = createMockComponent("Card/Default");
    comp2.description = "Default card component";
    mockFigma.currentPage.appendChild(comp1 as unknown as MockSceneNode);
    mockFigma.currentPage.appendChild(comp2 as unknown as MockSceneNode);

    const result = await scanDesignSystem();

    expect(result.components.local).toHaveLength(2);
    expect(result.components.local[0].name).toBe("Button/Primary");
    expect(result.components.local[0].description).toBe(
      "Primary action button"
    );
  });

  it("detects naming convention patterns", async () => {
    // Create components with BEM-like naming
    const comp1 = createMockComponent("button--primary");
    const comp2 = createMockComponent("button--secondary");
    const comp3 = createMockComponent("card__header");
    mockFigma.currentPage.appendChild(comp1 as unknown as MockSceneNode);
    mockFigma.currentPage.appendChild(comp2 as unknown as MockSceneNode);
    mockFigma.currentPage.appendChild(comp3 as unknown as MockSceneNode);

    const result = await scanDesignSystem();

    // The scanner should detect some naming pattern
    expect(result.conventions.namingPattern).toBeDefined();
  });

  it("extracts spacing scale from FLOAT variables", async () => {
    const collection =
      mockFigma.variables.createVariableCollection("Spacing");
    const var4 = mockFigma.variables.createVariable(
      "spacing/xs",
      collection.id,
      "FLOAT"
    );
    var4.setValueForMode(collection.modes[0].modeId, 4);
    const var8 = mockFigma.variables.createVariable(
      "spacing/sm",
      collection.id,
      "FLOAT"
    );
    var8.setValueForMode(collection.modes[0].modeId, 8);
    const var16 = mockFigma.variables.createVariable(
      "spacing/md",
      collection.id,
      "FLOAT"
    );
    var16.setValueForMode(collection.modes[0].modeId, 16);

    const result = await scanDesignSystem();

    expect(result.conventions.spacingScale.length).toBeGreaterThanOrEqual(1);
  });

  it("returns empty context for empty file", async () => {
    const result = await scanDesignSystem();

    expect(result.variables.collections).toHaveLength(0);
    expect(result.variables.colorTokens).toHaveLength(0);
    expect(result.styles.colorStyles).toHaveLength(0);
    expect(result.styles.textStyles).toHaveLength(0);
    expect(result.components.local).toHaveLength(0);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run plugin/__tests__/design-system-scanner.test.ts`
Expected: FAIL — module `../utils/design-system-scanner.js` not found

**Step 3: Write the implementation**

```typescript
// plugin/utils/design-system-scanner.ts

import type {
  DesignSystemContext,
  VariableCollectionInfo,
  VariableInfo,
  StyleInfo,
  ComponentInfo,
  ColorGroupInfo,
} from "../../shared/protocol.js";

// ============================================================
// scanDesignSystem
// ============================================================

export async function scanDesignSystem(): Promise<DesignSystemContext> {
  const variables = scanVariables();
  const styles = scanStyles();
  const components = scanComponents();
  const conventions = analyzeConventions(variables, styles, components);

  return {
    variables,
    styles,
    components,
    conventions,
  };
}

// ============================================================
// Variable Scanning
// ============================================================

function scanVariables(): DesignSystemContext["variables"] {
  const collections: VariableCollectionInfo[] = [];
  const colorTokens: VariableInfo[] = [];
  const spacingTokens: VariableInfo[] = [];
  const typographyTokens: VariableInfo[] = [];

  try {
    const localCollections =
      figma.variables.getLocalVariableCollections();

    for (const collection of localCollections) {
      collections.push({
        id: collection.id,
        name: collection.name,
        modes: collection.modes.map((m) => ({
          id: m.modeId,
          name: m.name,
        })),
        variableCount: collection.variableIds.length,
      });
    }

    const localVariables = figma.variables.getLocalVariables();

    for (const variable of localVariables) {
      const defaultModeId = getDefaultModeId(variable.variableCollectionId);
      const defaultValue =
        defaultModeId !== null
          ? variable.valuesByMode[defaultModeId]
          : undefined;

      const info: VariableInfo = {
        id: variable.id,
        name: variable.name,
        type: variable.resolvedType,
        value: defaultValue,
        collectionId: variable.variableCollectionId,
      };

      switch (variable.resolvedType) {
        case "COLOR":
          colorTokens.push(info);
          break;
        case "FLOAT": {
          // Heuristic: if name contains spacing/gap/padding/margin, it's spacing
          const lowerName = variable.name.toLowerCase();
          if (
            lowerName.includes("spacing") ||
            lowerName.includes("gap") ||
            lowerName.includes("padding") ||
            lowerName.includes("margin") ||
            lowerName.includes("space")
          ) {
            spacingTokens.push(info);
          } else if (
            lowerName.includes("font") ||
            lowerName.includes("line") ||
            lowerName.includes("letter") ||
            lowerName.includes("text")
          ) {
            typographyTokens.push(info);
          } else {
            // Default: treat as spacing if it's a round number
            spacingTokens.push(info);
          }
          break;
        }
        case "STRING":
          // String variables that contain font info → typography
          if (
            variable.name.toLowerCase().includes("font") ||
            variable.name.toLowerCase().includes("text")
          ) {
            typographyTokens.push(info);
          }
          break;
        case "BOOLEAN":
          // Booleans are typically feature flags, not design tokens
          break;
      }
    }
  } catch {
    // Variables API may not be available in all Figma versions
    // Return empty arrays silently
  }

  return { collections, colorTokens, spacingTokens, typographyTokens };
}

function getDefaultModeId(collectionId: string): string | null {
  try {
    const collection =
      figma.variables.getVariableCollectionById(collectionId);
    if (collection && collection.modes.length > 0) {
      return collection.modes[0].modeId;
    }
  } catch {
    // Collection not found
  }
  return null;
}

// ============================================================
// Style Scanning
// ============================================================

function scanStyles(): DesignSystemContext["styles"] {
  const textStyles: StyleInfo[] = [];
  const colorStyles: StyleInfo[] = [];
  const effectStyles: StyleInfo[] = [];
  const gridStyles: StyleInfo[] = [];

  try {
    for (const style of figma.getLocalPaintStyles()) {
      colorStyles.push({
        id: style.id,
        name: style.name,
        type: "PAINT",
        description: style.description ?? "",
      });
    }

    for (const style of figma.getLocalTextStyles()) {
      textStyles.push({
        id: style.id,
        name: style.name,
        type: "TEXT",
        description: style.description ?? "",
      });
    }

    for (const style of figma.getLocalEffectStyles()) {
      effectStyles.push({
        id: style.id,
        name: style.name,
        type: "EFFECT",
        description: style.description ?? "",
      });
    }

    for (const style of figma.getLocalGridStyles()) {
      gridStyles.push({
        id: style.id,
        name: style.name,
        type: "GRID",
        description: style.description ?? "",
      });
    }
  } catch {
    // Style API not available — return empty
  }

  return { textStyles, colorStyles, effectStyles, gridStyles };
}

// ============================================================
// Component Scanning
// ============================================================

function scanComponents(): DesignSystemContext["components"] {
  const local: ComponentInfo[] = [];

  try {
    // Walk the document to find all components
    function walkForComponents(node: BaseNode): void {
      if (node.type === "COMPONENT") {
        const comp = node as ComponentNode;
        local.push({
          id: comp.id,
          name: comp.name,
          description: comp.description ?? "",
        });
      }

      if ("children" in node) {
        const parent = node as BaseNode & ChildrenMixin;
        for (const child of parent.children) {
          walkForComponents(child);
        }
      }
    }

    // Scan all pages
    for (const page of figma.root.children) {
      walkForComponents(page);
    }
  } catch {
    // Scanning failed — return empty
  }

  return {
    local,
    external: [], // External libraries require async API calls in real Figma
  };
}

// ============================================================
// Convention Analysis
// ============================================================

function analyzeConventions(
  variables: DesignSystemContext["variables"],
  _styles: DesignSystemContext["styles"],
  components: DesignSystemContext["components"]
): DesignSystemContext["conventions"] {
  const namingPattern = detectNamingPattern(components.local);
  const spacingScale = extractSpacingScale(variables.spacingTokens);
  const colorPalette = extractColorPalette(variables.colorTokens);

  return {
    namingPattern,
    spacingScale,
    colorPalette,
  };
}

function detectNamingPattern(
  components: ComponentInfo[]
): "BEM" | "atomic" | "flat" | "unknown" {
  if (components.length === 0) return "unknown";

  let bemScore = 0;
  let slashScore = 0;

  for (const comp of components) {
    const name = comp.name;
    if (name.includes("--") || name.includes("__")) {
      bemScore++;
    }
    if (name.includes("/")) {
      slashScore++;
    }
  }

  const total = components.length;
  if (bemScore / total > 0.3) return "BEM";
  if (slashScore / total > 0.3) return "atomic";
  return "flat";
}

function extractSpacingScale(spacingTokens: VariableInfo[]): number[] {
  const values: number[] = [];

  for (const token of spacingTokens) {
    const val = token.value;
    if (typeof val === "number" && !isNaN(val) && val > 0) {
      values.push(val);
    }
  }

  // Return sorted unique values
  return [...new Set(values)].sort((a, b) => a - b);
}

function extractColorPalette(colorTokens: VariableInfo[]): ColorGroupInfo[] {
  const groups = new Map<string, string[]>();

  for (const token of colorTokens) {
    // Group by first segment of name (e.g., "primary/500" → "primary")
    const segments = token.name.split("/");
    const groupName = segments.length > 1 ? segments[0] : "ungrouped";

    if (!groups.has(groupName)) {
      groups.set(groupName, []);
    }

    // Convert color value to hex if possible
    const colorValue = token.value as
      | { r: number; g: number; b: number; a?: number }
      | undefined;
    if (colorValue && typeof colorValue === "object" && "r" in colorValue) {
      const hex = rgbToHex(colorValue.r, colorValue.g, colorValue.b);
      groups.get(groupName)!.push(hex);
    }
  }

  return Array.from(groups.entries()).map(([name, colors]) => ({
    name,
    colors,
  }));
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (c: number) =>
    Math.round(c * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run plugin/__tests__/design-system-scanner.test.ts`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add plugin/__tests__/design-system-scanner.test.ts plugin/utils/design-system-scanner.ts
git commit -m "feat: add design system scanner (scans variables, styles, components, conventions)"
```

---

## Task 7: Design System Context Manager (Server-Side)

**Files:**
- Create: `src/server/__tests__/design-system.test.ts`
- Create: `src/server/design-system.ts`

**Step 1: Write the failing tests**

```typescript
// src/server/__tests__/design-system.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { DesignSystemManager } from "../design-system.js";
import type { DesignSystemContext } from "../../../shared/protocol.js";

describe("DesignSystemManager", () => {
  let manager: DesignSystemManager;

  const sampleContext: DesignSystemContext = {
    variables: {
      collections: [
        {
          id: "VariableCollectionID:1:1",
          name: "Brand Colors",
          modes: [{ id: "mode-0", name: "Default" }],
          variableCount: 3,
        },
      ],
      colorTokens: [
        {
          id: "VariableID:1:1",
          name: "primary/500",
          type: "COLOR",
          value: { r: 0.2, g: 0.4, b: 0.8, a: 1 },
          collectionId: "VariableCollectionID:1:1",
        },
      ],
      spacingTokens: [
        {
          id: "VariableID:2:1",
          name: "spacing/md",
          type: "FLOAT",
          value: 16,
          collectionId: "VariableCollectionID:1:1",
        },
      ],
      typographyTokens: [],
    },
    styles: {
      textStyles: [
        {
          id: "S:text-1:1",
          name: "Heading/H1",
          type: "TEXT",
          description: "Main heading",
        },
      ],
      colorStyles: [
        {
          id: "S:paint-1:1",
          name: "Brand/Primary",
          type: "PAINT",
          description: "",
        },
      ],
      effectStyles: [],
      gridStyles: [],
    },
    components: {
      local: [
        {
          id: "100:1",
          name: "Button/Primary",
          description: "Primary action button",
        },
      ],
      external: [],
    },
    conventions: {
      namingPattern: "atomic",
      spacingScale: [4, 8, 16, 24, 32],
      colorPalette: [
        { name: "primary", colors: ["#3366CC"] },
      ],
    },
  };

  beforeEach(() => {
    manager = new DesignSystemManager();
  });

  afterEach(() => {
    manager.clear();
  });

  describe("context management", () => {
    it("starts with no context", () => {
      expect(manager.hasContext()).toBe(false);
      expect(manager.getContext()).toBeNull();
    });

    it("stores and retrieves design system context", () => {
      manager.setContext(sampleContext);

      expect(manager.hasContext()).toBe(true);
      const ctx = manager.getContext();
      expect(ctx).not.toBeNull();
      expect(ctx!.variables.collections).toHaveLength(1);
      expect(ctx!.styles.colorStyles).toHaveLength(1);
      expect(ctx!.components.local).toHaveLength(1);
    });

    it("replaces existing context on update", () => {
      manager.setContext(sampleContext);

      const updatedContext: DesignSystemContext = {
        ...sampleContext,
        components: {
          local: [
            { id: "100:1", name: "Button/Primary", description: "" },
            { id: "200:1", name: "Card/Default", description: "" },
          ],
          external: [],
        },
      };

      manager.setContext(updatedContext);
      expect(manager.getContext()!.components.local).toHaveLength(2);
    });

    it("clears context", () => {
      manager.setContext(sampleContext);
      manager.clear();

      expect(manager.hasContext()).toBe(false);
      expect(manager.getContext()).toBeNull();
    });
  });

  describe("context queries", () => {
    beforeEach(() => {
      manager.setContext(sampleContext);
    });

    it("finds a color token by name", () => {
      const token = manager.findColorToken("primary/500");

      expect(token).not.toBeNull();
      expect(token!.name).toBe("primary/500");
    });

    it("returns null for unknown color token", () => {
      const token = manager.findColorToken("nonexistent");
      expect(token).toBeNull();
    });

    it("finds a component by name", () => {
      const comp = manager.findComponent("Button/Primary");

      expect(comp).not.toBeNull();
      expect(comp!.id).toBe("100:1");
    });

    it("finds a component by partial name (case-insensitive)", () => {
      const comp = manager.findComponent("button");

      expect(comp).not.toBeNull();
      expect(comp!.name).toBe("Button/Primary");
    });

    it("returns null for unknown component", () => {
      const comp = manager.findComponent("Nonexistent");
      expect(comp).toBeNull();
    });

    it("finds closest color match", () => {
      const match = manager.findClosestColor("#3366CB");

      expect(match).not.toBeNull();
      expect(match!.tokenName).toBe("primary/500");
      expect(match!.distance).toBeLessThan(5);
    });

    it("returns null for color match when no tokens exist", () => {
      const emptyManager = new DesignSystemManager();
      const match = emptyManager.findClosestColor("#FF0000");
      expect(match).toBeNull();
    });

    it("gets spacing scale", () => {
      const scale = manager.getSpacingScale();
      expect(scale).toEqual([4, 8, 16, 24, 32]);
    });

    it("gets text styles", () => {
      const styles = manager.getTextStyles();
      expect(styles).toHaveLength(1);
      expect(styles[0].name).toBe("Heading/H1");
    });

    it("suggests closest spacing value", () => {
      const suggestion = manager.suggestSpacing(15);
      expect(suggestion).toBe(16);
    });

    it("returns the exact spacing if it matches", () => {
      const suggestion = manager.suggestSpacing(16);
      expect(suggestion).toBe(16);
    });

    it("returns null spacing suggestion when no scale exists", () => {
      const emptyManager = new DesignSystemManager();
      const suggestion = emptyManager.suggestSpacing(16);
      expect(suggestion).toBeNull();
    });
  });

  describe("cache timestamps", () => {
    it("tracks when context was last updated", () => {
      const before = Date.now();
      manager.setContext(sampleContext);
      const after = Date.now();

      const ts = manager.getLastUpdated();
      expect(ts).not.toBeNull();
      expect(ts!).toBeGreaterThanOrEqual(before);
      expect(ts!).toBeLessThanOrEqual(after);
    });

    it("returns null timestamp before any context is set", () => {
      expect(manager.getLastUpdated()).toBeNull();
    });
  });

  describe("context summary", () => {
    it("generates a human-readable summary", () => {
      manager.setContext(sampleContext);

      const summary = manager.getSummary();

      expect(summary).toContain("1 variable collection");
      expect(summary).toContain("1 color token");
      expect(summary).toContain("1 spacing token");
      expect(summary).toContain("1 color style");
      expect(summary).toContain("1 text style");
      expect(summary).toContain("1 local component");
      expect(summary).toContain("atomic");
    });

    it("returns empty summary when no context exists", () => {
      const summary = manager.getSummary();
      expect(summary).toContain("No design system context");
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/server/__tests__/design-system.test.ts`
Expected: FAIL — module `../design-system.js` not found

**Step 3: Write the implementation**

```typescript
// src/server/design-system.ts

import type {
  DesignSystemContext,
  VariableInfo,
  StyleInfo,
  ComponentInfo,
} from "../../shared/protocol.js";

// ============================================================
// Color Match Result
// ============================================================

export interface ColorMatch {
  tokenName: string;
  tokenValue: string;
  distance: number;
}

// ============================================================
// DesignSystemManager
// ============================================================

export class DesignSystemManager {
  private context: DesignSystemContext | null = null;
  private lastUpdated: number | null = null;

  // --------------------------------------------------------
  // Context Management
  // --------------------------------------------------------

  hasContext(): boolean {
    return this.context !== null;
  }

  getContext(): DesignSystemContext | null {
    return this.context;
  }

  setContext(context: DesignSystemContext): void {
    this.context = context;
    this.lastUpdated = Date.now();
  }

  clear(): void {
    this.context = null;
    this.lastUpdated = null;
  }

  getLastUpdated(): number | null {
    return this.lastUpdated;
  }

  // --------------------------------------------------------
  // Context Queries
  // --------------------------------------------------------

  findColorToken(name: string): VariableInfo | null {
    if (!this.context) return null;

    const lower = name.toLowerCase();
    return (
      this.context.variables.colorTokens.find(
        (t) => t.name.toLowerCase() === lower
      ) ?? null
    );
  }

  findComponent(name: string): ComponentInfo | null {
    if (!this.context) return null;

    const lower = name.toLowerCase();

    // Exact match first
    const exact = this.context.components.local.find(
      (c) => c.name.toLowerCase() === lower
    );
    if (exact) return exact;

    // Partial match (case-insensitive)
    return (
      this.context.components.local.find((c) =>
        c.name.toLowerCase().includes(lower)
      ) ?? null
    );
  }

  findClosestColor(hexColor: string): ColorMatch | null {
    if (!this.context || this.context.variables.colorTokens.length === 0) {
      return null;
    }

    const target = hexToRgb(hexColor);
    if (!target) return null;

    let closestToken: VariableInfo | null = null;
    let closestDistance = Infinity;
    let closestHex = "";

    for (const token of this.context.variables.colorTokens) {
      const val = token.value as
        | { r: number; g: number; b: number; a?: number }
        | undefined;
      if (!val || typeof val !== "object" || !("r" in val)) continue;

      const tokenRgb = {
        r: Math.round(val.r * 255),
        g: Math.round(val.g * 255),
        b: Math.round(val.b * 255),
      };

      const distance = colorDistance(target, tokenRgb);

      if (distance < closestDistance) {
        closestDistance = distance;
        closestToken = token;
        closestHex = rgbToHex(val.r, val.g, val.b);
      }
    }

    if (!closestToken) return null;

    return {
      tokenName: closestToken.name,
      tokenValue: closestHex,
      distance: closestDistance,
    };
  }

  getSpacingScale(): number[] {
    if (!this.context) return [];
    return this.context.conventions.spacingScale;
  }

  getTextStyles(): StyleInfo[] {
    if (!this.context) return [];
    return this.context.styles.textStyles;
  }

  suggestSpacing(value: number): number | null {
    const scale = this.getSpacingScale();
    if (scale.length === 0) return null;

    let closest = scale[0];
    let closestDiff = Math.abs(value - scale[0]);

    for (const s of scale) {
      const diff = Math.abs(value - s);
      if (diff < closestDiff) {
        closestDiff = diff;
        closest = s;
      }
    }

    return closest;
  }

  // --------------------------------------------------------
  // Summary
  // --------------------------------------------------------

  getSummary(): string {
    if (!this.context) {
      return "No design system context available. Connect to a Figma file to scan.";
    }

    const ctx = this.context;
    const parts: string[] = [];

    const collCount = ctx.variables.collections.length;
    if (collCount > 0) {
      parts.push(`${collCount} variable collection${collCount !== 1 ? "s" : ""}`);
    }

    const colorTokenCount = ctx.variables.colorTokens.length;
    if (colorTokenCount > 0) {
      parts.push(`${colorTokenCount} color token${colorTokenCount !== 1 ? "s" : ""}`);
    }

    const spacingTokenCount = ctx.variables.spacingTokens.length;
    if (spacingTokenCount > 0) {
      parts.push(`${spacingTokenCount} spacing token${spacingTokenCount !== 1 ? "s" : ""}`);
    }

    const colorStyleCount = ctx.styles.colorStyles.length;
    if (colorStyleCount > 0) {
      parts.push(`${colorStyleCount} color style${colorStyleCount !== 1 ? "s" : ""}`);
    }

    const textStyleCount = ctx.styles.textStyles.length;
    if (textStyleCount > 0) {
      parts.push(`${textStyleCount} text style${textStyleCount !== 1 ? "s" : ""}`);
    }

    const effectStyleCount = ctx.styles.effectStyles.length;
    if (effectStyleCount > 0) {
      parts.push(`${effectStyleCount} effect style${effectStyleCount !== 1 ? "s" : ""}`);
    }

    const localCompCount = ctx.components.local.length;
    if (localCompCount > 0) {
      parts.push(`${localCompCount} local component${localCompCount !== 1 ? "s" : ""}`);
    }

    const naming = ctx.conventions.namingPattern;
    if (naming !== "unknown") {
      parts.push(`${naming} naming convention`);
    }

    if (parts.length === 0) {
      return "Design system context scanned but no tokens, styles, or components found.";
    }

    return `Design system: ${parts.join(", ")}.`;
  }
}

// ============================================================
// Color Utility Functions
// ============================================================

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const match = hex.match(/^#?([0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/);
  if (!match) return null;

  const h = match[1];
  return {
    r: parseInt(h.substring(0, 2), 16),
    g: parseInt(h.substring(2, 4), 16),
    b: parseInt(h.substring(4, 6), 16),
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (c: number) =>
    Math.round(c * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

function colorDistance(
  a: { r: number; g: number; b: number },
  b: { r: number; g: number; b: number }
): number {
  // Euclidean distance in RGB space
  return Math.sqrt(
    Math.pow(a.r - b.r, 2) +
      Math.pow(a.g - b.g, 2) +
      Math.pow(a.b - b.b, 2)
  );
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/server/__tests__/design-system.test.ts`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/server/__tests__/design-system.test.ts src/server/design-system.ts
git commit -m "feat: add design system context manager with query, cache, and summary support"
```

---

## Task 8: Register Phase 5 Executors in Plugin Command Router + Design System Wiring

**Files:**
- Modify: `plugin/code.ts`

**Step 1: Add executor imports and design system scan wiring**

Add these imports at the top of the command executor section in `plugin/code.ts`:

```typescript
// Add after the existing Phase 4 imports in plugin/code.ts

// ============================================================
// Phase 5 Executor Imports
// ============================================================

import {
  exportNode,
  setExportSettings,
  setImageFill,
  getNodeCss,
} from "./executors/export.js";

import {
  createVariable,
  setVariableValue,
  createVariableCollection,
  bindVariable,
} from "./executors/variables.js";

import { scanDesignSystem } from "./utils/design-system-scanner.js";
```

**Step 2: Update the executeCommand function**

Add the Phase 5 cases to the `switch` statement in the `executeCommand` function:

```typescript
async function executeCommand(command: Command): Promise<CommandResponse> {
  sendToUI({ type: "commandExecuted", command: command.type });

  const params = command.params;

  switch (command.type) {
    // ==================== Phase 2 commands ====================
    // ... (existing Phase 2 cases)

    // ==================== Phase 3 commands ====================
    // ... (existing Phase 3 cases)

    // ==================== Phase 4: Components ====================
    // ... (existing Phase 4 cases)

    // ==================== Phase 5: Export ====================
    case "export_node":
      return await exportNode(params);
    case "set_export_settings":
      return await setExportSettings(params);
    case "set_image_fill":
      return await setImageFill(params);
    case "get_node_css":
      return await getNodeCss(params);

    // ==================== Phase 5: Variables ====================
    case "create_variable":
      return await createVariable(params);
    case "set_variable_value":
      return await setVariableValue(params);
    case "create_variable_collection":
      return await createVariableCollection(params);
    case "bind_variable":
      return await bindVariable(params);

    // ==================== Phase 5: Design System ====================
    case "scan_design_system": {
      const context = await scanDesignSystem();
      return {
        id: command.id,
        success: true,
        data: context,
      };
    }

    default:
      return {
        id: command.id,
        success: false,
        error: `Command '${command.type}' is not yet implemented. Available in a future phase.`,
      };
  }
}
```

**Step 3: Add design system scan to the WebSocket message handler**

In the `onMessage` handler of `plugin/code.ts`, add handling for the `scan_design_system` message type. This is triggered by the server after handshake:

```typescript
// In the WebSocket onMessage handler, add this case:

// Handle scan_design_system request from server
if (parsed.type === "scan_design_system") {
  try {
    const context = await scanDesignSystem();
    ws.send(
      JSON.stringify({
        type: "design_system_result",
        payload: context,
      })
    );
    sendToUI({
      type: "statusUpdate",
      message: "Design system scanned successfully",
    });
  } catch (err) {
    sendToUI({
      type: "statusUpdate",
      message: `Design system scan failed: ${err instanceof Error ? err.message : String(err)}`,
    });
  }
  return;
}
```

**Step 4: Add design system change listener**

Add a listener that fires a push event when styles or variables change:

```typescript
// In the plugin initialization section of plugin/code.ts

// Listen for style changes and push design_system_updated event
figma.on("stylechange" as unknown as "run", () => {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(
      JSON.stringify({
        type: "event",
        payload: {
          event: "design_system_updated",
          data: { reason: "style_changed" },
        },
      })
    );
  }
});
```

**Step 5: Build the plugin**

Run: `node scripts/build-plugin.js`
Expected: "Plugin built successfully -> plugin/code.js"

**Step 6: Run all Phase 5 executor tests**

Run: `npx vitest run plugin/__tests__/export.test.ts plugin/__tests__/variables.test.ts plugin/__tests__/design-system-scanner.test.ts`
Expected: All tests PASS

**Step 7: Commit**

```bash
git add plugin/code.ts
git commit -m "feat: register Phase 5 executors (export, variables, design system scan) in plugin command router"
```

---

## Task 9: Server-Side MCP Tool Definitions + Router Wiring

**Files:**
- Create: `src/server/tools/export.ts`
- Create: `src/server/tools/variables.ts`
- Modify: `src/server/router.ts`
- Modify: `src/server/mcp.ts`
- Create: `src/server/__tests__/tools-phase5.test.ts`

**Step 1: Create the export tool definition**

```typescript
// src/server/tools/export.ts

import { BULK_TIMEOUT } from "../../../shared/protocol.js";

export const EXPORT_TOOL_NAME = "figma_export";

export const EXPORT_TOOL_DESCRIPTION =
  `Export assets from Figma. Commands: export_node, set_export_settings, set_image_fill, get_node_css. ` +
  `Use export_node to render a node as PNG/SVG/PDF/JPG (returns base64). ` +
  `Use set_export_settings to configure export presets on a node. ` +
  `Use set_image_fill to set an image fill from base64 data. ` +
  `Use get_node_css to extract CSS properties or Tailwind classes from a node.`;

export const EXPORT_TOOL_SCHEMA = {
  type: "object" as const,
  properties: {
    command: {
      type: "string" as const,
      enum: [
        "export_node",
        "set_export_settings",
        "set_image_fill",
        "get_node_css",
      ],
      description: "The export command to execute",
    },
    params: {
      type: "object" as const,
      description:
        "Parameters for the command. " +
        "export_node: { nodeId, format: 'PNG'|'SVG'|'PDF'|'JPG', scale?: 0.5-4, constraint?: { type: 'SCALE'|'WIDTH'|'HEIGHT', value } }. " +
        "set_export_settings: { nodeId, settings: [{ format, suffix?, constraint? }] }. " +
        "set_image_fill: { nodeId, imageBase64?, imageUrl?, scaleMode?: 'FILL'|'FIT'|'CROP'|'TILE' }. " +
        "get_node_css: { nodeId, format?: 'css'|'tailwind' }.",
    },
  },
  required: ["command", "params"],
};

export const EXPORT_COMMANDS = [
  "export_node",
  "set_export_settings",
  "set_image_fill",
  "get_node_css",
];

export function getExportTimeout(command: string): number {
  switch (command) {
    case "export_node":
      return BULK_TIMEOUT; // 120s — large exports take time
    case "set_image_fill":
      return BULK_TIMEOUT; // 120s — image decoding
    default:
      return 30_000;
  }
}
```

**Step 2: Create the variables tool definition**

```typescript
// src/server/tools/variables.ts

export const VARIABLES_TOOL_NAME = "figma_variables";

export const VARIABLES_TOOL_DESCRIPTION =
  `Manage Figma variables (design tokens). Commands: create_variable, set_variable_value, create_variable_collection, bind_variable. ` +
  `Use create_variable_collection to create a collection with modes (e.g., Light/Dark). ` +
  `Use create_variable to create a color, number, string, or boolean variable in a collection. ` +
  `Use set_variable_value to set a variable's value for a specific mode. ` +
  `Use bind_variable to bind a variable to a node property (e.g., fills, cornerRadius, itemSpacing).`;

export const VARIABLES_TOOL_SCHEMA = {
  type: "object" as const,
  properties: {
    command: {
      type: "string" as const,
      enum: [
        "create_variable",
        "set_variable_value",
        "create_variable_collection",
        "bind_variable",
      ],
      description: "The variable command to execute",
    },
    params: {
      type: "object" as const,
      description:
        "Parameters for the command. " +
        "create_variable_collection: { name, modes?: string[] }. " +
        "create_variable: { name, collectionId, resolvedType: 'COLOR'|'FLOAT'|'STRING'|'BOOLEAN', value? }. " +
        "set_variable_value: { variableId, modeId, value }. " +
        "bind_variable: { nodeId, property, variableId }.",
    },
  },
  required: ["command", "params"],
};

export const VARIABLES_COMMANDS = [
  "create_variable",
  "set_variable_value",
  "create_variable_collection",
  "bind_variable",
];
```

**Step 3: Update router.ts to include Phase 5 categories**

Add the export and variable commands to the category mapping in `src/server/router.ts`:

```typescript
// In the COMMAND_CATEGORIES map in router.ts, add:

// Phase 5: Export
"export_node": "export",
"set_export_settings": "export",
"set_image_fill": "export",
"get_node_css": "export",

// Phase 5: Variables
"create_variable": "variables",
"set_variable_value": "variables",
"create_variable_collection": "variables",
"bind_variable": "variables",

// Phase 5: Design System (internal, not directly exposed as MCP command)
"scan_design_system": "reading",
```

**Step 4: Update mcp.ts to register the export and variables tools**

Add the tool registrations in `src/server/mcp.ts`:

```typescript
// In the tool registration section of mcp.ts, add:

import {
  EXPORT_TOOL_NAME,
  EXPORT_TOOL_DESCRIPTION,
  EXPORT_TOOL_SCHEMA,
  EXPORT_COMMANDS,
  getExportTimeout,
} from "./tools/export.js";

import {
  VARIABLES_TOOL_NAME,
  VARIABLES_TOOL_DESCRIPTION,
  VARIABLES_TOOL_SCHEMA,
  VARIABLES_COMMANDS,
} from "./tools/variables.js";

// Register figma_export tool
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      // ... existing tools ...
      {
        name: EXPORT_TOOL_NAME,
        description: EXPORT_TOOL_DESCRIPTION,
        inputSchema: EXPORT_TOOL_SCHEMA,
      },
      {
        name: VARIABLES_TOOL_NAME,
        description: VARIABLES_TOOL_DESCRIPTION,
        inputSchema: VARIABLES_TOOL_SCHEMA,
      },
    ],
  };
});

// In the CallToolRequestSchema handler, add:
case EXPORT_TOOL_NAME: {
  const { command, params } = args;
  if (!EXPORT_COMMANDS.includes(command)) {
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          success: false,
          error: `Unknown export command '${command}'. Valid commands: ${EXPORT_COMMANDS.join(", ")}`,
        }),
      }],
    };
  }
  const timeout = getExportTimeout(command);
  const result = await router.routeCategoryCommand("export", command, params ?? {}, timeout);
  return {
    content: [{ type: "text", text: JSON.stringify(result) }],
  };
}

case VARIABLES_TOOL_NAME: {
  const { command, params } = args;
  if (!VARIABLES_COMMANDS.includes(command)) {
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          success: false,
          error: `Unknown variable command '${command}'. Valid commands: ${VARIABLES_COMMANDS.join(", ")}`,
        }),
      }],
    };
  }
  const result = await router.routeCategoryCommand("variables", command, params ?? {});
  return {
    content: [{ type: "text", text: JSON.stringify(result) }],
  };
}
```

**Step 5: Write the server-side routing tests**

```typescript
// src/server/__tests__/tools-phase5.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { Router } from "../router.js";
import { CommandQueue } from "../command-queue.js";

describe("Phase 5 Server Tool Routing", () => {
  let router: Router;
  let queue: CommandQueue;

  beforeEach(() => {
    queue = new CommandQueue();
    router = new Router(queue);
  });

  // ============================================================
  // Export Commands — Category Routing
  // ============================================================

  describe("export commands", () => {
    const exportCommands = [
      "export_node",
      "set_export_settings",
      "set_image_fill",
      "get_node_css",
    ];

    it("all export commands are valid", () => {
      for (const cmd of exportCommands) {
        expect(router.isValidCommand(cmd)).toBe(true);
      }
    });

    it("all export commands belong to 'export' category", () => {
      for (const cmd of exportCommands) {
        expect(router.getCategory(cmd)).toBe("export");
      }
    });

    it("routes export commands through category tool", async () => {
      const spy = vi.fn();
      queue.onCommand(spy);

      for (const cmd of exportCommands) {
        const promise = router.routeCategoryCommand("export", cmd, {});
        const command = spy.mock.calls[spy.mock.calls.length - 1][0];
        queue.resolve(command.id, { nodeId: "1:1" });
        const result = await promise;
        expect(result.success).toBe(true);
      }
    });

    it("rejects export commands routed to wrong category", async () => {
      for (const cmd of exportCommands) {
        const result = await router.routeCategoryCommand("layers", cmd, {});
        expect(result.success).toBe(false);
        expect(result.error).toContain("does not belong to category");
      }
    });
  });

  // ============================================================
  // Variable Commands — Category Routing
  // ============================================================

  describe("variable commands", () => {
    const variableCommands = [
      "create_variable",
      "set_variable_value",
      "create_variable_collection",
      "bind_variable",
    ];

    it("all variable commands are valid", () => {
      for (const cmd of variableCommands) {
        expect(router.isValidCommand(cmd)).toBe(true);
      }
    });

    it("all variable commands belong to 'variables' category", () => {
      for (const cmd of variableCommands) {
        expect(router.getCategory(cmd)).toBe("variables");
      }
    });

    it("routes variable commands through category tool", async () => {
      const spy = vi.fn();
      queue.onCommand(spy);

      for (const cmd of variableCommands) {
        const promise = router.routeCategoryCommand("variables", cmd, {});
        const command = spy.mock.calls[spy.mock.calls.length - 1][0];
        queue.resolve(command.id, { variableId: "VariableID:1:1" });
        const result = await promise;
        expect(result.success).toBe(true);
      }
    });

    it("rejects variable commands routed to wrong category", async () => {
      for (const cmd of variableCommands) {
        const result = await router.routeCategoryCommand("styling", cmd, {});
        expect(result.success).toBe(false);
        expect(result.error).toContain("does not belong to category");
      }
    });
  });

  // ============================================================
  // Meta-tool Routing
  // ============================================================

  describe("meta-tool routing for Phase 5 commands", () => {
    it("routes Phase 5 commands through the meta-tool", async () => {
      const spy = vi.fn();
      queue.onCommand(spy);

      const allPhase5Commands = [
        "export_node",
        "set_export_settings",
        "set_image_fill",
        "get_node_css",
        "create_variable",
        "set_variable_value",
        "create_variable_collection",
        "bind_variable",
      ];

      for (const cmd of allPhase5Commands) {
        const promise = router.routeStructuredCommand(cmd, {});
        const command = spy.mock.calls[spy.mock.calls.length - 1][0];
        queue.resolve(command.id, { nodeId: "1:1" });
        const result = await promise;
        expect(result.success).toBe(true);
      }
    });
  });

  // ============================================================
  // Batch Support
  // ============================================================

  describe("batch operations with Phase 5 commands", () => {
    it("routes a batch with mixed export and variable commands", async () => {
      const spy = vi.fn();
      queue.onCommand(spy);

      const promise = router.routeBatch([
        { command: "create_variable_collection", params: { name: "Colors" } },
        {
          command: "create_variable",
          params: {
            name: "primary",
            collectionId: "$0",
            resolvedType: "COLOR",
          },
        },
        {
          command: "bind_variable",
          params: { nodeId: "1:1", property: "fills", variableId: "$1" },
        },
      ]);

      const batchCmd = spy.mock.calls[0][0];
      queue.resolve(batchCmd.id, {
        batchResults: [
          {
            id: "s1",
            success: true,
            data: { collectionId: "VariableCollectionID:1:1" },
          },
          {
            id: "s2",
            success: true,
            data: { variableId: "VariableID:1:1" },
          },
          { id: "s3", success: true, data: { nodeId: "1:1" } },
        ],
      });

      const result = await promise;
      expect(result.success).toBe(true);
      expect(result.operations).toHaveLength(3);
    });
  });
});
```

**Step 6: Run tests**

Run: `npx vitest run src/server/__tests__/tools-phase5.test.ts`
Expected: All tests PASS

**Step 7: Commit**

```bash
git add src/server/tools/export.ts src/server/tools/variables.ts src/server/router.ts src/server/mcp.ts src/server/__tests__/tools-phase5.test.ts
git commit -m "feat: add MCP tool definitions for export and variables, wire router categories"
```

---

## Task 10: Integration Test — Full Phase 5 Flow

**Files:**
- Create: `test/integration/phase5-flow.test.ts`

**Step 1: Write the integration test**

This test simulates the full end-to-end flow including design system scan on connect.

```typescript
// test/integration/phase5-flow.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { WebSocketManager } from "../../src/server/websocket.js";
import { FigmaMcpServer } from "../../src/server/mcp.js";
import { DesignSystemManager } from "../../src/server/design-system.js";
import WebSocket from "ws";
import {
  Command,
  CommandResponse,
  DesignSystemContext,
} from "../../shared/protocol.js";

describe("Phase 5 Integration: Export + Variables + Design System", () => {
  let wsManager: WebSocketManager;
  let mcpServer: FigmaMcpServer;
  let pluginClient: WebSocket;
  let dsManager: DesignSystemManager;

  beforeEach(async () => {
    dsManager = new DesignSystemManager();
    wsManager = new WebSocketManager();
    await wsManager.start(0); // random port
    mcpServer = new FigmaMcpServer(wsManager, dsManager);

    const port = wsManager.port;
    pluginClient = new WebSocket(`ws://localhost:${port}`);
    await new Promise<void>((resolve) => pluginClient.on("open", resolve));

    // Handshake
    pluginClient.send(
      JSON.stringify({
        type: "handshake",
        fileInfo: {
          name: "Phase 5 Test File",
          id: "file-phase5",
          pages: [{ id: "page-1", name: "Home" }],
          nodeCount: 100,
        },
      })
    );

    await new Promise<void>((resolve) => {
      pluginClient.on("message", (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === "handshake_ack") resolve();
      });
    });
  });

  afterEach(async () => {
    pluginClient.close();
    await wsManager.close();
    dsManager.clear();
  });

  function autoRespondToCommands(
    response: (cmd: Command) => CommandResponse
  ): void {
    pluginClient.on("message", (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === "command") {
        const cmd = msg.payload as Command;
        const resp = response(cmd);
        pluginClient.send(
          JSON.stringify({ type: "response", payload: resp })
        );
      }
    });
  }

  // ============================================================
  // Export Commands
  // ============================================================

  it("routes export_node through the full stack", async () => {
    autoRespondToCommands((cmd) => ({
      id: cmd.id,
      success: true,
      data: {
        nodeId: "50:1",
        format: "PNG",
        base64: "iVBORw0KGgoAAAANSUhEUg==",
        byteLength: 20,
      },
    }));

    const router = mcpServer.getRouter();
    const result = await router.routeStructuredCommand("export_node", {
      nodeId: "50:1",
      format: "PNG",
      scale: 2,
    });

    expect(result.success).toBe(true);
    expect((result.data as Record<string, unknown>).format).toBe("PNG");
    expect((result.data as Record<string, unknown>).base64).toBeDefined();
  });

  it("routes get_node_css through the full stack", async () => {
    autoRespondToCommands((cmd) => ({
      id: cmd.id,
      success: true,
      data: {
        nodeId: "50:1",
        css: "width: 200px;\nheight: 100px;\nborder-radius: 8px;",
      },
    }));

    const router = mcpServer.getRouter();
    const result = await router.routeStructuredCommand("get_node_css", {
      nodeId: "50:1",
    });

    expect(result.success).toBe(true);
    expect((result.data as Record<string, unknown>).css).toBeDefined();
  });

  it("routes set_image_fill through the full stack", async () => {
    autoRespondToCommands((cmd) => ({
      id: cmd.id,
      success: true,
      data: {
        nodeId: "50:1",
        imageHash: "image-hash-123",
        scaleMode: "FILL",
      },
    }));

    const router = mcpServer.getRouter();
    const result = await router.routeStructuredCommand("set_image_fill", {
      nodeId: "50:1",
      imageBase64: "iVBORw0KGgoAAAANSUhEUg==",
    });

    expect(result.success).toBe(true);
    expect((result.data as Record<string, unknown>).imageHash).toBeDefined();
  });

  // ============================================================
  // Variable Commands
  // ============================================================

  it("routes create_variable_collection through the full stack", async () => {
    autoRespondToCommands((cmd) => ({
      id: cmd.id,
      success: true,
      data: {
        collectionId: "VariableCollectionID:1:1",
        name: "Theme",
        modes: [
          { modeId: "mode-0", name: "Light" },
          { modeId: "mode-1", name: "Dark" },
        ],
      },
    }));

    const router = mcpServer.getRouter();
    const result = await router.routeStructuredCommand(
      "create_variable_collection",
      { name: "Theme", modes: ["Light", "Dark"] }
    );

    expect(result.success).toBe(true);
    expect(
      (result.data as Record<string, unknown>).collectionId
    ).toBeDefined();
  });

  it("routes create_variable through the full stack", async () => {
    autoRespondToCommands((cmd) => ({
      id: cmd.id,
      success: true,
      data: {
        variableId: "VariableID:1:1",
        name: "primary/500",
        resolvedType: "COLOR",
      },
    }));

    const router = mcpServer.getRouter();
    const result = await router.routeStructuredCommand("create_variable", {
      name: "primary/500",
      collectionId: "VariableCollectionID:1:1",
      resolvedType: "COLOR",
      value: { r: 0.2, g: 0.4, b: 0.8, a: 1 },
    });

    expect(result.success).toBe(true);
    expect(
      (result.data as Record<string, unknown>).variableId
    ).toBeDefined();
  });

  it("routes bind_variable through the full stack", async () => {
    autoRespondToCommands((cmd) => ({
      id: cmd.id,
      success: true,
      data: {
        nodeId: "50:1",
        property: "fills",
        variableId: "VariableID:1:1",
        variableName: "primary/500",
      },
    }));

    const router = mcpServer.getRouter();
    const result = await router.routeStructuredCommand("bind_variable", {
      nodeId: "50:1",
      property: "fills",
      variableId: "VariableID:1:1",
    });

    expect(result.success).toBe(true);
  });

  // ============================================================
  // Design System Context
  // ============================================================

  it("receives and stores design system context from plugin", async () => {
    const sampleContext: DesignSystemContext = {
      variables: {
        collections: [
          {
            id: "VariableCollectionID:1:1",
            name: "Brand",
            modes: [{ id: "mode-0", name: "Default" }],
            variableCount: 2,
          },
        ],
        colorTokens: [
          {
            id: "VariableID:1:1",
            name: "primary/500",
            type: "COLOR",
            value: { r: 0.2, g: 0.4, b: 0.8 },
            collectionId: "VariableCollectionID:1:1",
          },
        ],
        spacingTokens: [],
        typographyTokens: [],
      },
      styles: {
        textStyles: [],
        colorStyles: [],
        effectStyles: [],
        gridStyles: [],
      },
      components: { local: [], external: [] },
      conventions: {
        namingPattern: "unknown",
        spacingScale: [],
        colorPalette: [],
      },
    };

    // Simulate plugin sending design system result
    pluginClient.send(
      JSON.stringify({
        type: "design_system_result",
        payload: sampleContext,
      })
    );

    // Wait for the server to process the message
    await new Promise<void>((resolve) => setTimeout(resolve, 100));

    expect(dsManager.hasContext()).toBe(true);
    const ctx = dsManager.getContext();
    expect(ctx!.variables.collections).toHaveLength(1);
    expect(ctx!.variables.colorTokens).toHaveLength(1);
  });

  it("handles plugin errors for Phase 5 commands", async () => {
    autoRespondToCommands((cmd) => ({
      id: cmd.id,
      success: false,
      error: "Node 999:999 not found",
    }));

    const router = mcpServer.getRouter();
    const result = await router.routeStructuredCommand("export_node", {
      nodeId: "999:999",
      format: "PNG",
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("not found");
  });

  // ============================================================
  // Compound Operations
  // ============================================================

  it("routes a compound batch: create collection + variable + bind", async () => {
    let callCount = 0;
    autoRespondToCommands((cmd) => {
      if (cmd.type === "batch" && cmd.batch) {
        const batchResults = cmd.batch.map((sub) => ({
          id: sub.id,
          success: true,
          data: { nodeId: `batch-${++callCount}:1` },
        }));
        return {
          id: cmd.id,
          success: true,
          data: { batchResults },
        };
      }
      return { id: cmd.id, success: true, data: {} };
    });

    const router = mcpServer.getRouter();
    const result = await router.routeBatch([
      {
        command: "create_variable_collection",
        params: { name: "Colors" },
      },
      {
        command: "create_variable",
        params: {
          name: "primary",
          collectionId: "$0",
          resolvedType: "COLOR",
        },
      },
      {
        command: "bind_variable",
        params: {
          nodeId: "1:1",
          property: "fills",
          variableId: "$1",
        },
      },
    ]);

    expect(result.success).toBe(true);
    expect(result.operations).toHaveLength(3);
  });

  it("correctly categorizes all 8 Phase 5 commands", () => {
    const router = mcpServer.getRouter();

    // Export (4)
    expect(router.getCategory("export_node")).toBe("export");
    expect(router.getCategory("set_export_settings")).toBe("export");
    expect(router.getCategory("set_image_fill")).toBe("export");
    expect(router.getCategory("get_node_css")).toBe("export");

    // Variables (4)
    expect(router.getCategory("create_variable")).toBe("variables");
    expect(router.getCategory("set_variable_value")).toBe("variables");
    expect(router.getCategory("create_variable_collection")).toBe("variables");
    expect(router.getCategory("bind_variable")).toBe("variables");
  });
});
```

**Step 2: Run integration test**

Run: `npx vitest run test/integration/phase5-flow.test.ts`
Expected: All tests PASS

**Step 3: Commit**

```bash
git add test/integration/phase5-flow.test.ts
git commit -m "test: add Phase 5 integration test (full stack routing for export, variables, design system)"
```

---

## Task 11: Run All Tests — Phase 5 Verification

**Step 1: Run all tests**

Run: `npx vitest run`
Expected: All tests PASS (Phase 1 + Phase 2 + Phase 3 + Phase 4 + Phase 5 tests)

Specifically verify these test files pass:
- `plugin/__tests__/export.test.ts` — 26 tests
- `plugin/__tests__/variables.test.ts` — 22 tests
- `plugin/__tests__/design-system-scanner.test.ts` — 10 tests
- `src/server/__tests__/design-system.test.ts` — 17 tests
- `src/server/__tests__/tools-phase5.test.ts` — 14 tests
- `test/integration/phase5-flow.test.ts` — 10 tests

Total new tests in Phase 5: **~99 tests**

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --project tsconfig.json`
Expected: No errors

**Step 3: Build plugin**

Run: `node scripts/build-plugin.js`
Expected: "Plugin built successfully -> plugin/code.js"

**Step 4: Commit**

```bash
git add -A
git commit -m "chore: Phase 5 complete — 8 tools (export, variables) + design system context with ~99 tests"
```

---

## Summary

### Files Created (10)
| File | Purpose |
|------|---------|
| `test/mocks/figma-api-phase5.ts` | Mock Figma API for export, variable, and design system testing |
| `plugin/executors/export.ts` | 4 export executors |
| `plugin/executors/variables.ts` | 4 variable executors |
| `plugin/utils/design-system-scanner.ts` | Plugin-side design system scanner |
| `src/server/design-system.ts` | Server-side design system context manager |
| `src/server/tools/export.ts` | MCP tool definition for figma_export |
| `src/server/tools/variables.ts` | MCP tool definition for figma_variables |
| `plugin/__tests__/export.test.ts` | Export executor tests |
| `plugin/__tests__/variables.test.ts` | Variable executor tests |
| `plugin/__tests__/design-system-scanner.test.ts` | Design system scanner tests |

### Files Created (Tests — Server/Integration) (3)
| File | Purpose |
|------|---------|
| `src/server/__tests__/design-system.test.ts` | Design system manager tests |
| `src/server/__tests__/tools-phase5.test.ts` | Server-side routing tests |
| `test/integration/phase5-flow.test.ts` | Full stack integration test |

### Files Modified (3)
| File | Change |
|------|--------|
| `plugin/code.ts` | Import Phase 5 executors, add 9 cases to command router, add design system scan wiring |
| `src/server/router.ts` | Add export and variables to category mapping |
| `src/server/mcp.ts` | Register figma_export and figma_variables tools |

### Tool Inventory (8 tools + context)

| # | Tool | Category | Executor |
|---|------|----------|----------|
| 1 | `export_node` | Export | `plugin/executors/export.ts` |
| 2 | `set_export_settings` | Export | `plugin/executors/export.ts` |
| 3 | `set_image_fill` | Export | `plugin/executors/export.ts` |
| 4 | `get_node_css` | Export | `plugin/executors/export.ts` |
| 5 | `create_variable` | Variables | `plugin/executors/variables.ts` |
| 6 | `set_variable_value` | Variables | `plugin/executors/variables.ts` |
| 7 | `create_variable_collection` | Variables | `plugin/executors/variables.ts` |
| 8 | `bind_variable` | Variables | `plugin/executors/variables.ts` |

### Design System Context
| Component | File | Purpose |
|-----------|------|---------|
| Scanner | `plugin/utils/design-system-scanner.ts` | Scans variables, styles, components, conventions |
| Manager | `src/server/design-system.ts` | Cache, queries, closest-color, spacing suggestions, summary |
| Protocol | `shared/protocol.ts` (existing) | `DesignSystemContext` type + `design_system_result` message |

### Timeouts
| Operation | Timeout | Reason |
|-----------|---------|--------|
| `export_node` | 120s | Large nodes, high-res exports |
| `set_image_fill` | 120s | Image decoding from base64 |
| `set_export_settings` | 30s | Metadata-only, fast |
| `get_node_css` | 30s | Property extraction, fast |
| `create_variable*` | 30s | Default |
| `set_variable_value` | 30s | Default |
| `bind_variable` | 30s | Default |
| `scan_design_system` | 60s | Full file scan |

### Cumulative Progress After Phase 5
| Phase | Tools | Running Total |
|-------|-------|---------------|
| Phase 1 | 0 (architecture) | 0 |
| Phase 2 | 18 | 18 |
| Phase 3 | 13 | 31 |
| Phase 4 | 13 | 44 |
| **Phase 5** | **8 + context** | **52** |
| Phase 6 | 18 | 68 (+ 2 bonus) |
