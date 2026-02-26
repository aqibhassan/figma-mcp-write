// plugin/__tests__/design-system-scanner.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createMockFigma,
  createMockFrame,
  createMockComponent,
  createMockRectangle,
  createMockText,
  createMockPaintStyle,
  createMockTextStyle,
  createMockEffectStyle,
  createMockGridStyle,
  createMockVariable,
  createMockVariableCollection,
  resetIdCounter,
  resetVarIdCounter,
  resetCollectionIdCounter,
  resetStyleIdCounter,
  type MockFigmaGlobal,
  type MockSceneNode,
  type MockPaintStyle,
  type MockTextStyle,
  type MockEffectStyle,
  type MockGridStyle,
} from "../../test/mocks/figma-api-phase5.js";
import { scanDesignSystem } from "../utils/design-system-scanner.js";

describe("Design System Scanner", () => {
  let mockFigma: MockFigmaGlobal;

  beforeEach(() => {
    resetIdCounter();
    resetVarIdCounter();
    resetCollectionIdCounter();
    resetStyleIdCounter();
    mockFigma = createMockFigma();
    (globalThis as unknown as { figma: MockFigmaGlobal }).figma = mockFigma;
  });

  it("returns a complete DesignSystemContext structure", async () => {
    const result = await scanDesignSystem();

    expect(result).toBeDefined();
    expect(result.variables).toBeDefined();
    expect(result.variables.collections).toBeDefined();
    expect(result.variables.colorTokens).toBeDefined();
    expect(result.variables.spacingTokens).toBeDefined();
    expect(result.variables.typographyTokens).toBeDefined();
    expect(result.styles).toBeDefined();
    expect(result.styles.textStyles).toBeDefined();
    expect(result.styles.colorStyles).toBeDefined();
    expect(result.styles.effectStyles).toBeDefined();
    expect(result.styles.gridStyles).toBeDefined();
    expect(result.components).toBeDefined();
    expect(result.components.local).toBeDefined();
    expect(result.conventions).toBeDefined();
  });

  it("scans local paint styles", async () => {
    const style1 = createMockPaintStyle("Brand/Primary", {
      r: 0.2,
      g: 0.4,
      b: 0.8,
    });
    const style2 = createMockPaintStyle("Brand/Secondary", {
      r: 0.9,
      g: 0.3,
      b: 0.1,
    });
    const addPaintStyle = (mockFigma as unknown as Record<string, unknown>)
      .addPaintStyle as (s: MockPaintStyle) => void;
    addPaintStyle(style1);
    addPaintStyle(style2);

    const result = await scanDesignSystem();

    expect(result.styles.colorStyles).toHaveLength(2);
    expect(result.styles.colorStyles[0].name).toBe("Brand/Primary");
    expect(result.styles.colorStyles[1].name).toBe("Brand/Secondary");
  });

  it("scans local text styles", async () => {
    const style1 = createMockTextStyle("Heading/H1", 32, "Inter");
    const style2 = createMockTextStyle("Body/Regular", 16, "Inter");
    const addTextStyle = (mockFigma as unknown as Record<string, unknown>)
      .addTextStyle as (s: MockTextStyle) => void;
    addTextStyle(style1);
    addTextStyle(style2);

    const result = await scanDesignSystem();

    expect(result.styles.textStyles).toHaveLength(2);
    expect(result.styles.textStyles[0].name).toBe("Heading/H1");
  });

  it("scans local effect styles", async () => {
    const style = createMockEffectStyle("Elevation/Medium");
    const addEffectStyle = (mockFigma as unknown as Record<string, unknown>)
      .addEffectStyle as (s: MockEffectStyle) => void;
    addEffectStyle(style);

    const result = await scanDesignSystem();

    expect(result.styles.effectStyles).toHaveLength(1);
    expect(result.styles.effectStyles[0].name).toBe("Elevation/Medium");
  });

  it("scans local grid styles", async () => {
    const style = createMockGridStyle("Layout/12-Column");
    const addGridStyle = (mockFigma as unknown as Record<string, unknown>)
      .addGridStyle as (s: MockGridStyle) => void;
    addGridStyle(style);

    const result = await scanDesignSystem();

    expect(result.styles.gridStyles).toHaveLength(1);
    expect(result.styles.gridStyles[0].name).toBe("Layout/12-Column");
  });

  it("scans variable collections and variables", async () => {
    // Create collection and variables via the mock API
    const collection =
      mockFigma.variables.createVariableCollection("Brand Colors");
    mockFigma.variables.createVariable(
      "primary/500",
      collection.id,
      "COLOR"
    );
    mockFigma.variables.createVariable(
      "spacing/md",
      collection.id,
      "FLOAT"
    );

    const result = await scanDesignSystem();

    expect(result.variables.collections).toHaveLength(1);
    expect(result.variables.collections[0].name).toBe("Brand Colors");
    expect(result.variables.colorTokens.length).toBeGreaterThanOrEqual(1);
    expect(result.variables.spacingTokens.length).toBeGreaterThanOrEqual(1);
  });

  it("scans local components", async () => {
    const comp1 = createMockComponent("Button/Primary");
    comp1.description = "Primary action button";
    const comp2 = createMockComponent("Card/Default");
    comp2.description = "Default card component";
    mockFigma.currentPage.appendChild(comp1 as unknown as MockSceneNode);
    mockFigma.currentPage.appendChild(comp2 as unknown as MockSceneNode);

    const result = await scanDesignSystem();

    expect(result.components.local).toHaveLength(2);
    expect(result.components.local[0].name).toBe("Button/Primary");
    expect(result.components.local[0].description).toBe(
      "Primary action button"
    );
  });

  it("detects naming convention patterns", async () => {
    // Create components with BEM-like naming
    const comp1 = createMockComponent("button--primary");
    const comp2 = createMockComponent("button--secondary");
    const comp3 = createMockComponent("card__header");
    mockFigma.currentPage.appendChild(comp1 as unknown as MockSceneNode);
    mockFigma.currentPage.appendChild(comp2 as unknown as MockSceneNode);
    mockFigma.currentPage.appendChild(comp3 as unknown as MockSceneNode);

    const result = await scanDesignSystem();

    // The scanner should detect some naming pattern
    expect(result.conventions.namingPattern).toBeDefined();
  });

  it("extracts spacing scale from FLOAT variables", async () => {
    const collection =
      mockFigma.variables.createVariableCollection("Spacing");
    const var4 = mockFigma.variables.createVariable(
      "spacing/xs",
      collection.id,
      "FLOAT"
    );
    var4.setValueForMode(collection.modes[0].modeId, 4);
    const var8 = mockFigma.variables.createVariable(
      "spacing/sm",
      collection.id,
      "FLOAT"
    );
    var8.setValueForMode(collection.modes[0].modeId, 8);
    const var16 = mockFigma.variables.createVariable(
      "spacing/md",
      collection.id,
      "FLOAT"
    );
    var16.setValueForMode(collection.modes[0].modeId, 16);

    const result = await scanDesignSystem();

    expect(result.conventions.spacingScale.length).toBeGreaterThanOrEqual(1);
  });

  it("returns empty context for empty file", async () => {
    const result = await scanDesignSystem();

    expect(result.variables.collections).toHaveLength(0);
    expect(result.variables.colorTokens).toHaveLength(0);
    expect(result.styles.colorStyles).toHaveLength(0);
    expect(result.styles.textStyles).toHaveLength(0);
    expect(result.components.local).toHaveLength(0);
  });
});
