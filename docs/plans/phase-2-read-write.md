# Phase 2: Read + Basic Write (18 Tools)

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement reading tools (5), layer tools (8), and text tools (5). At the end, Claude can read a Figma file and create/edit text and shapes.

**Architecture:** Each tool has a server-side definition (already registered via category tools in Phase 1) and a plugin-side executor.

**Tech Stack:** TypeScript, @figma/plugin-typings, vitest

---

## Task 1: Figma API Mock for Testing

**Files:**
- Create: `test/mocks/figma-api.ts`

**Step 1: Create test/mocks/figma-api.ts**

```typescript
// test/mocks/figma-api.ts
import { vi } from "vitest";

// ============================================================
// Mock Node Types
// ============================================================

interface MockNodeOptions {
  id?: string;
  name?: string;
  type?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  children?: MockNode[];
  characters?: string;
  fontName?: FontName;
  fontSize?: number;
  textAlignHorizontal?: string;
  textAlignVertical?: string;
  parent?: MockNode | null;
  fills?: Paint[];
  opacity?: number;
}

interface FontName {
  family: string;
  style: string;
}

interface Paint {
  type: string;
  color?: { r: number; g: number; b: number };
  opacity?: number;
  visible?: boolean;
}

let nextId = 1;

export class MockNode {
  id: string;
  name: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  children: MockNode[];
  characters: string;
  fontName: FontName;
  fontSize: number;
  textAlignHorizontal: string;
  textAlignVertical: string;
  parent: MockNode | null;
  fills: Paint[];
  opacity: number;
  removed: boolean;
  visible: boolean;

  constructor(options: MockNodeOptions = {}) {
    this.id = options.id ?? `${nextId++}:${nextId++}`;
    this.name = options.name ?? "Node";
    this.type = options.type ?? "FRAME";
    this.x = options.x ?? 0;
    this.y = options.y ?? 0;
    this.width = options.width ?? 100;
    this.height = options.height ?? 100;
    this.children = options.children ?? [];
    this.characters = options.characters ?? "";
    this.fontName = options.fontName ?? { family: "Inter", style: "Regular" };
    this.fontSize = options.fontSize ?? 16;
    this.textAlignHorizontal = options.textAlignHorizontal ?? "LEFT";
    this.textAlignVertical = options.textAlignVertical ?? "TOP";
    this.parent = options.parent ?? null;
    this.fills = options.fills ?? [];
    this.opacity = options.opacity ?? 1;
    this.removed = false;
    this.visible = true;

    // Set parent references for children
    for (const child of this.children) {
      child.parent = this;
    }
  }

  remove(): void {
    this.removed = true;
    if (this.parent && this.parent.children) {
      const index = this.parent.children.indexOf(this);
      if (index !== -1) {
        this.parent.children.splice(index, 1);
      }
    }
  }

  clone(): MockNode {
    const cloned = new MockNode({
      name: this.name,
      type: this.type,
      x: this.x,
      y: this.y,
      width: this.width,
      height: this.height,
      characters: this.characters,
      fontName: { ...this.fontName },
      fontSize: this.fontSize,
      textAlignHorizontal: this.textAlignHorizontal,
      textAlignVertical: this.textAlignVertical,
      fills: JSON.parse(JSON.stringify(this.fills)),
      opacity: this.opacity,
    });
    cloned.parent = this.parent;
    if (this.parent && this.parent.children) {
      this.parent.children.push(cloned);
    }
    return cloned;
  }

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
  }

  appendChild(child: MockNode): void {
    child.parent = this;
    this.children.push(child);
  }

  insertChild(index: number, child: MockNode): void {
    child.parent = this;
    this.children.splice(index, 0, child);
  }

  findAll(callback?: (node: MockNode) => boolean): MockNode[] {
    const results: MockNode[] = [];
    const search = (node: MockNode) => {
      if (!callback || callback(node)) {
        results.push(node);
      }
      if (node.children) {
        for (const child of node.children) {
          search(child);
        }
      }
    };
    for (const child of this.children) {
      search(child);
    }
    return results;
  }

  findOne(callback: (node: MockNode) => boolean): MockNode | null {
    const search = (node: MockNode): MockNode | null => {
      if (callback(node)) return node;
      if (node.children) {
        for (const child of node.children) {
          const found = search(child);
          if (found) return found;
        }
      }
      return null;
    };
    for (const child of this.children) {
      const found = search(child);
      if (found) return found;
    }
    return null;
  }

  // Text-specific methods
  setRangeFontSize(start: number, end: number, size: number): void {
    // Simplified: just set fontSize for mock purposes
    this.fontSize = size;
  }

  setRangeFontName(start: number, end: number, fontName: FontName): void {
    this.fontName = fontName;
  }

  setRangeLineHeight(
    _start: number,
    _end: number,
    _lineHeight: { value: number; unit: string }
  ): void {
    // Mock implementation
  }

  setRangeLetterSpacing(
    _start: number,
    _end: number,
    _letterSpacing: { value: number; unit: string }
  ): void {
    // Mock implementation
  }

  setRangeFills(start: number, end: number, fills: Paint[]): void {
    this.fills = fills;
  }
}

// ============================================================
// Mock Page
// ============================================================

export class MockPage extends MockNode {
  selection: MockNode[];
  backgrounds: Paint[];

  constructor(options: MockNodeOptions = {}) {
    super({ ...options, type: "PAGE" });
    this.selection = [];
    this.backgrounds = [
      { type: "SOLID", color: { r: 1, g: 1, b: 1 }, visible: true },
    ];
  }
}

// ============================================================
// Node Registry (for getNodeById)
// ============================================================

const nodeRegistry = new Map<string, MockNode>();

export function registerNode(node: MockNode): void {
  nodeRegistry.set(node.id, node);
  if (node.children) {
    for (const child of node.children) {
      registerNode(child);
    }
  }
}

export function clearRegistry(): void {
  nodeRegistry.clear();
  nextId = 1;
}

// ============================================================
// Mock Figma Global
// ============================================================

export function createMockFigma() {
  const currentPage = new MockPage({ id: "0:1", name: "Page 1" });
  registerNode(currentPage);

  const root = new MockNode({
    id: "0:0",
    name: "Mock File",
    type: "DOCUMENT",
    children: [currentPage],
  });

  const mockFigma = {
    root,
    currentPage,

    getNodeById(id: string): MockNode | null {
      return nodeRegistry.get(id) ?? null;
    },

    createFrame(): MockNode {
      const node = new MockNode({ type: "FRAME", name: "Frame" });
      registerNode(node);
      currentPage.appendChild(node);
      return node;
    },

    createRectangle(): MockNode {
      const node = new MockNode({ type: "RECTANGLE", name: "Rectangle" });
      registerNode(node);
      currentPage.appendChild(node);
      return node;
    },

    createEllipse(): MockNode {
      const node = new MockNode({ type: "ELLIPSE", name: "Ellipse" });
      registerNode(node);
      currentPage.appendChild(node);
      return node;
    },

    createLine(): MockNode {
      const node = new MockNode({
        type: "LINE",
        name: "Line",
        height: 0,
      });
      registerNode(node);
      currentPage.appendChild(node);
      return node;
    },

    createPolygon(): MockNode {
      const node = new MockNode({ type: "POLYGON", name: "Polygon" });
      registerNode(node);
      currentPage.appendChild(node);
      return node;
    },

    createStar(): MockNode {
      const node = new MockNode({ type: "STAR", name: "Star" });
      registerNode(node);
      currentPage.appendChild(node);
      return node;
    },

    createText(): MockNode {
      const node = new MockNode({
        type: "TEXT",
        name: "Text",
        characters: "",
        fontName: { family: "Inter", style: "Regular" },
        fontSize: 16,
      });
      registerNode(node);
      currentPage.appendChild(node);
      return node;
    },

    loadFontAsync: vi.fn().mockResolvedValue(undefined),

    viewport: {
      scrollAndZoomIntoView: vi.fn(),
      center: { x: 0, y: 0 },
      zoom: 1,
    },

    notify: vi.fn(),

    undo: vi.fn(),
  };

  return mockFigma;
}

// ============================================================
// Setup Helper (call in beforeEach)
// ============================================================

export function setupMockFigma() {
  clearRegistry();
  const mockFigma = createMockFigma();
  (globalThis as Record<string, unknown>).figma = mockFigma;
  return mockFigma;
}

export function teardownMockFigma() {
  clearRegistry();
  delete (globalThis as Record<string, unknown>).figma;
}
```

**Step 2: Verify TypeScript compiles**

Run: `npx vitest run --passWithNoTests`
Expected: No failures (no tests yet, just verifying the mock compiles)

**Step 3: Commit**

```bash
git add test/mocks/figma-api.ts
git commit -m "test: add Figma Plugin API mock with node registry, create methods, and page simulation"
```

---

## Task 2: Executor Registry

**Files:**
- Create: `plugin/executors/index.ts`
- Create: `plugin/__tests__/registry.test.ts`

**Step 1: Write the failing test**

```typescript
// plugin/__tests__/registry.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  setupMockFigma,
  teardownMockFigma,
} from "../../test/mocks/figma-api.js";
import { executorRegistry, getExecutor } from "../executors/index.js";

describe("Executor Registry", () => {
  beforeEach(() => {
    setupMockFigma();
  });

  afterEach(() => {
    teardownMockFigma();
  });

  it("has executors registered for all 18 Phase 2 commands", () => {
    const phase2Commands = [
      // Reading (5)
      "get_node",
      "get_selection",
      "get_page_nodes",
      "search_nodes",
      "scroll_to_node",
      // Layers (8)
      "create_node",
      "create_text",
      "delete_node",
      "duplicate_node",
      "move_node",
      "resize_node",
      "rename_node",
      "reorder_node",
      // Text (5)
      "set_text_content",
      "set_text_style",
      "set_text_color",
      "set_text_alignment",
      "find_replace_text",
    ];

    for (const cmd of phase2Commands) {
      const executor = getExecutor(cmd);
      expect(executor, `Missing executor for '${cmd}'`).toBeDefined();
      expect(typeof executor).toBe("function");
    }
  });

  it("returns undefined for unknown commands", () => {
    const executor = getExecutor("nonexistent_command");
    expect(executor).toBeUndefined();
  });

  it("executors are callable async functions", async () => {
    const executor = getExecutor("get_selection");
    expect(executor).toBeDefined();
    // Should return a promise
    const result = executor!({});
    expect(result).toBeInstanceOf(Promise);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run plugin/__tests__/registry.test.ts`
Expected: FAIL -- module not found

**Step 3: Write the implementation**

```typescript
// plugin/executors/index.ts

// ============================================================
// Executor Type
// ============================================================

export type ExecutorFn = (
  params: Record<string, unknown>
) => Promise<{ success: boolean; data?: unknown; error?: string }>;

// ============================================================
// Registry
// ============================================================

export const executorRegistry = new Map<string, ExecutorFn>();

export function registerExecutor(name: string, fn: ExecutorFn): void {
  executorRegistry.set(name, fn);
}

export function getExecutor(name: string): ExecutorFn | undefined {
  return executorRegistry.get(name);
}

// ============================================================
// Import all executor modules to trigger registration
// ============================================================

import "./reading.js";
import "./layers.js";
import "./text.js";
```

**Step 4: Create empty executor stubs so the registry test passes**

We need the three executor files to exist with their registrations. These will be fully implemented in Tasks 3-5, but we need stubs now so the registry test passes.

```typescript
// plugin/executors/reading.ts
import { registerExecutor } from "./index.js";

// Stubs — full implementation in Task 3
registerExecutor("get_node", async (_params) => {
  throw new Error("Not implemented");
});
registerExecutor("get_selection", async (_params) => {
  throw new Error("Not implemented");
});
registerExecutor("get_page_nodes", async (_params) => {
  throw new Error("Not implemented");
});
registerExecutor("search_nodes", async (_params) => {
  throw new Error("Not implemented");
});
registerExecutor("scroll_to_node", async (_params) => {
  throw new Error("Not implemented");
});
```

