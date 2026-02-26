// test/mocks/figma-api-phase4.ts
import { vi } from "vitest";

// ============================================================
// Mock Node Types
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
  isMask: boolean;
  fills: unknown[];
  children?: MockSceneNode[];
  appendChild?: (child: MockSceneNode) => void;
  insertChild?: (index: number, child: MockSceneNode) => void;
}

export interface MockFrameNode extends MockSceneNode {
  type: "FRAME";
  children: MockSceneNode[];
  appendChild: (child: MockSceneNode) => void;
  insertChild: (index: number, child: MockSceneNode) => void;
  layoutMode: "NONE" | "HORIZONTAL" | "VERTICAL";
}

export interface MockGroupNode extends MockSceneNode {
  type: "GROUP";
  children: MockSceneNode[];
  appendChild: (child: MockSceneNode) => void;
  insertChild: (index: number, child: MockSceneNode) => void;
}

export interface MockComponentNode extends MockSceneNode {
  type: "COMPONENT";
  children: MockSceneNode[];
  appendChild: (child: MockSceneNode) => void;
  insertChild: (index: number, child: MockSceneNode) => void;
  createInstance: () => MockInstanceNode;
  description: string;
  key: string;
}

export interface MockComponentSetNode extends MockSceneNode {
  type: "COMPONENT_SET";
  children: MockComponentNode[];
  appendChild: (child: MockSceneNode) => void;
  insertChild: (index: number, child: MockSceneNode) => void;
  description: string;
}

export interface MockInstanceNode extends MockSceneNode {
  type: "INSTANCE";
  mainComponent: MockComponentNode | null;
  children: MockSceneNode[];
  appendChild: (child: MockSceneNode) => void;
  insertChild: (index: number, child: MockSceneNode) => void;
  swapComponent: (component: MockComponentNode) => void;
  detachInstance: () => MockFrameNode;
}

export interface MockTextNode extends MockSceneNode {
  type: "TEXT";
  characters: string;
  fontSize: number;
  fontName: { family: string; style: string };
}

export interface MockRectangleNode extends MockSceneNode {
  type: "RECTANGLE";
}

export interface MockEllipseNode extends MockSceneNode {
  type: "ELLIPSE";
}

export interface MockBooleanOperationNode extends MockSceneNode {
  type: "BOOLEAN_OPERATION";
  booleanOperation: "UNION" | "SUBTRACT" | "INTERSECT" | "EXCLUDE";
  children: MockSceneNode[];
  appendChild: (child: MockSceneNode) => void;
}

export interface MockVectorNode extends MockSceneNode {
  type: "VECTOR";
}

export interface MockSectionNode extends MockSceneNode {
  type: "SECTION";
  children: MockSceneNode[];
  appendChild: (child: MockSceneNode) => void;
  insertChild: (index: number, child: MockSceneNode) => void;
}

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
    isMask: false,
    fills: [],
    children: [] as MockSceneNode[],
    layoutMode: "NONE" as const,
  } as MockFrameNode;
  createChildrenMixin(node);
  return node;
}

export function createMockGroup(name = "Group"): MockGroupNode {
  const base = createBaseNode("GROUP", name);
  const node = {
    ...base,
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    visible: true,
    opacity: 1,
    isMask: false,
    fills: [],
    children: [] as MockSceneNode[],
  } as MockGroupNode;
  createChildrenMixin(node);
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
    isMask: false,
    fills: [],
    strokes: [],
    cornerRadius: 0,
    clipsContent: false,
    layoutMode: "NONE" as const,
    itemSpacing: 0,
    paddingTop: 0,
    paddingRight: 0,
    paddingBottom: 0,
    paddingLeft: 0,
    primaryAxisAlignItems: "MIN" as const,
    counterAxisAlignItems: "MIN" as const,
    children: [] as MockSceneNode[],
    description: "",
    key: `component-key-${base.id}`,
    createInstance: vi.fn(),
    resize(w: number, h: number) { this.width = w; this.height = h; },
  } as unknown as MockComponentNode;
  createChildrenMixin(node);

  // createInstance returns a mock instance
  node.createInstance = vi.fn(() => {
    return createMockInstance(name + " Instance", node);
  });

  return node;
}

