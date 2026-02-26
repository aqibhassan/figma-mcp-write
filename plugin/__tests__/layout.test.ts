// plugin/__tests__/layout.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// ============================================================
// Mock Figma API
// ============================================================

function createMockFrame(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "1:2",
    type: "FRAME",
    name: "Test Frame",
    layoutMode: "NONE",
    primaryAxisSizingMode: "FIXED",
    counterAxisSizingMode: "FIXED",
    primaryAxisAlignItems: "MIN",
    counterAxisAlignItems: "MIN",
    layoutWrap: "NO_WRAP",
    itemSpacing: 0,
    paddingTop: 0,
    paddingRight: 0,
    paddingBottom: 0,
    paddingLeft: 0,
    layoutGrids: [],
    children: [],
    parent: { id: "0:1", type: "PAGE", children: [] },
    appendChild: vi.fn(),
    insertChild: vi.fn(),
    ...overrides,
  };
}

function createMockNode(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "2:1",
    type: "RECTANGLE",
    name: "Test Node",
    parent: null,
    ...overrides,
  };
}

const mockFigma = {
  getNodeById: vi.fn(),
  group: vi.fn(),
  createFrame: vi.fn(),
  currentPage: {
    id: "0:1",
    type: "PAGE",
    children: [],
    appendChild: vi.fn(),
  },
};

vi.stubGlobal("figma", mockFigma);

import { executeLayoutCommand } from "../executors/layout.js";

