// plugin/__tests__/pages.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createMockFigma,
  createMockPage,
  createMockFrame,
  resetIdCounter,
  type MockFigmaGlobal,
  type MockSceneNode,
  type MockPageNode,
} from "../../test/mocks/figma-api-phase4.js";
import {
  createPage,
  switchPage,
  createSection,
  setPageBackground,
} from "../executors/pages.js";

describe("Page Executors", () => {
  let mockFigma: MockFigmaGlobal;

  beforeEach(() => {
    resetIdCounter();
    mockFigma = createMockFigma();
    (globalThis as unknown as { figma: MockFigmaGlobal }).figma = mockFigma;
  });

  // ============================================================
  // create_page
  // ============================================================

  describe("create_page", () => {
    it("creates a new page with the given name", async () => {
      const result = await createPage({ name: "Settings" });

      expect(result.success).toBe(true);
      expect(mockFigma.createPage).toHaveBeenCalledOnce();
      const data = result.data as Record<string, unknown>;
      expect(data.name).toBe("Settings");
      expect(data.type).toBe("PAGE");
    });

    it("fails if name is missing", async () => {
      const result = await createPage({});

      expect(result.success).toBe(false);
      expect(result.error).toContain("name");
    });

    it("fails if name is empty string", async () => {
      const result = await createPage({ name: "" });

      expect(result.success).toBe(false);
      expect(result.error).toContain("name");
    });
  });

  // ============================================================
  // switch_page
  // ============================================================

  describe("switch_page", () => {
    it("switches to a page by ID", async () => {
      const page = mockFigma.root.children[0];

      const result = await switchPage({ pageId: page.id });

      expect(result.success).toBe(true);
      expect(mockFigma.currentPage).toBe(page);
    });

    it("switches to a page by name", async () => {
      // Create a second page
      const page2 = createMockPage("Design System");
      page2.parent = mockFigma.root as unknown as null;
      mockFigma.root.children.push(page2);

      const result = await switchPage({ pageName: "Design System" });

      expect(result.success).toBe(true);
      expect(mockFigma.currentPage.name).toBe("Design System");
    });

    it("fails if neither pageId nor pageName is provided", async () => {
      const result = await switchPage({});

      expect(result.success).toBe(false);
      expect(result.error).toContain("pageId or pageName");
    });

    it("fails if page is not found by ID", async () => {
      const result = await switchPage({ pageId: "999:999" });

      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });

    it("fails if page is not found by name", async () => {
      const result = await switchPage({ pageName: "Nonexistent" });

      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });
  });

  // ============================================================
  // create_section
  // ============================================================

  describe("create_section", () => {
    it("creates a section with the given name", async () => {
      const result = await createSection({ name: "Sprint 1" });

      expect(result.success).toBe(true);
      expect(mockFigma.createSection).toHaveBeenCalledOnce();
      const data = result.data as Record<string, unknown>;
      expect(data.name).toBe("Sprint 1");
      expect(data.type).toBe("SECTION");
    });

    it("creates a section with position and size", async () => {
      const result = await createSection({
        name: "Header Section",
        x: 100,
        y: 200,
        width: 800,
        height: 600,
      });

      expect(result.success).toBe(true);
      const data = result.data as Record<string, unknown>;
      expect(data.x).toBe(100);
      expect(data.y).toBe(200);
      expect(data.width).toBe(800);
      expect(data.height).toBe(600);
    });

    it("uses default position and size when not specified", async () => {
      const result = await createSection({ name: "Default Section" });

      expect(result.success).toBe(true);
      const data = result.data as Record<string, unknown>;
      // Default position is 0,0; section has default mock size
      expect(data.nodeId).toBeDefined();
    });

    it("fails if name is missing", async () => {
      const result = await createSection({});

      expect(result.success).toBe(false);
      expect(result.error).toContain("name");
    });

    it("fails if name is empty", async () => {
      const result = await createSection({ name: "" });

      expect(result.success).toBe(false);
      expect(result.error).toContain("name");
    });
  });

  // ============================================================
  // set_page_background
  // ============================================================

  describe("set_page_background", () => {
    it("sets the background color of the current page", async () => {
      const result = await setPageBackground({ color: "#FFFFFF" });

      expect(result.success).toBe(true);
      const data = result.data as Record<string, unknown>;
      expect(data.color).toBe("#FFFFFF");
    });

    it("sets the background color of a specific page by ID", async () => {
      const page = mockFigma.root.children[0];

      const result = await setPageBackground({
        pageId: page.id,
        color: "#1E1E1E",
      });

      expect(result.success).toBe(true);
    });

    it("fails if color is missing", async () => {
      const result = await setPageBackground({});

      expect(result.success).toBe(false);
      expect(result.error).toContain("color");
    });

    it("fails if color is not a valid hex color", async () => {
      const result = await setPageBackground({ color: "red" });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid hex color");
    });

    it("fails if specified page is not found", async () => {
      const result = await setPageBackground({
        pageId: "999:999",
        color: "#FF0000",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });
  });
});