```typescript
// plugin/executors/layers.ts
import { registerExecutor } from "./index.js";

// Stubs — full implementation in Task 4
registerExecutor("create_node", async (_params) => {
  throw new Error("Not implemented");
});
registerExecutor("create_text", async (_params) => {
  throw new Error("Not implemented");
});
registerExecutor("delete_node", async (_params) => {
  throw new Error("Not implemented");
});
registerExecutor("duplicate_node", async (_params) => {
  throw new Error("Not implemented");
});
registerExecutor("move_node", async (_params) => {
  throw new Error("Not implemented");
});
registerExecutor("resize_node", async (_params) => {
  throw new Error("Not implemented");
});
registerExecutor("rename_node", async (_params) => {
  throw new Error("Not implemented");
});
registerExecutor("reorder_node", async (_params) => {
  throw new Error("Not implemented");
});
```

```typescript
// plugin/executors/text.ts
import { registerExecutor } from "./index.js";

// Stubs — full implementation in Task 5
registerExecutor("set_text_content", async (_params) => {
  throw new Error("Not implemented");
});
registerExecutor("set_text_style", async (_params) => {
  throw new Error("Not implemented");
});
registerExecutor("set_text_color", async (_params) => {
  throw new Error("Not implemented");
});
registerExecutor("set_text_alignment", async (_params) => {
  throw new Error("Not implemented");
});
registerExecutor("find_replace_text", async (_params) => {
  throw new Error("Not implemented");
});
```

**Step 5: Run tests to verify they pass**

Run: `npx vitest run plugin/__tests__/registry.test.ts`
Expected: All 3 tests PASS

**Step 6: Commit**

```bash
git add plugin/executors/index.ts plugin/executors/reading.ts plugin/executors/layers.ts plugin/executors/text.ts plugin/__tests__/registry.test.ts
git commit -m "feat: add executor registry with stubs for all 18 Phase 2 commands"
```

---

## Task 3: Reading Executors (5)

**Files:**
- Modify: `plugin/executors/reading.ts`
- Create: `plugin/__tests__/reading.test.ts`

### Step 1: Write the failing tests

```typescript
// plugin/__tests__/reading.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  setupMockFigma,
  teardownMockFigma,
  MockNode,
  MockPage,
  registerNode,
} from "../../test/mocks/figma-api.js";
import { getExecutor } from "../executors/index.js";

describe("Reading Executors", () => {
  let mockFigma: ReturnType<typeof setupMockFigma>;

  beforeEach(() => {
    mockFigma = setupMockFigma();
  });

  afterEach(() => {
    teardownMockFigma();
  });

  // ============================================================
  // get_node
  // ============================================================
  describe("get_node", () => {
    it("returns full node details by ID", async () => {
      const frame = new MockNode({
        id: "10:1",
        name: "Card",
        type: "FRAME",
        x: 100,
        y: 200,
        width: 320,
        height: 240,
      });
      registerNode(frame);
      mockFigma.currentPage.appendChild(frame);

      const exec = getExecutor("get_node")!;
      const result = await exec({ nodeId: "10:1" });

      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        id: "10:1",
        name: "Card",
        type: "FRAME",
        x: 100,
        y: 200,
        width: 320,
        height: 240,
      });
    });

    it("returns children when depth > 0", async () => {
      const child = new MockNode({
        id: "10:2",
        name: "Title",
        type: "TEXT",
      });
      const frame = new MockNode({
        id: "10:1",
        name: "Card",
        type: "FRAME",
        children: [child],
      });
      registerNode(frame);
      mockFigma.currentPage.appendChild(frame);

      const exec = getExecutor("get_node")!;
      const result = await exec({ nodeId: "10:1", depth: 1 });

      expect(result.success).toBe(true);
      const data = result.data as Record<string, unknown>;
      const children = data.children as unknown[];
      expect(children).toHaveLength(1);
      expect((children[0] as Record<string, unknown>).name).toBe("Title");
    });

    it("returns error for invalid node ID format", async () => {
      const exec = getExecutor("get_node")!;
      const result = await exec({ nodeId: "invalid" });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid node ID");
    });

    it("returns error when node not found", async () => {
      const exec = getExecutor("get_node")!;
      const result = await exec({ nodeId: "999:999" });

      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });

    it("returns error when nodeId is missing", async () => {
      const exec = getExecutor("get_node")!;
      const result = await exec({});

      expect(result.success).toBe(false);
      expect(result.error).toContain("nodeId");
    });
  });

  // ============================================================
  // get_selection
  // ============================================================
  describe("get_selection", () => {
    it("returns currently selected nodes", async () => {
      const node1 = new MockNode({
        id: "10:1",
        name: "Frame A",
        type: "FRAME",
      });
      const node2 = new MockNode({
        id: "10:2",
        name: "Text B",
        type: "TEXT",
      });
      registerNode(node1);
      registerNode(node2);
      (mockFigma.currentPage as MockPage).selection = [node1, node2];

      const exec = getExecutor("get_selection")!;
      const result = await exec({});

      expect(result.success).toBe(true);
      const data = result.data as { nodes: unknown[] };
      expect(data.nodes).toHaveLength(2);
      expect((data.nodes[0] as Record<string, unknown>).id).toBe("10:1");
      expect((data.nodes[1] as Record<string, unknown>).id).toBe("10:2");
    });

    it("returns empty array when nothing is selected", async () => {
      (mockFigma.currentPage as MockPage).selection = [];

      const exec = getExecutor("get_selection")!;
      const result = await exec({});

      expect(result.success).toBe(true);
      const data = result.data as { nodes: unknown[] };
      expect(data.nodes).toHaveLength(0);
    });
  });

  // ============================================================
  // get_page_nodes
  // ============================================================
  describe("get_page_nodes", () => {
    it("returns all nodes on the current page", async () => {
      const frame = new MockNode({
        id: "10:1",
        name: "Frame",
        type: "FRAME",
      });
      const rect = new MockNode({
        id: "10:2",
        name: "Rect",
        type: "RECTANGLE",
      });
      registerNode(frame);
      registerNode(rect);
      mockFigma.currentPage.children = [frame, rect];

      const exec = getExecutor("get_page_nodes")!;
      const result = await exec({});

      expect(result.success).toBe(true);
      const data = result.data as { nodes: unknown[] };
      expect(data.nodes.length).toBeGreaterThanOrEqual(2);
    });

    it("filters by type when typeFilter is provided", async () => {
      const frame = new MockNode({
        id: "10:1",
        name: "Frame",
        type: "FRAME",
      });
      const text = new MockNode({
        id: "10:2",
        name: "Text",
        type: "TEXT",
      });
      registerNode(frame);
      registerNode(text);
      mockFigma.currentPage.children = [frame, text];

      const exec = getExecutor("get_page_nodes")!;
      const result = await exec({ typeFilter: "TEXT" });

      expect(result.success).toBe(true);
      const data = result.data as { nodes: unknown[] };
      expect(data.nodes).toHaveLength(1);
      expect((data.nodes[0] as Record<string, unknown>).type).toBe("TEXT");
    });
  });

  // ============================================================
  // search_nodes
  // ============================================================
  describe("search_nodes", () => {
    it("searches nodes by name", async () => {
      const btn = new MockNode({
        id: "10:1",
        name: "Submit Button",
        type: "FRAME",
      });
      const title = new MockNode({
        id: "10:2",
        name: "Page Title",
        type: "TEXT",
      });
      registerNode(btn);
      registerNode(title);
      mockFigma.currentPage.children = [btn, title];

      const exec = getExecutor("search_nodes")!;
      const result = await exec({ query: "Button", searchIn: "name" });

      expect(result.success).toBe(true);
      const data = result.data as { nodes: unknown[] };
      expect(data.nodes).toHaveLength(1);
      expect((data.nodes[0] as Record<string, unknown>).name).toBe(
        "Submit Button"
      );
    });

    it("searches nodes by type", async () => {
      const frame = new MockNode({
        id: "10:1",
        name: "Card",
        type: "FRAME",
      });
      const text = new MockNode({
        id: "10:2",
        name: "Label",
        type: "TEXT",
      });
      registerNode(frame);
      registerNode(text);
      mockFigma.currentPage.children = [frame, text];

      const exec = getExecutor("search_nodes")!;
      const result = await exec({ query: "TEXT", searchIn: "type" });

      expect(result.success).toBe(true);
      const data = result.data as { nodes: unknown[] };
      expect(data.nodes).toHaveLength(1);
      expect((data.nodes[0] as Record<string, unknown>).type).toBe("TEXT");
    });

    it("searches nodes by text content", async () => {
      const text1 = new MockNode({
        id: "10:1",
        name: "Label",
        type: "TEXT",
        characters: "Hello World",
      });
      const text2 = new MockNode({
        id: "10:2",
        name: "Other",
        type: "TEXT",
        characters: "Goodbye",
      });
      registerNode(text1);
      registerNode(text2);
      mockFigma.currentPage.children = [text1, text2];

      const exec = getExecutor("search_nodes")!;
      const result = await exec({ query: "Hello", searchIn: "text" });

      expect(result.success).toBe(true);
      const data = result.data as { nodes: unknown[] };
      expect(data.nodes).toHaveLength(1);
      expect((data.nodes[0] as Record<string, unknown>).id).toBe("10:1");
    });

    it("returns error when query is missing", async () => {
      const exec = getExecutor("search_nodes")!;
      const result = await exec({ searchIn: "name" });

      expect(result.success).toBe(false);
      expect(result.error).toContain("query");
    });

    it("returns error for invalid searchIn value", async () => {
      const exec = getExecutor("search_nodes")!;
      const result = await exec({ query: "test", searchIn: "invalid" });

      expect(result.success).toBe(false);
      expect(result.error).toContain("searchIn");
    });
  });

  // ============================================================
  // scroll_to_node
  // ============================================================
  describe("scroll_to_node", () => {
    it("scrolls viewport to the specified node", async () => {
      const node = new MockNode({ id: "10:1", name: "Target", type: "FRAME" });
      registerNode(node);
      mockFigma.currentPage.appendChild(node);

      const exec = getExecutor("scroll_to_node")!;
      const result = await exec({ nodeId: "10:1" });

      expect(result.success).toBe(true);
      expect(mockFigma.viewport.scrollAndZoomIntoView).toHaveBeenCalledWith([
        node,
      ]);
    });

    it("returns error for invalid node ID", async () => {
      const exec = getExecutor("scroll_to_node")!;
      const result = await exec({ nodeId: "invalid" });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid node ID");
    });

    it("returns error when node not found", async () => {
      const exec = getExecutor("scroll_to_node")!;
      const result = await exec({ nodeId: "999:999" });

      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });

    it("returns error when nodeId is missing", async () => {
      const exec = getExecutor("scroll_to_node")!;
      const result = await exec({});

      expect(result.success).toBe(false);
      expect(result.error).toContain("nodeId");
    });
  });
});
```

### Step 2: Run tests to verify they fail

Run: `npx vitest run plugin/__tests__/reading.test.ts`
Expected: FAIL -- executors throw "Not implemented"

### Step 3: Write the implementation

