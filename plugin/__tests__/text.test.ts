// plugin/__tests__/text.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  setupMockFigma,
  teardownMockFigma,
  MockNode,
  registerNode,
} from "../../test/mocks/figma-api.js";
import { getExecutor } from "../executors/index.js";

describe("Text Executors", () => {
  let mockFigma: ReturnType<typeof setupMockFigma>;

  beforeEach(() => {
    mockFigma = setupMockFigma();
  });

  afterEach(() => {
    teardownMockFigma();
  });

  // ============================================================
  // set_text_content
  // ============================================================
  describe("set_text_content", () => {
    it("sets text content on a text node", async () => {
      const textNode = new MockNode({
        id: "10:1",
        name: "Label",
        type: "TEXT",
        characters: "Old text",
        fontName: { family: "Inter", style: "Regular" },
      });
      registerNode(textNode);
      mockFigma.currentPage.appendChild(textNode);

      const exec = getExecutor("set_text_content")!;
      const result = await exec({ nodeId: "10:1", text: "New text" });

      expect(result.success).toBe(true);
      expect(textNode.characters).toBe("New text");
      expect(mockFigma.loadFontAsync).toHaveBeenCalled();
    });

    it("returns error when nodeId is missing", async () => {
      const exec = getExecutor("set_text_content")!;
      const result = await exec({ text: "Hello" });

      expect(result.success).toBe(false);
      expect(result.error).toContain("nodeId");
    });

    it("returns error when text is missing", async () => {
      const textNode = new MockNode({
        id: "10:1",
        type: "TEXT",
        characters: "Old",
      });
      registerNode(textNode);

      const exec = getExecutor("set_text_content")!;
      const result = await exec({ nodeId: "10:1" });

      expect(result.success).toBe(false);
      expect(result.error).toContain("text");
    });

    it("returns error for non-text node", async () => {
      const frame = new MockNode({
        id: "10:1",
        type: "FRAME",
        name: "Frame",
      });
      registerNode(frame);
      mockFigma.currentPage.appendChild(frame);

      const exec = getExecutor("set_text_content")!;
      const result = await exec({ nodeId: "10:1", text: "Hello" });

      expect(result.success).toBe(false);
      expect(result.error).toContain("TEXT");
    });
  });

  // ============================================================
  // set_text_style
  // ============================================================
  describe("set_text_style", () => {
    it("sets font family and size", async () => {
      const textNode = new MockNode({
        id: "10:1",
        type: "TEXT",
        characters: "Styled",
        fontName: { family: "Inter", style: "Regular" },
        fontSize: 16,
      });
      registerNode(textNode);
      mockFigma.currentPage.appendChild(textNode);

      const exec = getExecutor("set_text_style")!;
      const result = await exec({
        nodeId: "10:1",
        fontFamily: "Roboto",
        fontSize: 24,
      });

      expect(result.success).toBe(true);
      expect(mockFigma.loadFontAsync).toHaveBeenCalled();
    });

    it("returns error when nodeId is missing", async () => {
      const exec = getExecutor("set_text_style")!;
      const result = await exec({ fontSize: 24 });

      expect(result.success).toBe(false);
      expect(result.error).toContain("nodeId");
    });

    it("returns error for non-text node", async () => {
      const frame = new MockNode({
        id: "10:1",
        type: "FRAME",
        name: "Frame",
      });
      registerNode(frame);
      mockFigma.currentPage.appendChild(frame);

      const exec = getExecutor("set_text_style")!;
      const result = await exec({ nodeId: "10:1", fontSize: 24 });

      expect(result.success).toBe(false);
      expect(result.error).toContain("TEXT");
    });

    it("returns error when no style params provided", async () => {
      const textNode = new MockNode({
        id: "10:1",
        type: "TEXT",
        characters: "Text",
      });
      registerNode(textNode);
      mockFigma.currentPage.appendChild(textNode);

      const exec = getExecutor("set_text_style")!;
      const result = await exec({ nodeId: "10:1" });

      expect(result.success).toBe(false);
      expect(result.error).toContain("style");
    });
  });

  // ============================================================
  // set_text_color
  // ============================================================
  describe("set_text_color", () => {
    it("sets text color from hex string", async () => {
      const textNode = new MockNode({
        id: "10:1",
        type: "TEXT",
        characters: "Colored",
        fontName: { family: "Inter", style: "Regular" },
      });
      registerNode(textNode);
      mockFigma.currentPage.appendChild(textNode);

      const exec = getExecutor("set_text_color")!;
      const result = await exec({ nodeId: "10:1", color: "#FF0000" });

      expect(result.success).toBe(true);
    });

    it("returns error when color is missing", async () => {
      const textNode = new MockNode({
        id: "10:1",
        type: "TEXT",
        characters: "Text",
      });
      registerNode(textNode);

      const exec = getExecutor("set_text_color")!;
      const result = await exec({ nodeId: "10:1" });

      expect(result.success).toBe(false);
      expect(result.error).toContain("color");
    });

    it("returns error for invalid hex color", async () => {
      const textNode = new MockNode({
        id: "10:1",
        type: "TEXT",
        characters: "Text",
      });
      registerNode(textNode);
      mockFigma.currentPage.appendChild(textNode);

      const exec = getExecutor("set_text_color")!;
      const result = await exec({ nodeId: "10:1", color: "not-a-color" });

      expect(result.success).toBe(false);
      expect(result.error).toContain("hex");
    });

    it("returns error for non-text node", async () => {
      const frame = new MockNode({
        id: "10:1",
        type: "FRAME",
        name: "Frame",
      });
      registerNode(frame);
      mockFigma.currentPage.appendChild(frame);

      const exec = getExecutor("set_text_color")!;
      const result = await exec({ nodeId: "10:1", color: "#FF0000" });

      expect(result.success).toBe(false);
      expect(result.error).toContain("TEXT");
    });
  });

  // ============================================================
  // set_text_alignment
  // ============================================================
  describe("set_text_alignment", () => {
    it("sets horizontal alignment", async () => {
      const textNode = new MockNode({
        id: "10:1",
        type: "TEXT",
        characters: "Aligned",
        fontName: { family: "Inter", style: "Regular" },
      });
      registerNode(textNode);
      mockFigma.currentPage.appendChild(textNode);

      const exec = getExecutor("set_text_alignment")!;
      const result = await exec({ nodeId: "10:1", horizontal: "CENTER" });

      expect(result.success).toBe(true);
      expect(textNode.textAlignHorizontal).toBe("CENTER");
    });

    it("sets vertical alignment", async () => {
      const textNode = new MockNode({
        id: "10:1",
        type: "TEXT",
        characters: "Aligned",
        fontName: { family: "Inter", style: "Regular" },
      });
      registerNode(textNode);
      mockFigma.currentPage.appendChild(textNode);

      const exec = getExecutor("set_text_alignment")!;
      const result = await exec({ nodeId: "10:1", vertical: "CENTER" });

      expect(result.success).toBe(true);
      expect(textNode.textAlignVertical).toBe("CENTER");
    });

    it("sets both alignments", async () => {
      const textNode = new MockNode({
        id: "10:1",
        type: "TEXT",
        characters: "Aligned",
        fontName: { family: "Inter", style: "Regular" },
      });
      registerNode(textNode);
      mockFigma.currentPage.appendChild(textNode);

      const exec = getExecutor("set_text_alignment")!;
      const result = await exec({
        nodeId: "10:1",
        horizontal: "RIGHT",
        vertical: "BOTTOM",
      });

      expect(result.success).toBe(true);
      expect(textNode.textAlignHorizontal).toBe("RIGHT");
      expect(textNode.textAlignVertical).toBe("BOTTOM");
    });

    it("returns error for invalid horizontal value", async () => {
      const textNode = new MockNode({
        id: "10:1",
        type: "TEXT",
        characters: "Text",
      });
      registerNode(textNode);
      mockFigma.currentPage.appendChild(textNode);

      const exec = getExecutor("set_text_alignment")!;
      const result = await exec({ nodeId: "10:1", horizontal: "INVALID" });

      expect(result.success).toBe(false);
      expect(result.error).toContain("horizontal");
    });

    it("returns error for invalid vertical value", async () => {
      const textNode = new MockNode({
        id: "10:1",
        type: "TEXT",
        characters: "Text",
      });
      registerNode(textNode);
      mockFigma.currentPage.appendChild(textNode);

      const exec = getExecutor("set_text_alignment")!;
      const result = await exec({ nodeId: "10:1", vertical: "INVALID" });

      expect(result.success).toBe(false);
      expect(result.error).toContain("vertical");
    });

    it("returns error when no alignment params provided", async () => {
      const textNode = new MockNode({
        id: "10:1",
        type: "TEXT",
        characters: "Text",
      });
      registerNode(textNode);
      mockFigma.currentPage.appendChild(textNode);

      const exec = getExecutor("set_text_alignment")!;
      const result = await exec({ nodeId: "10:1" });

      expect(result.success).toBe(false);
      expect(result.error).toContain("alignment");
    });
  });

  // ============================================================
  // find_replace_text
  // ============================================================
  describe("find_replace_text", () => {
    it("finds and replaces text in all text nodes on the page", async () => {
      const text1 = new MockNode({
        id: "10:1",
        type: "TEXT",
        characters: "Hello World",
        fontName: { family: "Inter", style: "Regular" },
      });
      const text2 = new MockNode({
        id: "10:2",
        type: "TEXT",
        characters: "Hello Figma",
        fontName: { family: "Inter", style: "Regular" },
      });
      registerNode(text1);
      registerNode(text2);
      mockFigma.currentPage.children = [text1, text2];

      const exec = getExecutor("find_replace_text")!;
      const result = await exec({
        pattern: "Hello",
        replacement: "Hi",
        scope: "page",
      });

      expect(result.success).toBe(true);
      expect(text1.characters).toBe("Hi World");
      expect(text2.characters).toBe("Hi Figma");
      const data = result.data as Record<string, unknown>;
      expect(data.replacedCount).toBe(2);
    });

    it("finds and replaces with regex support", async () => {
      const text1 = new MockNode({
        id: "10:1",
        type: "TEXT",
        characters: "Item 123",
        fontName: { family: "Inter", style: "Regular" },
      });
      registerNode(text1);
      mockFigma.currentPage.children = [text1];

      const exec = getExecutor("find_replace_text")!;
      const result = await exec({
        pattern: "\\d+",
        replacement: "999",
        scope: "page",
        regex: true,
      });

      expect(result.success).toBe(true);
      expect(text1.characters).toBe("Item 999");
    });

    it("scopes replacement to a specific node and its children", async () => {
      const inner = new MockNode({
        id: "10:2",
        type: "TEXT",
        characters: "Hello Inside",
        fontName: { family: "Inter", style: "Regular" },
      });
      const container = new MockNode({
        id: "10:1",
        type: "FRAME",
        name: "Container",
        children: [inner],
      });
      const outside = new MockNode({
        id: "10:3",
        type: "TEXT",
        characters: "Hello Outside",
        fontName: { family: "Inter", style: "Regular" },
      });
      registerNode(container);
      registerNode(outside);
      mockFigma.currentPage.children = [container, outside];

      const exec = getExecutor("find_replace_text")!;
      const result = await exec({
        pattern: "Hello",
        replacement: "Hi",
        scope: "10:1",
      });

      expect(result.success).toBe(true);
      expect(inner.characters).toBe("Hi Inside");
      expect(outside.characters).toBe("Hello Outside"); // Unchanged
    });

    it("returns error when pattern is missing", async () => {
      const exec = getExecutor("find_replace_text")!;
      const result = await exec({ replacement: "Hi", scope: "page" });

      expect(result.success).toBe(false);
      expect(result.error).toContain("pattern");
    });

    it("returns error when replacement is missing", async () => {
      const exec = getExecutor("find_replace_text")!;
      const result = await exec({ pattern: "Hello", scope: "page" });

      expect(result.success).toBe(false);
      expect(result.error).toContain("replacement");
    });

    it("returns error when scope is missing", async () => {
      const exec = getExecutor("find_replace_text")!;
      const result = await exec({ pattern: "Hello", replacement: "Hi" });

      expect(result.success).toBe(false);
      expect(result.error).toContain("scope");
    });

    it("handles zero matches gracefully", async () => {
      const text1 = new MockNode({
        id: "10:1",
        type: "TEXT",
        characters: "No match here",
        fontName: { family: "Inter", style: "Regular" },
      });
      registerNode(text1);
      mockFigma.currentPage.children = [text1];

      const exec = getExecutor("find_replace_text")!;
      const result = await exec({
        pattern: "ZZZZZ",
        replacement: "Y",
        scope: "page",
      });

      expect(result.success).toBe(true);
      const data = result.data as Record<string, unknown>;
      expect(data.replacedCount).toBe(0);
    });
  });
});
