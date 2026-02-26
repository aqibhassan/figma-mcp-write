// src/server/design-system.ts

import type {
  DesignSystemContext,
  VariableInfo,
  StyleInfo,
  ComponentInfo,
} from "../../shared/protocol.js";

// ============================================================
// Color Match Result
// ============================================================

export interface ColorMatch {
  tokenName: string;
  tokenValue: string;
  distance: number;
}

// ============================================================
// DesignSystemManager
// ============================================================

export class DesignSystemManager {
  private context: DesignSystemContext | null = null;
  private lastUpdated: number | null = null;

  // --------------------------------------------------------
  // Context Management
  // --------------------------------------------------------

  hasContext(): boolean {
    return this.context !== null;
  }

  getContext(): DesignSystemContext | null {
    return this.context;
  }

  setContext(context: DesignSystemContext): void {
    this.context = context;
    this.lastUpdated = Date.now();
  }

  clear(): void {
    this.context = null;
    this.lastUpdated = null;
  }

  getLastUpdated(): number | null {
    return this.lastUpdated;
  }

  // --------------------------------------------------------
  // Context Queries
  // --------------------------------------------------------

  findColorToken(name: string): VariableInfo | null {
    if (!this.context) return null;

    const lower = name.toLowerCase();
    return (
      this.context.variables.colorTokens.find(
        (t) => t.name.toLowerCase() === lower
      ) ?? null
    );
  }

  findComponent(name: string): ComponentInfo | null {
    if (!this.context) return null;

    const lower = name.toLowerCase();

    // Exact match first
    const exact = this.context.components.local.find(
      (c) => c.name.toLowerCase() === lower
    );
    if (exact) return exact;

    // Partial match (case-insensitive)
    return (
      this.context.components.local.find((c) =>
        c.name.toLowerCase().includes(lower)
      ) ?? null
    );
  }

  findClosestColor(hexColor: string): ColorMatch | null {
    if (!this.context || this.context.variables.colorTokens.length === 0) {
      return null;
    }

    const target = hexToRgb(hexColor);
    if (!target) return null;

    let closestToken: VariableInfo | null = null;
    let closestDistance = Infinity;
    let closestHex = "";

    for (const token of this.context.variables.colorTokens) {
      const val = token.value as
        | { r: number; g: number; b: number; a?: number }
        | undefined;
      if (!val || typeof val !== "object" || !("r" in val)) continue;

      const tokenRgb = {
        r: Math.round(val.r * 255),
        g: Math.round(val.g * 255),
        b: Math.round(val.b * 255),
      };

      const distance = colorDistance(target, tokenRgb);

      if (distance < closestDistance) {
        closestDistance = distance;
        closestToken = token;
        closestHex = rgbToHex(val.r, val.g, val.b);
      }
    }

    if (!closestToken) return null;

    return {
      tokenName: closestToken.name,
      tokenValue: closestHex,
      distance: closestDistance,
    };
  }

  getSpacingScale(): number[] {
    if (!this.context) return [];
    return this.context.conventions.spacingScale;
  }

  getTextStyles(): StyleInfo[] {
    if (!this.context) return [];
    return this.context.styles.textStyles;
  }

  suggestSpacing(value: number): number | null {
    const scale = this.getSpacingScale();
    if (scale.length === 0) return null;

    let closest = scale[0];
    let closestDiff = Math.abs(value - scale[0]);

    for (const s of scale) {
      const diff = Math.abs(value - s);
      if (diff < closestDiff) {
        closestDiff = diff;
        closest = s;
      }
    }

    return closest;
  }

  // --------------------------------------------------------
  // Summary
  // --------------------------------------------------------

  getSummary(): string {
    if (!this.context) {
      return "No design system context available. Connect to a Figma file to scan.";
    }

    const ctx = this.context;
    const parts: string[] = [];

    const collCount = ctx.variables.collections.length;
    if (collCount > 0) {
      parts.push(`${collCount} variable collection${collCount !== 1 ? "s" : ""}`);
    }

    const colorTokenCount = ctx.variables.colorTokens.length;
    if (colorTokenCount > 0) {
      parts.push(`${colorTokenCount} color token${colorTokenCount !== 1 ? "s" : ""}`);
    }

    const spacingTokenCount = ctx.variables.spacingTokens.length;
    if (spacingTokenCount > 0) {
      parts.push(`${spacingTokenCount} spacing token${spacingTokenCount !== 1 ? "s" : ""}`);
    }

    const colorStyleCount = ctx.styles.colorStyles.length;
    if (colorStyleCount > 0) {
      parts.push(`${colorStyleCount} color style${colorStyleCount !== 1 ? "s" : ""}`);
    }

    const textStyleCount = ctx.styles.textStyles.length;
    if (textStyleCount > 0) {
      parts.push(`${textStyleCount} text style${textStyleCount !== 1 ? "s" : ""}`);
    }

    const effectStyleCount = ctx.styles.effectStyles.length;
    if (effectStyleCount > 0) {
      parts.push(`${effectStyleCount} effect style${effectStyleCount !== 1 ? "s" : ""}`);
    }

    const localCompCount = ctx.components.local.length;
    if (localCompCount > 0) {
      parts.push(`${localCompCount} local component${localCompCount !== 1 ? "s" : ""}`);
    }

    const naming = ctx.conventions.namingPattern;
    if (naming !== "unknown") {
      parts.push(`${naming} naming convention`);
    }

    if (parts.length === 0) {
      return "Design system context scanned but no tokens, styles, or components found.";
    }

    return `Design system: ${parts.join(", ")}.`;
  }
}

// ============================================================
// Color Utility Functions
// ============================================================

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const match = hex.match(/^#?([0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/);
  if (!match) return null;

  const h = match[1];
  return {
    r: parseInt(h.substring(0, 2), 16),
    g: parseInt(h.substring(2, 4), 16),
    b: parseInt(h.substring(4, 6), 16),
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (c: number) =>
    Math.round(c * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

function colorDistance(
  a: { r: number; g: number; b: number },
  b: { r: number; g: number; b: number }
): number {
  // Euclidean distance in RGB space
  return Math.sqrt(
    Math.pow(a.r - b.r, 2) +
      Math.pow(a.g - b.g, 2) +
      Math.pow(a.b - b.b, 2)
  );
}