```typescript
// plugin/executors/reading.ts
import { registerExecutor } from "./index.js";

// ============================================================
// Helpers
// ============================================================

const NODE_ID_PATTERN = /^\d+:\d+$/;

function validateNodeId(nodeId: unknown): string | null {
  if (typeof nodeId !== "string" || !nodeId) {
    return "Required parameter 'nodeId' is missing or not a string.";
  }
  if (!NODE_ID_PATTERN.test(nodeId)) {
    return `Invalid node ID format '${nodeId}'. Expected format: '123:456'.`;
  }
  return null;
}

function getNodeOrError(nodeId: string): {
  node?: SceneNode;
  error?: string;
} {
  const validationError = validateNodeId(nodeId);
  if (validationError) return { error: validationError };

  const node = figma.getNodeById(nodeId);
  if (!node) {
    return { error: `Node '${nodeId}' not found. It may have been deleted.` };
  }
  return { node: node as SceneNode };
}

function serializeNode(
  node: BaseNode & Record<string, unknown>,
  depth: number = 0
): Record<string, unknown> {
  const result: Record<string, unknown> = {
    id: node.id,
    name: node.name,
    type: node.type,
  };

  // Position and size (if applicable)
  if ("x" in node) result.x = node.x;
  if ("y" in node) result.y = node.y;
  if ("width" in node) result.width = node.width;
  if ("height" in node) result.height = node.height;

  // Visibility and opacity
  if ("visible" in node) result.visible = node.visible;
  if ("opacity" in node) result.opacity = node.opacity;

  // Text properties
  if (node.type === "TEXT") {
    if ("characters" in node) result.characters = node.characters;
    if ("fontSize" in node) result.fontSize = node.fontSize;
    if ("fontName" in node) result.fontName = node.fontName;
    if ("textAlignHorizontal" in node)
      result.textAlignHorizontal = node.textAlignHorizontal;
    if ("textAlignVertical" in node)
      result.textAlignVertical = node.textAlignVertical;
  }

  // Fills
  if ("fills" in node) result.fills = node.fills;

  // Children
  if (depth > 0 && "children" in node) {
    const children = node.children as BaseNode[];
    result.children = children.map((child) =>
      serializeNode(child as BaseNode & Record<string, unknown>, depth - 1)
    );
  } else if ("children" in node) {
    const children = node.children as BaseNode[];
    result.childCount = children.length;
  }

  return result;
}

// ============================================================
// get_node
// ============================================================

registerExecutor("get_node", async (params) => {
  const nodeId = params.nodeId as string | undefined;

  if (!nodeId) {
    return {
      success: false,
      error: "Required parameter 'nodeId' is missing.",
    };
  }

  const { node, error } = getNodeOrError(nodeId);
  if (error) return { success: false, error };

  const depth =
    typeof params.depth === "number" ? params.depth : 0;

  const data = serializeNode(
    node as unknown as BaseNode & Record<string, unknown>,
    depth
  );

  return { success: true, data };
});

// ============================================================
// get_selection
// ============================================================

registerExecutor("get_selection", async (_params) => {
  const selection = figma.currentPage.selection;
  const nodes = selection.map((node) =>
    serializeNode(node as unknown as BaseNode & Record<string, unknown>, 0)
  );

  return {
    success: true,
    data: { nodes },
  };
});

// ============================================================
// get_page_nodes
// ============================================================

registerExecutor("get_page_nodes", async (params) => {
  const typeFilter = params.typeFilter as string | undefined;
  const depth =
    typeof params.depth === "number" ? params.depth : 0;

  const page = figma.currentPage;
  let nodes: BaseNode[];

  if (typeFilter) {
    nodes = page.findAll(
      (node) => node.type === typeFilter
    );
  } else {
    nodes = page.findAll();
  }

  const serialized = nodes.map((node) =>
    serializeNode(node as unknown as BaseNode & Record<string, unknown>, depth)
  );

  return {
    success: true,
    data: { nodes: serialized },
  };
});

// ============================================================
// search_nodes
// ============================================================

registerExecutor("search_nodes", async (params) => {
  const query = params.query as string | undefined;
  const searchIn = params.searchIn as string | undefined;

  if (!query) {
    return {
      success: false,
      error:
        "Required parameter 'query' is missing. Provide the search term.",
    };
  }

  if (!searchIn || !["name", "type", "text"].includes(searchIn)) {
    return {
      success: false,
      error:
        "Required parameter 'searchIn' must be one of: 'name', 'type', 'text'.",
    };
  }

  const page = figma.currentPage;
  let results: BaseNode[];

  switch (searchIn) {
    case "name":
      results = page.findAll(
        (node) =>
          node.name.toLowerCase().includes(query.toLowerCase())
      );
      break;
    case "type":
      results = page.findAll(
        (node) => node.type === query.toUpperCase()
      );
      break;
    case "text":
      results = page.findAll(
        (node) =>
          node.type === "TEXT" &&
          "characters" in node &&
          (node as unknown as { characters: string }).characters
            .toLowerCase()
            .includes(query.toLowerCase())
      );
      break;
    default:
      results = [];
  }

  const serialized = results.map((node) =>
    serializeNode(node as unknown as BaseNode & Record<string, unknown>, 0)
  );

  return {
    success: true,
    data: { nodes: serialized },
  };
});

// ============================================================
// scroll_to_node
// ============================================================

registerExecutor("scroll_to_node", async (params) => {
  const nodeId = params.nodeId as string | undefined;

  if (!nodeId) {
    return {
      success: false,
      error: "Required parameter 'nodeId' is missing.",
    };
  }

  const { node, error } = getNodeOrError(nodeId);
  if (error) return { success: false, error };

  figma.viewport.scrollAndZoomIntoView([node!]);

  return {
    success: true,
    data: { nodeId: node!.id, scrolledTo: true },
  };
});
```

### Step 4: Run tests to verify they pass

Run: `npx vitest run plugin/__tests__/reading.test.ts`
Expected: All 14 tests PASS

### Step 5: Commit

```bash
git add plugin/executors/reading.ts plugin/__tests__/reading.test.ts
git commit -m "feat: implement 5 reading executors — get_node, get_selection, get_page_nodes, search_nodes, scroll_to_node"
```

---

## Task 4: Layer Executors (8)

**Files:**
- Modify: `plugin/executors/layers.ts`
- Create: `plugin/__tests__/layers.test.ts`

### Step 1: Write the failing tests

