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