export function createMockComponentSet(
  name = "ComponentSet",
  components: MockComponentNode[] = []
): MockComponentSetNode {
  const base = createBaseNode("COMPONENT_SET", name);
  const node = {
    ...base,
    x: 0,
    y: 0,
    width: 200,
    height: 200,
    visible: true,
    opacity: 1,
    isMask: false,
    fills: [],
    children: [...components] as MockComponentNode[],
    description: "",
  } as MockComponentSetNode;
  createChildrenMixin(node as unknown as MockSceneNode);
  for (const comp of components) {
    comp.parent = node as unknown as MockBaseNode;
  }
  return node;
}

export function createMockInstance(
  name = "Instance",
  mainComponent: MockComponentNode | null = null
): MockInstanceNode {
  const base = createBaseNode("INSTANCE", name);
  const node = {
    ...base,
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    visible: true,
    opacity: 1,
    isMask: false,
    fills: [],
    children: [] as MockSceneNode[],
    mainComponent,
    swapComponent: vi.fn(),
    detachInstance: vi.fn(),
  } as unknown as MockInstanceNode;
  createChildrenMixin(node);

  node.swapComponent = vi.fn((newComponent: MockComponentNode) => {
    node.mainComponent = newComponent;
  });

  node.detachInstance = vi.fn(() => {
    const frame = createMockFrame(node.name);
    frame.x = node.x;
    frame.y = node.y;
    frame.width = node.width;
    frame.height = node.height;
    frame.children = [...node.children];
    // Replace in parent
    if (node.parent && "children" in node.parent) {
      const parent = node.parent as unknown as { children: MockSceneNode[] };
      const index = parent.children.findIndex((c) => c.id === node.id);
      if (index !== -1) {
        parent.children[index] = frame as unknown as MockSceneNode;
        frame.parent = node.parent;
      }
    }
    return frame;
  });

  return node;
}

export function createMockText(
  name = "Text",
  characters = "Hello"
): MockTextNode {
  const base = createBaseNode("TEXT", name);
  return {
    ...base,
    x: 0,
    y: 0,
    width: 100,
    height: 20,
    visible: true,
    opacity: 1,
    isMask: false,
    fills: [],
    characters,
    fontSize: 16,
    fontName: { family: "Inter", style: "Regular" },
  } as MockTextNode;
}

export function createMockRectangle(name = "Rectangle"): MockRectangleNode {
  const base = createBaseNode("RECTANGLE", name);
  return {
    ...base,
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    visible: true,
    opacity: 1,
    isMask: false,
    fills: [],
  } as MockRectangleNode;
}

export function createMockEllipse(name = "Ellipse"): MockEllipseNode {
  const base = createBaseNode("ELLIPSE", name);
  return {
    ...base,
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    visible: true,
    opacity: 1,
    isMask: false,
    fills: [],
  } as MockEllipseNode;
}

export function createMockVector(name = "Vector"): MockVectorNode {
  const base = createBaseNode("VECTOR", name);
  return {
    ...base,
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    visible: true,
    opacity: 1,
    isMask: false,
    fills: [],
  } as MockVectorNode;
}

export function createMockBooleanOperation(
  operation: "UNION" | "SUBTRACT" | "INTERSECT" | "EXCLUDE",
  children: MockSceneNode[] = []
): MockBooleanOperationNode {
  const base = createBaseNode("BOOLEAN_OPERATION", `Boolean ${operation}`);
  const node = {
    ...base,
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    visible: true,
    opacity: 1,
    isMask: false,
    fills: [],
    booleanOperation: operation,
    children: [...children],
  } as MockBooleanOperationNode;
  createChildrenMixin(node as unknown as MockSceneNode);
  for (const child of children) {
    child.parent = node as unknown as MockBaseNode;
  }
  return node;
}

export function createMockSection(name = "Section"): MockSectionNode {
  const base = createBaseNode("SECTION", name);
  const node = {
    ...base,
    x: 0,
    y: 0,
    width: 500,
    height: 500,
    visible: true,
    opacity: 1,
    isMask: false,
    fills: [],
    children: [] as MockSceneNode[],
  } as MockSectionNode;
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
    backgrounds: [{ type: "SOLID", color: { r: 0.96, g: 0.96, b: 0.96 }, visible: true }],
    selection: [],
  } as MockPageNode;
}

// ============================================================
// Mock Figma Global
// ============================================================