```typescript
// plugin/__tests__/layers.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  setupMockFigma,
  teardownMockFigma,
  MockNode,
  registerNode,
} from "../../test/mocks/figma-api.js";
import { getExecutor } from "../executors/index.js";

describe("Layer Executors", () => {
  let mockFigma: ReturnType<typeof setupMockFigma>;

  beforeEach(() => {
    mockFigma = setupMockFigma();
  });

  afterEach(() => {
    teardownMockFigma();
  });

  // ============================================================
  // create_node
  // ============================================================
  describe("create_node", () => {
    it("creates a FRAME node", async () => {
      const exec = getExecutor("create_node")!;
      const result = await exec({
        type: "FRAME",
        name: "My Frame",
        x: 50,
        y: 100,
        width: 320,
        height: 200,
      });

      expect(result.success).toBe(true);
      const data = result.data as Record<string, unknown>;
      expect(data.nodeId).toBeDefined();
      expect(data.type).toBe("FRAME");
      expect(data.name).toBe("My Frame");
    });

    it("creates a RECTANGLE node", async () => {
      const exec = getExecutor("create_node")!;
      const result = await exec({ type: "RECTANGLE", name: "Box" });

      expect(result.success).toBe(true);
      const data = result.data as Record<string, unknown>;
      expect(data.type).toBe("RECTANGLE");
    });

    it("creates an ELLIPSE node", async () => {
      const exec = getExecutor("create_node")!;
      const result = await exec({ type: "ELLIPSE" });

      expect(result.success).toBe(true);
      const data = result.data as Record<string, unknown>;
      expect(data.type).toBe("ELLIPSE");
    });

    it("creates a LINE node", async () => {
      const exec = getExecutor("create_node")!;
      const result = await exec({ type: "LINE" });

      expect(result.success).toBe(true);
      const data = result.data as Record<string, unknown>;
      expect(data.type).toBe("LINE");
    });

    it("creates a POLYGON node", async () => {
      const exec = getExecutor("create_node")!;
      const result = await exec({ type: "POLYGON" });

      expect(result.success).toBe(true);
      const data = result.data as Record<string, unknown>;
      expect(data.type).toBe("POLYGON");
    });

    it("creates a STAR node", async () => {
      const exec = getExecutor("create_node")!;
      const result = await exec({ type: "STAR" });

      expect(result.success).toBe(true);
      const data = result.data as Record<string, unknown>;
      expect(data.type).toBe("STAR");
    });

    it("appends to parent when parentId is provided", async () => {
      const parent = new MockNode({
        id: "10:1",
        name: "Parent",
        type: "FRAME",
      });
      registerNode(parent);
      mockFigma.currentPage.appendChild(parent);

      const exec = getExecutor("create_node")!;
      const result = await exec({
        type: "RECTANGLE",
        parentId: "10:1",
        name: "Child",
      });

      expect(result.success).toBe(true);
      expect(parent.children.length).toBeGreaterThanOrEqual(1);
    });

    it("returns error for missing type", async () => {
      const exec = getExecutor("create_node")!;
      const result = await exec({});

      expect(result.success).toBe(false);
      expect(result.error).toContain("type");
    });

    it("returns error for invalid type", async () => {
      const exec = getExecutor("create_node")!;
      const result = await exec({ type: "INVALID_TYPE" });

      expect(result.success).toBe(false);
      expect(result.error).toContain("type");
    });

    it("returns error for invalid parentId format", async () => {
      const exec = getExecutor("create_node")!;
      const result = await exec({ type: "FRAME", parentId: "invalid" });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid");
    });
  });

  // ============================================================
  // create_text
  // ============================================================
  describe("create_text", () => {
    it("creates a text node with content", async () => {
      const exec = getExecutor("create_text")!;
      const result = await exec({ text: "Hello World" });

      expect(result.success).toBe(true);
      const data = result.data as Record<string, unknown>;
      expect(data.nodeId).toBeDefined();
      expect(data.type).toBe("TEXT");
      expect(mockFigma.loadFontAsync).toHaveBeenCalled();
    });

    it("creates a text node with custom font and size", async () => {
      const exec = getExecutor("create_text")!;
      const result = await exec({
        text: "Styled Text",
        fontFamily: "Roboto",
        fontSize: 24,
      });

      expect(result.success).toBe(true);
    });

    it("returns error when text is missing", async () => {
      const exec = getExecutor("create_text")!;
      const result = await exec({});

      expect(result.success).toBe(false);
      expect(result.error).toContain("text");
    });

    it("appends to parent when parentId is provided", async () => {
      const parent = new MockNode({
        id: "10:1",
        name: "Container",
        type: "FRAME",
      });
      registerNode(parent);
      mockFigma.currentPage.appendChild(parent);

      const exec = getExecutor("create_text")!;
      const result = await exec({
        text: "Child Text",
        parentId: "10:1",
      });

      expect(result.success).toBe(true);
      expect(parent.children.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ============================================================
  // delete_node
  // ============================================================
  describe("delete_node", () => {
    it("deletes a node by ID", async () => {
      const node = new MockNode({
        id: "10:1",
        name: "ToDelete",
        type: "FRAME",
      });
      registerNode(node);
      mockFigma.currentPage.appendChild(node);

      const exec = getExecutor("delete_node")!;
      const result = await exec({ nodeId: "10:1" });

      expect(result.success).toBe(true);
      expect(node.removed).toBe(true);
    });

    it("returns error when nodeId is missing", async () => {
      const exec = getExecutor("delete_node")!;
      const result = await exec({});

      expect(result.success).toBe(false);
      expect(result.error).toContain("nodeId");
    });

    it("returns error when node not found", async () => {
      const exec = getExecutor("delete_node")!;
      const result = await exec({ nodeId: "999:999" });

      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });
  });

  // ============================================================
  // duplicate_node
  // ============================================================
  describe("duplicate_node", () => {
    it("duplicates a node", async () => {
      const node = new MockNode({
        id: "10:1",
        name: "Original",
        type: "FRAME",
        x: 100,
        y: 200,
      });
      registerNode(node);
      mockFigma.currentPage.appendChild(node);

      const exec = getExecutor("duplicate_node")!;
      const result = await exec({ nodeId: "10:1" });

      expect(result.success).toBe(true);
      const data = result.data as Record<string, unknown>;
      expect(data.nodeId).toBeDefined();
      expect(data.nodeId).not.toBe("10:1");
    });

    it("applies offset to duplicated node", async () => {
      const node = new MockNode({
        id: "10:1",
        name: "Original",
        type: "FRAME",
        x: 100,
        y: 200,
      });
      registerNode(node);
      mockFigma.currentPage.appendChild(node);

      const exec = getExecutor("duplicate_node")!;
      const result = await exec({
        nodeId: "10:1",
        offsetX: 50,
        offsetY: 30,
      });

      expect(result.success).toBe(true);
    });

    it("returns error when nodeId is missing", async () => {
      const exec = getExecutor("duplicate_node")!;
      const result = await exec({});

      expect(result.success).toBe(false);
      expect(result.error).toContain("nodeId");
    });
  });

  // ============================================================
  // move_node
  // ============================================================
  describe("move_node", () => {
    it("moves a node to absolute position", async () => {
      const node = new MockNode({
        id: "10:1",
        name: "Movable",
        type: "FRAME",
        x: 0,
        y: 0,
      });
      registerNode(node);
      mockFigma.currentPage.appendChild(node);

      const exec = getExecutor("move_node")!;
      const result = await exec({ nodeId: "10:1", x: 200, y: 300 });

      expect(result.success).toBe(true);
      expect(node.x).toBe(200);
      expect(node.y).toBe(300);
    });

    it("moves a node by relative offset", async () => {
      const node = new MockNode({
        id: "10:1",
        name: "Movable",
        type: "FRAME",
        x: 100,
        y: 100,
      });
      registerNode(node);
      mockFigma.currentPage.appendChild(node);

      const exec = getExecutor("move_node")!;
      const result = await exec({
        nodeId: "10:1",
        relativeX: 50,
        relativeY: -25,
      });

      expect(result.success).toBe(true);
      expect(node.x).toBe(150);
      expect(node.y).toBe(75);
    });

    it("returns error when nodeId is missing", async () => {
      const exec = getExecutor("move_node")!;
      const result = await exec({ x: 100 });

      expect(result.success).toBe(false);
      expect(result.error).toContain("nodeId");
    });

    it("returns error when no position params provided", async () => {
      const node = new MockNode({ id: "10:1", name: "N", type: "FRAME" });
      registerNode(node);
      mockFigma.currentPage.appendChild(node);

      const exec = getExecutor("move_node")!;
      const result = await exec({ nodeId: "10:1" });

      expect(result.success).toBe(false);
      expect(result.error).toContain("position");
    });
  });

  // ============================================================
  // resize_node
  // ============================================================
  describe("resize_node", () => {
    it("resizes a node to new dimensions", async () => {
      const node = new MockNode({
        id: "10:1",
        name: "Resizable",
        type: "FRAME",
        width: 100,
        height: 100,
      });
      registerNode(node);
      mockFigma.currentPage.appendChild(node);

      const exec = getExecutor("resize_node")!;
      const result = await exec({
        nodeId: "10:1",
        width: 200,
        height: 150,
      });

      expect(result.success).toBe(true);
      expect(node.width).toBe(200);
      expect(node.height).toBe(150);
    });

    it("resizes only width", async () => {
      const node = new MockNode({
        id: "10:1",
        name: "R",
        type: "FRAME",
        width: 100,
        height: 100,
      });
      registerNode(node);
      mockFigma.currentPage.appendChild(node);

      const exec = getExecutor("resize_node")!;
      const result = await exec({ nodeId: "10:1", width: 300 });

      expect(result.success).toBe(true);
      expect(node.width).toBe(300);
      expect(node.height).toBe(100);
    });

    it("resizes only height", async () => {
      const node = new MockNode({
        id: "10:1",
        name: "R",
        type: "FRAME",
        width: 100,
        height: 100,
      });
      registerNode(node);
      mockFigma.currentPage.appendChild(node);

      const exec = getExecutor("resize_node")!;
      const result = await exec({ nodeId: "10:1", height: 250 });

      expect(result.success).toBe(true);
      expect(node.width).toBe(100);
      expect(node.height).toBe(250);
    });

    it("returns error when nodeId is missing", async () => {
      const exec = getExecutor("resize_node")!;
      const result = await exec({ width: 100 });

      expect(result.success).toBe(false);
      expect(result.error).toContain("nodeId");
    });

    it("returns error when no dimension params provided", async () => {
      const node = new MockNode({ id: "10:1", name: "N", type: "FRAME" });
      registerNode(node);
      mockFigma.currentPage.appendChild(node);

      const exec = getExecutor("resize_node")!;
      const result = await exec({ nodeId: "10:1" });

      expect(result.success).toBe(false);
      expect(result.error).toContain("width");
    });

    it("returns error for negative dimensions", async () => {
      const node = new MockNode({ id: "10:1", name: "N", type: "FRAME" });
      registerNode(node);
      mockFigma.currentPage.appendChild(node);

      const exec = getExecutor("resize_node")!;
      const result = await exec({
        nodeId: "10:1",
        width: -10,
        height: 100,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("positive");
    });
  });

  // ============================================================
  // rename_node
  // ============================================================
  describe("rename_node", () => {
    it("renames a node", async () => {
      const node = new MockNode({
        id: "10:1",
        name: "OldName",
        type: "FRAME",
      });
      registerNode(node);
      mockFigma.currentPage.appendChild(node);

      const exec = getExecutor("rename_node")!;
      const result = await exec({ nodeId: "10:1", name: "NewName" });

      expect(result.success).toBe(true);
      expect(node.name).toBe("NewName");
    });

    it("returns error when nodeId is missing", async () => {
      const exec = getExecutor("rename_node")!;
      const result = await exec({ name: "Test" });

      expect(result.success).toBe(false);
      expect(result.error).toContain("nodeId");
    });

    it("returns error when name is missing", async () => {
      const node = new MockNode({ id: "10:1", name: "N", type: "FRAME" });
      registerNode(node);
      mockFigma.currentPage.appendChild(node);

      const exec = getExecutor("rename_node")!;
      const result = await exec({ nodeId: "10:1" });

      expect(result.success).toBe(false);
      expect(result.error).toContain("name");
    });
  });

  // ============================================================
  // reorder_node
  // ============================================================
  describe("reorder_node", () => {
    it("moves a node to the front", async () => {
      const parent = new MockNode({
        id: "10:0",
        name: "Parent",
        type: "FRAME",
      });
      const child1 = new MockNode({
        id: "10:1",
        name: "First",
        type: "RECTANGLE",
      });
      const child2 = new MockNode({
        id: "10:2",
        name: "Second",
        type: "RECTANGLE",
      });
      parent.children = [child1, child2];
      child1.parent = parent;
      child2.parent = parent;
      registerNode(parent);
      registerNode(child1);
      registerNode(child2);
      mockFigma.currentPage.appendChild(parent);

      const exec = getExecutor("reorder_node")!;
      const result = await exec({ nodeId: "10:1", position: "front" });

      expect(result.success).toBe(true);
    });

    it("moves a node to the back", async () => {
      const parent = new MockNode({
        id: "10:0",
        name: "Parent",
        type: "FRAME",
      });
      const child1 = new MockNode({
        id: "10:1",
        name: "First",
        type: "RECTANGLE",
      });
      const child2 = new MockNode({
        id: "10:2",
        name: "Second",
        type: "RECTANGLE",
      });
      parent.children = [child1, child2];
      child1.parent = parent;
      child2.parent = parent;
      registerNode(parent);
      registerNode(child1);
      registerNode(child2);
      mockFigma.currentPage.appendChild(parent);

      const exec = getExecutor("reorder_node")!;
      const result = await exec({ nodeId: "10:2", position: "back" });

      expect(result.success).toBe(true);
    });

    it("moves a node to a specific index", async () => {
      const parent = new MockNode({
        id: "10:0",
        name: "Parent",
        type: "FRAME",
      });
      const child1 = new MockNode({
        id: "10:1",
        name: "First",
        type: "RECTANGLE",
      });
      const child2 = new MockNode({
        id: "10:2",
        name: "Second",
        type: "RECTANGLE",
      });
      const child3 = new MockNode({
        id: "10:3",
        name: "Third",
        type: "RECTANGLE",
      });
      parent.children = [child1, child2, child3];
      child1.parent = parent;
      child2.parent = parent;
      child3.parent = parent;
      registerNode(parent);
      registerNode(child1);
      registerNode(child2);
      registerNode(child3);
      mockFigma.currentPage.appendChild(parent);

      const exec = getExecutor("reorder_node")!;
      const result = await exec({ nodeId: "10:3", position: 0 });

      expect(result.success).toBe(true);
    });

    it("returns error when nodeId is missing", async () => {
      const exec = getExecutor("reorder_node")!;
      const result = await exec({ position: "front" });

      expect(result.success).toBe(false);
      expect(result.error).toContain("nodeId");
    });

    it("returns error when position is missing", async () => {
      const node = new MockNode({ id: "10:1", name: "N", type: "FRAME" });
      registerNode(node);
      mockFigma.currentPage.appendChild(node);

      const exec = getExecutor("reorder_node")!;
      const result = await exec({ nodeId: "10:1" });

      expect(result.success).toBe(false);
      expect(result.error).toContain("position");
    });

    it("returns error for node without parent", async () => {
      const node = new MockNode({ id: "10:1", name: "N", type: "FRAME" });
      node.parent = null;
      registerNode(node);

      const exec = getExecutor("reorder_node")!;
      const result = await exec({ nodeId: "10:1", position: "front" });

      expect(result.success).toBe(false);
      expect(result.error).toContain("parent");
    });
  });
});
```

### Step 2: Run tests to verify they fail

Run: `npx vitest run plugin/__tests__/layers.test.ts`
Expected: FAIL -- executors throw "Not implemented"

### Step 3: Write the implementation

