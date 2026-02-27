import { describe, it, expect, vi, beforeEach } from "vitest";
import { Router } from "../../src/server/router.js";
import { RestReadAdapter } from "../../src/server/rest-adapter.js";
import { FigmaApiClient } from "../../src/server/figma-api.js";
import { CommandQueue } from "../../src/server/command-queue.js";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const MOCK_FILE_RESPONSE = {
  ok: true,
  json: async () => ({
    name: "Integration Test File",
    document: {
      id: "0:0",
      type: "DOCUMENT",
      children: [
        {
          id: "0:1",
          name: "Page 1",
          type: "CANVAS",
          children: [
            {
              id: "1:2",
              name: "Hero Frame",
              type: "FRAME",
              absoluteBoundingBox: { x: 0, y: 0, width: 1440, height: 900 },
              children: [
                { id: "1:3", name: "Title", type: "TEXT", absoluteBoundingBox: { x: 100, y: 100, width: 300, height: 40 } },
                { id: "1:4", name: "CTA Button", type: "RECTANGLE", absoluteBoundingBox: { x: 100, y: 200, width: 200, height: 48 } },
              ],
            },
            {
              id: "2:1",
              name: "Card Component",
              type: "COMPONENT",
              absoluteBoundingBox: { x: 0, y: 1000, width: 320, height: 400 },
              children: [],
            },
          ],
        },
      ],
    },
  }),
};

describe("Hybrid Flow Integration", () => {
  let queue: CommandQueue;
  let restAdapter: RestReadAdapter;

  beforeEach(() => {
    queue = new CommandQueue();
    const client = new FigmaApiClient("figd_test_token");
    restAdapter = new RestReadAdapter(client);
    restAdapter.setFileKey("abc123");
    mockFetch.mockReset();
  });

  describe("REST API mode (plugin disconnected)", () => {
    it("should read page nodes via REST API", async () => {
      const router = new Router(queue, { restAdapter, isPluginConnected: () => false });
      mockFetch.mockResolvedValueOnce(MOCK_FILE_RESPONSE);

      const result = await router.routeStructuredCommand("get_page_nodes", {});
      expect(result.success).toBe(true);
      const data = result.data as { nodes: { name: string }[]; pageName: string };
      expect(data.pageName).toBe("Page 1");
      expect(data.nodes).toHaveLength(2);
      expect(data.nodes[0].name).toBe("Hero Frame");
      expect(data.nodes[1].name).toBe("Card Component");
    });

    it("should search nodes via REST API", async () => {
      const router = new Router(queue, { restAdapter, isPluginConnected: () => false });
      mockFetch.mockResolvedValueOnce(MOCK_FILE_RESPONSE);

      const result = await router.routeStructuredCommand("search_nodes", { query: "Button" });
      expect(result.success).toBe(true);
      const data = result.data as { nodes: { name: string }[]; count: number };
      expect(data.count).toBe(1);
      expect(data.nodes[0].name).toBe("CTA Button");
    });

    it("should export node via REST API", async () => {
      const router = new Router(queue, { restAdapter, isPluginConnected: () => false });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ images: { "1:2": "https://figma-cdn.com/hero.png" } }),
      });

      const result = await router.routeStructuredCommand("export_node", { nodeId: "1:2", format: "png" });
      expect(result.success).toBe(true);
      const data = result.data as { url: string };
      expect(data.url).toBe("https://figma-cdn.com/hero.png");
    });

    it("should reject write commands with helpful error", async () => {
      const router = new Router(queue, { restAdapter, isPluginConnected: () => false });

      const result = await router.routeStructuredCommand("create_node", { nodeType: "FRAME" });
      expect(result.success).toBe(false);
      expect(result.error).toContain("write");
      expect(result.error).toContain("plugin");
    });

    it("should reject plugin-only reads", async () => {
      const router = new Router(queue, { restAdapter, isPluginConnected: () => false });

      const result = await router.routeStructuredCommand("get_selection", {});
      expect(result.success).toBe(false);
      expect(result.error).toContain("plugin");
    });

    it("should route category commands through REST API", async () => {
      const router = new Router(queue, { restAdapter, isPluginConnected: () => false });
      mockFetch.mockResolvedValueOnce(MOCK_FILE_RESPONSE);

      const result = await router.routeCategoryCommand("reading", "get_page_nodes", {});
      expect(result.success).toBe(true);
    });
  });

  describe("Plugin mode (plugin connected)", () => {
    it("should route reads through plugin when connected", async () => {
      const router = new Router(queue, { restAdapter, isPluginConnected: () => true });

      queue.onCommand((cmd) => {
        queue.resolveWithResponse({
          id: cmd.id,
          success: true,
          data: { nodes: [{ id: "1:2", name: "Frame", type: "FRAME" }] },
        });
      });

      const result = await router.routeStructuredCommand("get_page_nodes", {});
      expect(result.success).toBe(true);
      // Should NOT call fetch (REST API) — everything goes through plugin
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should route writes through plugin when connected", async () => {
      const router = new Router(queue, { restAdapter, isPluginConnected: () => true });

      queue.onCommand((cmd) => {
        queue.resolveWithResponse({
          id: cmd.id,
          success: true,
          data: { nodeId: "1:99", type: "FRAME" },
        });
      });

      const result = await router.routeStructuredCommand("create_node", { nodeType: "FRAME" });
      expect(result.success).toBe(true);
      expect((result.data as { nodeId: string }).nodeId).toBe("1:99");
    });
  });

  describe("File URL handling", () => {
    it("should set file key from URL", () => {
      const adapter = new RestReadAdapter(new FigmaApiClient("figd_test"));
      const ok = adapter.setFileUrl("https://www.figma.com/design/XYZ789/MyDesign");
      expect(ok).toBe(true);
      expect(adapter.getFileKey()).toBe("XYZ789");
    });

    it("should reject invalid URLs", () => {
      const adapter = new RestReadAdapter(new FigmaApiClient("figd_test"));
      const ok = adapter.setFileUrl("https://google.com");
      expect(ok).toBe(false);
      expect(adapter.getFileKey()).toBeNull();
    });
  });

  describe("No token mode (fully disconnected)", () => {
    it("should fail gracefully without REST adapter", async () => {
      const router = new Router(queue, { isPluginConnected: () => false });

      const result = await router.routeStructuredCommand("get_page_nodes", {});
      expect(result.success).toBe(false);
      expect(result.error).toContain("write");
    });
  });
});
