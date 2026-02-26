// plugin/utils/design-system-scanner.ts

import type {
  DesignSystemContext,
  VariableCollectionInfo,
  VariableInfo,
  StyleInfo,
  ComponentInfo,
  ColorGroupInfo,
} from "../../shared/protocol.js";

// ============================================================
// scanDesignSystem
// ============================================================

export async function scanDesignSystem(): Promise<DesignSystemContext> {
  const variables = scanVariables();
  const styles = scanStyles();
  const components = scanComponents();
  const conventions = analyzeConventions(variables, styles, components);

  return {
    variables,
    styles,
    components,
    conventions,
  };
}

// ============================================================
// Variable Scanning
// ============================================================

function scanVariables(): DesignSystemContext["variables"] {
  const collections: VariableCollectionInfo[] = [];
  const colorTokens: VariableInfo[] = [];
  const spacingTokens: VariableInfo[] = [];
  const typographyTokens: VariableInfo[] = [];

  try {
    const localCollections =
      figma.variables.getLocalVariableCollections();

    for (const collection of localCollections) {
      collections.push({
        id: collection.id,
        name: collection.name,
        modes: collection.modes.map((m) => ({
          id: m.modeId,
          name: m.name,
        })),
        variableCount: collection.variableIds.length,
      });
    }

    const localVariables = figma.variables.getLocalVariables();

    for (const variable of localVariables) {
      const defaultModeId = getDefaultModeId(variable.variableCollectionId);
      const defaultValue =
        defaultModeId !== null
          ? variable.valuesByMode[defaultModeId]
          : undefined;

      const info: VariableInfo = {
        id: variable.id,
        name: variable.name,
        type: variable.resolvedType,
        value: defaultValue,
        collectionId: variable.variableCollectionId,
      };

      switch (variable.resolvedType) {
        case "COLOR":
          colorTokens.push(info);
          break;
        case "FLOAT": {
          // Heuristic: if name contains spacing/gap/padding/margin, it's spacing
          const lowerName = variable.name.toLowerCase();
          if (
            lowerName.includes("spacing") ||
            lowerName.includes("gap") ||
            lowerName.includes("padding") ||
            lowerName.includes("margin") ||
            lowerName.includes("space")
          ) {
            spacingTokens.push(info);
          } else if (
            lowerName.includes("font") ||
            lowerName.includes("line") ||
            lowerName.includes("letter") ||
            lowerName.includes("text")
          ) {
            typographyTokens.push(info);
          } else {
            // Default: treat as spacing if it's a round number
            spacingTokens.push(info);
          }
          break;
        }
        case "STRING":
          // String variables that contain font info → typography
          if (
            variable.name.toLowerCase().includes("font") ||
            variable.name.toLowerCase().includes("text")
          ) {
            typographyTokens.push(info);
          }
          break;
        case "BOOLEAN":
          // Booleans are typically feature flags, not design tokens
          break;
      }
    }
  } catch {
    // Variables API may not be available in all Figma versions
    // Return empty arrays silently
  }

  return { collections, colorTokens, spacingTokens, typographyTokens };
}

function getDefaultModeId(collectionId: string): string | null {
  try {
    const collection =
      figma.variables.getVariableCollectionById(collectionId);
    if (collection && collection.modes.length > 0) {
      return collection.modes[0].modeId;
    }
  } catch {
    // Collection not found
  }
  return null;
}

// ============================================================
// Style Scanning
// ============================================================

