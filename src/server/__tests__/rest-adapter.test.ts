// src/server/__tests__/rest-adapter.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { RestReadAdapter } from "../rest-adapter.js";
import { FigmaApiClient } from "../figma-api.js";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("RestReadAdapter", () => {
  let adapter: RestReadAdapter;

  beforeEach(() => {
    const client = new FigmaApiClient("figd_test");
    adapter = new RestReadAdapter(client);
    mockFetch.mockReset();
  });

  describe("executeRead", () => {
    it("should handle get_page_nodes", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          name: "Test",
          lastModified: "2026-02-27",
          document: { id: "0:0", type: "DOCUMENT", children: [
            { id: "0:1", name: "Page 1", type: "CANVAS", children: [
              { id: "1:2", name: "Frame", type: "FRAME", absoluteBoundingBox: { x: 0, y: 0, width: 100, height: 100 } },
              { id: "1:3", name: "Rect", type: "RECTANGLE", absoluteBoundingBox: { x: 10, y: 10, width: 50, height: 50 } },
            ]},
          ]},
          styles: {},
          components: {},
        }),
      });
      adapter.setFileKey("abc123");
      const result = await adapter.executeRead("get_page_nodes", {});
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty("nodes");
      const data = result.data as { nodes: unknown[] };
      expect(data.nodes).toHaveLength(2);
    });

    it("should handle get_node", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          nodes: {
            "1:2": { document: { id: "1:2", name: "Frame", type: "FRAME" } },
          },
        }),
      });
      adapter.setFileKey("abc123");
      const result = await adapter.executeRead("get_node", { nodeId: "1:2" });
      expect(result.success).toBe(true);
      expect((result.data as { node: { name: string } }).node.name).toBe("Frame");
    });

    it("should handle search_nodes", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          name: "Test",
          lastModified: "2026-02-27",
          document: { id: "0:0", type: "DOCUMENT", children: [
            { id: "0:1", name: "Page 1", type: "CANVAS", children: [
              { id: "1:2", name: "Login Frame", type: "FRAME" },
              { id: "1:3", name: "Button", type: "RECTANGLE" },
              { id: "1:4", name: "Login Text", type: "TEXT" },
            ]},
          ]},
          styles: {},
          components: {},
        }),
      });
      adapter.setFileKey("abc123");
      const result = await adapter.executeRead("search_nodes", { query: "Login" });
      expect(result.success).toBe(true);
      const data = result.data as { nodes: unknown[]; count: number };
      expect(data.count).toBe(2);
    });

    it("should handle export_node", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          images: { "1:2": "https://cdn.figma.com/img.png" },
        }),
      });
      adapter.setFileKey("abc123");
      const result = await adapter.executeRead("export_node", { nodeId: "1:2", format: "png" });
      expect(result.success).toBe(true);
      expect((result.data as { url: string }).url).toBe("https://cdn.figma.com/img.png");
    });

    it("should handle get_node_css", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          nodes: {
            "1:2": {
              document: {
                id: "1:2", name: "Frame", type: "FRAME",
                absoluteBoundingBox: { x: 0, y: 0, width: 200, height: 100 },
                opacity: 0.8,
                cornerRadius: 8,
              },
            },
          },
        }),
      });
      adapter.setFileKey("abc123");
      const result = await adapter.executeRead("get_node_css", { nodeId: "1:2" });
      expect(result.success).toBe(true);
      const data = result.data as { css: string };
      expect(data.css).toContain("width: 200px");
      expect(data.css).toContain("opacity: 0.8");
      expect(data.css).toContain("border-radius: 8px");
    });

    it("should return error if no file key set", async () => {
      const result = await adapter.executeRead("get_page_nodes", {});
      expect(result.success).toBe(false);
      expect(result.error).toContain("file");
    });

    it("should return error for unsupported command", async () => {
      adapter.setFileKey("abc123");
      const result = await adapter.executeRead("create_node", {});
      expect(result.success).toBe(false);
      expect(result.error).toContain("write");
    });
  });

  describe("canHandle", () => {
    it("should return true for read commands", () => {
      expect(RestReadAdapter.canHandle("get_node")).toBe(true);
      expect(RestReadAdapter.canHandle("get_page_nodes")).toBe(true);
      expect(RestReadAdapter.canHandle("search_nodes")).toBe(true);
      expect(RestReadAdapter.canHandle("export_node")).toBe(true);
    });

    it("should return false for write commands", () => {
      expect(RestReadAdapter.canHandle("create_node")).toBe(false);
      expect(RestReadAdapter.canHandle("set_fill")).toBe(false);
    });

    it("should return false for plugin-only commands", () => {
      expect(RestReadAdapter.canHandle("get_selection")).toBe(false);
      expect(RestReadAdapter.canHandle("scroll_to_node")).toBe(false);
    });
  });
});