```typescript
// plugin/executors/layers.ts
import { registerExecutor } from "./index.js";

// ============================================================
// Helpers
// ============================================================

const NODE_ID_PATTERN = /^\d+:\d+$/;

const VALID_NODE_TYPES = [
  "FRAME",
  "RECTANGLE",
  "ELLIPSE",
  "LINE",
  "POLYGON",
  "STAR",
] as const;

type CreateNodeType = (typeof VALID_NODE_TYPES)[number];

function validateNodeId(nodeId: unknown): string | null {
  if (typeof nodeId !== "string" || !nodeId) {
    return "Required parameter 'nodeId' is missing or not a string.";
  }
  if (!NODE_ID_PATTERN.test(nodeId)) {
    return `Invalid node ID format '${nodeId}'. Expected format: '123:456'.`;
  }
  return null;
}

function getNodeOrError(nodeId: string): {
  node?: SceneNode;
  error?: string;
} {
  const validationError = validateNodeId(nodeId);
  if (validationError) return { error: validationError };

  const node = figma.getNodeById(nodeId);
  if (!node) {
    return { error: `Node '${nodeId}' not found. It may have been deleted.` };
  }
  return { node: node as SceneNode };
}

function resolveParent(
  parentId: string | undefined
): { parent?: SceneNode & ChildrenMixin; error?: string } {
  if (!parentId) {
    return { parent: figma.currentPage as unknown as SceneNode & ChildrenMixin };
  }

  const validationError = validateNodeId(parentId);
  if (validationError) return { error: validationError };

  const parentNode = figma.getNodeById(parentId);
  if (!parentNode) {
    return {
      error: `Parent node '${parentId}' not found. It may have been deleted.`,
    };
  }
  if (!("children" in parentNode)) {
    return {
      error: `Node '${parentId}' (${parentNode.type}) cannot have children. Use a FRAME or GROUP as parent.`,
    };
  }

  return { parent: parentNode as SceneNode & ChildrenMixin };
}

// ============================================================
// create_node
// ============================================================

registerExecutor("create_node", async (params) => {
  const type = params.type as string | undefined;

  if (!type) {
    return {
      success: false,
      error:
        "Required parameter 'type' is missing. Must be one of: FRAME, RECTANGLE, ELLIPSE, LINE, POLYGON, STAR.",
    };
  }

  if (!VALID_NODE_TYPES.includes(type as CreateNodeType)) {
    return {
      success: false,
      error: `Invalid node type '${type}'. Must be one of: ${VALID_NODE_TYPES.join(", ")}.`,
    };
  }

  const { parent, error: parentError } = resolveParent(
    params.parentId as string | undefined
  );
  if (parentError) return { success: false, error: parentError };

  let node: SceneNode;

  switch (type) {
    case "FRAME":
      node = figma.createFrame();
      break;
    case "RECTANGLE":
      node = figma.createRectangle();
      break;
    case "ELLIPSE":
      node = figma.createEllipse();
      break;
    case "LINE":
      node = figma.createLine();
      break;
    case "POLYGON":
      node = figma.createPolygon();
      break;
    case "STAR":
      node = figma.createStar();
      break;
    default:
      return { success: false, error: `Unsupported type '${type}'.` };
  }

  // Apply optional properties
  if (typeof params.name === "string") node.name = params.name;
  if (typeof params.x === "number") node.x = params.x;
  if (typeof params.y === "number") node.y = params.y;
  if (typeof params.width === "number" && typeof params.height === "number") {
    node.resize(params.width as number, params.height as number);
  } else if (typeof params.width === "number") {
    node.resize(params.width as number, node.height);
  } else if (typeof params.height === "number") {
    node.resize(node.width, params.height as number);
  }

  // Reparent if needed (createX always adds to currentPage first)
  if (params.parentId && parent !== figma.currentPage) {
    // Remove from current parent and add to target parent
    const sceneNode = node as SceneNode;
    (parent as ChildrenMixin).appendChild(sceneNode as unknown as SceneNode);
  }

  return {
    success: true,
    data: {
      nodeId: node.id,
      type: node.type,
      name: node.name,
      x: node.x,
      y: node.y,
      width: node.width,
      height: node.height,
    },
  };
});

// ============================================================
// create_text
// ============================================================

registerExecutor("create_text", async (params) => {
  const text = params.text as string | undefined;

  if (typeof text !== "string") {
    return {
      success: false,
      error:
        "Required parameter 'text' is missing. Provide the text content for the new text node.",
    };
  }

  const fontFamily =
    typeof params.fontFamily === "string" ? params.fontFamily : "Inter";
  const fontStyle = "Regular";
  const fontSize =
    typeof params.fontSize === "number" ? params.fontSize : 16;

  const { parent, error: parentError } = resolveParent(
    params.parentId as string | undefined
  );
  if (parentError) return { success: false, error: parentError };

  // Must load font before modifying text
  await figma.loadFontAsync({ family: fontFamily, style: fontStyle });

  const textNode = figma.createText();
  textNode.fontName = { family: fontFamily, style: fontStyle };
  textNode.fontSize = fontSize;
  textNode.characters = text;

  if (typeof params.name === "string") textNode.name = params.name;
  if (typeof params.x === "number") textNode.x = params.x;
  if (typeof params.y === "number") textNode.y = params.y;

  // Apply color if provided
  if (typeof params.color === "string") {
    const hex = params.color as string;
    const rgb = hexToRgb(hex);
    if (rgb) {
      textNode.fills = [
        { type: "SOLID", color: rgb, visible: true },
      ] as Paint[];
    }
  }

  // Reparent if needed
  if (params.parentId && parent !== figma.currentPage) {
    (parent as ChildrenMixin).appendChild(textNode as unknown as SceneNode);
  }

  return {
    success: true,
    data: {
      nodeId: textNode.id,
      type: "TEXT",
      name: textNode.name,
      characters: textNode.characters,
      fontFamily,
      fontSize,
    },
  };
});

function hexToRgb(
  hex: string
): { r: number; g: number; b: number } | null {
  const match = hex.match(/^#?([0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/);
  if (!match) return null;
  const h = match[1];
  return {
    r: parseInt(h.substring(0, 2), 16) / 255,
    g: parseInt(h.substring(2, 4), 16) / 255,
    b: parseInt(h.substring(4, 6), 16) / 255,
  };
}

// ============================================================
// delete_node
// ============================================================

registerExecutor("delete_node", async (params) => {
  const nodeId = params.nodeId as string | undefined;

  if (!nodeId) {
    return {
      success: false,
      error: "Required parameter 'nodeId' is missing.",
    };
  }

  const { node, error } = getNodeOrError(nodeId);
  if (error) return { success: false, error };

  const name = node!.name;
  node!.remove();

  return {
    success: true,
    data: { deleted: true, nodeId, name },
  };
});

// ============================================================
// duplicate_node
// ============================================================

registerExecutor("duplicate_node", async (params) => {
  const nodeId = params.nodeId as string | undefined;

  if (!nodeId) {
    return {
      success: false,
      error: "Required parameter 'nodeId' is missing.",
    };
  }

  const { node, error } = getNodeOrError(nodeId);
  if (error) return { success: false, error };

  const cloned = node!.clone();

  // Apply offset if provided
  if (typeof params.offsetX === "number") {
    cloned.x = node!.x + (params.offsetX as number);
  }
  if (typeof params.offsetY === "number") {
    cloned.y = node!.y + (params.offsetY as number);
  }

  return {
    success: true,
    data: {
      nodeId: cloned.id,
      originalNodeId: nodeId,
      name: cloned.name,
      x: cloned.x,
      y: cloned.y,
    },
  };
});

// ============================================================
// move_node
// ============================================================

registerExecutor("move_node", async (params) => {
  const nodeId = params.nodeId as string | undefined;

  if (!nodeId) {
    return {
      success: false,
      error: "Required parameter 'nodeId' is missing.",
    };
  }

  const { node, error } = getNodeOrError(nodeId);
  if (error) return { success: false, error };

  const hasAbsolute =
    typeof params.x === "number" || typeof params.y === "number";
  const hasRelative =
    typeof params.relativeX === "number" ||
    typeof params.relativeY === "number";

  if (!hasAbsolute && !hasRelative) {
    return {
      success: false,
      error:
        "No position parameters provided. Use 'x'/'y' for absolute or 'relativeX'/'relativeY' for relative positioning.",
    };
  }

  if (hasAbsolute) {
    if (typeof params.x === "number") node!.x = params.x as number;
    if (typeof params.y === "number") node!.y = params.y as number;
  }

  if (hasRelative) {
    if (typeof params.relativeX === "number")
      node!.x += params.relativeX as number;
    if (typeof params.relativeY === "number")
      node!.y += params.relativeY as number;
  }

  return {
    success: true,
    data: { nodeId, x: node!.x, y: node!.y },
  };
});

// ============================================================
// resize_node
// ============================================================

registerExecutor("resize_node", async (params) => {
  const nodeId = params.nodeId as string | undefined;

  if (!nodeId) {
    return {
      success: false,
      error: "Required parameter 'nodeId' is missing.",
    };
  }

  const { node, error } = getNodeOrError(nodeId);
  if (error) return { success: false, error };

  const newWidth =
    typeof params.width === "number" ? (params.width as number) : null;
  const newHeight =
    typeof params.height === "number" ? (params.height as number) : null;

  if (newWidth === null && newHeight === null) {
    return {
      success: false,
      error:
        "At least one of 'width' or 'height' must be provided.",
    };
  }

  if ((newWidth !== null && newWidth <= 0) || (newHeight !== null && newHeight <= 0)) {
    return {
      success: false,
      error: "Dimensions must be positive numbers.",
    };
  }

  const finalWidth = newWidth ?? node!.width;
  const finalHeight = newHeight ?? node!.height;

  node!.resize(finalWidth, finalHeight);

  return {
    success: true,
    data: {
      nodeId,
      width: node!.width,
      height: node!.height,
    },
  };
});

// ============================================================
// rename_node
// ============================================================

registerExecutor("rename_node", async (params) => {
  const nodeId = params.nodeId as string | undefined;
  const name = params.name as string | undefined;

  if (!nodeId) {
    return {
      success: false,
      error: "Required parameter 'nodeId' is missing.",
    };
  }

  if (typeof name !== "string" || !name) {
    return {
      success: false,
      error:
        "Required parameter 'name' is missing or empty.",
    };
  }

  const { node, error } = getNodeOrError(nodeId);
  if (error) return { success: false, error };

  const oldName = node!.name;
  node!.name = name;

  return {
    success: true,
    data: { nodeId, oldName, newName: name },
  };
});

// ============================================================
// reorder_node
// ============================================================

registerExecutor("reorder_node", async (params) => {
  const nodeId = params.nodeId as string | undefined;
  const position = params.position;

  if (!nodeId) {
    return {
      success: false,
      error: "Required parameter 'nodeId' is missing.",
    };
  }

  if (position === undefined || position === null) {
    return {
      success: false,
      error:
        "Required parameter 'position' is missing. Use 'front', 'back', or a number.",
    };
  }

  const { node, error } = getNodeOrError(nodeId);
  if (error) return { success: false, error };

  const parentNode = node!.parent;
  if (!parentNode || !("children" in parentNode)) {
    return {
      success: false,
      error:
        "Cannot reorder a node without a parent container. The node must be inside a frame, group, or page.",
    };
  }

  const siblings = (parentNode as ChildrenMixin & BaseNode).children as SceneNode[];
  const currentIndex = siblings.indexOf(node as unknown as SceneNode);

  if (currentIndex === -1) {
    return {
      success: false,
      error: "Node not found in parent's children list.",
    };
  }

  // Remove from current position
  siblings.splice(currentIndex, 1);

  let targetIndex: number;

  if (position === "front") {
    targetIndex = siblings.length; // Last = visually on top
    siblings.push(node as unknown as SceneNode);
  } else if (position === "back") {
    targetIndex = 0; // First = visually on bottom
    siblings.unshift(node as unknown as SceneNode);
  } else if (typeof position === "number") {
    targetIndex = Math.max(0, Math.min(position, siblings.length));
    siblings.splice(targetIndex, 0, node as unknown as SceneNode);
  } else {
    // Put it back where it was
    siblings.splice(currentIndex, 0, node as unknown as SceneNode);
    return {
      success: false,
      error:
        "Parameter 'position' must be 'front', 'back', or a number.",
    };
  }

  return {
    success: true,
    data: { nodeId, position: targetIndex },
  };
});
```

### Step 4: Run tests to verify they pass

Run: `npx vitest run plugin/__tests__/layers.test.ts`
Expected: All 28 tests PASS

### Step 5: Commit

```bash
git add plugin/executors/layers.ts plugin/__tests__/layers.test.ts
git commit -m "feat: implement 8 layer executors — create_node, create_text, delete_node, duplicate_node, move_node, resize_node, rename_node, reorder_node"
```

---

## Task 5: Text Executors (5)

**Files:**
- Modify: `plugin/executors/text.ts`
- Create: `plugin/__tests__/text.test.ts`

### Step 1: Write the failing tests