function scanStyles(): DesignSystemContext["styles"] {
  const textStyles: StyleInfo[] = [];
  const colorStyles: StyleInfo[] = [];
  const effectStyles: StyleInfo[] = [];
  const gridStyles: StyleInfo[] = [];

  try {
    for (const style of figma.getLocalPaintStyles()) {
      colorStyles.push({
        id: style.id,
        name: style.name,
        type: "PAINT",
        description: style.description ?? "",
      });
    }

    for (const style of figma.getLocalTextStyles()) {
      textStyles.push({
        id: style.id,
        name: style.name,
        type: "TEXT",
        description: style.description ?? "",
      });
    }

    for (const style of figma.getLocalEffectStyles()) {
      effectStyles.push({
        id: style.id,
        name: style.name,
        type: "EFFECT",
        description: style.description ?? "",
      });
    }

    for (const style of figma.getLocalGridStyles()) {
      gridStyles.push({
        id: style.id,
        name: style.name,
        type: "GRID",
        description: style.description ?? "",
      });
    }
  } catch {
    // Style API not available — return empty
  }

  return { textStyles, colorStyles, effectStyles, gridStyles };
}

// ============================================================
// Component Scanning
// ============================================================

function scanComponents(): DesignSystemContext["components"] {
  const local: ComponentInfo[] = [];

  try {
    // Walk the document to find all components
    function walkForComponents(node: BaseNode): void {
      if (node.type === "COMPONENT") {
        const comp = node as ComponentNode;
        local.push({
          id: comp.id,
          name: comp.name,
          description: comp.description ?? "",
        });
      }

      if ("children" in node) {
        const parent = node as BaseNode & ChildrenMixin;
        for (const child of parent.children) {
          walkForComponents(child);
        }
      }
    }

    // Scan all pages
    for (const page of figma.root.children) {
      walkForComponents(page);
    }
  } catch {
    // Scanning failed — return empty
  }

  return {
    local,
    external: [], // External libraries require async API calls in real Figma
  };
}

// ============================================================
// Convention Analysis
// ============================================================

function analyzeConventions(
  variables: DesignSystemContext["variables"],
  _styles: DesignSystemContext["styles"],
  components: DesignSystemContext["components"]
): DesignSystemContext["conventions"] {
  const namingPattern = detectNamingPattern(components.local);
  const spacingScale = extractSpacingScale(variables.spacingTokens);
  const colorPalette = extractColorPalette(variables.colorTokens);

  return {
    namingPattern,
    spacingScale,
    colorPalette,
  };
}

function detectNamingPattern(
  components: ComponentInfo[]
): "BEM" | "atomic" | "flat" | "unknown" {
  if (components.length === 0) return "unknown";

  let bemScore = 0;
  let slashScore = 0;

  for (const comp of components) {
    const name = comp.name;
    if (name.includes("--") || name.includes("__")) {
      bemScore++;
    }
    if (name.includes("/")) {
      slashScore++;
    }
  }

  const total = components.length;
  if (bemScore / total > 0.3) return "BEM";
  if (slashScore / total > 0.3) return "atomic";
  return "flat";
}

function extractSpacingScale(spacingTokens: VariableInfo[]): number[] {
  const values: number[] = [];

  for (const token of spacingTokens) {
    const val = token.value;
    if (typeof val === "number" && !isNaN(val) && val > 0) {
      values.push(val);
    }
  }

  // Return sorted unique values
  return [...new Set(values)].sort((a, b) => a - b);
}

function extractColorPalette(colorTokens: VariableInfo[]): ColorGroupInfo[] {
  const groups = new Map<string, string[]>();

  for (const token of colorTokens) {
    // Group by first segment of name (e.g., "primary/500" → "primary")
    const segments = token.name.split("/");
    const groupName = segments.length > 1 ? segments[0] : "ungrouped";

    if (!groups.has(groupName)) {
      groups.set(groupName, []);
    }

    // Convert color value to hex if possible
    const colorValue = token.value as
      | { r: number; g: number; b: number; a?: number }
      | undefined;
    if (colorValue && typeof colorValue === "object" && "r" in colorValue) {
      const hex = rgbToHex(colorValue.r, colorValue.g, colorValue.b);
      groups.get(groupName)!.push(hex);
    }
  }

  return Array.from(groups.entries()).map(([name, colors]) => ({
    name,
    colors,
  }));
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (c: number) =>
    Math.round(c * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}
