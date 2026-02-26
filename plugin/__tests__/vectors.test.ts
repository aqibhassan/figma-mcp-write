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

    it("fails if node does not support isMask (not inside a group or frame)", async () => {
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