```typescript
// plugin/__tests__/text.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  setupMockFigma,
  teardownMockFigma,
  MockNode,
  registerNode,
} from "../../test/mocks/figma-api.js";
import { getExecutor } from "../executors/index.js";

describe("Text Executors", () => {
  let mockFigma: ReturnType<typeof setupMockFigma>;

  beforeEach(() => {
    mockFigma = setupMockFigma();
  });

  afterEach(() => {
    teardownMockFigma();
  });

  // ============================================================
  // set_text_content
  // ============================================================
  describe("set_text_content", () => {
    it("sets text content on a text node", async () => {
      const textNode = new MockNode({
        id: "10:1",
        name: "Label",
        type: "TEXT",
        characters: "Old text",
        fontName: { family: "Inter", style: "Regular" },
      });
      registerNode(textNode);
      mockFigma.currentPage.appendChild(textNode);

      const exec = getExecutor("set_text_content")!;
      const result = await exec({ nodeId: "10:1", text: "New text" });

      expect(result.success).toBe(true);
      expect(textNode.characters).toBe("New text");
      expect(mockFigma.loadFontAsync).toHaveBeenCalled();
    });

    it("returns error when nodeId is missing", async () => {
      const exec = getExecutor("set_text_content")!;
      const result = await exec({ text: "Hello" });

      expect(result.success).toBe(false);
      expect(result.error).toContain("nodeId");
    });

    it("returns error when text is missing", async () => {
      const textNode = new MockNode({
        id: "10:1",
        type: "TEXT",
        characters: "Old",
      });
      registerNode(textNode);

      const exec = getExecutor("set_text_content")!;
      const result = await exec({ nodeId: "10:1" });

      expect(result.success).toBe(false);
      expect(result.error).toContain("text");
    });

    it("returns error for non-text node", async () => {
      const frame = new MockNode({
        id: "10:1",
        type: "FRAME",
        name: "Frame",
      });
      registerNode(frame);
      mockFigma.currentPage.appendChild(frame);

      const exec = getExecutor("set_text_content")!;
      const result = await exec({ nodeId: "10:1", text: "Hello" });

      expect(result.success).toBe(false);
      expect(result.error).toContain("TEXT");
    });
  });

  // ============================================================
  // set_text_style
  // ============================================================
  describe("set_text_style", () => {
    it("sets font family and size", async () => {
      const textNode = new MockNode({
        id: "10:1",
        type: "TEXT",
        characters: "Styled",
        fontName: { family: "Inter", style: "Regular" },
        fontSize: 16,
      });
      registerNode(textNode);
      mockFigma.currentPage.appendChild(textNode);

      const exec = getExecutor("set_text_style")!;
      const result = await exec({
        nodeId: "10:1",
        fontFamily: "Roboto",
        fontSize: 24,
      });

      expect(result.success).toBe(true);
      expect(mockFigma.loadFontAsync).toHaveBeenCalled();
    });

    it("returns error when nodeId is missing", async () => {
      const exec = getExecutor("set_text_style")!;
      const result = await exec({ fontSize: 24 });

      expect(result.success).toBe(false);
      expect(result.error).toContain("nodeId");
    });

    it("returns error for non-text node", async () => {
      const frame = new MockNode({
        id: "10:1",
        type: "FRAME",
        name: "Frame",
      });
      registerNode(frame);
      mockFigma.currentPage.appendChild(frame);

      const exec = getExecutor("set_text_style")!;
      const result = await exec({ nodeId: "10:1", fontSize: 24 });

      expect(result.success).toBe(false);
      expect(result.error).toContain("TEXT");
    });

    it("returns error when no style params provided", async () => {
      const textNode = new MockNode({
        id: "10:1",
        type: "TEXT",
        characters: "Text",
      });
      registerNode(textNode);
      mockFigma.currentPage.appendChild(textNode);

      const exec = getExecutor("set_text_style")!;
      const result = await exec({ nodeId: "10:1" });

      expect(result.success).toBe(false);
      expect(result.error).toContain("style");
    });
  });

  // ============================================================
  // set_text_color
  // ============================================================
  describe("set_text_color", () => {
    it("sets text color from hex string", async () => {
      const textNode = new MockNode({
        id: "10:1",
        type: "TEXT",
        characters: "Colored",
        fontName: { family: "Inter", style: "Regular" },
      });
      registerNode(textNode);
      mockFigma.currentPage.appendChild(textNode);

      const exec = getExecutor("set_text_color")!;
      const result = await exec({ nodeId: "10:1", color: "#FF0000" });

      expect(result.success).toBe(true);
    });

    it("returns error when color is missing", async () => {
      const textNode = new MockNode({
        id: "10:1",
        type: "TEXT",
        characters: "Text",
      });
      registerNode(textNode);

      const exec = getExecutor("set_text_color")!;
      const result = await exec({ nodeId: "10:1" });

      expect(result.success).toBe(false);
      expect(result.error).toContain("color");
    });

    it("returns error for invalid hex color", async () => {
      const textNode = new MockNode({
        id: "10:1",
        type: "TEXT",
        characters: "Text",
      });
      registerNode(textNode);
      mockFigma.currentPage.appendChild(textNode);

      const exec = getExecutor("set_text_color")!;
      const result = await exec({ nodeId: "10:1", color: "not-a-color" });

      expect(result.success).toBe(false);
      expect(result.error).toContain("hex");
    });

    it("returns error for non-text node", async () => {
      const frame = new MockNode({
        id: "10:1",
        type: "FRAME",
        name: "Frame",
      });
      registerNode(frame);
      mockFigma.currentPage.appendChild(frame);

      const exec = getExecutor("set_text_color")!;
      const result = await exec({ nodeId: "10:1", color: "#FF0000" });

      expect(result.success).toBe(false);
      expect(result.error).toContain("TEXT");
    });
  });

  // ============================================================
  // set_text_alignment
  // ============================================================
  describe("set_text_alignment", () => {
    it("sets horizontal alignment", async () => {
      const textNode = new MockNode({
        id: "10:1",
        type: "TEXT",
        characters: "Aligned",
        fontName: { family: "Inter", style: "Regular" },
      });
      registerNode(textNode);
      mockFigma.currentPage.appendChild(textNode);

      const exec = getExecutor("set_text_alignment")!;
      const result = await exec({ nodeId: "10:1", horizontal: "CENTER" });

      expect(result.success).toBe(true);
      expect(textNode.textAlignHorizontal).toBe("CENTER");
    });

    it("sets vertical alignment", async () => {
      const textNode = new MockNode({
        id: "10:1",
        type: "TEXT",
        characters: "Aligned",
        fontName: { family: "Inter", style: "Regular" },
      });
      registerNode(textNode);
      mockFigma.currentPage.appendChild(textNode);

      const exec = getExecutor("set_text_alignment")!;
      const result = await exec({ nodeId: "10:1", vertical: "CENTER" });

      expect(result.success).toBe(true);
      expect(textNode.textAlignVertical).toBe("CENTER");
    });

    it("sets both alignments", async () => {
      const textNode = new MockNode({
        id: "10:1",
        type: "TEXT",
        characters: "Aligned",
        fontName: { family: "Inter", style: "Regular" },
      });
      registerNode(textNode);
      mockFigma.currentPage.appendChild(textNode);

      const exec = getExecutor("set_text_alignment")!;
      const result = await exec({
        nodeId: "10:1",
        horizontal: "RIGHT",
        vertical: "BOTTOM",
      });

      expect(result.success).toBe(true);
      expect(textNode.textAlignHorizontal).toBe("RIGHT");
      expect(textNode.textAlignVertical).toBe("BOTTOM");
    });

    it("returns error for invalid horizontal value", async () => {
      const textNode = new MockNode({
        id: "10:1",
        type: "TEXT",
        characters: "Text",
      });
      registerNode(textNode);
      mockFigma.currentPage.appendChild(textNode);

      const exec = getExecutor("set_text_alignment")!;
      const result = await exec({ nodeId: "10:1", horizontal: "INVALID" });

      expect(result.success).toBe(false);
      expect(result.error).toContain("horizontal");
    });

    it("returns error for invalid vertical value", async () => {
      const textNode = new MockNode({
        id: "10:1",
        type: "TEXT",
        characters: "Text",
      });
      registerNode(textNode);
      mockFigma.currentPage.appendChild(textNode);

      const exec = getExecutor("set_text_alignment")!;
      const result = await exec({ nodeId: "10:1", vertical: "INVALID" });

      expect(result.success).toBe(false);
      expect(result.error).toContain("vertical");
    });

    it("returns error when no alignment params provided", async () => {
      const textNode = new MockNode({
        id: "10:1",
        type: "TEXT",
        characters: "Text",
      });
      registerNode(textNode);
      mockFigma.currentPage.appendChild(textNode);

      const exec = getExecutor("set_text_alignment")!;
      const result = await exec({ nodeId: "10:1" });

      expect(result.success).toBe(false);
      expect(result.error).toContain("alignment");
    });
  });

  // ============================================================
  // find_replace_text
  // ============================================================
  describe("find_replace_text", () => {
    it("finds and replaces text in all text nodes on the page", async () => {
      const text1 = new MockNode({
        id: "10:1",
        type: "TEXT",
        characters: "Hello World",
        fontName: { family: "Inter", style: "Regular" },
      });
      const text2 = new MockNode({
        id: "10:2",
        type: "TEXT",
        characters: "Hello Figma",
        fontName: { family: "Inter", style: "Regular" },
      });
      registerNode(text1);
      registerNode(text2);
      mockFigma.currentPage.children = [text1, text2];

      const exec = getExecutor("find_replace_text")!;
      const result = await exec({
        pattern: "Hello",
        replacement: "Hi",
        scope: "page",
      });

      expect(result.success).toBe(true);
      expect(text1.characters).toBe("Hi World");
      expect(text2.characters).toBe("Hi Figma");
      const data = result.data as Record<string, unknown>;
      expect(data.replacedCount).toBe(2);
    });

    it("finds and replaces with regex support", async () => {
      const text1 = new MockNode({
        id: "10:1",
        type: "TEXT",
        characters: "Item 123",
        fontName: { family: "Inter", style: "Regular" },
      });
      registerNode(text1);
      mockFigma.currentPage.children = [text1];

      const exec = getExecutor("find_replace_text")!;
      const result = await exec({
        pattern: "\\d+",
        replacement: "999",
        scope: "page",
        regex: true,
      });

      expect(result.success).toBe(true);
      expect(text1.characters).toBe("Item 999");
    });

    it("scopes replacement to a specific node and its children", async () => {
      const inner = new MockNode({
        id: "10:2",
        type: "TEXT",
        characters: "Hello Inside",
        fontName: { family: "Inter", style: "Regular" },
      });
      const container = new MockNode({
        id: "10:1",
        type: "FRAME",
        name: "Container",
        children: [inner],
      });
      const outside = new MockNode({
        id: "10:3",
        type: "TEXT",
        characters: "Hello Outside",
        fontName: { family: "Inter", style: "Regular" },
      });
      registerNode(container);
      registerNode(outside);
      mockFigma.currentPage.children = [container, outside];

      const exec = getExecutor("find_replace_text")!;
      const result = await exec({
        pattern: "Hello",
        replacement: "Hi",
        scope: "10:1",
      });

      expect(result.success).toBe(true);
      expect(inner.characters).toBe("Hi Inside");
      expect(outside.characters).toBe("Hello Outside"); // Unchanged
    });

    it("returns error when pattern is missing", async () => {
      const exec = getExecutor("find_replace_text")!;
      const result = await exec({ replacement: "Hi", scope: "page" });

      expect(result.success).toBe(false);
      expect(result.error).toContain("pattern");
    });

    it("returns error when replacement is missing", async () => {
      const exec = getExecutor("find_replace_text")!;
      const result = await exec({ pattern: "Hello", scope: "page" });

      expect(result.success).toBe(false);
      expect(result.error).toContain("replacement");
    });

    it("returns error when scope is missing", async () => {
      const exec = getExecutor("find_replace_text")!;
      const result = await exec({ pattern: "Hello", replacement: "Hi" });

      expect(result.success).toBe(false);
      expect(result.error).toContain("scope");
    });

    it("handles zero matches gracefully", async () => {
      const text1 = new MockNode({
        id: "10:1",
        type: "TEXT",
        characters: "No match here",
        fontName: { family: "Inter", style: "Regular" },
      });
      registerNode(text1);
      mockFigma.currentPage.children = [text1];

      const exec = getExecutor("find_replace_text")!;
      const result = await exec({
        pattern: "ZZZZZ",
        replacement: "Y",
        scope: "page",
      });

      expect(result.success).toBe(true);
      const data = result.data as Record<string, unknown>;
      expect(data.replacedCount).toBe(0);
    });
  });
});
```

### Step 2: Run tests to verify they fail

Run: `npx vitest run plugin/__tests__/text.test.ts`
Expected: FAIL -- executors throw "Not implemented"

### Step 3: Write the implementation

