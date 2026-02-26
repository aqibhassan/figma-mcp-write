// test/integration/styling-layout.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { WebSocketManager } from "../../src/server/websocket.js";
import { FigmaMcpServer } from "../../src/server/mcp.js";
import WebSocket from "ws";

/**
 * Integration test: Verifies that styling and layout commands flow
 * correctly from the MCP server through WebSocket to a simulated plugin.
 *
 * The simulated plugin echoes back success responses to verify the
 * routing chain works end-to-end.
 */
describe("Integration: Styling + Layout command flow", () => {
  let wsManager: WebSocketManager;
  let mcpServer: FigmaMcpServer;
  let client: WebSocket;

  beforeEach(async () => {
    wsManager = new WebSocketManager();
    await wsManager.start(0);
    mcpServer = new FigmaMcpServer(wsManager);

    // Connect a mock plugin
    client = new WebSocket(`ws://localhost:${wsManager.port}`);
    await new Promise<void>((resolve) => client.on("open", resolve));

    // Handshake
    client.send(
      JSON.stringify({
        type: "handshake",
        fileInfo: { name: "Style Test File", id: "style-test", pages: [], nodeCount: 50 },
      })
    );
    await new Promise<void>((resolve) => {
      client.on("message", (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === "handshake_ack") resolve();
      });
    });

    // Plugin: echo all commands as success
    client.on("message", (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === "command") {
        client.send(
          JSON.stringify({
            type: "response",
            payload: {
              id: msg.payload.id,
              success: true,
              data: { nodeId: "1:2", command: msg.payload.type },
            },
          })
        );
      }
    });
  });

  afterEach(async () => {
    client.close();
    await wsManager.close();
  });

  // Styling commands
  const stylingCommands = [
    { command: "set_fill", params: { nodeId: "1:2", type: "SOLID", color: "#FF0000" } },
    { command: "set_stroke", params: { nodeId: "1:2", color: "#0000FF", weight: 2 } },
    { command: "set_corner_radius", params: { nodeId: "1:2", radius: 8 } },
    { command: "set_opacity", params: { nodeId: "1:2", opacity: 0.5 } },
    { command: "set_effects", params: { nodeId: "1:2", effects: [{ type: "DROP_SHADOW", radius: 8 }] } },
    { command: "set_blend_mode", params: { nodeId: "1:2", blendMode: "MULTIPLY" } },
    { command: "set_constraints", params: { nodeId: "1:2", horizontal: "CENTER" } },
    { command: "apply_style", params: { nodeId: "1:2", styleName: "Brand/Primary", styleType: "fill" } },
  ];

  for (const { command, params } of stylingCommands) {
    it(`routes ${command} through the styling category`, async () => {
      const queue = mcpServer.getQueue();
      const result = await queue.enqueue(command, params);

      expect(result.success).toBe(true);
      expect((result.data as Record<string, unknown>).command).toBe(command);
    });
  }

  // Layout commands
  const layoutCommands = [
    { command: "set_auto_layout", params: { nodeId: "1:2", direction: "VERTICAL", spacing: 16 } },
    { command: "add_to_auto_layout", params: { parentId: "1:2", childId: "3:1" } },
    { command: "set_layout_grid", params: { nodeId: "1:2", grids: [{ pattern: "COLUMNS", count: 12 }] } },
    { command: "group_nodes", params: { nodeIds: ["1:2", "3:1"], type: "group" } },
    { command: "ungroup_nodes", params: { nodeId: "5:1" } },
  ];

  for (const { command, params } of layoutCommands) {
    it(`routes ${command} through the layout category`, async () => {
      const queue = mcpServer.getQueue();
      const result = await queue.enqueue(command, params);

      expect(result.success).toBe(true);
      expect((result.data as Record<string, unknown>).command).toBe(command);
    });
  }

  it("routes styling commands through the figma_styling category tool", async () => {
    const router = mcpServer.getRouter();

    const result = await router.routeCategoryCommand("styling", "set_fill", {
      nodeId: "1:2",
      type: "SOLID",
      color: "#FF0000",
    });

    expect(result.success).toBe(true);
  });

  it("routes layout commands through the figma_layout category tool", async () => {
    const router = mcpServer.getRouter();

    const result = await router.routeCategoryCommand("layout", "set_auto_layout", {
      nodeId: "1:2",
      direction: "VERTICAL",
    });

    expect(result.success).toBe(true);
  });

  it("rejects styling commands routed to wrong category", async () => {
    const router = mcpServer.getRouter();

    const result = await router.routeCategoryCommand("layout", "set_fill", {
      nodeId: "1:2",
      type: "SOLID",
      color: "#FF0000",
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("does not belong to category");
  });

  it("handles compound operations with styling + layout", async () => {
    const queue = mcpServer.getQueue();

    // Simulate a batch: set auto-layout + set fill + set corner radius
    const batchResult = await queue.enqueueBatch([
      { type: "set_auto_layout", params: { nodeId: "1:2", direction: "VERTICAL", spacing: 16 } },
      { type: "set_fill", params: { nodeId: "1:2", type: "SOLID", color: "#FFFFFF" } },
      { type: "set_corner_radius", params: { nodeId: "1:2", radius: 12 } },
    ]);

    expect(batchResult.success).toBe(true);
  });
});
