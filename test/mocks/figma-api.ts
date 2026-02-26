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
    // Remove from current parent first (matches real Figma behavior)
    if (child.parent) {
      const idx = child.parent.children.indexOf(child);
      if (idx !== -1) child.parent.children.splice(idx, 1);
    }
    child.parent = this;
    this.children.push(child);
  }

  insertChild(index: number, child: MockNode): void {
    // Remove from current parent first (matches real Figma behavior)
    if (child.parent) {
      const idx = child.parent.children.indexOf(child);
      if (idx !== -1) child.parent.children.splice(idx, 1);
    }
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
      const node = nodeRegistry.get(id) ?? null;
      // Return null for removed nodes (simulates real Figma behavior)
      if (node && node.removed) return null;
      return node;
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
