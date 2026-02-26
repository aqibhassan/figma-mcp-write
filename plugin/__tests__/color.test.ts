// plugin/__tests__/color.test.ts
import { describe, it, expect } from "vitest";
import { hexToRgb, rgbToHex } from "../utils/color.js";

describe("hexToRgb", () => {
  it("parses 6-digit hex color", () => {
    const result = hexToRgb("#FF0000");
    expect(result).toEqual({ r: 1, g: 0, b: 0, a: 1 });
  });

  it("parses lowercase hex color", () => {
    const result = hexToRgb("#00ff00");
    expect(result).toEqual({ r: 0, g: 1, b: 0, a: 1 });
  });

  it("parses 8-digit hex color with alpha", () => {
    const result = hexToRgb("#FF000080");
    expect(result.r).toBeCloseTo(1, 2);
    expect(result.g).toBeCloseTo(0, 2);
    expect(result.b).toBeCloseTo(0, 2);
    expect(result.a).toBeCloseTo(0.502, 2);
  });

  it("parses white", () => {
    const result = hexToRgb("#FFFFFF");
    expect(result).toEqual({ r: 1, g: 1, b: 1, a: 1 });
  });

  it("parses black", () => {
    const result = hexToRgb("#000000");
    expect(result).toEqual({ r: 0, g: 0, b: 0, a: 1 });
  });

  it("parses mid-range color", () => {
    const result = hexToRgb("#808080");
    expect(result.r).toBeCloseTo(0.502, 2);
    expect(result.g).toBeCloseTo(0.502, 2);
    expect(result.b).toBeCloseTo(0.502, 2);
    expect(result.a).toBe(1);
  });

  it("handles hex without # prefix", () => {
    const result = hexToRgb("FF0000");
    expect(result).toEqual({ r: 1, g: 0, b: 0, a: 1 });
  });

  it("throws on invalid hex", () => {
    expect(() => hexToRgb("#GG0000")).toThrow("Invalid hex color");
    expect(() => hexToRgb("#FFF")).toThrow("Invalid hex color");
    expect(() => hexToRgb("")).toThrow("Invalid hex color");
    expect(() => hexToRgb("#12345")).toThrow("Invalid hex color");
  });
});

describe("rgbToHex", () => {
  it("converts red to hex", () => {
    expect(rgbToHex(1, 0, 0)).toBe("#FF0000");
  });

  it("converts green to hex", () => {
    expect(rgbToHex(0, 1, 0)).toBe("#00FF00");
  });

  it("converts blue to hex", () => {
    expect(rgbToHex(0, 0, 1)).toBe("#0000FF");
  });

  it("converts white to hex", () => {
    expect(rgbToHex(1, 1, 1)).toBe("#FFFFFF");
  });

  it("converts black to hex", () => {
    expect(rgbToHex(0, 0, 0)).toBe("#000000");
  });

  it("converts mid-range values", () => {
    expect(rgbToHex(0.5, 0.5, 0.5)).toBe("#808080");
  });

  it("clamps values above 1", () => {
    expect(rgbToHex(1.5, 0, 0)).toBe("#FF0000");
  });

  it("clamps values below 0", () => {
    expect(rgbToHex(-0.5, 0, 0)).toBe("#000000");
  });
});
