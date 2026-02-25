# Phase 4: Components + Structure (13 Tools)

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement component tools (6), page tools (4), and vector tools (3). At the end, Claude can work with component libraries and multi-page files.

**Architecture:** Server-side tool definitions already registered. This phase adds plugin-side executors.

**Tech Stack:** TypeScript, @figma/plugin-typings, vitest

---

## Task 1: Figma API Mock for Components, Pages, and Vectors

**Files:**
- Create: `test/mocks/figma-api-phase4.ts`

**Step 1: Create the mock**

This mock extends any existing Figma API mock with component, page, section, and vector operation support needed for Phase 4 tests.

```typescript
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
    children: [] as MockSceneNode[],
    description: "",
    key: `component-key-${base.id}`,
    createInstance: vi.fn(),
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
  };

  // Helper: register nodes added to pages
  const origAppendChild = page1.appendChild.bind(page1);
  page1.appendChild = (child: MockSceneNode) => {
    origAppendChild(child);
    registerNode(child as unknown as MockBaseNode);
  };

  return mockFigma;
}
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --project tsconfig.json`
Expected: No errors

**Step 3: Commit**

```bash
git add test/mocks/figma-api-phase4.ts
git commit -m "test: add Figma API mock for Phase 4 (components, pages, vectors)"
```

---

## Task 2: Component Executors — Tests

**Files:**
- Create: `plugin/__tests__/components.test.ts`

**Step 1: Write the failing tests**

```typescript
// plugin/__tests__/components.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createMockFigma,
  createMockFrame,
  createMockGroup,
  createMockComponent,
  createMockInstance,
  createMockText,
  createMockRectangle,
  createMockPage,
  resetIdCounter,
  type MockFigmaGlobal,
  type MockComponentNode,
  type MockInstanceNode,
  type MockFrameNode,
  type MockSceneNode,
} from "../../test/mocks/figma-api-phase4.js";
import {
  createComponent,
  createComponentSet,
  createInstance,
  swapInstance,
  setInstanceOverride,
  detachInstance,
} from "../executors/components.js";

describe("Component Executors", () => {
  let mockFigma: MockFigmaGlobal;

  beforeEach(() => {
    resetIdCounter();
    mockFigma = createMockFigma();
    (globalThis as unknown as { figma: MockFigmaGlobal }).figma = mockFigma;
  });

  // ============================================================
  // create_component
  // ============================================================

  describe("create_component", () => {
    it("converts a frame to a component", async () => {
      const frame = createMockFrame("Card");
      const child = createMockText("Title", "Hello");
      frame.appendChild(child);
      mockFigma.currentPage.appendChild(frame as unknown as MockSceneNode);

      const result = await createComponent({ nodeId: frame.id });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect((result.data as Record<string, unknown>).nodeId).toBeDefined();
      expect((result.data as Record<string, unknown>).type).toBe("COMPONENT");
    });

    it("converts a group to a component", async () => {
      const group = createMockGroup("Icon Group");
      const rect = createMockRectangle("BG");
      group.appendChild(rect);
      mockFigma.currentPage.appendChild(group as unknown as MockSceneNode);

      const result = await createComponent({ nodeId: group.id });

      expect(result.success).toBe(true);
      expect((result.data as Record<string, unknown>).type).toBe("COMPONENT");
    });

    it("fails if node does not exist", async () => {
      const result = await createComponent({ nodeId: "999:999" });

      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });

    it("fails if nodeId is missing", async () => {
      const result = await createComponent({});

      expect(result.success).toBe(false);
      expect(result.error).toContain("nodeId");
    });

    it("fails if node is not a frame or group", async () => {
      const text = createMockText("Label", "Hi");
      mockFigma.currentPage.appendChild(text as unknown as MockSceneNode);

      const result = await createComponent({ nodeId: text.id });

      expect(result.success).toBe(false);
      expect(result.error).toContain("must be a FRAME or GROUP");
    });

    it("fails if node is already a component", async () => {
      const comp = createMockComponent("Already Component");
      mockFigma.currentPage.appendChild(comp as unknown as MockSceneNode);

      const result = await createComponent({ nodeId: comp.id });

      expect(result.success).toBe(false);
      expect(result.error).toContain("already a COMPONENT");
    });
  });

  // ============================================================
  // create_component_set
  // ============================================================

  describe("create_component_set", () => {
    it("creates a component set from multiple components", async () => {
      const comp1 = createMockComponent("Button/Primary");
      const comp2 = createMockComponent("Button/Secondary");
      mockFigma.currentPage.appendChild(comp1 as unknown as MockSceneNode);
      mockFigma.currentPage.appendChild(comp2 as unknown as MockSceneNode);

      const result = await createComponentSet({
        componentIds: [comp1.id, comp2.id],
      });

      expect(result.success).toBe(true);
      expect(mockFigma.combineAsVariants).toHaveBeenCalledOnce();
      expect((result.data as Record<string, unknown>).type).toBe(
        "COMPONENT_SET"
      );
    });

    it("creates a component set with a custom name", async () => {
      const comp1 = createMockComponent("Variant A");
      const comp2 = createMockComponent("Variant B");
      mockFigma.currentPage.appendChild(comp1 as unknown as MockSceneNode);
      mockFigma.currentPage.appendChild(comp2 as unknown as MockSceneNode);

      const result = await createComponentSet({
        componentIds: [comp1.id, comp2.id],
        name: "My Variants",
      });

      expect(result.success).toBe(true);
      expect((result.data as Record<string, unknown>).name).toBe(
        "My Variants"
      );
    });

    it("fails if componentIds is missing or empty", async () => {
      const result1 = await createComponentSet({});
      expect(result1.success).toBe(false);
      expect(result1.error).toContain("componentIds");

      const result2 = await createComponentSet({ componentIds: [] });
      expect(result2.success).toBe(false);
      expect(result2.error).toContain("at least 2");
    });

    it("fails if fewer than 2 component IDs provided", async () => {
      const comp = createMockComponent("Solo");
      mockFigma.currentPage.appendChild(comp as unknown as MockSceneNode);

      const result = await createComponentSet({
        componentIds: [comp.id],
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("at least 2");
    });

    it("fails if a referenced node is not a component", async () => {
      const comp = createMockComponent("Real Component");
      const frame = createMockFrame("Not A Component");
      mockFigma.currentPage.appendChild(comp as unknown as MockSceneNode);
      mockFigma.currentPage.appendChild(frame as unknown as MockSceneNode);

      const result = await createComponentSet({
        componentIds: [comp.id, frame.id],
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("not a COMPONENT");
    });

    it("fails if a component is not found", async () => {
      const comp = createMockComponent("Exists");
      mockFigma.currentPage.appendChild(comp as unknown as MockSceneNode);

      const result = await createComponentSet({
        componentIds: [comp.id, "999:999"],
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });
  });

  // ============================================================
  // create_instance
  // ============================================================

  describe("create_instance", () => {
    it("creates an instance from a component", async () => {
      const comp = createMockComponent("Button");
      mockFigma.currentPage.appendChild(comp as unknown as MockSceneNode);

      const result = await createInstance({ componentId: comp.id });

      expect(result.success).toBe(true);
      expect(comp.createInstance).toHaveBeenCalledOnce();
      expect((result.data as Record<string, unknown>).type).toBe("INSTANCE");
    });

    it("positions the instance at specified coordinates", async () => {
      const comp = createMockComponent("Card");
      mockFigma.currentPage.appendChild(comp as unknown as MockSceneNode);

      const result = await createInstance({
        componentId: comp.id,
        x: 200,
        y: 300,
      });

      expect(result.success).toBe(true);
      const data = result.data as Record<string, unknown>;
      expect(data.x).toBe(200);
      expect(data.y).toBe(300);
    });

    it("reparents instance to specified parent", async () => {
      const comp = createMockComponent("Icon");
      const parent = createMockFrame("Container");
      mockFigma.currentPage.appendChild(comp as unknown as MockSceneNode);
      mockFigma.currentPage.appendChild(parent as unknown as MockSceneNode);

      const result = await createInstance({
        componentId: comp.id,
        parentId: parent.id,
      });

      expect(result.success).toBe(true);
    });

    it("fails if componentId is missing", async () => {
      const result = await createInstance({});

      expect(result.success).toBe(false);
      expect(result.error).toContain("componentId");
    });

    it("fails if component is not found", async () => {
      const result = await createInstance({ componentId: "999:999" });

      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });

    it("fails if referenced node is not a component", async () => {
      const frame = createMockFrame("Not a component");
      mockFigma.currentPage.appendChild(frame as unknown as MockSceneNode);

      const result = await createInstance({ componentId: frame.id });

      expect(result.success).toBe(false);
      expect(result.error).toContain("not a COMPONENT");
    });
  });

  // ============================================================
  // swap_instance
  // ============================================================

  describe("swap_instance", () => {
    it("swaps an instance to a different component", async () => {
      const comp1 = createMockComponent("Button/Primary");
      const comp2 = createMockComponent("Button/Secondary");
      const instance = createMockInstance("Button Instance", comp1);
      mockFigma.currentPage.appendChild(comp1 as unknown as MockSceneNode);
      mockFigma.currentPage.appendChild(comp2 as unknown as MockSceneNode);
      mockFigma.currentPage.appendChild(instance as unknown as MockSceneNode);

      const result = await swapInstance({
        instanceId: instance.id,
        newComponentId: comp2.id,
      });

      expect(result.success).toBe(true);
      expect(instance.swapComponent).toHaveBeenCalledWith(comp2);
    });

    it("fails if instanceId is missing", async () => {
      const result = await swapInstance({ newComponentId: "1:1" });

      expect(result.success).toBe(false);
      expect(result.error).toContain("instanceId");
    });

    it("fails if newComponentId is missing", async () => {
      const result = await swapInstance({ instanceId: "1:1" });

      expect(result.success).toBe(false);
      expect(result.error).toContain("newComponentId");
    });

    it("fails if instance is not found", async () => {
      const comp = createMockComponent("Comp");
      mockFigma.currentPage.appendChild(comp as unknown as MockSceneNode);

      const result = await swapInstance({
        instanceId: "999:999",
        newComponentId: comp.id,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });

    it("fails if node is not an instance", async () => {
      const frame = createMockFrame("Not Instance");
      const comp = createMockComponent("Comp");
      mockFigma.currentPage.appendChild(frame as unknown as MockSceneNode);
      mockFigma.currentPage.appendChild(comp as unknown as MockSceneNode);

      const result = await swapInstance({
        instanceId: frame.id,
        newComponentId: comp.id,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("not an INSTANCE");
    });

    it("fails if new component is not found", async () => {
      const comp = createMockComponent("Original");
      const instance = createMockInstance("Instance", comp);
      mockFigma.currentPage.appendChild(comp as unknown as MockSceneNode);
      mockFigma.currentPage.appendChild(instance as unknown as MockSceneNode);

      const result = await swapInstance({
        instanceId: instance.id,
        newComponentId: "999:999",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });

    it("fails if new component node is not a component", async () => {
      const comp = createMockComponent("Original");
      const instance = createMockInstance("Instance", comp);
      const frame = createMockFrame("Frame");
      mockFigma.currentPage.appendChild(comp as unknown as MockSceneNode);
      mockFigma.currentPage.appendChild(instance as unknown as MockSceneNode);
      mockFigma.currentPage.appendChild(frame as unknown as MockSceneNode);

      const result = await swapInstance({
        instanceId: instance.id,
        newComponentId: frame.id,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("not a COMPONENT");
    });
  });

  // ============================================================
  // set_instance_override
  // ============================================================

  describe("set_instance_override", () => {
    it("overrides text in an instance child", async () => {
      const comp = createMockComponent("Card");
      const textChild = createMockText("Title", "Default Title");
      comp.appendChild(textChild as unknown as MockSceneNode);
      const instance = createMockInstance("Card Instance", comp);
      const instanceTextChild = createMockText("Title", "Default Title");
      instance.appendChild(instanceTextChild as unknown as MockSceneNode);
      mockFigma.currentPage.appendChild(comp as unknown as MockSceneNode);
      mockFigma.currentPage.appendChild(instance as unknown as MockSceneNode);

      const result = await setInstanceOverride({
        instanceId: instance.id,
        overrides: [
          {
            property: "text",
            nodeId: instanceTextChild.id,
            value: "New Title",
          },
        ],
      });

      expect(result.success).toBe(true);
    });

    it("overrides visibility of an instance child", async () => {
      const comp = createMockComponent("Card");
      const rect = createMockRectangle("Badge");
      comp.appendChild(rect as unknown as MockSceneNode);
      const instance = createMockInstance("Card Instance", comp);
      const instanceRect = createMockRectangle("Badge");
      instance.appendChild(instanceRect as unknown as MockSceneNode);
      mockFigma.currentPage.appendChild(comp as unknown as MockSceneNode);
      mockFigma.currentPage.appendChild(instance as unknown as MockSceneNode);

      const result = await setInstanceOverride({
        instanceId: instance.id,
        overrides: [
          { property: "visible", nodeId: instanceRect.id, value: false },
        ],
      });

      expect(result.success).toBe(true);
    });

    it("overrides opacity of an instance child", async () => {
      const comp = createMockComponent("Card");
      const rect = createMockRectangle("Overlay");
      comp.appendChild(rect as unknown as MockSceneNode);
      const instance = createMockInstance("Card Instance", comp);
      const instanceRect = createMockRectangle("Overlay");
      instance.appendChild(instanceRect as unknown as MockSceneNode);
      mockFigma.currentPage.appendChild(comp as unknown as MockSceneNode);
      mockFigma.currentPage.appendChild(instance as unknown as MockSceneNode);

      const result = await setInstanceOverride({
        instanceId: instance.id,
        overrides: [
          { property: "opacity", nodeId: instanceRect.id, value: 0.5 },
        ],
      });

      expect(result.success).toBe(true);
    });

    it("fails if instanceId is missing", async () => {
      const result = await setInstanceOverride({
        overrides: [{ property: "text", value: "Hi" }],
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("instanceId");
    });

    it("fails if overrides array is missing or empty", async () => {
      const comp = createMockComponent("Comp");
      const instance = createMockInstance("Instance", comp);
      mockFigma.currentPage.appendChild(comp as unknown as MockSceneNode);
      mockFigma.currentPage.appendChild(instance as unknown as MockSceneNode);

      const result1 = await setInstanceOverride({
        instanceId: instance.id,
      });
      expect(result1.success).toBe(false);
      expect(result1.error).toContain("overrides");

      const result2 = await setInstanceOverride({
        instanceId: instance.id,
        overrides: [],
      });
      expect(result2.success).toBe(false);
      expect(result2.error).toContain("at least one override");
    });

    it("fails if instance is not found", async () => {
      const result = await setInstanceOverride({
        instanceId: "999:999",
        overrides: [{ property: "text", value: "Hi" }],
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });

    it("fails if node is not an instance", async () => {
      const frame = createMockFrame("Frame");
      mockFigma.currentPage.appendChild(frame as unknown as MockSceneNode);

      const result = await setInstanceOverride({
        instanceId: frame.id,
        overrides: [{ property: "text", value: "Hi" }],
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("not an INSTANCE");
    });

    it("fails for unsupported override property", async () => {
      const comp = createMockComponent("Card");
      const instance = createMockInstance("Card Instance", comp);
      mockFigma.currentPage.appendChild(comp as unknown as MockSceneNode);
      mockFigma.currentPage.appendChild(instance as unknown as MockSceneNode);

      const result = await setInstanceOverride({
        instanceId: instance.id,
        overrides: [
          { property: "unknownProp", value: "something" },
        ],
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Unsupported override property");
    });
  });

  // ============================================================
  // detach_instance
  // ============================================================

  describe("detach_instance", () => {
    it("detaches an instance and returns the resulting frame", async () => {
      const comp = createMockComponent("Button");
      const instance = createMockInstance("Button Instance", comp);
      mockFigma.currentPage.appendChild(comp as unknown as MockSceneNode);
      mockFigma.currentPage.appendChild(instance as unknown as MockSceneNode);

      const result = await detachInstance({ instanceId: instance.id });

      expect(result.success).toBe(true);
      expect(instance.detachInstance).toHaveBeenCalledOnce();
      expect((result.data as Record<string, unknown>).type).toBe("FRAME");
    });

    it("fails if instanceId is missing", async () => {
      const result = await detachInstance({});

      expect(result.success).toBe(false);
      expect(result.error).toContain("instanceId");
    });

    it("fails if instance is not found", async () => {
      const result = await detachInstance({ instanceId: "999:999" });

      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });

    it("fails if node is not an instance", async () => {
      const frame = createMockFrame("Frame");
      mockFigma.currentPage.appendChild(frame as unknown as MockSceneNode);

      const result = await detachInstance({ instanceId: frame.id });

      expect(result.success).toBe(false);
      expect(result.error).toContain("not an INSTANCE");
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run plugin/__tests__/components.test.ts`
Expected: FAIL — module `../executors/components.js` not found