describe("Layout Executors", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================
  // set_auto_layout
  // ============================================================

  describe("set_auto_layout", () => {
    it("sets auto-layout direction to VERTICAL", async () => {
      const frame = createMockFrame();
      mockFigma.getNodeById.mockReturnValue(frame);

      const result = await executeLayoutCommand("set_auto_layout", {
        nodeId: "1:2",
        direction: "VERTICAL",
      });

      expect(result.success).toBe(true);
      expect(frame.layoutMode).toBe("VERTICAL");
    });

    it("sets auto-layout direction to HORIZONTAL", async () => {
      const frame = createMockFrame();
      mockFigma.getNodeById.mockReturnValue(frame);

      const result = await executeLayoutCommand("set_auto_layout", {
        nodeId: "1:2",
        direction: "HORIZONTAL",
      });

      expect(result.success).toBe(true);
      expect(frame.layoutMode).toBe("HORIZONTAL");
    });

    it("sets spacing", async () => {
      const frame = createMockFrame();
      mockFigma.getNodeById.mockReturnValue(frame);

      const result = await executeLayoutCommand("set_auto_layout", {
        nodeId: "1:2",
        direction: "VERTICAL",
        spacing: 16,
      });

      expect(result.success).toBe(true);
      expect(frame.itemSpacing).toBe(16);
    });

    it("sets padding", async () => {
      const frame = createMockFrame();
      mockFigma.getNodeById.mockReturnValue(frame);

      const result = await executeLayoutCommand("set_auto_layout", {
        nodeId: "1:2",
        direction: "VERTICAL",
        paddingTop: 10,
        paddingRight: 20,
        paddingBottom: 10,
        paddingLeft: 20,
      });

      expect(result.success).toBe(true);
      expect(frame.paddingTop).toBe(10);
      expect(frame.paddingRight).toBe(20);
      expect(frame.paddingBottom).toBe(10);
      expect(frame.paddingLeft).toBe(20);
    });

    it("sets primary and counter axis sizing", async () => {
      const frame = createMockFrame();
      mockFigma.getNodeById.mockReturnValue(frame);

      const result = await executeLayoutCommand("set_auto_layout", {
        nodeId: "1:2",
        direction: "VERTICAL",
        primarySizing: "HUG",
        counterSizing: "FILL",
      });

      expect(result.success).toBe(true);
      expect(frame.primaryAxisSizingMode).toBe("AUTO");
      expect(frame.counterAxisSizingMode).toBe("FIXED");
    });

    it("sets wrap mode", async () => {
      const frame = createMockFrame();
      mockFigma.getNodeById.mockReturnValue(frame);

      const result = await executeLayoutCommand("set_auto_layout", {
        nodeId: "1:2",
        direction: "HORIZONTAL",
        wrap: true,
      });

      expect(result.success).toBe(true);
      expect(frame.layoutWrap).toBe("WRAP");
    });

    it("sets alignment", async () => {
      const frame = createMockFrame();
      mockFigma.getNodeById.mockReturnValue(frame);

      const result = await executeLayoutCommand("set_auto_layout", {
        nodeId: "1:2",
        direction: "VERTICAL",
        alignment: "CENTER",
      });

      expect(result.success).toBe(true);
      expect(frame.counterAxisAlignItems).toBe("CENTER");
    });

    it("errors on non-frame node", async () => {
      const node = createMockNode({ type: "RECTANGLE" });
      mockFigma.getNodeById.mockReturnValue(node);

      const result = await executeLayoutCommand("set_auto_layout", {
        nodeId: "2:1",
        direction: "VERTICAL",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("FRAME");
    });

    it("errors on invalid direction", async () => {
      const frame = createMockFrame();
      mockFigma.getNodeById.mockReturnValue(frame);

      const result = await executeLayoutCommand("set_auto_layout", {
        nodeId: "1:2",
        direction: "DIAGONAL",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("direction");
    });

    it("errors on missing nodeId", async () => {
      const result = await executeLayoutCommand("set_auto_layout", {
        direction: "VERTICAL",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("nodeId");
    });
  });

  // ============================================================
  // add_to_auto_layout
  // ============================================================

  describe("add_to_auto_layout", () => {
    it("adds a child to an auto-layout frame", async () => {
      const child = createMockNode({ id: "3:1" });
      const frame = createMockFrame({
        layoutMode: "VERTICAL",
        children: [],
      });

      mockFigma.getNodeById.mockImplementation((id: string) => {
        if (id === "1:2") return frame;
        if (id === "3:1") return child;
        return null;
      });

      const result = await executeLayoutCommand("add_to_auto_layout", {
        parentId: "1:2",
        childId: "3:1",
      });

      expect(result.success).toBe(true);
      expect(frame.appendChild).toHaveBeenCalledWith(child);
    });

    it("inserts a child at a specific index", async () => {
      const child = createMockNode({ id: "3:1" });
      const frame = createMockFrame({
        layoutMode: "VERTICAL",
        children: [{ id: "4:1" }],
      });

      mockFigma.getNodeById.mockImplementation((id: string) => {
        if (id === "1:2") return frame;
        if (id === "3:1") return child;
        return null;
      });

      const result = await executeLayoutCommand("add_to_auto_layout", {
        parentId: "1:2",
        childId: "3:1",
        index: 0,
      });

      expect(result.success).toBe(true);
      expect(frame.insertChild).toHaveBeenCalledWith(0, child);
    });

    it("errors on missing parentId", async () => {
      const result = await executeLayoutCommand("add_to_auto_layout", {
        childId: "3:1",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("parentId");
    });

    it("errors on missing childId", async () => {
      const result = await executeLayoutCommand("add_to_auto_layout", {
        parentId: "1:2",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("childId");
    });

    it("errors when parent is not found", async () => {
      mockFigma.getNodeById.mockReturnValue(null);

      const result = await executeLayoutCommand("add_to_auto_layout", {
        parentId: "999:999",
        childId: "3:1",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });

    it("errors when child is not found", async () => {
      const frame = createMockFrame();
      mockFigma.getNodeById.mockImplementation((id: string) => {
        if (id === "1:2") return frame;
        return null;
      });

      const result = await executeLayoutCommand("add_to_auto_layout", {
        parentId: "1:2",
        childId: "999:999",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });
  });

  // ============================================================
  // set_layout_grid
  // ============================================================

  describe("set_layout_grid", () => {
    it("sets a column layout grid", async () => {
      const frame = createMockFrame();
      mockFigma.getNodeById.mockReturnValue(frame);

      const result = await executeLayoutCommand("set_layout_grid", {
        nodeId: "1:2",
        grids: [
          {
            pattern: "COLUMNS",
            count: 12,
            gutterSize: 16,
            offset: 0,
            alignment: "STRETCH",
          },
        ],
      });

      expect(result.success).toBe(true);
      const grids = frame.layoutGrids as { pattern: string; count: number }[];
      expect(grids).toHaveLength(1);
      expect(grids[0].pattern).toBe("COLUMNS");
      expect(grids[0].count).toBe(12);
    });

    it("sets a row layout grid", async () => {
      const frame = createMockFrame();
      mockFigma.getNodeById.mockReturnValue(frame);

      const result = await executeLayoutCommand("set_layout_grid", {
        nodeId: "1:2",
        grids: [
          {
            pattern: "ROWS",
            count: 4,
            sectionSize: 100,
          },
        ],
      });

      expect(result.success).toBe(true);
      const grids = frame.layoutGrids as { pattern: string }[];
      expect(grids[0].pattern).toBe("ROWS");
    });

    it("sets a pixel grid", async () => {
      const frame = createMockFrame();
      mockFigma.getNodeById.mockReturnValue(frame);

      const result = await executeLayoutCommand("set_layout_grid", {
        nodeId: "1:2",
        grids: [
          {
            pattern: "GRID",
            sectionSize: 8,
          },
        ],
      });

      expect(result.success).toBe(true);
      const grids = frame.layoutGrids as { pattern: string; sectionSize: number }[];
      expect(grids[0].pattern).toBe("GRID");
      expect(grids[0].sectionSize).toBe(8);
    });

    it("sets multiple grids", async () => {
      const frame = createMockFrame();
      mockFigma.getNodeById.mockReturnValue(frame);

      const result = await executeLayoutCommand("set_layout_grid", {
        nodeId: "1:2",
        grids: [
          { pattern: "COLUMNS", count: 12, gutterSize: 16 },
          { pattern: "ROWS", count: 4, sectionSize: 100 },
        ],
      });

      expect(result.success).toBe(true);
      expect((frame.layoutGrids as unknown[]).length).toBe(2);
    });

    it("errors on missing grids", async () => {
      const frame = createMockFrame();
      mockFigma.getNodeById.mockReturnValue(frame);

      const result = await executeLayoutCommand("set_layout_grid", {
        nodeId: "1:2",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("grids");
    });

    it("errors on invalid pattern", async () => {
      const frame = createMockFrame();
      mockFigma.getNodeById.mockReturnValue(frame);

      const result = await executeLayoutCommand("set_layout_grid", {
        nodeId: "1:2",
        grids: [{ pattern: "INVALID" }],
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("pattern");
    });

    it("errors on non-frame node", async () => {
      const node = createMockNode({ type: "RECTANGLE" });
      mockFigma.getNodeById.mockReturnValue(node);

      const result = await executeLayoutCommand("set_layout_grid", {
        nodeId: "2:1",
        grids: [{ pattern: "COLUMNS", count: 12 }],
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("FRAME");
    });
  });

  // ============================================================
  // group_nodes
  // ============================================================

  describe("group_nodes", () => {
    it("groups nodes into a group", async () => {
      const node1 = createMockNode({ id: "2:1", parent: { id: "0:1", type: "PAGE" } });
      const node2 = createMockNode({ id: "2:2", parent: { id: "0:1", type: "PAGE" } });
      const mockGroup = { id: "5:1", type: "GROUP", name: "Group 1" };

      mockFigma.getNodeById.mockImplementation((id: string) => {
        if (id === "2:1") return node1;
        if (id === "2:2") return node2;
        if (id === "0:1") return mockFigma.currentPage;
        return null;
      });
      mockFigma.group.mockReturnValue(mockGroup);

      const result = await executeLayoutCommand("group_nodes", {
        nodeIds: ["2:1", "2:2"],
        type: "group",
      });

      expect(result.success).toBe(true);
      expect(mockFigma.group).toHaveBeenCalled();
      expect(result.data).toEqual(expect.objectContaining({ nodeId: "5:1" }));
    });

    it("groups nodes into a frame", async () => {
      const node1 = createMockNode({
        id: "2:1",
        x: 10, y: 10, width: 100, height: 50,
        parent: { id: "0:1", type: "PAGE", appendChild: vi.fn() },
      });
      const node2 = createMockNode({
        id: "2:2",
        x: 10, y: 70, width: 100, height: 50,
        parent: { id: "0:1", type: "PAGE", appendChild: vi.fn() },
      });

      const mockFrame = {
        id: "6:1",
        type: "FRAME",
        name: "Frame",
        x: 0, y: 0,
        resize: vi.fn(),
        appendChild: vi.fn(),
      };

      mockFigma.getNodeById.mockImplementation((id: string) => {
        if (id === "2:1") return node1;
        if (id === "2:2") return node2;
        return null;
      });
      mockFigma.createFrame.mockReturnValue(mockFrame);

      const result = await executeLayoutCommand("group_nodes", {
        nodeIds: ["2:1", "2:2"],
        type: "frame",
        name: "Container",
      });

      expect(result.success).toBe(true);
      expect(mockFigma.createFrame).toHaveBeenCalled();
      expect(mockFrame.name).toBe("Container");
    });

    it("errors on less than 2 nodeIds", async () => {
      const result = await executeLayoutCommand("group_nodes", {
        nodeIds: ["2:1"],
        type: "group",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("at least 2");
    });

    it("errors on missing nodeIds", async () => {
      const result = await executeLayoutCommand("group_nodes", {
        type: "group",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("nodeIds");
    });

    it("errors on missing type", async () => {
      const result = await executeLayoutCommand("group_nodes", {
        nodeIds: ["2:1", "2:2"],
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("type");
    });

    it("errors on invalid type", async () => {
      const result = await executeLayoutCommand("group_nodes", {
        nodeIds: ["2:1", "2:2"],
        type: "invalid",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("type");
    });

    it("errors when a node is not found", async () => {
      mockFigma.getNodeById.mockImplementation((id: string) => {
        if (id === "2:1") return createMockNode({ id: "2:1" });
        return null;
      });

      const result = await executeLayoutCommand("group_nodes", {
        nodeIds: ["2:1", "999:999"],
        type: "group",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("999:999");
    });
  });

  // ============================================================
  // ungroup_nodes
  // ============================================================

  describe("ungroup_nodes", () => {
    it("ungroups a group node", async () => {
      const child1 = createMockNode({ id: "3:1" });
      const child2 = createMockNode({ id: "3:2" });
      const parent = {
        id: "0:1",
        type: "PAGE",
        appendChild: vi.fn(),
        insertChild: vi.fn(),
        children: [],
      };
      const group = {
        id: "5:1",
        type: "GROUP",
        name: "Group 1",
        parent,
        children: [child1, child2],
        remove: vi.fn(),
      };

      mockFigma.getNodeById.mockReturnValue(group);

      // Mock parent.children.indexOf to return position
      parent.children = [group] as unknown[];

      const result = await executeLayoutCommand("ungroup_nodes", {
        nodeId: "5:1",
      });

      expect(result.success).toBe(true);
      expect(parent.appendChild).toHaveBeenCalledTimes(2);
      expect(group.remove).toHaveBeenCalled();
    });

    it("ungroups a frame node", async () => {
      const child1 = createMockNode({ id: "3:1" });
      const parent = {
        id: "0:1",
        type: "PAGE",
        appendChild: vi.fn(),
        insertChild: vi.fn(),
        children: [],
      };
      const frame = {
        id: "5:1",
        type: "FRAME",
        name: "Frame 1",
        parent,
        children: [child1],
        remove: vi.fn(),
      };

      mockFigma.getNodeById.mockReturnValue(frame);
      parent.children = [frame] as unknown[];

      const result = await executeLayoutCommand("ungroup_nodes", {
        nodeId: "5:1",
      });

      expect(result.success).toBe(true);
      expect(parent.appendChild).toHaveBeenCalledWith(child1);
      expect(frame.remove).toHaveBeenCalled();
    });

    it("errors on missing nodeId", async () => {
      const result = await executeLayoutCommand("ungroup_nodes", {});

      expect(result.success).toBe(false);
      expect(result.error).toContain("nodeId");
    });

    it("errors when node is not found", async () => {
      mockFigma.getNodeById.mockReturnValue(null);

      const result = await executeLayoutCommand("ungroup_nodes", {
        nodeId: "999:999",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });

    it("errors when node has no children", async () => {
      const node = createMockNode({
        id: "2:1",
        type: "RECTANGLE",
        parent: { id: "0:1", type: "PAGE" },
      });
      mockFigma.getNodeById.mockReturnValue(node);

      const result = await executeLayoutCommand("ungroup_nodes", {
        nodeId: "2:1",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("children");
    });

    it("errors when node has no parent", async () => {
      const group = {
        id: "5:1",
        type: "GROUP",
        parent: null,
        children: [createMockNode()],
        remove: vi.fn(),
      };
      mockFigma.getNodeById.mockReturnValue(group);

      const result = await executeLayoutCommand("ungroup_nodes", {
        nodeId: "5:1",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("parent");
    });
  });
});
