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