**Step 3: Commit**

```bash
git add plugin/__tests__/components.test.ts
git commit -m "test: add failing tests for component executors (create, instance, swap, override, detach)"
```

---

## Task 3: Component Executors — Implementation

**Files:**
- Create: `plugin/executors/components.ts`

**Step 1: Write the implementation**

```typescript
// plugin/executors/components.ts

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

function serializeNode(
  node: SceneNode
): Record<string, unknown> {
  const base: Record<string, unknown> = {
    nodeId: node.id,
    name: node.name,
    type: node.type,
  };
  if ("x" in node) base.x = node.x;
  if ("y" in node) base.y = node.y;
  if ("width" in node) base.width = node.width;
  if ("height" in node) base.height = node.height;
  return base;
}

// ============================================================
// create_component
// ============================================================

export async function createComponent(
  params: Record<string, unknown>
): Promise<CommandResponse> {
  const nodeId = params.nodeId as string | undefined;

  if (!nodeId) {
    return errorResponse("Missing required parameter: nodeId");
  }

  const node = getNode(nodeId);
  if (!node) {
    return errorResponse(
      `Node '${nodeId}' not found. Verify the node ID is correct and the node exists on the current page.`
    );
  }

  if (node.type === "COMPONENT") {
    return errorResponse(
      `Node '${nodeId}' is already a COMPONENT. No conversion needed.`
    );
  }

  if (node.type !== "FRAME" && node.type !== "GROUP") {
    return errorResponse(
      `Node '${nodeId}' is a ${node.type}, but must be a FRAME or GROUP to convert to a component. ` +
        `Only frames and groups can be converted to components.`
    );
  }

  // Create a new component and copy properties from the source node
  const component = figma.createComponent();
  component.name = node.name;

  // Copy geometric properties
  component.x = node.x;
  component.y = node.y;
  component.resize(node.width, node.height);

  // Copy children from source to component
  const sourceWithChildren = node as FrameNode | GroupNode;
  const childrenToMove = [...sourceWithChildren.children];
  for (const child of childrenToMove) {
    component.appendChild(child);
  }

  // Copy layout properties if source is a frame
  if (node.type === "FRAME") {
    const frame = node as FrameNode;
    component.layoutMode = frame.layoutMode;
    if (frame.layoutMode !== "NONE") {
      component.itemSpacing = frame.itemSpacing;
      component.paddingTop = frame.paddingTop;
      component.paddingRight = frame.paddingRight;
      component.paddingBottom = frame.paddingBottom;
      component.paddingLeft = frame.paddingLeft;
      component.primaryAxisAlignItems = frame.primaryAxisAlignItems;
      component.counterAxisAlignItems = frame.counterAxisAlignItems;
    }
    component.fills = frame.fills as Paint[];
    component.strokes = frame.strokes as Paint[];
    component.cornerRadius = frame.cornerRadius;
    component.clipsContent = frame.clipsContent;
  }

  // Insert component at the same position in parent
  const parent = node.parent;
  if (parent && "children" in parent) {
    const index = (parent as ChildrenMixin).children.indexOf(node);
    if (index !== -1) {
      (parent as ChildrenMixin).insertChild(index, component);
    } else {
      (parent as ChildrenMixin).appendChild(component);
    }
  }

  // Remove the original node
  node.remove();

  return successResponse({
    ...serializeNode(component),
    type: "COMPONENT",
    key: component.key,
  });
}

// ============================================================
// create_component_set
// ============================================================

export async function createComponentSet(
  params: Record<string, unknown>
): Promise<CommandResponse> {
  const componentIds = params.componentIds as string[] | undefined;
  const name = params.name as string | undefined;

  if (!componentIds || !Array.isArray(componentIds)) {
    return errorResponse(
      "Missing required parameter: componentIds (array of component node IDs)"
    );
  }

  if (componentIds.length < 2) {
    return errorResponse(
      `Need at least 2 components to create a component set, but got ${componentIds.length}. ` +
        `A component set (variant group) requires multiple component variants.`
    );
  }

  // Resolve and validate all components
  const components: ComponentNode[] = [];

  for (const id of componentIds) {
    const node = figma.getNodeById(id);
    if (!node) {
      return errorResponse(
        `Component '${id}' not found. Verify the node ID is correct and the node exists.`
      );
    }
    if (node.type !== "COMPONENT") {
      return errorResponse(
        `Node '${id}' (${node.name}) is a ${node.type}, not a COMPONENT. ` +
          `All nodes in a component set must be components.`
      );
    }
    components.push(node as ComponentNode);
  }

  // All components must be on the same page — use the first component's parent
  const parent = components[0].parent;
  if (!parent) {
    return errorResponse(
      `Component '${components[0].id}' has no parent. Components must be on a page.`
    );
  }

  const componentSet = figma.combineAsVariants(
    components,
    parent as BaseNode & ChildrenMixin
  );

  if (name) {
    componentSet.name = name;
  }

  return successResponse({
    nodeId: componentSet.id,
    name: componentSet.name,
    type: "COMPONENT_SET",
    childCount: componentSet.children.length,
  });
}

// ============================================================
// create_instance
// ============================================================

export async function createInstance(
  params: Record<string, unknown>
): Promise<CommandResponse> {
  const componentId = params.componentId as string | undefined;
  const x = params.x as number | undefined;
  const y = params.y as number | undefined;
  const parentId = params.parentId as string | undefined;

  if (!componentId) {
    return errorResponse("Missing required parameter: componentId");
  }

  const node = figma.getNodeById(componentId);
  if (!node) {
    return errorResponse(
      `Component '${componentId}' not found. Verify the component ID is correct.`
    );
  }

  if (node.type !== "COMPONENT") {
    return errorResponse(
      `Node '${componentId}' (${node.name}) is a ${node.type}, not a COMPONENT. ` +
        `You can only create instances from components.`
    );
  }

  const component = node as ComponentNode;
  const instance = component.createInstance();

  // Position
  if (x !== undefined) instance.x = x;
  if (y !== undefined) instance.y = y;

  // Reparent if specified
  if (parentId) {
    const parentNode = figma.getNodeById(parentId);
    if (!parentNode) {
      return errorResponse(
        `Parent '${parentId}' not found. The instance was created but could not be moved to the specified parent.`
      );
    }
    if ("appendChild" in parentNode) {
      (parentNode as BaseNode & ChildrenMixin).appendChild(instance);
    } else {
      return errorResponse(
        `Parent '${parentId}' (${parentNode.name}) cannot contain children. ` +
          `Choose a frame, group, or page as the parent.`
      );
    }
  }

  return successResponse({
    nodeId: instance.id,
    name: instance.name,
    type: "INSTANCE",
    x: instance.x,
    y: instance.y,
    width: instance.width,
    height: instance.height,
    mainComponentId: component.id,
  });
}

// ============================================================
// swap_instance
// ============================================================

export async function swapInstance(
  params: Record<string, unknown>
): Promise<CommandResponse> {
  const instanceId = params.instanceId as string | undefined;
  const newComponentId = params.newComponentId as string | undefined;

  if (!instanceId) {
    return errorResponse("Missing required parameter: instanceId");
  }

  if (!newComponentId) {
    return errorResponse("Missing required parameter: newComponentId");
  }

  const instanceNode = figma.getNodeById(instanceId);
  if (!instanceNode) {
    return errorResponse(
      `Instance '${instanceId}' not found. Verify the instance node ID is correct.`
    );
  }

  if (instanceNode.type !== "INSTANCE") {
    return errorResponse(
      `Node '${instanceId}' (${instanceNode.name}) is a ${instanceNode.type}, not an INSTANCE. ` +
        `Only instances can be swapped to a different component.`
    );
  }

  const newComponent = figma.getNodeById(newComponentId);
  if (!newComponent) {
    return errorResponse(
      `New component '${newComponentId}' not found. Verify the component ID is correct.`
    );
  }

  if (newComponent.type !== "COMPONENT") {
    return errorResponse(
      `Node '${newComponentId}' (${newComponent.name}) is a ${newComponent.type}, not a COMPONENT. ` +
        `You can only swap an instance to a component.`
    );
  }

  const instance = instanceNode as InstanceNode;
  instance.swapComponent(newComponent as ComponentNode);

  return successResponse({
    nodeId: instance.id,
    name: instance.name,
    type: "INSTANCE",
    newComponentId: newComponent.id,
    newComponentName: newComponent.name,
  });
}

// ============================================================
// set_instance_override
// ============================================================

const SUPPORTED_OVERRIDE_PROPERTIES = ["text", "fill", "visible", "opacity"];

export async function setInstanceOverride(
  params: Record<string, unknown>
): Promise<CommandResponse> {
  const instanceId = params.instanceId as string | undefined;
  const overrides = params.overrides as
    | Array<{
        property: string;
        nodeId?: string;
        value: unknown;
      }>
    | undefined;

  if (!instanceId) {
    return errorResponse("Missing required parameter: instanceId");
  }

  if (!overrides || !Array.isArray(overrides)) {
    return errorResponse(
      "Missing required parameter: overrides (array of override objects with property, nodeId?, and value)"
    );
  }

  if (overrides.length === 0) {
    return errorResponse(
      "overrides array must contain at least one override. " +
        `Supported properties: ${SUPPORTED_OVERRIDE_PROPERTIES.join(", ")}`
    );
  }

  const instanceNode = figma.getNodeById(instanceId);
  if (!instanceNode) {
    return errorResponse(
      `Instance '${instanceId}' not found. Verify the instance node ID is correct.`
    );
  }

  if (instanceNode.type !== "INSTANCE") {
    return errorResponse(
      `Node '${instanceId}' (${instanceNode.name}) is a ${instanceNode.type}, not an INSTANCE. ` +
        `Overrides can only be applied to component instances.`
    );
  }

  const instance = instanceNode as InstanceNode;
  const applied: Array<{
    property: string;
    nodeId?: string;
    status: string;
  }> = [];

  for (const override of overrides) {
    const { property, nodeId, value } = override;

    if (!SUPPORTED_OVERRIDE_PROPERTIES.includes(property)) {
      return errorResponse(
        `Unsupported override property '${property}'. ` +
          `Supported properties: ${SUPPORTED_OVERRIDE_PROPERTIES.join(", ")}`
      );
    }

    // Find the target node (either specified by nodeId or the instance itself)
    let targetNode: SceneNode;
    if (nodeId) {
      const found = figma.getNodeById(nodeId);
      if (!found) {
        return errorResponse(
          `Override target node '${nodeId}' not found within instance '${instanceId}'.`
        );
      }
      targetNode = found as SceneNode;
    } else {
      targetNode = instance;
    }

    switch (property) {
      case "text": {
        if (targetNode.type !== "TEXT") {
          return errorResponse(
            `Cannot set text on node '${targetNode.id}' (${targetNode.name}) — it is a ${targetNode.type}, not a TEXT node.`
          );
        }
        const textNode = targetNode as TextNode;
        await figma.loadFontAsync(textNode.fontName as FontName);
        textNode.characters = String(value);
        applied.push({ property, nodeId, status: "ok" });
        break;
      }

      case "fill": {
        if (!("fills" in targetNode)) {
          return errorResponse(
            `Cannot set fill on node '${targetNode.id}' (${targetNode.name}) — it does not support fills.`
          );
        }
        const color = parseHexColor(String(value));
        if (!color) {
          return errorResponse(
            `Invalid hex color '${value}'. Use format #RRGGBB or #RRGGBBAA.`
          );
        }
        (targetNode as GeometryMixin).fills = [
          { type: "SOLID", color, opacity: 1 },
        ];
        applied.push({ property, nodeId, status: "ok" });
        break;
      }

      case "visible": {
        targetNode.visible = Boolean(value);
        applied.push({ property, nodeId, status: "ok" });
        break;
      }

      case "opacity": {
        const opacityValue = Number(value);
        if (isNaN(opacityValue) || opacityValue < 0 || opacityValue > 1) {
          return errorResponse(
            `Invalid opacity value '${value}'. Must be a number between 0 and 1.`
          );
        }
        (targetNode as SceneNode).opacity = opacityValue;
        applied.push({ property, nodeId, status: "ok" });
        break;
      }
    }
  }

  return successResponse({
    nodeId: instance.id,
    name: instance.name,
    type: "INSTANCE",
    overridesApplied: applied,
  });
}

