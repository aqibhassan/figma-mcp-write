// src/server/__tests__/design-system.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { DesignSystemManager } from "../design-system.js";
import type { DesignSystemContext } from "../../../shared/protocol.js";

describe("DesignSystemManager", () => {
  let manager: DesignSystemManager;

  const sampleContext: DesignSystemContext = {
    variables: {
      collections: [
        {
          id: "VariableCollectionID:1:1",
          name: "Brand Colors",
          modes: [{ id: "mode-0", name: "Default" }],
          variableCount: 3,
        },
      ],
      colorTokens: [
        {
          id: "VariableID:1:1",
          name: "primary/500",
          type: "COLOR",
          value: { r: 0.2, g: 0.4, b: 0.8, a: 1 },
          collectionId: "VariableCollectionID:1:1",
        },
      ],
      spacingTokens: [
        {
          id: "VariableID:2:1",
          name: "spacing/md",
          type: "FLOAT",
          value: 16,
          collectionId: "VariableCollectionID:1:1",
        },
      ],
      typographyTokens: [],
    },
    styles: {
      textStyles: [
        {
          id: "S:text-1:1",
          name: "Heading/H1",
          type: "TEXT",
          description: "Main heading",
        },
      ],
      colorStyles: [
        {
          id: "S:paint-1:1",
          name: "Brand/Primary",
          type: "PAINT",
          description: "",
        },
      ],
      effectStyles: [],
      gridStyles: [],
    },
    components: {
      local: [
        {
          id: "100:1",
          name: "Button/Primary",
          description: "Primary action button",
        },
      ],
      external: [],
    },
    conventions: {
      namingPattern: "atomic",
      spacingScale: [4, 8, 16, 24, 32],
      colorPalette: [
        { name: "primary", colors: ["#3366CC"] },
      ],
    },
  };

  beforeEach(() => {
    manager = new DesignSystemManager();
  });

  afterEach(() => {
    manager.clear();
  });

  describe("context management", () => {
    it("starts with no context", () => {
      expect(manager.hasContext()).toBe(false);
      expect(manager.getContext()).toBeNull();
    });

    it("stores and retrieves design system context", () => {
      manager.setContext(sampleContext);

      expect(manager.hasContext()).toBe(true);
      const ctx = manager.getContext();
      expect(ctx).not.toBeNull();
      expect(ctx!.variables.collections).toHaveLength(1);
      expect(ctx!.styles.colorStyles).toHaveLength(1);
      expect(ctx!.components.local).toHaveLength(1);
    });

    it("replaces existing context on update", () => {
      manager.setContext(sampleContext);

      const updatedContext: DesignSystemContext = {
        ...sampleContext,
        components: {
          local: [
            { id: "100:1", name: "Button/Primary", description: "" },
            { id: "200:1", name: "Card/Default", description: "" },
          ],
          external: [],
        },
      };

      manager.setContext(updatedContext);
      expect(manager.getContext()!.components.local).toHaveLength(2);
    });

    it("clears context", () => {
      manager.setContext(sampleContext);
      manager.clear();

      expect(manager.hasContext()).toBe(false);
      expect(manager.getContext()).toBeNull();
    });
  });

  describe("context queries", () => {
    beforeEach(() => {
      manager.setContext(sampleContext);
    });

    it("finds a color token by name", () => {
      const token = manager.findColorToken("primary/500");

      expect(token).not.toBeNull();
      expect(token!.name).toBe("primary/500");
    });

    it("returns null for unknown color token", () => {
      const token = manager.findColorToken("nonexistent");
      expect(token).toBeNull();
    });

    it("finds a component by name", () => {
      const comp = manager.findComponent("Button/Primary");

      expect(comp).not.toBeNull();
      expect(comp!.id).toBe("100:1");
    });

    it("finds a component by partial name (case-insensitive)", () => {
      const comp = manager.findComponent("button");

      expect(comp).not.toBeNull();
      expect(comp!.name).toBe("Button/Primary");
    });

    it("returns null for unknown component", () => {
      const comp = manager.findComponent("Nonexistent");
      expect(comp).toBeNull();
    });

    it("finds closest color match", () => {
      const match = manager.findClosestColor("#3366CB");

      expect(match).not.toBeNull();
      expect(match!.tokenName).toBe("primary/500");
      expect(match!.distance).toBeLessThan(5);
    });

    it("returns null for color match when no tokens exist", () => {
      const emptyManager = new DesignSystemManager();
      const match = emptyManager.findClosestColor("#FF0000");
      expect(match).toBeNull();
    });

    it("gets spacing scale", () => {
      const scale = manager.getSpacingScale();
      expect(scale).toEqual([4, 8, 16, 24, 32]);
    });

    it("gets text styles", () => {
      const styles = manager.getTextStyles();
      expect(styles).toHaveLength(1);
      expect(styles[0].name).toBe("Heading/H1");
    });

    it("suggests closest spacing value", () => {
      const suggestion = manager.suggestSpacing(15);
      expect(suggestion).toBe(16);
    });

    it("returns the exact spacing if it matches", () => {
      const suggestion = manager.suggestSpacing(16);
      expect(suggestion).toBe(16);
    });

    it("returns null spacing suggestion when no scale exists", () => {
      const emptyManager = new DesignSystemManager();
      const suggestion = emptyManager.suggestSpacing(16);
      expect(suggestion).toBeNull();
    });
  });

  describe("cache timestamps", () => {
    it("tracks when context was last updated", () => {
      const before = Date.now();
      manager.setContext(sampleContext);
      const after = Date.now();

      const ts = manager.getLastUpdated();
      expect(ts).not.toBeNull();
      expect(ts!).toBeGreaterThanOrEqual(before);
      expect(ts!).toBeLessThanOrEqual(after);
    });

    it("returns null timestamp before any context is set", () => {
      expect(manager.getLastUpdated()).toBeNull();
    });
  });

  describe("context summary", () => {
    it("generates a human-readable summary", () => {
      manager.setContext(sampleContext);

      const summary = manager.getSummary();

      expect(summary).toContain("1 variable collection");
      expect(summary).toContain("1 color token");
      expect(summary).toContain("1 spacing token");
      expect(summary).toContain("1 color style");
      expect(summary).toContain("1 text style");
      expect(summary).toContain("1 local component");
      expect(summary).toContain("atomic");
    });

    it("returns empty summary when no context exists", () => {
      const summary = manager.getSummary();
      expect(summary).toContain("No design system context");
    });
  });
});
