// plugin/utils/color.ts

/**
 * Parse a hex color string into Figma-compatible RGB values (0-1 range).
 * Accepts 6-digit (#RRGGBB) or 8-digit (#RRGGBBAA) hex strings.
 * The # prefix is optional.
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number; a: number } {
  // Strip # prefix if present
  const cleaned = hex.startsWith("#") ? hex.slice(1) : hex;

  // Validate
  if (!/^[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$/.test(cleaned)) {
    throw new Error(
      `Invalid hex color "${hex}". Expected format: #RRGGBB or #RRGGBBAA (e.g., #FF0000 or #FF000080).`
    );
  }

  const r = parseInt(cleaned.slice(0, 2), 16) / 255;
  const g = parseInt(cleaned.slice(2, 4), 16) / 255;
  const b = parseInt(cleaned.slice(4, 6), 16) / 255;
  const a = cleaned.length === 8 ? parseInt(cleaned.slice(6, 8), 16) / 255 : 1;

  return { r, g, b, a };
}

/**
 * Convert Figma RGB values (0-1 range) to a hex color string.
 * Returns uppercase 6-digit hex with # prefix.
 */
export function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(1, v));
  const toHex = (v: number) =>
    Math.round(clamp(v) * 255)
      .toString(16)
      .toUpperCase()
      .padStart(2, "0");

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Create a Figma SolidPaint from a hex color string.
 */
export function hexToSolidPaint(
  hex: string
): { type: "SOLID"; color: { r: number; g: number; b: number }; opacity: number } {
  const { r, g, b, a } = hexToRgb(hex);
  return {
    type: "SOLID",
    color: { r, g, b },
    opacity: a,
  };
}

/**
 * Parse gradient stops from the command format into Figma gradient stops.
 * Each stop: { color: "#RRGGBB", position: 0-1 }
 */
export function parseGradientStops(
  stops: { color: string; position: number }[]
): { color: { r: number; g: number; b: number; a: number }; position: number }[] {
  if (!stops || stops.length < 2) {
    throw new Error("Gradient requires at least 2 color stops.");
  }

  return stops.map((stop) => {
    if (stop.position < 0 || stop.position > 1) {
      throw new Error(
        `Gradient stop position must be between 0 and 1. Got: ${stop.position}`
      );
    }
    const { r, g, b, a } = hexToRgb(stop.color);
    return {
      color: { r, g, b, a },
      position: stop.position,
    };
  });
}