export interface MockFigmaGlobal {
  root: MockDocumentNode;
  currentPage: MockPageNode;
  getNodeById: (id: string) => MockBaseNode | null;
  createPage: () => MockPageNode;
  createSection: () => MockSectionNode;
  createComponent: () => MockComponentNode;
  combineAsVariants: (
    components: MockComponentNode[],
    parent: MockSceneNode | MockPageNode
  ) => MockComponentSetNode;
  union: (
    nodes: MockSceneNode[],
    parent: MockSceneNode | MockPageNode
  ) => MockBooleanOperationNode;
  subtract: (
    nodes: MockSceneNode[],
    parent: MockSceneNode | MockPageNode
  ) => MockBooleanOperationNode;
  intersect: (
    nodes: MockSceneNode[],
    parent: MockSceneNode | MockPageNode
  ) => MockBooleanOperationNode;
  exclude: (
    nodes: MockSceneNode[],
    parent: MockSceneNode | MockPageNode
  ) => MockBooleanOperationNode;
  flatten: (nodes: MockSceneNode[]) => MockVectorNode;
  notify: (message: string) => void;
  loadFontAsync: (font: unknown) => Promise<void>;
}

export function createMockFigma(): MockFigmaGlobal {
  const page1 = createMockPage("Page 1");
  const allNodes = new Map<string, MockBaseNode>();

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

  // Register pages in allNodes
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

    createSection: vi.fn(() => {
      const section = createMockSection("Section");
      allNodes.set(section.id, section);
      return section;
    }),

    createComponent: vi.fn(() => {
      const component = createMockComponent("Component");
      allNodes.set(component.id, component);
      return component;
    }),

    combineAsVariants: vi.fn(
      (
        components: MockComponentNode[],
        parent: MockSceneNode | MockPageNode
      ) => {
        const set = createMockComponentSet("Component Set", components);
        set.parent = parent as unknown as MockBaseNode;
        if ("children" in parent && parent.appendChild) {
          (parent as MockPageNode).appendChild(set as unknown as MockSceneNode);
        }
        allNodes.set(set.id, set as unknown as MockBaseNode);
        return set;
      }
    ),

    union: vi.fn(
      (nodes: MockSceneNode[], parent: MockSceneNode | MockPageNode) => {
        const result = createMockBooleanOperation("UNION", nodes);
        result.parent = parent as unknown as MockBaseNode;
        allNodes.set(result.id, result as unknown as MockBaseNode);
        return result;
      }
    ),

    subtract: vi.fn(
      (nodes: MockSceneNode[], parent: MockSceneNode | MockPageNode) => {
        const result = createMockBooleanOperation("SUBTRACT", nodes);
        result.parent = parent as unknown as MockBaseNode;
        allNodes.set(result.id, result as unknown as MockBaseNode);
        return result;
      }
    ),

    intersect: vi.fn(
      (nodes: MockSceneNode[], parent: MockSceneNode | MockPageNode) => {
        const result = createMockBooleanOperation("INTERSECT", nodes);
        result.parent = parent as unknown as MockBaseNode;
        allNodes.set(result.id, result as unknown as MockBaseNode);
        return result;
      }
    ),

    exclude: vi.fn(
      (nodes: MockSceneNode[], parent: MockSceneNode | MockPageNode) => {
        const result = createMockBooleanOperation("EXCLUDE", nodes);
        result.parent = parent as unknown as MockBaseNode;
        allNodes.set(result.id, result as unknown as MockBaseNode);
        return result;
      }
    ),

    flatten: vi.fn((nodes: MockSceneNode[]) => {
      const vector = createMockVector("Flattened");
      if (nodes.length > 0) {
        vector.x = nodes[0].x;
        vector.y = nodes[0].y;
        vector.width = nodes[0].width;
        vector.height = nodes[0].height;
        vector.parent = nodes[0].parent;
      }
      allNodes.set(vector.id, vector as unknown as MockBaseNode);
      return vector;
    }),

    notify: vi.fn(),

    loadFontAsync: vi.fn().mockResolvedValue(undefined),
  };

  // Helper: register nodes added to pages
  const origAppendChild = page1.appendChild.bind(page1);
  page1.appendChild = (child: MockSceneNode) => {
    origAppendChild(child);
    registerNode(child as unknown as MockBaseNode);
  };

  return mockFigma;
}