// ============================================================
// detach_instance
// ============================================================

export async function detachInstance(
  params: Record<string, unknown>
): Promise<CommandResponse> {
  const instanceId = params.instanceId as string | undefined;

  if (!instanceId) {
    return errorResponse("Missing required parameter: instanceId");
  }

  const node = figma.getNodeById(instanceId);
  if (!node) {
    return errorResponse(
      `Instance '${instanceId}' not found. Verify the instance node ID is correct.`
    );
  }

  if (node.type !== "INSTANCE") {
    return errorResponse(
      `Node '${instanceId}' (${node.name}) is a ${node.type}, not an INSTANCE. ` +
        `Only instances can be detached.`
    );
  }

  const instance = node as InstanceNode;
  const frame = instance.detachInstance();

  return successResponse({
    nodeId: frame.id,
    name: frame.name,
    type: "FRAME",
    x: frame.x,
    y: frame.y,
    width: frame.width,
    height: frame.height,
  });
}

// ============================================================
// Color Parsing Helper
// ============================================================

function parseHexColor(
  hex: string
): { r: number; g: number; b: number } | null {
  const match = hex.match(/^#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/);
  if (!match) return null;

  const h = match[1];
  return {
    r: parseInt(h.substring(0, 2), 16) / 255,
    g: parseInt(h.substring(2, 4), 16) / 255,
    b: parseInt(h.substring(4, 6), 16) / 255,
  };
}
```

**Step 2: Run tests to verify they pass**

Run: `npx vitest run plugin/__tests__/components.test.ts`
Expected: All tests PASS

**Step 3: Commit**

```bash
git add plugin/executors/components.ts
git commit -m "feat: add component executors (create_component, create_component_set, create_instance, swap_instance, set_instance_override, detach_instance)"
```

---

## Task 4: Page Executors — Tests

**Files:**
- Create: `plugin/__tests__/pages.test.ts`

**Step 1: Write the failing tests**

```typescript
// plugin/__tests__/pages.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createMockFigma,
  createMockPage,
  createMockFrame,
  resetIdCounter,
  type MockFigmaGlobal,
  type MockSceneNode,
  type MockPageNode,
} from "../../test/mocks/figma-api-phase4.js";
import {
  createPage,
  switchPage,
  createSection,
  setPageBackground,
} from "../executors/pages.js";

