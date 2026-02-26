// plugin/__tests__/export.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createMockFigma,
  createMockFrame,
  createMockRectangle,
  createMockText,
  createMockEllipse,
  resetIdCounter,
  type MockFigmaGlobal,
  type MockSceneNode,
  type MockFrameNode,
} from "../../test/mocks/figma-api-phase5.js";
import {
  exportNode,
  setExportSettings,
  setImageFill,
  getNodeCss,
} from "../executors/export.js";

describe("Export Executors", () => {
  let mockFigma: MockFigmaGlobal;

  beforeEach(() => {
    resetIdCounter();
    mockFigma = createMockFigma();
    (globalThis as unknown as { figma: MockFigmaGlobal }).figma = mockFigma;
  });

  // ============================================================
  // export_node
  // ============================================================

  describe("export_node", () => {
    it("exports a node as PNG with default scale", async () => {
      const rect = createMockRectangle("Icon");
      mockFigma.currentPage.appendChild(rect as unknown as MockSceneNode);

      const result = await exportNode({
        nodeId: rect.id,
        format: "PNG",
      });

      expect(result.success).toBe(true);
      const data = result.data as Record<string, unknown>;
      expect(data.format).toBe("PNG");
      expect(data.base64).toBeDefined();
      expect(typeof data.base64).toBe("string");
      expect(rect.exportAsync).toHaveBeenCalledWith(
        expect.objectContaining({ format: "PNG" })
      );
    });

    it("exports a node as SVG", async () => {
      const rect = createMockRectangle("Logo");
      mockFigma.currentPage.appendChild(rect as unknown as MockSceneNode);

      const result = await exportNode({
        nodeId: rect.id,
        format: "SVG",
      });

      expect(result.success).toBe(true);
      expect((result.data as Record<string, unknown>).format).toBe("SVG");
    });

    it("exports a node as PDF", async () => {
      const frame = createMockFrame("Page Layout");
      mockFigma.currentPage.appendChild(frame as unknown as MockSceneNode);

      const result = await exportNode({
        nodeId: frame.id,
        format: "PDF",
      });

      expect(result.success).toBe(true);
      expect((result.data as Record<string, unknown>).format).toBe("PDF");
    });

    it("exports a node as JPG", async () => {
      const rect = createMockRectangle("Photo");
      mockFigma.currentPage.appendChild(rect as unknown as MockSceneNode);

      const result = await exportNode({
        nodeId: rect.id,
        format: "JPG",
      });

      expect(result.success).toBe(true);
      expect((result.data as Record<string, unknown>).format).toBe("JPG");
    });

    it("exports with a custom scale", async () => {
      const rect = createMockRectangle("HiRes");
      mockFigma.currentPage.appendChild(rect as unknown as MockSceneNode);

      const result = await exportNode({
        nodeId: rect.id,
        format: "PNG",
        scale: 2,
      });

      expect(result.success).toBe(true);
      expect(rect.exportAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          format: "PNG",
          constraint: { type: "SCALE", value: 2 },
        })
      );
    });

    it("exports with a width constraint", async () => {
      const rect = createMockRectangle("Thumb");
      mockFigma.currentPage.appendChild(rect as unknown as MockSceneNode);

      const result = await exportNode({
        nodeId: rect.id,
        format: "PNG",
        constraint: { type: "WIDTH", value: 200 },
      });

      expect(result.success).toBe(true);
      expect(rect.exportAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          constraint: { type: "WIDTH", value: 200 },
        })
      );
    });

    it("fails if nodeId is missing", async () => {
      const result = await exportNode({ format: "PNG" });

      expect(result.success).toBe(false);
      expect(result.error).toContain("nodeId");
    });

    it("fails if format is missing", async () => {
      const rect = createMockRectangle("Shape");
      mockFigma.currentPage.appendChild(rect as unknown as MockSceneNode);

      const result = await exportNode({ nodeId: rect.id });

      expect(result.success).toBe(false);
      expect(result.error).toContain("format");
    });

    it("fails if format is invalid", async () => {
      const rect = createMockRectangle("Shape");
      mockFigma.currentPage.appendChild(rect as unknown as MockSceneNode);

      const result = await exportNode({
        nodeId: rect.id,
        format: "GIF",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid format");
    });

    it("fails if node is not found", async () => {
      const result = await exportNode({
        nodeId: "999:999",
        format: "PNG",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });

    it("fails if scale is out of range", async () => {
      const rect = createMockRectangle("Shape");
      mockFigma.currentPage.appendChild(rect as unknown as MockSceneNode);

      const result = await exportNode({
        nodeId: rect.id,
        format: "PNG",
        scale: 10,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("scale");
    });
  });

  // ============================================================
  // set_export_settings
  // ============================================================

  describe("set_export_settings", () => {
    it("sets a single export setting on a node", async () => {
      const rect = createMockRectangle("Icon");
      mockFigma.currentPage.appendChild(rect as unknown as MockSceneNode);

      const result = await setExportSettings({
        nodeId: rect.id,
        settings: [
          {
            format: "PNG",
            suffix: "@2x",
            constraint: { type: "SCALE", value: 2 },
          },
        ],
      });

      expect(result.success).toBe(true);
      expect(rect.exportSettings).toHaveLength(1);
      expect(rect.exportSettings[0].format).toBe("PNG");
      expect(rect.exportSettings[0].suffix).toBe("@2x");
    });

    it("sets multiple export settings on a node", async () => {
      const rect = createMockRectangle("Multi Export");
      mockFigma.currentPage.appendChild(rect as unknown as MockSceneNode);

      const result = await setExportSettings({
        nodeId: rect.id,
        settings: [
          {
            format: "PNG",
            suffix: "@1x",
            constraint: { type: "SCALE", value: 1 },
          },
          {
            format: "PNG",
            suffix: "@2x",
            constraint: { type: "SCALE", value: 2 },
          },
          {
            format: "SVG",
            suffix: "",
            constraint: { type: "SCALE", value: 1 },
          },
        ],
      });

      expect(result.success).toBe(true);
      expect(rect.exportSettings).toHaveLength(3);
    });

    it("replaces existing export settings", async () => {
      const rect = createMockRectangle("Replace");
      rect.exportSettings = [
        {
          format: "JPG",
          suffix: "",
          constraint: { type: "SCALE", value: 1 },
        },
      ];
      mockFigma.currentPage.appendChild(rect as unknown as MockSceneNode);

      const result = await setExportSettings({
        nodeId: rect.id,
        settings: [
          {
            format: "PNG",
            suffix: "@2x",
            constraint: { type: "SCALE", value: 2 },
          },
        ],
      });

      expect(result.success).toBe(true);
      expect(rect.exportSettings).toHaveLength(1);
      expect(rect.exportSettings[0].format).toBe("PNG");
    });

    it("fails if nodeId is missing", async () => {
      const result = await setExportSettings({
        settings: [{ format: "PNG" }],
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("nodeId");
    });

    it("fails if settings is missing or empty", async () => {
      const rect = createMockRectangle("No Settings");
      mockFigma.currentPage.appendChild(rect as unknown as MockSceneNode);

      const result1 = await setExportSettings({ nodeId: rect.id });
      expect(result1.success).toBe(false);
      expect(result1.error).toContain("settings");

      const result2 = await setExportSettings({
        nodeId: rect.id,
        settings: [],
      });
      expect(result2.success).toBe(false);
      expect(result2.error).toContain("at least one");
    });

    it("fails if node is not found", async () => {
      const result = await setExportSettings({
        nodeId: "999:999",
        settings: [{ format: "PNG" }],
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });
  });

  // ============================================================
  // set_image_fill
  // ============================================================

  describe("set_image_fill", () => {
    it("sets an image fill from base64 data", async () => {
      const rect = createMockRectangle("Image Holder");
      mockFigma.currentPage.appendChild(rect as unknown as MockSceneNode);

      const result = await setImageFill({
        nodeId: rect.id,
        imageBase64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      });

      expect(result.success).toBe(true);
      expect(mockFigma.createImage).toHaveBeenCalledOnce();
      const data = result.data as Record<string, unknown>;
      expect(data.imageHash).toBeDefined();
    });

    it("sets an image fill with FILL scale mode", async () => {
      const rect = createMockRectangle("Cover Image");
      mockFigma.currentPage.appendChild(rect as unknown as MockSceneNode);

      const result = await setImageFill({
        nodeId: rect.id,
        imageBase64: "iVBORw0KGgoAAAANSUhEUg==",
        scaleMode: "FILL",
      });

      expect(result.success).toBe(true);
    });

    it("sets an image fill with FIT scale mode", async () => {
      const rect = createMockRectangle("Fit Image");
      mockFigma.currentPage.appendChild(rect as unknown as MockSceneNode);

      const result = await setImageFill({
        nodeId: rect.id,
        imageBase64: "iVBORw0KGgoAAAANSUhEUg==",
        scaleMode: "FIT",
      });

      expect(result.success).toBe(true);
    });

    it("sets an image fill with CROP scale mode", async () => {
      const rect = createMockRectangle("Crop Image");
      mockFigma.currentPage.appendChild(rect as unknown as MockSceneNode);

      const result = await setImageFill({
        nodeId: rect.id,
        imageBase64: "iVBORw0KGgoAAAANSUhEUg==",
        scaleMode: "CROP",
      });

      expect(result.success).toBe(true);
    });

    it("sets an image fill with TILE scale mode", async () => {
      const rect = createMockRectangle("Tile Image");
      mockFigma.currentPage.appendChild(rect as unknown as MockSceneNode);

      const result = await setImageFill({
        nodeId: rect.id,
        imageBase64: "iVBORw0KGgoAAAANSUhEUg==",
        scaleMode: "TILE",
      });

      expect(result.success).toBe(true);
    });

    it("fails if nodeId is missing", async () => {
      const result = await setImageFill({
        imageBase64: "iVBORw0KGgoAAAANSUhEUg==",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("nodeId");
    });

    it("fails if neither imageBase64 nor imageUrl is provided", async () => {
      const rect = createMockRectangle("Empty");
      mockFigma.currentPage.appendChild(rect as unknown as MockSceneNode);

      const result = await setImageFill({ nodeId: rect.id });

      expect(result.success).toBe(false);
      expect(result.error).toContain("imageBase64 or imageUrl");
    });

    it("fails if node is not found", async () => {
      const result = await setImageFill({
        nodeId: "999:999",
        imageBase64: "iVBORw0KGgoAAAANSUhEUg==",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });

    it("fails if node does not support fills", async () => {
      const text = createMockText("Label", "Hello");
      // Remove fills property to simulate a node without fill support
      delete (text as unknown as Record<string, unknown>).fills;
      mockFigma.currentPage.appendChild(text as unknown as MockSceneNode);

      const result = await setImageFill({
        nodeId: text.id,
        imageBase64: "iVBORw0KGgoAAAANSUhEUg==",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("does not support fills");
    });

    it("fails if scaleMode is invalid", async () => {
      const rect = createMockRectangle("Bad Scale");
      mockFigma.currentPage.appendChild(rect as unknown as MockSceneNode);

      const result = await setImageFill({
        nodeId: rect.id,
        imageBase64: "iVBORw0KGgoAAAANSUhEUg==",
        scaleMode: "STRETCH",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid scaleMode");
    });
  });

  // ============================================================
  // get_node_css
  // ============================================================

  describe("get_node_css", () => {
    it("extracts CSS properties from a rectangle", async () => {
      const rect = createMockRectangle("Box");
      rect.width = 200;
      rect.height = 100;
      rect.cornerRadius = 8;
      rect.opacity = 0.9;
      mockFigma.currentPage.appendChild(rect as unknown as MockSceneNode);

      const result = await getNodeCss({ nodeId: rect.id });

      expect(result.success).toBe(true);
      const data = result.data as Record<string, unknown>;
      expect(data.css).toBeDefined();
      expect(typeof data.css).toBe("string");
      const css = data.css as string;
      expect(css).toContain("width");
      expect(css).toContain("height");
      expect(css).toContain("border-radius");
    });

    it("extracts CSS from a text node", async () => {
      const text = createMockText("Heading", "Welcome");
      text.fontSize = 24;
      text.fontName = { family: "Inter", style: "Bold" };
      text.fontWeight = 700;
      mockFigma.currentPage.appendChild(text as unknown as MockSceneNode);

      const result = await getNodeCss({ nodeId: text.id });

      expect(result.success).toBe(true);
      const css = (result.data as Record<string, unknown>).css as string;
      expect(css).toContain("font-family");
      expect(css).toContain("font-size");
    });

    it("extracts CSS from a frame with auto-layout", async () => {
      const frame = createMockFrame("Container");
      frame.layoutMode = "VERTICAL";
      frame.itemSpacing = 16;
      frame.paddingTop = 24;
      frame.paddingRight = 24;
      frame.paddingBottom = 24;
      frame.paddingLeft = 24;
      mockFigma.currentPage.appendChild(frame as unknown as MockSceneNode);

      const result = await getNodeCss({ nodeId: frame.id });

      expect(result.success).toBe(true);
      const css = (result.data as Record<string, unknown>).css as string;
      expect(css).toContain("display: flex");
      expect(css).toContain("flex-direction: column");
      expect(css).toContain("gap: 16px");
    });

    it("returns Tailwind classes when format is tailwind", async () => {
      const rect = createMockRectangle("TW Box");
      rect.width = 200;
      rect.height = 100;
      rect.cornerRadius = 8;
      mockFigma.currentPage.appendChild(rect as unknown as MockSceneNode);

      const result = await getNodeCss({
        nodeId: rect.id,
        format: "tailwind",
      });

      expect(result.success).toBe(true);
      const data = result.data as Record<string, unknown>;
      expect(data.tailwind).toBeDefined();
      expect(typeof data.tailwind).toBe("string");
    });

    it("fails if nodeId is missing", async () => {
      const result = await getNodeCss({});

      expect(result.success).toBe(false);
      expect(result.error).toContain("nodeId");
    });

    it("fails if node is not found", async () => {
      const result = await getNodeCss({ nodeId: "999:999" });

      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });
  });
});
