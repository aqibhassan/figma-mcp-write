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
