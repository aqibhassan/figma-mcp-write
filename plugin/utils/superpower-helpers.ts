// plugin/utils/superpower-helpers.ts

// ============================================================
// Color Types
// ============================================================

export interface RgbColor {
  r: number; // 0-1
  g: number; // 0-1
  b: number; // 0-1
  a?: number; // 0-1
}

export interface LabColor {
  l: number;
  a: number;
  b: number;
}

export interface ExtractedColor {
  hex: string;
  rgb: RgbColor;
  source: "fill" | "stroke" | "text";
  nodeId: string;
  nodeName: string;
}

// ============================================================
// Hex ↔ RGB
// ============================================================

export function hexToRgb(hex: string): RgbColor {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.substring(0, 2), 16) / 255;
  const g = parseInt(clean.substring(2, 4), 16) / 255;
  const b = parseInt(clean.substring(4, 6), 16) / 255;
  if (clean.length === 8) {
    const a = parseInt(clean.substring(6, 8), 16) / 255;
    return { r, g, b, a };
  }
  return { r, g, b };
}

export function rgbToHex(color: RgbColor): string {
  const toHex = (v: number) =>
    Math.round(Math.max(0, Math.min(1, v)) * 255)
      .toString(16)
      .padStart(2, "0")
      .toUpperCase();
  return `#${toHex(color.r)}${toHex(color.g)}${toHex(color.b)}`;
}

// ============================================================
// RGB → Lab (CIE 1976)
// ============================================================

export function rgbToLab(color: RgbColor): LabColor {
  // sRGB to linear
  const linearize = (v: number) =>
    v > 0.04045 ? Math.pow((v + 0.055) / 1.055, 2.4) : v / 12.92;

  const rl = linearize(color.r);
  const gl = linearize(color.g);
  const bl = linearize(color.b);

  // Linear RGB to XYZ (D65)
  let x = rl * 0.4124564 + gl * 0.3575761 + bl * 0.1804375;
  let y = rl * 0.2126729 + gl * 0.7151522 + bl * 0.0721750;
  let z = rl * 0.0193339 + gl * 0.1191920 + bl * 0.9503041;

  // Normalize to D65 white point
  x /= 0.95047;
  y /= 1.0;
  z /= 1.08883;

  // XYZ to Lab
  const f = (t: number) =>
    t > 0.008856 ? Math.pow(t, 1 / 3) : 7.787 * t + 16 / 116;

  const fx = f(x);
  const fy = f(y);
  const fz = f(z);

  return {
    l: 116 * fy - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz),
  };
}

// ============================================================
// Delta E (CIE76)
// ============================================================

export function deltaE(c1: RgbColor, c2: RgbColor): number {
  const lab1 = rgbToLab(c1);
  const lab2 = rgbToLab(c2);
  return Math.sqrt(
    Math.pow(lab1.l - lab2.l, 2) +
    Math.pow(lab1.a - lab2.a, 2) +
    Math.pow(lab1.b - lab2.b, 2)
  );
}

export function hexDeltaE(hex1: string, hex2: string): number {
  return deltaE(hexToRgb(hex1), hexToRgb(hex2));
}

// ============================================================
// WCAG Contrast Ratio
// ============================================================

