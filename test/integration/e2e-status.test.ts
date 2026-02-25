// test/integration/e2e-status.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { WebSocketManager } from "../../src/server/websocket.js";
import { FigmaMcpServer } from "../../src/server/mcp.js";
import WebSocket from "ws";

describe("End-to-end: figma_status", () => {
  let wsManager: WebSocketManager;
  let mcpServer: FigmaMcpServer;

  beforeEach(async () => {
    wsManager = new WebSocketManager();
    await wsManager.start(0); // random port
    mcpServer = new FigmaMcpServer(wsManager);
  });

  afterEach(async () => {
    await wsManager.close();
  });

  it("returns disconnected status when no plugin is connected", async () => {
    expect(wsManager.isConnected).toBe(false);
  });

  it("returns connected status after plugin handshake", async () => {
    const port = wsManager.port;

    // Simulate a plugin connecting
    const client = new WebSocket(`ws://localhost:${port}`);
    await new Promise<void>((resolve) => client.on("open", resolve));

    client.send(
      JSON.stringify({
        type: "handshake",
        fileInfo: {
          name: "Integration Test File",
          id: "file-integration-1",
          pages: [
            { id: "page-1", name: "Home" },
            { id: "page-2", name: "Settings" },
          ],
          nodeCount: 156,
        },
      })
    );

    // Wait for handshake ack
    await new Promise<void>((resolve) => {
      client.on("message", (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === "handshake_ack") resolve();
      });
    });

    expect(wsManager.isConnected).toBe(true);
    expect(wsManager.fileInfo?.name).toBe("Integration Test File");
    expect(wsManager.fileInfo?.pages).toHaveLength(2);
    expect(wsManager.fileInfo?.nodeCount).toBe(156);

    client.close();
  });

  it("sends commands to plugin and receives responses", async () => {
    const port = wsManager.port;
    const queue = mcpServer.getQueue();

    // Connect plugin
    const client = new WebSocket(`ws://localhost:${port}`);
    await new Promise<void>((resolve) => client.on("open", resolve));

    client.send(
      JSON.stringify({
        type: "handshake",
        fileInfo: { name: "Test", id: "f1", pages: [], nodeCount: 0 },
      })
    );

    await new Promise<void>((resolve) => {
      client.on("message", (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === "handshake_ack") resolve();
      });
    });

    // Plugin echoes back commands as success (simulating executor)
    client.on("message", (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === "command") {
        client.send(
          JSON.stringify({
            type: "response",
            payload: {
              id: msg.payload.id,
              success: true,
              data: { echo: msg.payload.type },
            },
          })
        );
      }
    });

    // Send a command through the queue
    const result = await queue.enqueue("get_selection", {});
    expect(result.success).toBe(true);
    expect((result.data as Record<string, unknown>).echo).toBe("get_selection");

    client.close();
  });
});
