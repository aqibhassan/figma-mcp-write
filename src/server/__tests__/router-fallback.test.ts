import { describe, it, expect, vi, beforeEach } from "vitest";
import { Router } from "../router.js";
import { RestReadAdapter } from "../rest-adapter.js";
import { FigmaApiClient } from "../figma-api.js";
import { CommandQueue } from "../command-queue.js";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("Router REST API Fallback", () => {
  let router: Router;
  let queue: CommandQueue;
  let restAdapter: RestReadAdapter;

  beforeEach(() => {
    queue = new CommandQueue();
    const client = new FigmaApiClient("figd_test");
    restAdapter = new RestReadAdapter(client);
    restAdapter.setFileKey("abc123");
    router = new Router(queue, { restAdapter, isPluginConnected: () => false });
    mockFetch.mockReset();
  });

  it("should route read commands to REST API when plugin disconnected", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        name: "Test",
        document: { id: "0:0", type: "DOCUMENT", children: [
          { id: "0:1", name: "Page 1", type: "CANVAS", children: [
            { id: "1:2", name: "Frame", type: "FRAME", absoluteBoundingBox: { x: 0, y: 0, width: 100, height: 100 } },
          ]},
        ]},
      }),
    });

    const result = await router.routeStructuredCommand("get_page_nodes", {});
    expect(result.success).toBe(true);
    expect(result.data).toHaveProperty("nodes");
  });

  it("should return helpful error for write commands when plugin disconnected", async () => {
    const result = await router.routeStructuredCommand("create_node", { nodeType: "RECTANGLE" });
    expect(result.success).toBe(false);
    expect(result.error).toContain("plugin");
  });

  it("should return plugin-only error for get_selection without plugin", async () => {
    const result = await router.routeStructuredCommand("get_selection", {});
    expect(result.success).toBe(false);
    expect(result.error).toContain("plugin");
  });

  it("should route through queue when plugin IS connected", async () => {
    const connectedRouter = new Router(queue, {
      restAdapter,
      isPluginConnected: () => true,
    });

    queue.onCommand((cmd) => {
      queue.resolveWithResponse({ id: cmd.id, success: true, data: { test: true } });
    });

    const result = await connectedRouter.routeStructuredCommand("get_page_nodes", {});
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ test: true });
  });
});
