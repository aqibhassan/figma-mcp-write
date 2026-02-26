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