export function relativeLuminance(color: RgbColor): number {
  const linearize = (v: number) =>
    v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  const r = linearize(color.r);
  const g = linearize(color.g);
  const b = linearize(color.b);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(fg: RgbColor, bg: RgbColor): number {
  const l1 = relativeLuminance(fg);
  const l2 = relativeLuminance(bg);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

// ============================================================
// Grid / Spacing Utility
// ============================================================

export function isOnGrid(value: number, baseUnit: number): boolean {
  if (value === 0) return true;
  return Math.abs(value % baseUnit) < 0.01;
}

// ============================================================
// Node Traversal
// ============================================================

export function collectNodesInScope(
  scope: string,
  figmaApi: PluginAPI
): SceneNode[] {
  if (scope === "file") {
    const nodes: SceneNode[] = [];
    for (const page of figmaApi.root.children) {
      walkNodes(page, (node) => nodes.push(node));
    }
    return nodes;
  }

  if (scope === "page") {
    const nodes: SceneNode[] = [];
    for (const child of figmaApi.currentPage.children) {
      walkNodes(child, (node) => nodes.push(node));
    }
    return nodes;
  }

  // scope is a node ID
  const node = figmaApi.getNodeById(scope);
  if (!node || node.type === "DOCUMENT" || node.type === "PAGE") {
    return [];
  }

  const nodes: SceneNode[] = [];
  walkNodes(node as SceneNode, (n) => nodes.push(n));
  return nodes;
}

export function walkNodes(
  node: SceneNode,
  callback: (node: SceneNode) => void
): void {
  callback(node);
  if ("children" in node && node.children) {
    for (const child of node.children) {
      walkNodes(child as SceneNode, callback);
    }
  }
}

export function collectTopLevelInScope(
  scope: string,
  figmaApi: PluginAPI
): SceneNode[] {
  if (scope === "file") {
    const nodes: SceneNode[] = [];
    for (const page of figmaApi.root.children) {
      for (const child of page.children) {
        nodes.push(child);
      }
    }
    return nodes;
  }

  if (scope === "page") {
    return [...figmaApi.currentPage.children];
  }

  const node = figmaApi.getNodeById(scope);
  if (!node) return [];
  return [node as SceneNode];
}

// ============================================================
// Color Extraction
// ============================================================

export function extractColorsFromNode(node: SceneNode): ExtractedColor[] {
  const colors: ExtractedColor[] = [];

  // Fills
  if ("fills" in node && Array.isArray(node.fills)) {
    for (const paint of node.fills as Paint[]) {
      if (paint.type === "SOLID" && paint.visible !== false) {
        const solid = paint as SolidPaint;
        colors.push({
          hex: rgbToHex(solid.color),
          rgb: { r: solid.color.r, g: solid.color.g, b: solid.color.b },
          source: "fill",
          nodeId: node.id,
          nodeName: node.name,
        });
      }
    }
  }

  // Strokes
  if ("strokes" in node && Array.isArray(node.strokes)) {
    for (const paint of node.strokes as Paint[]) {
      if (paint.type === "SOLID" && paint.visible !== false) {
        const solid = paint as SolidPaint;
        colors.push({
          hex: rgbToHex(solid.color),
          rgb: { r: solid.color.r, g: solid.color.g, b: solid.color.b },
          source: "stroke",
          nodeId: node.id,
          nodeName: node.name,
        });
      }
    }
  }

  // Text fill
  if (node.type === "TEXT" && "fills" in node && Array.isArray(node.fills)) {
    // Already captured above as fill, but re-tag as "text" source
    const lastFill = colors.find(
      (c) => c.nodeId === node.id && c.source === "fill"
    );
    if (lastFill) {
      lastFill.source = "text";
    }
  }

  return colors;
}

// ============================================================
// Node Matching (for bulk_style selector)
// ============================================================

export interface NodeSelector {
  type?: string;
  name?: string;
  style?: Record<string, unknown>;
}

export function nodeMatchesSelector(
  node: SceneNode,
  selector: NodeSelector
): boolean {
  if (selector.type && node.type !== selector.type) {
    return false;
  }

  if (selector.name) {
    let pattern: RegExp;
    try {
      pattern = new RegExp(selector.name, "i");
    } catch {
      // Invalid regex — fall back to literal substring match
      pattern = new RegExp(selector.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    }
    if (!pattern.test(node.name)) {
      return false;
    }
  }

  if (selector.style) {
    for (const [key, value] of Object.entries(selector.style)) {
      if ((node as Record<string, unknown>)[key] !== value) {
        return false;
      }
    }
  }

  return true;
}

// ============================================================
// Structural Fingerprinting (for duplicate detection)
// ============================================================

export interface NodeFingerprint {
  type: string;
  width: number;
  height: number;
  childCount: number;
  fillHex: string | null;
  childTypes: string[];
}

export function fingerprintNode(node: SceneNode): NodeFingerprint {
  const width = "width" in node ? (node.width as number) : 0;
  const height = "height" in node ? (node.height as number) : 0;

  let fillHex: string | null = null;
  if ("fills" in node && Array.isArray(node.fills) && node.fills.length > 0) {
    const first = node.fills[0] as Paint;
    if (first.type === "SOLID") {
      fillHex = rgbToHex((first as SolidPaint).color);
    }
  }

  const children =
    "children" in node && Array.isArray((node as Record<string, unknown>).children)
      ? (node.children as SceneNode[])
      : [];
  const childTypes = children.map((c) => c.type).sort();

  return {
    type: node.type,
    width: Math.round(width),
    height: Math.round(height),
    childCount: children.length,
    fillHex,
    childTypes,
  };
}

export function fingerprintSimilarity(
  a: NodeFingerprint,
  b: NodeFingerprint
): number {
  let score = 0;
  const maxScore = 5;

  if (a.type === b.type) score += 1;
  if (Math.abs(a.width - b.width) <= 2) score += 1;
  if (Math.abs(a.height - b.height) <= 2) score += 1;
  if (a.fillHex === b.fillHex) score += 1;
  if (
    a.childCount === b.childCount &&
    JSON.stringify(a.childTypes) === JSON.stringify(b.childTypes)
  ) {
    score += 1;
  }

  return score / maxScore;
}
