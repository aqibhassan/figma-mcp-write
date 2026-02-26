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
  resetIdCounter,
  type MockFigmaGlobal,
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
      frame.appendChild(child as unknown as MockSceneNode);
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
      group.appendChild(rect as unknown as MockSceneNode);
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