```typescript
// plugin/executors/text.ts
import { registerExecutor } from "./index.js";

// ============================================================
// Helpers
// ============================================================

const NODE_ID_PATTERN = /^\d+:\d+$/;

const VALID_HORIZONTAL_ALIGN = ["LEFT", "CENTER", "RIGHT", "JUSTIFIED"];
const VALID_VERTICAL_ALIGN = ["TOP", "CENTER", "BOTTOM"];

function validateNodeId(nodeId: unknown): string | null {
  if (typeof nodeId !== "string" || !nodeId) {
    return "Required parameter 'nodeId' is missing or not a string.";
  }
  if (!NODE_ID_PATTERN.test(nodeId)) {
    return `Invalid node ID format '${nodeId}'. Expected format: '123:456'.`;
  }
  return null;
}

function getTextNodeOrError(nodeId: string): {
  node?: TextNode;
  error?: string;
} {
  const validationError = validateNodeId(nodeId);
  if (validationError) return { error: validationError };

  const node = figma.getNodeById(nodeId);
  if (!node) {
    return { error: `Node '${nodeId}' not found. It may have been deleted.` };
  }
  if (node.type !== "TEXT") {
    return {
      error: `Node '${nodeId}' is a ${node.type}, not a TEXT node. This command only works on text layers.`,
    };
  }
  return { node: node as unknown as TextNode };
}

function hexToRgb(
  hex: string
): { r: number; g: number; b: number } | null {
  const match = hex.match(/^#?([0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/);
  if (!match) return null;
  const h = match[1];
  return {
    r: parseInt(h.substring(0, 2), 16) / 255,
    g: parseInt(h.substring(2, 4), 16) / 255,
    b: parseInt(h.substring(4, 6), 16) / 255,
  };
}

// ============================================================
// set_text_content
// ============================================================

registerExecutor("set_text_content", async (params) => {
  const nodeId = params.nodeId as string | undefined;
  const text = params.text as string | undefined;

  if (!nodeId) {
    return {
      success: false,
      error: "Required parameter 'nodeId' is missing.",
    };
  }

  if (typeof text !== "string") {
    return {
      success: false,
      error:
        "Required parameter 'text' is missing. Provide the new text content.",
    };
  }

  const { node, error } = getTextNodeOrError(nodeId);
  if (error) return { success: false, error };

  // Must load font before modifying text
  const fontName = node!.fontName as FontName;
  await figma.loadFontAsync(fontName);

  node!.characters = text;

  return {
    success: true,
    data: { nodeId, characters: text },
  };
});

// ============================================================
// set_text_style
// ============================================================

registerExecutor("set_text_style", async (params) => {
  const nodeId = params.nodeId as string | undefined;

  if (!nodeId) {
    return {
      success: false,
      error: "Required parameter 'nodeId' is missing.",
    };
  }

  const { node, error } = getTextNodeOrError(nodeId);
  if (error) return { success: false, error };

  const fontFamily = params.fontFamily as string | undefined;
  const fontSize = params.fontSize as number | undefined;
  const fontWeight = params.fontWeight as string | undefined;
  const lineHeight = params.lineHeight as number | undefined;
  const letterSpacing = params.letterSpacing as number | undefined;

  const hasAnyStyle =
    fontFamily !== undefined ||
    fontSize !== undefined ||
    fontWeight !== undefined ||
    lineHeight !== undefined ||
    letterSpacing !== undefined;

  if (!hasAnyStyle) {
    return {
      success: false,
      error:
        "No style parameters provided. Provide at least one of: fontFamily, fontSize, fontWeight, lineHeight, letterSpacing.",
    };
  }

  const currentFontName = node!.fontName as FontName;
  const newFamily = fontFamily ?? currentFontName.family;
  const newStyle = fontWeight ?? currentFontName.style;

  // Load the target font
  await figma.loadFontAsync({ family: newFamily, style: newStyle });

  const len = node!.characters.length;

  if (fontFamily || fontWeight) {
    node!.setRangeFontName(0, len, {
      family: newFamily,
      style: newStyle,
    });
  }

  if (typeof fontSize === "number") {
    node!.setRangeFontSize(0, len, fontSize);
  }

  if (typeof lineHeight === "number") {
    node!.setRangeLineHeight(0, len, {
      value: lineHeight,
      unit: "PIXELS",
    });
  }

  if (typeof letterSpacing === "number") {
    node!.setRangeLetterSpacing(0, len, {
      value: letterSpacing,
      unit: "PIXELS",
    });
  }

  return {
    success: true,
    data: {
      nodeId,
      fontFamily: newFamily,
      fontStyle: newStyle,
      fontSize: fontSize ?? node!.fontSize,
    },
  };
});

// ============================================================
// set_text_color
// ============================================================

registerExecutor("set_text_color", async (params) => {
  const nodeId = params.nodeId as string | undefined;
  const color = params.color as string | undefined;

  if (!nodeId) {
    return {
      success: false,
      error: "Required parameter 'nodeId' is missing.",
    };
  }

  if (!color) {
    return {
      success: false,
      error:
        "Required parameter 'color' is missing. Provide a hex color string (e.g., '#FF0000').",
    };
  }

  const { node, error } = getTextNodeOrError(nodeId);
  if (error) return { success: false, error };

  const rgb = hexToRgb(color);
  if (!rgb) {
    return {
      success: false,
      error: `Invalid hex color '${color}'. Expected format: '#RRGGBB' or '#RRGGBBAA' (e.g., '#FF0000').`,
    };
  }

  // Load font before modifying
  const fontName = node!.fontName as FontName;
  await figma.loadFontAsync(fontName);

  const len = node!.characters.length;
  node!.setRangeFills(0, len, [
    { type: "SOLID", color: rgb, visible: true },
  ]);

  return {
    success: true,
    data: { nodeId, color },
  };
});

// ============================================================
// set_text_alignment
// ============================================================

registerExecutor("set_text_alignment", async (params) => {
  const nodeId = params.nodeId as string | undefined;
  const horizontal = params.horizontal as string | undefined;
  const vertical = params.vertical as string | undefined;

  if (!nodeId) {
    return {
      success: false,
      error: "Required parameter 'nodeId' is missing.",
    };
  }

  if (!horizontal && !vertical) {
    return {
      success: false,
      error:
        "No alignment parameters provided. Provide at least one of: 'horizontal' (LEFT, CENTER, RIGHT, JUSTIFIED) or 'vertical' (TOP, CENTER, BOTTOM).",
    };
  }

  if (horizontal && !VALID_HORIZONTAL_ALIGN.includes(horizontal)) {
    return {
      success: false,
      error: `Invalid horizontal alignment '${horizontal}'. Must be one of: ${VALID_HORIZONTAL_ALIGN.join(", ")}.`,
    };
  }

  if (vertical && !VALID_VERTICAL_ALIGN.includes(vertical)) {
    return {
      success: false,
      error: `Invalid vertical alignment '${vertical}'. Must be one of: ${VALID_VERTICAL_ALIGN.join(", ")}.`,
    };
  }

  const { node, error } = getTextNodeOrError(nodeId);
  if (error) return { success: false, error };

  if (horizontal) {
    (node as unknown as Record<string, unknown>).textAlignHorizontal =
      horizontal;
  }
  if (vertical) {
    (node as unknown as Record<string, unknown>).textAlignVertical = vertical;
  }

  return {
    success: true,
    data: {
      nodeId,
      textAlignHorizontal: (node as unknown as Record<string, unknown>)
        .textAlignHorizontal,
      textAlignVertical: (node as unknown as Record<string, unknown>)
        .textAlignVertical,
    },
  };
});

// ============================================================
// find_replace_text
// ============================================================

registerExecutor("find_replace_text", async (params) => {
  const pattern = params.pattern as string | undefined;
  const replacement = params.replacement as string | undefined;
  const scope = params.scope as string | undefined;
  const useRegex = params.regex === true;

  if (typeof pattern !== "string") {
    return {
      success: false,
      error:
        "Required parameter 'pattern' is missing. Provide the text to find.",
    };
  }

  if (typeof replacement !== "string") {
    return {
      success: false,
      error:
        "Required parameter 'replacement' is missing. Provide the replacement text.",
    };
  }

  if (!scope) {
    return {
      success: false,
      error:
        "Required parameter 'scope' is missing. Use 'file', 'page', or a node ID to scope the search.",
    };
  }

  // Determine the search root
  let searchRoot: BaseNode;

  if (scope === "file" || scope === "page") {
    searchRoot = figma.currentPage;
  } else {
    // scope is a node ID
    const validationError = validateNodeId(scope);
    if (validationError) return { success: false, error: validationError };

    const scopeNode = figma.getNodeById(scope);
    if (!scopeNode) {
      return {
        success: false,
        error: `Scope node '${scope}' not found.`,
      };
    }
    searchRoot = scopeNode;
  }

  // Find all text nodes under the search root
  let textNodes: BaseNode[];

  if ("findAll" in searchRoot) {
    textNodes = (searchRoot as ChildrenMixin).findAll(
      (node: BaseNode) => node.type === "TEXT"
    );
  } else if (searchRoot.type === "TEXT") {
    textNodes = [searchRoot];
  } else {
    textNodes = [];
  }

  let replacedCount = 0;
  const replacedNodes: { nodeId: string; oldText: string; newText: string }[] =
    [];

  for (const textNode of textNodes) {
    const tn = textNode as unknown as {
      id: string;
      characters: string;
      fontName: FontName;
    };
    const oldText = tn.characters;
    let newText: string;

    if (useRegex) {
      const regex = new RegExp(pattern, "g");
      newText = oldText.replace(regex, replacement);
    } else {
      newText = oldText.split(pattern).join(replacement);
    }

    if (newText !== oldText) {
      // Load font before modifying
      await figma.loadFontAsync(tn.fontName);
      tn.characters = newText;
      replacedCount++;
      replacedNodes.push({
        nodeId: tn.id,
        oldText,
        newText,
      });
    }
  }

  return {
    success: true,
    data: {
      replacedCount,
      replacedNodes,
    },
  };
});
```

### Step 4: Run tests to verify they pass

Run: `npx vitest run plugin/__tests__/text.test.ts`
Expected: All 18 tests PASS

### Step 5: Commit

```bash
git add plugin/executors/text.ts plugin/__tests__/text.test.ts
git commit -m "feat: implement 5 text executors — set_text_content, set_text_style, set_text_color, set_text_alignment, find_replace_text"
```

---

## Task 6: Wire Executors into Plugin code.ts

**Files:**
- Modify: `plugin/code.ts`

### Step 1: Update the executeCommand function in plugin/code.ts

Replace the `executeCommand` function stub with a version that uses the executor registry. Find this block in `plugin/code.ts`:

```typescript
async function executeCommand(command: Command): Promise<CommandResponse> {
  // This will be filled in by executor imports in Phase 2+
  // For now, return a "not implemented" response
  sendToUI({ type: "commandExecuted", command: command.type });

  return {
    id: command.id,
    success: false,
    error: `Command '${command.type}' is not yet implemented. Available in a future phase.`,
  };
}
```

Replace it with:

```typescript
// ============================================================
// Executor Registry Import
// ============================================================

// Import executor types and registry
type ExecutorFn = (
  params: Record<string, unknown>
) => Promise<{ success: boolean; data?: unknown; error?: string }>;

const executorRegistry = new Map<string, ExecutorFn>();

function registerExecutor(name: string, fn: ExecutorFn): void {
  executorRegistry.set(name, fn);
}

// ============================================================
// Inline Executor Registrations
// ============================================================
// NOTE: In the plugin build (esbuild IIFE bundle), we inline the
// executor registrations directly rather than using ES module imports.
// This is because the Figma plugin runs as a single IIFE bundle.
// The executor code from plugin/executors/*.ts is bundled into this
// file by esbuild. The import statements in plugin/executors/index.ts
// pull in reading.ts, layers.ts, and text.ts automatically.

// This will be resolved by esbuild bundling — the imports in
// plugin/executors/index.ts trigger side-effect registrations.
import "./executors/index.js";

// ============================================================
// Command Execution
// ============================================================

async function executeCommand(command: Command): Promise<CommandResponse> {
  const executor = executorRegistry.get(command.type);

  if (!executor) {
    sendToUI({ type: "commandError", command: command.type, error: "Not implemented" });
    return {
      id: command.id,
      success: false,
      error: `Command '${command.type}' is not yet implemented. It will be available in a future phase.`,
    };
  }

  try {
    const result = await executor(command.params);
    sendToUI({ type: "commandExecuted", command: command.type });
    return {
      id: command.id,
      success: result.success,
      data: result.data,
      error: result.error,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    sendToUI({ type: "commandError", command: command.type, error: errorMessage });
    return {
      id: command.id,
      success: false,
      error: errorMessage,
    };
  }
}
```