describe("Page Executors", () => {
  let mockFigma: MockFigmaGlobal;

  beforeEach(() => {
    resetIdCounter();
    mockFigma = createMockFigma();
    (globalThis as unknown as { figma: MockFigmaGlobal }).figma = mockFigma;
  });

  // ============================================================
  // create_page
  // ============================================================

  describe("create_page", () => {
    it("creates a new page with the given name", async () => {
      const result = await createPage({ name: "Settings" });

      expect(result.success).toBe(true);
      expect(mockFigma.createPage).toHaveBeenCalledOnce();
      const data = result.data as Record<string, unknown>;
      expect(data.name).toBe("Settings");
      expect(data.type).toBe("PAGE");
    });

    it("fails if name is missing", async () => {
      const result = await createPage({});

      expect(result.success).toBe(false);
      expect(result.error).toContain("name");
    });

    it("fails if name is empty string", async () => {
      const result = await createPage({ name: "" });

      expect(result.success).toBe(false);
      expect(result.error).toContain("name");
    });
  });

  // ============================================================
  // switch_page
  // ============================================================

  describe("switch_page", () => {
    it("switches to a page by ID", async () => {
      const page = mockFigma.root.children[0];

      const result = await switchPage({ pageId: page.id });

      expect(result.success).toBe(true);
      expect(mockFigma.currentPage).toBe(page);
    });

    it("switches to a page by name", async () => {
      // Create a second page
      const page2 = createMockPage("Design System");
      page2.parent = mockFigma.root as unknown as null;
      mockFigma.root.children.push(page2);

      const result = await switchPage({ pageName: "Design System" });

      expect(result.success).toBe(true);
      expect(mockFigma.currentPage.name).toBe("Design System");
    });

    it("fails if neither pageId nor pageName is provided", async () => {
      const result = await switchPage({});

      expect(result.success).toBe(false);
      expect(result.error).toContain("pageId or pageName");
    });

    it("fails if page is not found by ID", async () => {
      const result = await switchPage({ pageId: "999:999" });

      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });

    it("fails if page is not found by name", async () => {
      const result = await switchPage({ pageName: "Nonexistent" });

      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });
  });

  // ============================================================
  // create_section
  // ============================================================

  describe("create_section", () => {
    it("creates a section with the given name", async () => {
      const result = await createSection({ name: "Sprint 1" });

      expect(result.success).toBe(true);
      expect(mockFigma.createSection).toHaveBeenCalledOnce();
      const data = result.data as Record<string, unknown>;
      expect(data.name).toBe("Sprint 1");
      expect(data.type).toBe("SECTION");
    });

    it("creates a section with position and size", async () => {
      const result = await createSection({
        name: "Header Section",
        x: 100,
        y: 200,
        width: 800,
        height: 600,
      });

      expect(result.success).toBe(true);
      const data = result.data as Record<string, unknown>;
      expect(data.x).toBe(100);
      expect(data.y).toBe(200);
      expect(data.width).toBe(800);
      expect(data.height).toBe(600);
    });

    it("uses default position and size when not specified", async () => {
      const result = await createSection({ name: "Default Section" });

      expect(result.success).toBe(true);
      const data = result.data as Record<string, unknown>;
      // Default position is 0,0; section has default mock size
      expect(data.nodeId).toBeDefined();
    });

    it("fails if name is missing", async () => {
      const result = await createSection({});

      expect(result.success).toBe(false);
      expect(result.error).toContain("name");
    });

    it("fails if name is empty", async () => {
      const result = await createSection({ name: "" });

      expect(result.success).toBe(false);
      expect(result.error).toContain("name");
    });
  });

  // ============================================================
  // set_page_background
  // ============================================================

  describe("set_page_background", () => {
    it("sets the background color of the current page", async () => {
      const result = await setPageBackground({ color: "#FFFFFF" });

      expect(result.success).toBe(true);
      const data = result.data as Record<string, unknown>;
      expect(data.color).toBe("#FFFFFF");
    });

    it("sets the background color of a specific page by ID", async () => {
      const page = mockFigma.root.children[0];

      const result = await setPageBackground({
        pageId: page.id,
        color: "#1E1E1E",
      });

      expect(result.success).toBe(true);
    });

    it("fails if color is missing", async () => {
      const result = await setPageBackground({});

      expect(result.success).toBe(false);
      expect(result.error).toContain("color");
    });

    it("fails if color is not a valid hex color", async () => {
      const result = await setPageBackground({ color: "red" });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid hex color");
    });

    it("fails if specified page is not found", async () => {
      const result = await setPageBackground({
        pageId: "999:999",
        color: "#FF0000",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run plugin/__tests__/pages.test.ts`
Expected: FAIL — module `../executors/pages.js` not found

**Step 3: Commit**

```bash
git add plugin/__tests__/pages.test.ts
git commit -m "test: add failing tests for page executors (create_page, switch_page, create_section, set_page_background)"
```

---

## Task 5: Page Executors — Implementation

**Files:**
- Create: `plugin/executors/pages.ts`

**Step 1: Write the implementation**

```typescript
// plugin/executors/pages.ts

interface CommandResponse {
  id?: string;
  success: boolean;
  data?: unknown;
  error?: string;
}

// ============================================================
// Helpers
// ============================================================

function errorResponse(error: string): CommandResponse {
  return { success: false, error };
}

function successResponse(data: unknown): CommandResponse {
  return { success: true, data };
}

function isValidHexColor(color: string): boolean {
  return /^#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/.test(color);
}

function parseHexColor(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace("#", "");
  return {
    r: parseInt(h.substring(0, 2), 16) / 255,
    g: parseInt(h.substring(2, 4), 16) / 255,
    b: parseInt(h.substring(4, 6), 16) / 255,
  };
}

// ============================================================
// create_page
// ============================================================

export async function createPage(
  params: Record<string, unknown>
): Promise<CommandResponse> {
  const name = params.name as string | undefined;

  if (!name || typeof name !== "string" || name.trim() === "") {
    return errorResponse(
      "Missing required parameter: name (non-empty string for the new page)"
    );
  }

  const page = figma.createPage();
  page.name = name.trim();

  return successResponse({
    nodeId: page.id,
    name: page.name,
    type: "PAGE",
  });
}

// ============================================================
// switch_page
// ============================================================

export async function switchPage(
  params: Record<string, unknown>
): Promise<CommandResponse> {
  const pageId = params.pageId as string | undefined;
  const pageName = params.pageName as string | undefined;

  if (!pageId && !pageName) {
    return errorResponse(
      "Missing required parameter: provide either pageId or pageName to switch pages"
    );
  }

  let targetPage: PageNode | undefined;

  if (pageId) {
    targetPage = figma.root.children.find(
      (page) => page.id === pageId
    ) as PageNode | undefined;

    if (!targetPage) {
      return errorResponse(
        `Page with ID '${pageId}' not found. ` +
          `Available pages: ${figma.root.children.map((p) => `"${p.name}" (${p.id})`).join(", ")}`
      );
    }
  } else if (pageName) {
    targetPage = figma.root.children.find(
      (page) => page.name === pageName
    ) as PageNode | undefined;

    if (!targetPage) {
      return errorResponse(
        `Page with name '${pageName}' not found. ` +
          `Available pages: ${figma.root.children.map((p) => `"${p.name}"`).join(", ")}`
      );
    }
  }

  figma.currentPage = targetPage!;

  return successResponse({
    nodeId: targetPage!.id,
    name: targetPage!.name,
    type: "PAGE",
  });
}

// ============================================================
// create_section
// ============================================================

export async function createSection(
  params: Record<string, unknown>
): Promise<CommandResponse> {
  const name = params.name as string | undefined;
  const x = params.x as number | undefined;
  const y = params.y as number | undefined;
  const width = params.width as number | undefined;
  const height = params.height as number | undefined;

  if (!name || typeof name !== "string" || name.trim() === "") {
    return errorResponse(
      "Missing required parameter: name (non-empty string for the section)"
    );
  }

  const section = figma.createSection();
  section.name = name.trim();

  if (x !== undefined) section.x = x;
  if (y !== undefined) section.y = y;
  if (width !== undefined && height !== undefined) {
    section.resizeWithoutConstraints(width, height);
  } else if (width !== undefined) {
    section.resizeWithoutConstraints(width, section.height);
  } else if (height !== undefined) {
    section.resizeWithoutConstraints(section.width, height);
  }

  // Add section to current page
  figma.currentPage.appendChild(section);

  return successResponse({
    nodeId: section.id,
    name: section.name,
    type: "SECTION",
    x: section.x,
    y: section.y,
    width: section.width,
    height: section.height,
  });
}

// ============================================================
// set_page_background
// ============================================================

export async function setPageBackground(
  params: Record<string, unknown>
): Promise<CommandResponse> {
  const pageId = params.pageId as string | undefined;
  const color = params.color as string | undefined;

  if (!color) {
    return errorResponse(
      "Missing required parameter: color (hex string like #FFFFFF)"
    );
  }

  if (!isValidHexColor(color)) {
    return errorResponse(
      `Invalid hex color '${color}'. Use format #RRGGBB or #RRGGBBAA (e.g., #FFFFFF, #1E1E1EFF).`
    );
  }

  let page: PageNode;

  if (pageId) {
    const found = figma.root.children.find(
      (p) => p.id === pageId
    ) as PageNode | undefined;

    if (!found) {
      return errorResponse(
        `Page with ID '${pageId}' not found. ` +
          `Available pages: ${figma.root.children.map((p) => `"${p.name}" (${p.id})`).join(", ")}`
      );
    }
    page = found;
  } else {
    page = figma.currentPage;
  }

  const rgb = parseHexColor(color);

  page.backgrounds = [
    {
      type: "SOLID",
      color: rgb,
      visible: true,
    },
  ];

  return successResponse({
    nodeId: page.id,
    name: page.name,
    type: "PAGE",
    color,
  });
}
```

**Step 2: Run tests to verify they pass**

Run: `npx vitest run plugin/__tests__/pages.test.ts`
Expected: All tests PASS

**Step 3: Commit**

```bash
git add plugin/executors/pages.ts
git commit -m "feat: add page executors (create_page, switch_page, create_section, set_page_background)"
```

---

## Task 6: Vector Executors — Tests

**Files:**
- Create: `plugin/__tests__/vectors.test.ts`

**Step 1: Write the failing tests**

```typescript
// plugin/__tests__/vectors.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createMockFigma,
  createMockFrame,
  createMockGroup,
  createMockRectangle,
  createMockEllipse,
  createMockText,
  resetIdCounter,
  type MockFigmaGlobal,
  type MockSceneNode,
} from "../../test/mocks/figma-api-phase4.js";
import {
  booleanOperation,
  flattenNode,
  setMask,
} from "../executors/vectors.js";

describe("Vector Executors", () => {
  let mockFigma: MockFigmaGlobal;

  beforeEach(() => {
    resetIdCounter();
    mockFigma = createMockFigma();
    (globalThis as unknown as { figma: MockFigmaGlobal }).figma = mockFigma;
  });

  // ============================================================
  // boolean_operation
  // ============================================================

  describe("boolean_operation", () => {
    it("performs a UNION operation on two nodes", async () => {
      const rect1 = createMockRectangle("Circle 1");
      const rect2 = createMockRectangle("Circle 2");
      mockFigma.currentPage.appendChild(rect1 as unknown as MockSceneNode);
      mockFigma.currentPage.appendChild(rect2 as unknown as MockSceneNode);

      const result = await booleanOperation({
        nodeIds: [rect1.id, rect2.id],
        operation: "UNION",
      });

      expect(result.success).toBe(true);
      expect(mockFigma.union).toHaveBeenCalledOnce();
      const data = result.data as Record<string, unknown>;
      expect(data.type).toBe("BOOLEAN_OPERATION");
      expect(data.operation).toBe("UNION");
    });

    it("performs a SUBTRACT operation", async () => {
      const rect1 = createMockRectangle("Base");
      const rect2 = createMockRectangle("Cutout");
      mockFigma.currentPage.appendChild(rect1 as unknown as MockSceneNode);
      mockFigma.currentPage.appendChild(rect2 as unknown as MockSceneNode);

      const result = await booleanOperation({
        nodeIds: [rect1.id, rect2.id],
        operation: "SUBTRACT",
      });

      expect(result.success).toBe(true);
      expect(mockFigma.subtract).toHaveBeenCalledOnce();
      expect(
        (result.data as Record<string, unknown>).operation
      ).toBe("SUBTRACT");
    });

    it("performs an INTERSECT operation", async () => {
      const rect1 = createMockRectangle("A");
      const rect2 = createMockRectangle("B");
      mockFigma.currentPage.appendChild(rect1 as unknown as MockSceneNode);
      mockFigma.currentPage.appendChild(rect2 as unknown as MockSceneNode);

      const result = await booleanOperation({
        nodeIds: [rect1.id, rect2.id],
        operation: "INTERSECT",
      });

      expect(result.success).toBe(true);
      expect(mockFigma.intersect).toHaveBeenCalledOnce();
    });

    it("performs an EXCLUDE operation", async () => {
      const rect1 = createMockRectangle("X");
      const rect2 = createMockRectangle("Y");
      mockFigma.currentPage.appendChild(rect1 as unknown as MockSceneNode);
      mockFigma.currentPage.appendChild(rect2 as unknown as MockSceneNode);

      const result = await booleanOperation({
        nodeIds: [rect1.id, rect2.id],
        operation: "EXCLUDE",
      });

      expect(result.success).toBe(true);
      expect(mockFigma.exclude).toHaveBeenCalledOnce();
    });

    it("works with more than 2 nodes", async () => {
      const rect1 = createMockRectangle("A");
      const rect2 = createMockRectangle("B");
      const rect3 = createMockRectangle("C");
      mockFigma.currentPage.appendChild(rect1 as unknown as MockSceneNode);
      mockFigma.currentPage.appendChild(rect2 as unknown as MockSceneNode);
      mockFigma.currentPage.appendChild(rect3 as unknown as MockSceneNode);

      const result = await booleanOperation({
        nodeIds: [rect1.id, rect2.id, rect3.id],
        operation: "UNION",
      });

      expect(result.success).toBe(true);
    });

    it("fails if nodeIds is missing or empty", async () => {
      const result1 = await booleanOperation({ operation: "UNION" });
      expect(result1.success).toBe(false);
      expect(result1.error).toContain("nodeIds");

      const result2 = await booleanOperation({
        nodeIds: [],
        operation: "UNION",
      });
      expect(result2.success).toBe(false);
      expect(result2.error).toContain("at least 2");
    });

    it("fails if fewer than 2 nodes provided", async () => {
      const rect = createMockRectangle("Solo");
      mockFigma.currentPage.appendChild(rect as unknown as MockSceneNode);

      const result = await booleanOperation({
        nodeIds: [rect.id],
        operation: "UNION",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("at least 2");
    });

    it("fails if operation is missing", async () => {
      const rect1 = createMockRectangle("A");
      const rect2 = createMockRectangle("B");
      mockFigma.currentPage.appendChild(rect1 as unknown as MockSceneNode);
      mockFigma.currentPage.appendChild(rect2 as unknown as MockSceneNode);

      const result = await booleanOperation({
        nodeIds: [rect1.id, rect2.id],
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("operation");
    });

    it("fails if operation is invalid", async () => {
      const rect1 = createMockRectangle("A");
      const rect2 = createMockRectangle("B");
      mockFigma.currentPage.appendChild(rect1 as unknown as MockSceneNode);
      mockFigma.currentPage.appendChild(rect2 as unknown as MockSceneNode);

      const result = await booleanOperation({
        nodeIds: [rect1.id, rect2.id],
        operation: "MERGE",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid operation");
    });

    it("fails if a node is not found", async () => {
      const rect = createMockRectangle("Real");
      mockFigma.currentPage.appendChild(rect as unknown as MockSceneNode);

      const result = await booleanOperation({
        nodeIds: [rect.id, "999:999"],
        operation: "UNION",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });
  });

  // ============================================================
  // flatten_node
  // ============================================================

  describe("flatten_node", () => {
    it("flattens a node into a vector", async () => {
      const rect = createMockRectangle("Shape");
      mockFigma.currentPage.appendChild(rect as unknown as MockSceneNode);

      const result = await flattenNode({ nodeId: rect.id });

      expect(result.success).toBe(true);
      expect(mockFigma.flatten).toHaveBeenCalledOnce();
      const data = result.data as Record<string, unknown>;
      expect(data.type).toBe("VECTOR");
    });

    it("fails if nodeId is missing", async () => {
      const result = await flattenNode({});

      expect(result.success).toBe(false);
      expect(result.error).toContain("nodeId");
    });

    it("fails if node is not found", async () => {
      const result = await flattenNode({ nodeId: "999:999" });

      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });
  });

  // ============================================================
  // set_mask
  // ============================================================

  describe("set_mask", () => {
    it("sets a node as a mask", async () => {
      const frame = createMockFrame("Container");
      const rect = createMockRectangle("Mask Shape");
      frame.appendChild(rect as unknown as MockSceneNode);
      mockFigma.currentPage.appendChild(frame as unknown as MockSceneNode);

      const result = await setMask({
        nodeId: rect.id,
        isMask: true,
      });

      expect(result.success).toBe(true);
      const data = result.data as Record<string, unknown>;
      expect(data.isMask).toBe(true);
    });

    it("removes mask from a node", async () => {
      const group = createMockGroup("Group");
      const rect = createMockRectangle("Was Mask");
      rect.isMask = true;
      group.appendChild(rect as unknown as MockSceneNode);
      mockFigma.currentPage.appendChild(group as unknown as MockSceneNode);

      const result = await setMask({
        nodeId: rect.id,
        isMask: false,
      });

      expect(result.success).toBe(true);
      const data = result.data as Record<string, unknown>;
      expect(data.isMask).toBe(false);
    });

    it("fails if nodeId is missing", async () => {
      const result = await setMask({ isMask: true });

      expect(result.success).toBe(false);
      expect(result.error).toContain("nodeId");
    });

    it("fails if isMask is missing", async () => {
      const rect = createMockRectangle("Shape");
      mockFigma.currentPage.appendChild(rect as unknown as MockSceneNode);

      const result = await setMask({ nodeId: rect.id });

      expect(result.success).toBe(false);
      expect(result.error).toContain("isMask");
    });

    it("fails if node is not found", async () => {
      const result = await setMask({
        nodeId: "999:999",
        isMask: true,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });

    it("fails if node does not support isMask", async () => {
      const text = createMockText("Label", "Hi");
      // Text nodes in the mock do not have isMask by default —
      // but in our mock they do. This test verifies the node must be
      // inside a group or frame. We test with a top-level page child.
      mockFigma.currentPage.appendChild(text as unknown as MockSceneNode);

      // Note: In real Figma, text can be a mask inside a group/frame.
      // The requirement is that the node must be inside a group or frame.
      // A top-level page node cannot be a mask.
      const result = await setMask({
        nodeId: text.id,
        isMask: true,
      });

      // This should succeed if parent is a page (Figma allows it at frame/group level)
      // But per the spec, node must be inside a group or frame
      expect(result.success).toBe(false);
      expect(result.error).toContain("inside a group or frame");
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run plugin/__tests__/vectors.test.ts`
Expected: FAIL — module `../executors/vectors.js` not found

**Step 3: Commit**

```bash
git add plugin/__tests__/vectors.test.ts
git commit -m "test: add failing tests for vector executors (boolean_operation, flatten_node, set_mask)"
```

---

## Task 7: Vector Executors — Implementation

**Files:**
- Create: `plugin/executors/vectors.ts`

**Step 1: Write the implementation**

```typescript
// plugin/executors/vectors.ts

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

const VALID_BOOLEAN_OPS = ["UNION", "SUBTRACT", "INTERSECT", "EXCLUDE"] as const;
type BooleanOp = (typeof VALID_BOOLEAN_OPS)[number];

// ============================================================
// boolean_operation
// ============================================================

export async function booleanOperation(
  params: Record<string, unknown>
): Promise<CommandResponse> {
  const nodeIds = params.nodeIds as string[] | undefined;
  const operation = params.operation as string | undefined;

  if (!nodeIds || !Array.isArray(nodeIds)) {
    return errorResponse(
      "Missing required parameter: nodeIds (array of node IDs to combine)"
    );
  }

  if (nodeIds.length < 2) {
    return errorResponse(
      `Boolean operations require at least 2 nodes, but got ${nodeIds.length}. ` +
        `Provide 2 or more node IDs to combine.`
    );
  }

  if (!operation) {
    return errorResponse(
      "Missing required parameter: operation (UNION, SUBTRACT, INTERSECT, or EXCLUDE)"
    );
  }

  if (!VALID_BOOLEAN_OPS.includes(operation as BooleanOp)) {
    return errorResponse(
      `Invalid operation '${operation}'. ` +
        `Must be one of: ${VALID_BOOLEAN_OPS.join(", ")}`
    );
  }

  // Resolve all nodes
  const nodes: SceneNode[] = [];
  for (const id of nodeIds) {
    const node = getNode(id);
    if (!node) {
      return errorResponse(
        `Node '${id}' not found. Verify the node ID is correct and the node exists on the current page.`
      );
    }
    nodes.push(node);
  }

  // All nodes should share the same parent for boolean operations
  const parent = nodes[0].parent;
  if (!parent) {
    return errorResponse(
      `Node '${nodes[0].id}' has no parent. Nodes must be on a page or inside a frame.`
    );
  }

  // Perform the boolean operation
  let result: BooleanOperationNode;

  switch (operation as BooleanOp) {
    case "UNION":
      result = figma.union(
        nodes,
        parent as BaseNode & ChildrenMixin
      );
      break;
    case "SUBTRACT":
      result = figma.subtract(
        nodes,
        parent as BaseNode & ChildrenMixin
      );
      break;
    case "INTERSECT":
      result = figma.intersect(
        nodes,
        parent as BaseNode & ChildrenMixin
      );
      break;
    case "EXCLUDE":
      result = figma.exclude(
        nodes,
        parent as BaseNode & ChildrenMixin
      );
      break;
  }

  return successResponse({
    nodeId: result.id,
    name: result.name,
    type: "BOOLEAN_OPERATION",
    operation,
    x: result.x,
    y: result.y,
    width: result.width,
    height: result.height,
  });
}

// ============================================================
// flatten_node
// ============================================================

export async function flattenNode(
  params: Record<string, unknown>
): Promise<CommandResponse> {
  const nodeId = params.nodeId as string | undefined;

  if (!nodeId) {
    return errorResponse("Missing required parameter: nodeId");
  }

  const node = getNode(nodeId);
  if (!node) {
    return errorResponse(
      `Node '${nodeId}' not found. Verify the node ID is correct and the node exists on the current page.`
    );
  }

  const vector = figma.flatten([node]);

  return successResponse({
    nodeId: vector.id,
    name: vector.name,
    type: "VECTOR",
    x: vector.x,
    y: vector.y,
    width: vector.width,
    height: vector.height,
  });
}

// ============================================================
// set_mask
// ============================================================

export async function setMask(
  params: Record<string, unknown>
): Promise<CommandResponse> {
  const nodeId = params.nodeId as string | undefined;
  const isMask = params.isMask as boolean | undefined;

  if (!nodeId) {
    return errorResponse("Missing required parameter: nodeId");
  }

  if (isMask === undefined || typeof isMask !== "boolean") {
    return errorResponse(
      "Missing required parameter: isMask (boolean — true to set as mask, false to remove mask)"
    );
  }

  const node = getNode(nodeId);
  if (!node) {
    return errorResponse(
      `Node '${nodeId}' not found. Verify the node ID is correct and the node exists on the current page.`
    );
  }

  // Verify the node is inside a group or frame (not a direct page child)
  const parent = node.parent;
  if (
    !parent ||
    (parent.type !== "FRAME" &&
      parent.type !== "GROUP" &&
      parent.type !== "COMPONENT" &&
      parent.type !== "INSTANCE" &&
      parent.type !== "SECTION" &&
      parent.type !== "BOOLEAN_OPERATION")
  ) {
    return errorResponse(
      `Node '${nodeId}' (${node.name}) must be inside a group or frame to be used as a mask. ` +
        `Currently its parent is ${parent ? `a ${parent.type}` : "none"} — ` +
        `move the node into a frame or group first.`
    );
  }

  // Check that the node supports isMask
  if (!("isMask" in node)) {
    return errorResponse(
      `Node '${nodeId}' (${node.name}) of type ${node.type} does not support the mask property.`
    );
  }

  (node as SceneNode & { isMask: boolean }).isMask = isMask;

  return successResponse({
    nodeId: node.id,
    name: node.name,
    type: node.type,
    isMask,
  });
}
```

**Step 2: Run tests to verify they pass**

Run: `npx vitest run plugin/__tests__/vectors.test.ts`
Expected: All tests PASS

**Step 3: Commit**

```bash
git add plugin/executors/vectors.ts
git commit -m "feat: add vector executors (boolean_operation, flatten_node, set_mask)"
```

---

## Task 8: Register Phase 4 Executors in Plugin Command Router

**Files:**
- Modify: `plugin/code.ts`

**Step 1: Update the executeCommand function**

Replace the `executeCommand` function in `plugin/code.ts` to import and route to the Phase 4 executors. This adds the component, page, and vector commands to the existing command router.

Add these imports at the top of the command executor section in `plugin/code.ts`:

```typescript
// Add after the existing imports/types section in plugin/code.ts

// ============================================================
// Phase 4 Executor Imports
// ============================================================

import {
  createComponent,
  createComponentSet,
  createInstance,
  swapInstance,
  setInstanceOverride,
  detachInstance,
} from "./executors/components.js";

import {
  createPage,
  switchPage,
  createSection,
  setPageBackground,
} from "./executors/pages.js";

import {
  booleanOperation,
  flattenNode,
  setMask,
} from "./executors/vectors.js";
```

Then update the `executeCommand` function to route Phase 4 commands:

```typescript
async function executeCommand(command: Command): Promise<CommandResponse> {
  sendToUI({ type: "commandExecuted", command: command.type });

  const params = command.params;

  switch (command.type) {
    // ==================== Phase 2 commands would be here ====================
    // ==================== Phase 3 commands would be here ====================

    // ==================== Phase 4: Components ====================
    case "create_component":
      return await createComponent(params);
    case "create_component_set":
      return await createComponentSet(params);
    case "create_instance":
      return await createInstance(params);
    case "swap_instance":
      return await swapInstance(params);
    case "set_instance_override":
      return await setInstanceOverride(params);
    case "detach_instance":
      return await detachInstance(params);

    // ==================== Phase 4: Pages ====================
    case "create_page":
      return await createPage(params);
    case "switch_page":
      return await switchPage(params);
    case "create_section":
      return await createSection(params);
    case "set_page_background":
      return await setPageBackground(params);

    // ==================== Phase 4: Vectors ====================
    case "boolean_operation":
      return await booleanOperation(params);
    case "flatten_node":
      return await flattenNode(params);
    case "set_mask":
      return await setMask(params);

    default:
      return {
        id: command.id,
        success: false,
        error: `Command '${command.type}' is not yet implemented. Available in a future phase.`,
      };
  }
}
```

**Step 2: Build the plugin**

Run: `node scripts/build-plugin.js`
Expected: "Plugin built successfully -> plugin/code.js"

**Step 3: Run all Phase 4 tests**

Run: `npx vitest run plugin/__tests__/components.test.ts plugin/__tests__/pages.test.ts plugin/__tests__/vectors.test.ts`
Expected: All tests PASS

**Step 4: Commit**

```bash
git add plugin/code.ts
git commit -m "feat: register Phase 4 executors (components, pages, vectors) in plugin command router"
```

---

## Task 9: Server-Side Tool Definition Tests

**Files:**
- Create: `src/server/__tests__/tools-phase4.test.ts`

**Step 1: Write the server-side validation tests**

These tests verify that the router correctly categorizes all Phase 4 commands and that the server tool definitions accept/reject parameters correctly.

```typescript
// src/server/__tests__/tools-phase4.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { Router } from "../router.js";
import { CommandQueue } from "../command-queue.js";

describe("Phase 4 Server Tool Routing", () => {
  let router: Router;
  let queue: CommandQueue;

  beforeEach(() => {
    queue = new CommandQueue();
    router = new Router(queue);
  });

  // ============================================================
  // Component Commands — Category Routing
  // ============================================================

  describe("component commands", () => {
    const componentCommands = [
      "create_component",
      "create_component_set",
      "create_instance",
      "swap_instance",
      "set_instance_override",
      "detach_instance",
    ];

    it("all component commands are valid", () => {
      for (const cmd of componentCommands) {
        expect(router.isValidCommand(cmd)).toBe(true);
      }
    });

    it("all component commands belong to 'components' category", () => {
      for (const cmd of componentCommands) {
        expect(router.getCategory(cmd)).toBe("components");
      }
    });

    it("routes component commands through category tool", async () => {
      const spy = vi.fn();
      queue.onCommand(spy);

      for (const cmd of componentCommands) {
        const promise = router.routeCategoryCommand("components", cmd, {});
        const command = spy.mock.calls[spy.mock.calls.length - 1][0];
        queue.resolve(command.id, { nodeId: "1:1" });
        const result = await promise;
        expect(result.success).toBe(true);
      }
    });

    it("rejects component commands routed to wrong category", async () => {
      for (const cmd of componentCommands) {
        const result = await router.routeCategoryCommand("layers", cmd, {});
        expect(result.success).toBe(false);
        expect(result.error).toContain("does not belong to category");
      }
    });
  });

  // ============================================================
  // Page Commands — Category Routing
  // ============================================================

  describe("page commands", () => {
    const pageCommands = [
      "create_page",
      "switch_page",
      "create_section",
      "set_page_background",
    ];

    it("all page commands are valid", () => {
      for (const cmd of pageCommands) {
        expect(router.isValidCommand(cmd)).toBe(true);
      }
    });

    it("all page commands belong to 'pages' category", () => {
      for (const cmd of pageCommands) {
        expect(router.getCategory(cmd)).toBe("pages");
      }
    });

    it("routes page commands through category tool", async () => {
      const spy = vi.fn();
      queue.onCommand(spy);

      for (const cmd of pageCommands) {
        const promise = router.routeCategoryCommand("pages", cmd, {});
        const command = spy.mock.calls[spy.mock.calls.length - 1][0];
        queue.resolve(command.id, { nodeId: "1:1" });
        const result = await promise;
        expect(result.success).toBe(true);
      }
    });

    it("rejects page commands routed to wrong category", async () => {
      for (const cmd of pageCommands) {
        const result = await router.routeCategoryCommand("styling", cmd, {});
        expect(result.success).toBe(false);
        expect(result.error).toContain("does not belong to category");
      }
    });
  });

  // ============================================================
  // Vector Commands — Category Routing
  // ============================================================

  describe("vector commands", () => {
    const vectorCommands = [
      "boolean_operation",
      "flatten_node",
      "set_mask",
    ];

    it("all vector commands are valid", () => {
      for (const cmd of vectorCommands) {
        expect(router.isValidCommand(cmd)).toBe(true);
      }
    });

    it("all vector commands belong to 'vectors' category", () => {
      for (const cmd of vectorCommands) {
        expect(router.getCategory(cmd)).toBe("vectors");
      }
    });

    it("routes vector commands through category tool", async () => {
      const spy = vi.fn();
      queue.onCommand(spy);

      for (const cmd of vectorCommands) {
        const promise = router.routeCategoryCommand("vectors", cmd, {});
        const command = spy.mock.calls[spy.mock.calls.length - 1][0];
        queue.resolve(command.id, { nodeId: "1:1" });
        const result = await promise;
        expect(result.success).toBe(true);
      }
    });

    it("rejects vector commands routed to wrong category", async () => {
      for (const cmd of vectorCommands) {
        const result = await router.routeCategoryCommand("text", cmd, {});
        expect(result.success).toBe(false);
        expect(result.error).toContain("does not belong to category");
      }
    });
  });

  // ============================================================
  // Meta-tool Routing
  // ============================================================

  describe("meta-tool routing for Phase 4 commands", () => {
    it("routes Phase 4 commands through the meta-tool", async () => {
      const spy = vi.fn();
      queue.onCommand(spy);

      const allPhase4Commands = [
        "create_component",
        "create_component_set",
        "create_instance",
        "swap_instance",
        "set_instance_override",
        "detach_instance",
        "create_page",
        "switch_page",
        "create_section",
        "set_page_background",
        "boolean_operation",
        "flatten_node",
        "set_mask",
      ];

      for (const cmd of allPhase4Commands) {
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

  describe("batch operations with Phase 4 commands", () => {
    it("routes a batch with mixed Phase 4 commands", async () => {
      const spy = vi.fn();
      queue.onCommand(spy);

      const promise = router.routeBatch([
        { command: "create_page", params: { name: "New Page" } },
        { command: "create_component", params: { nodeId: "1:1" } },
        { command: "boolean_operation", params: { nodeIds: ["1:1", "1:2"], operation: "UNION" } },
      ]);

      const batchCmd = spy.mock.calls[0][0];
      queue.resolve(batchCmd.id, {
        batchResults: [
          { id: "s1", success: true, data: { nodeId: "10:1" } },
          { id: "s2", success: true, data: { nodeId: "10:2" } },
          { id: "s3", success: true, data: { nodeId: "10:3" } },
        ],
      });

      const result = await promise;
      expect(result.success).toBe(true);
      expect(result.operations).toHaveLength(3);
    });
  });
});
```

**Step 2: Run tests**

Run: `npx vitest run src/server/__tests__/tools-phase4.test.ts`
Expected: All tests PASS

**Step 3: Commit**

```bash
git add src/server/__tests__/tools-phase4.test.ts
git commit -m "test: add server-side routing tests for Phase 4 commands (components, pages, vectors)"
```

---

## Task 10: Integration Test — Full Phase 4 Flow

**Files:**
- Create: `test/integration/phase4-flow.test.ts`

**Step 1: Write the integration test**

This test simulates the full end-to-end flow: MCP server routes commands through WebSocket to a mock plugin that echoes responses.

```typescript
// test/integration/phase4-flow.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { WebSocketManager } from "../../src/server/websocket.js";
import { FigmaMcpServer } from "../../src/server/mcp.js";
import WebSocket from "ws";
import { Command, CommandResponse } from "../../shared/protocol.js";

describe("Phase 4 Integration: Components + Pages + Vectors", () => {
  let wsManager: WebSocketManager;
  let mcpServer: FigmaMcpServer;
  let pluginClient: WebSocket;

  beforeEach(async () => {
    wsManager = new WebSocketManager();
    await wsManager.start(0); // random port
    mcpServer = new FigmaMcpServer(wsManager);

    const port = wsManager.port;
    pluginClient = new WebSocket(`ws://localhost:${port}`);
    await new Promise<void>((resolve) => pluginClient.on("open", resolve));

    // Handshake
    pluginClient.send(
      JSON.stringify({
        type: "handshake",
        fileInfo: {
          name: "Phase 4 Test File",
          id: "file-phase4",
          pages: [{ id: "page-1", name: "Home" }],
          nodeCount: 50,
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
  });

  // Helper: simulate plugin receiving a command and sending a response
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

  it("routes create_component through the full stack", async () => {
    autoRespondToCommands((cmd) => ({
      id: cmd.id,
      success: true,
      data: { nodeId: "100:1", type: "COMPONENT", name: "Card" },
    }));

    const router = mcpServer.getRouter();
    const result = await router.routeStructuredCommand("create_component", {
      nodeId: "50:1",
    });

    expect(result.success).toBe(true);
    expect((result.data as Record<string, unknown>).type).toBe("COMPONENT");
  });

  it("routes create_instance through the full stack", async () => {
    autoRespondToCommands((cmd) => ({
      id: cmd.id,
      success: true,
      data: {
        nodeId: "100:2",
        type: "INSTANCE",
        name: "Card Instance",
        x: 200,
        y: 300,
      },
    }));

    const router = mcpServer.getRouter();
    const result = await router.routeStructuredCommand("create_instance", {
      componentId: "50:1",
      x: 200,
      y: 300,
    });

    expect(result.success).toBe(true);
    expect((result.data as Record<string, unknown>).type).toBe("INSTANCE");
  });

  it("routes create_page through the full stack", async () => {
    autoRespondToCommands((cmd) => ({
      id: cmd.id,
      success: true,
      data: { nodeId: "200:1", type: "PAGE", name: "Settings" },
    }));

    const router = mcpServer.getRouter();
    const result = await router.routeStructuredCommand("create_page", {
      name: "Settings",
    });

    expect(result.success).toBe(true);
    expect((result.data as Record<string, unknown>).name).toBe("Settings");
  });

  it("routes boolean_operation through the full stack", async () => {
    autoRespondToCommands((cmd) => ({
      id: cmd.id,
      success: true,
      data: {
        nodeId: "300:1",
        type: "BOOLEAN_OPERATION",
        operation: "UNION",
      },
    }));

    const router = mcpServer.getRouter();
    const result = await router.routeStructuredCommand("boolean_operation", {
      nodeIds: ["50:1", "50:2"],
      operation: "UNION",
    });

    expect(result.success).toBe(true);
    expect((result.data as Record<string, unknown>).operation).toBe("UNION");
  });

  it("routes a compound batch with Phase 4 commands", async () => {
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
      { command: "create_page", params: { name: "New Page" } },
      { command: "create_component", params: { nodeId: "$0" } },
      {
        command: "create_instance",
        params: { componentId: "$1", x: 100, y: 100 },
      },
    ]);

    expect(result.success).toBe(true);
    expect(result.operations).toHaveLength(3);
    expect(result.nodeIds).toHaveLength(3);
  });

  it("handles plugin errors for Phase 4 commands", async () => {
    autoRespondToCommands((cmd) => ({
      id: cmd.id,
      success: false,
      error: "Node 999:999 not found",
    }));

    const router = mcpServer.getRouter();
    const result = await router.routeStructuredCommand("swap_instance", {
      instanceId: "999:999",
      newComponentId: "1:1",
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("not found");
  });

  it("correctly categorizes all 13 Phase 4 commands", () => {
    const router = mcpServer.getRouter();

    // Components (6)
    expect(router.getCategory("create_component")).toBe("components");
    expect(router.getCategory("create_component_set")).toBe("components");
    expect(router.getCategory("create_instance")).toBe("components");
    expect(router.getCategory("swap_instance")).toBe("components");
    expect(router.getCategory("set_instance_override")).toBe("components");
    expect(router.getCategory("detach_instance")).toBe("components");

    // Pages (4)
    expect(router.getCategory("create_page")).toBe("pages");
    expect(router.getCategory("switch_page")).toBe("pages");
    expect(router.getCategory("create_section")).toBe("pages");
    expect(router.getCategory("set_page_background")).toBe("pages");

    // Vectors (3)
    expect(router.getCategory("boolean_operation")).toBe("vectors");
    expect(router.getCategory("flatten_node")).toBe("vectors");
    expect(router.getCategory("set_mask")).toBe("vectors");
  });
});
```

**Step 2: Run integration test**

Run: `npx vitest run test/integration/phase4-flow.test.ts`
Expected: All tests PASS

**Step 3: Commit**

```bash
git add test/integration/phase4-flow.test.ts
git commit -m "test: add Phase 4 integration test (full stack routing for components, pages, vectors)"
```

---

## Task 11: Run All Tests — Phase 4 Verification

**Step 1: Run all tests**

Run: `npx vitest run`
Expected: All tests PASS (Phase 1 + Phase 2 + Phase 3 + Phase 4 tests)

Specifically verify these test files pass:
- `plugin/__tests__/components.test.ts` — 24 tests
- `plugin/__tests__/pages.test.ts` — 14 tests
- `plugin/__tests__/vectors.test.ts` — 15 tests
- `src/server/__tests__/tools-phase4.test.ts` — 16 tests
- `test/integration/phase4-flow.test.ts` — 7 tests

Total new tests in Phase 4: **76 tests**

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --project tsconfig.json`
Expected: No errors

**Step 3: Build plugin**

Run: `node scripts/build-plugin.js`
Expected: "Plugin built successfully -> plugin/code.js"

**Step 4: Commit**

```bash
git add -A
git commit -m "chore: Phase 4 complete — 13 tools (components, pages, vectors) with 76 tests"
```

---

## Summary

### Files Created (8)
| File | Purpose |
|------|---------|
| `test/mocks/figma-api-phase4.ts` | Mock Figma API for component, page, and vector testing |
| `plugin/executors/components.ts` | 6 component executors |
| `plugin/executors/pages.ts` | 4 page executors |
| `plugin/executors/vectors.ts` | 3 vector executors |
| `plugin/__tests__/components.test.ts` | Component executor tests |
| `plugin/__tests__/pages.test.ts` | Page executor tests |
| `plugin/__tests__/vectors.test.ts` | Vector executor tests |
| `src/server/__tests__/tools-phase4.test.ts` | Server-side routing tests |

### Files Modified (1)
| File | Change |
|------|--------|
| `plugin/code.ts` | Import Phase 4 executors and add 13 cases to command router |

### Integration Tests (1)
| File | Purpose |
|------|---------|
| `test/integration/phase4-flow.test.ts` | Full stack routing test for all 13 Phase 4 commands |

### Tool Inventory (13 tools)

| # | Tool | Category | Executor |
|---|------|----------|----------|
| 1 | `create_component` | Components | `plugin/executors/components.ts` |
| 2 | `create_component_set` | Components | `plugin/executors/components.ts` |
| 3 | `create_instance` | Components | `plugin/executors/components.ts` |
| 4 | `swap_instance` | Components | `plugin/executors/components.ts` |
| 5 | `set_instance_override` | Components | `plugin/executors/components.ts` |
| 6 | `detach_instance` | Components | `plugin/executors/components.ts` |
| 7 | `create_page` | Pages | `plugin/executors/pages.ts` |
| 8 | `switch_page` | Pages | `plugin/executors/pages.ts` |
| 9 | `create_section` | Pages | `plugin/executors/pages.ts` |
| 10 | `set_page_background` | Pages | `plugin/executors/pages.ts` |
| 11 | `boolean_operation` | Vectors | `plugin/executors/vectors.ts` |
| 12 | `flatten_node` | Vectors | `plugin/executors/vectors.ts` |
| 13 | `set_mask` | Vectors | `plugin/executors/vectors.ts` |

### Cumulative Progress After Phase 4
| Phase | Tools | Running Total |
|-------|-------|---------------|
| Phase 1 | 0 (architecture) | 0 |
| Phase 2 | 18 | 18 |
| Phase 3 | 13 | 31 |
| **Phase 4** | **13** | **44** |
| Phase 5 | 8 | 52 |
| Phase 6 | 18 | 68 (+ 2 bonus) |