**Important:** Since the plugin is bundled by esbuild as a single IIFE, the executor files need to reference the `registerExecutor` function from the same scope. Update `plugin/executors/index.ts` to export the registry from the main scope instead:

Replace the contents of `plugin/executors/index.ts` with:

```typescript
// plugin/executors/index.ts
//
// This file re-exports the registry type and triggers all executor
// registrations via side-effect imports.
//
// The actual registerExecutor function and executorRegistry map live
// in the plugin/code.ts scope. In the esbuild bundle, all files share
// the same IIFE scope, so the executors can call registerExecutor directly.
//
// For TESTING (vitest, not bundled), we define a standalone registry here.

export type ExecutorFn = (
  params: Record<string, unknown>
) => Promise<{ success: boolean; data?: unknown; error?: string }>;

// Standalone registry for testing (in the bundled plugin, code.ts provides this)
export const executorRegistry = new Map<string, ExecutorFn>();

export function registerExecutor(name: string, fn: ExecutorFn): void {
  executorRegistry.set(name, fn);
}

export function getExecutor(name: string): ExecutorFn | undefined {
  return executorRegistry.get(name);
}

// Side-effect imports: each file calls registerExecutor(...)
import "./reading.js";
import "./layers.js";
import "./text.js";
```

### Step 2: Build the plugin

Run: `node scripts/build-plugin.js`
Expected: "Plugin built successfully -> plugin/code.js"

### Step 3: Run all tests

Run: `npx vitest run`
Expected: All tests pass (registry, reading, layers, text)

### Step 4: Commit

```bash
git add plugin/code.ts plugin/executors/index.ts
git commit -m "feat: wire executor registry into plugin command handler — 18 commands now functional"
```

---

## Task 7: Integration Tests

**Files:**
- Create: `test/integration/phase2-commands.test.ts`

### Step 1: Write the integration test

```typescript
// test/integration/phase2-commands.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { WebSocketManager } from "../../src/server/websocket.js";
import { FigmaMcpServer } from "../../src/server/mcp.js";
import WebSocket from "ws";
import {
  setupMockFigma,
  teardownMockFigma,
  MockNode,
  registerNode,
} from "../mocks/figma-api.js";
import { getExecutor } from "../../plugin/executors/index.js";

describe("Phase 2 Integration: Command Flow", () => {
  let wsManager: WebSocketManager;
  let mcpServer: FigmaMcpServer;

  beforeEach(async () => {
    wsManager = new WebSocketManager();
    await wsManager.start(0);
    mcpServer = new FigmaMcpServer(wsManager);
  });

  afterEach(async () => {
    await wsManager.close();
  });

  it("routes a reading command through the full stack", async () => {
    const port = wsManager.port;
    const queue = mcpServer.getQueue();

    // Connect mock plugin
    const client = new WebSocket(`ws://localhost:${port}`);
    await new Promise<void>((resolve) => client.on("open", resolve));

    client.send(
      JSON.stringify({
        type: "handshake",
        fileInfo: { name: "Test", id: "f1", pages: [], nodeCount: 10 },
      })
    );

    await new Promise<void>((resolve) => {
      client.on("message", (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === "handshake_ack") resolve();
      });
    });

    // Plugin simulates executor: when it receives get_selection, respond
    client.on("message", (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === "command") {
        const cmd = msg.payload;
        if (cmd.type === "get_selection") {
          client.send(
            JSON.stringify({
              type: "response",
              payload: {
                id: cmd.id,
                success: true,
                data: { nodes: [] },
              },
            })
          );
        }
      }
    });

    const result = await queue.enqueue("get_selection", {});
    expect(result.success).toBe(true);
    expect((result.data as Record<string, unknown>).nodes).toBeDefined();

    client.close();
  });

  it("routes a layer command through the full stack", async () => {
    const port = wsManager.port;
    const queue = mcpServer.getQueue();

    const client = new WebSocket(`ws://localhost:${port}`);
    await new Promise<void>((resolve) => client.on("open", resolve));

    client.send(
      JSON.stringify({
        type: "handshake",
        fileInfo: { name: "Test", id: "f1", pages: [], nodeCount: 0 },
      })
    );

    await new Promise<void>((resolve) => {
      client.on("message", (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === "handshake_ack") resolve();
      });
    });

    client.on("message", (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === "command") {
        const cmd = msg.payload;
        if (cmd.type === "create_node") {
          client.send(
            JSON.stringify({
              type: "response",
              payload: {
                id: cmd.id,
                success: true,
                data: {
                  nodeId: "100:1",
                  type: cmd.params.type,
                  name: cmd.params.name ?? "Frame",
                },
              },
            })
          );
        }
      }
    });

    const result = await queue.enqueue("create_node", {
      type: "FRAME",
      name: "Test Frame",
      width: 320,
      height: 200,
    });

    expect(result.success).toBe(true);
    const data = result.data as Record<string, unknown>;
    expect(data.nodeId).toBe("100:1");
    expect(data.type).toBe("FRAME");

    client.close();
  });

  it("routes a text command through the full stack", async () => {
    const port = wsManager.port;
    const queue = mcpServer.getQueue();

    const client = new WebSocket(`ws://localhost:${port}`);
    await new Promise<void>((resolve) => client.on("open", resolve));

    client.send(
      JSON.stringify({
        type: "handshake",
        fileInfo: { name: "Test", id: "f1", pages: [], nodeCount: 0 },
      })
    );

    await new Promise<void>((resolve) => {
      client.on("message", (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === "handshake_ack") resolve();
      });
    });

    client.on("message", (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === "command") {
        const cmd = msg.payload;
        if (cmd.type === "set_text_content") {
          client.send(
            JSON.stringify({
              type: "response",
              payload: {
                id: cmd.id,
                success: true,
                data: {
                  nodeId: cmd.params.nodeId,
                  characters: cmd.params.text,
                },
              },
            })
          );
        }
      }
    });

    const result = await queue.enqueue("set_text_content", {
      nodeId: "50:1",
      text: "Updated text",
    });

    expect(result.success).toBe(true);
    const data = result.data as Record<string, unknown>;
    expect(data.characters).toBe("Updated text");

    client.close();
  });
});

describe("Phase 2 Integration: Executor Unit Coverage", () => {
  let mockFigma: ReturnType<typeof setupMockFigma>;

  beforeEach(() => {
    mockFigma = setupMockFigma();
  });

  afterEach(() => {
    teardownMockFigma();
  });

  it("all 18 executors are registered and callable", () => {
    const commands = [
      "get_node",
      "get_selection",
      "get_page_nodes",
      "search_nodes",
      "scroll_to_node",
      "create_node",
      "create_text",
      "delete_node",
      "duplicate_node",
      "move_node",
      "resize_node",
      "rename_node",
      "reorder_node",
      "set_text_content",
      "set_text_style",
      "set_text_color",
      "set_text_alignment",
      "find_replace_text",
    ];

    for (const cmd of commands) {
      const executor = getExecutor(cmd);
      expect(executor, `Executor for '${cmd}' not found`).toBeDefined();
    }
  });

  it("create_node + get_node round-trip works", async () => {
    const createExec = getExecutor("create_node")!;
    const createResult = await createExec({
      type: "FRAME",
      name: "RoundTrip",
      x: 10,
      y: 20,
      width: 300,
      height: 150,
    });

    expect(createResult.success).toBe(true);
    const nodeId = (createResult.data as Record<string, unknown>)
      .nodeId as string;

    const getExec = getExecutor("get_node")!;
    const getResult = await getExec({ nodeId, depth: 0 });

    expect(getResult.success).toBe(true);
    const data = getResult.data as Record<string, unknown>;
    expect(data.name).toBe("RoundTrip");
    expect(data.type).toBe("FRAME");
  });

  it("create_text + set_text_content round-trip works", async () => {
    const createExec = getExecutor("create_text")!;
    const createResult = await createExec({ text: "Original" });

    expect(createResult.success).toBe(true);
    const nodeId = (createResult.data as Record<string, unknown>)
      .nodeId as string;

    const setExec = getExecutor("set_text_content")!;
    const setResult = await setExec({ nodeId, text: "Modified" });

    expect(setResult.success).toBe(true);

    const getExec = getExecutor("get_node")!;
    const getResult = await getExec({ nodeId });

    expect(getResult.success).toBe(true);
    expect(
      (getResult.data as Record<string, unknown>).characters
    ).toBe("Modified");
  });

  it("create_node + rename_node + delete_node lifecycle", async () => {
    const createExec = getExecutor("create_node")!;
    const createResult = await createExec({ type: "RECTANGLE", name: "Temp" });
    const nodeId = (createResult.data as Record<string, unknown>)
      .nodeId as string;

    const renameExec = getExecutor("rename_node")!;
    const renameResult = await renameExec({ nodeId, name: "Renamed" });
    expect(renameResult.success).toBe(true);
    expect(
      (renameResult.data as Record<string, unknown>).newName
    ).toBe("Renamed");

    const deleteExec = getExecutor("delete_node")!;
    const deleteResult = await deleteExec({ nodeId });
    expect(deleteResult.success).toBe(true);

    // Verify it's gone
    const getExec = getExecutor("get_node")!;
    const getResult = await getExec({ nodeId });
    expect(getResult.success).toBe(false);
  });
});
```

### Step 2: Run the integration tests

Run: `npx vitest run test/integration/phase2-commands.test.ts`
Expected: All 7 tests PASS

### Step 3: Run the full test suite

Run: `npx vitest run`
Expected: All tests pass across all files:
- `plugin/__tests__/registry.test.ts` — 3 tests
- `plugin/__tests__/reading.test.ts` — 14 tests
- `plugin/__tests__/layers.test.ts` — 28 tests
- `plugin/__tests__/text.test.ts` — 18 tests
- `test/integration/phase2-commands.test.ts` — 7 tests
- (Plus Phase 1 tests if already implemented)

### Step 4: Commit

```bash
git add test/integration/phase2-commands.test.ts
git commit -m "test: add Phase 2 integration tests — full-stack command flow and executor round-trip verification"
```

---

## Task 8: Run All Tests + Final Verification

### Step 1: Run the full test suite

Run: `npx vitest run`
Expected: All tests pass

### Step 2: Run typecheck

Run: `npx tsc --noEmit --project tsconfig.json`
Expected: No errors

### Step 3: Verify plugin builds

Run: `node scripts/build-plugin.js`
Expected: "Plugin built successfully -> plugin/code.js"

---

## Phase 2 Complete

At this point you have:
- Figma Plugin API mock (`test/mocks/figma-api.ts`) with node registry, create methods, page simulation
- Executor registry (`plugin/executors/index.ts`) with registration pattern and lookup
- 5 reading executors: get_node, get_selection, get_page_nodes, search_nodes, scroll_to_node
- 8 layer executors: create_node, create_text, delete_node, duplicate_node, move_node, resize_node, rename_node, reorder_node
- 5 text executors: set_text_content, set_text_style, set_text_color, set_text_alignment, find_replace_text
- Plugin code.ts wired to executor registry — 18 commands now functional
- 70+ unit tests covering all executors with parameter validation and error cases
- Integration tests verifying full-stack command flow and executor round-trips

**Next:** Phase 3 — implement styling tools (8) and layout tools (5) to make 31 tools functional.
