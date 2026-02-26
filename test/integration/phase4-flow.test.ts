// test/integration/phase4-flow.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { WebSocketManager } from "../../src/server/websocket.js";
import { FigmaMcpServer } from "../../src/server/mcp.js";
import WebSocket from "ws";
import type { Command, CommandResponse } from "../../shared/protocol.js";

describe("Phase 4 Integration: Components + Pages + Vectors", () => {
  let wsManager: WebSocketManager;
  let mcpServer: FigmaMcpServer;
  let pluginClient: WebSocket;

  beforeEach(async () => {
    wsManager = new WebSocketManager();
    await wsManager.start(0); // random port
    mcpServer = new FigmaMcpServer(wsManager);

    const port = wsManager.port;
    pluginClient = new WebSocket(`ws://localhost:${port}`);
    await new Promise<void>((resolve) => pluginClient.on("open", resolve));

    // Handshake
    pluginClient.send(
      JSON.stringify({
        type: "handshake",
        fileInfo: {
          name: "Phase 4 Test File",
          id: "file-phase4",
          pages: [{ id: "page-1", name: "Home" }],
          nodeCount: 50,
        },
      })
    );

    await new Promise<void>((resolve) => {
      pluginClient.on("message", (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === "handshake_ack") resolve();
      });
    });
  });

  afterEach(async () => {
    pluginClient.close();
    await wsManager.close();
  });

  // Helper: simulate plugin receiving a command and sending a response
  function autoRespondToCommands(
    response: (cmd: Command) => CommandResponse
  ): void {
    pluginClient.on("message", (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === "command") {
        const cmd = msg.payload as Command;
        const resp = response(cmd);
        pluginClient.send(
          JSON.stringify({ type: "response", payload: resp })
        );
      }
    });
  }

  it("routes create_component through the full stack", async () => {
    autoRespondToCommands((cmd) => ({
      id: cmd.id,
      success: true,
      data: { nodeId: "100:1", type: "COMPONENT", name: "Card" },
    }));

    const router = mcpServer.getRouter();
    const result = await router.routeStructuredCommand("create_component", {
      nodeId: "50:1",
    });

    expect(result.success).toBe(true);
    expect((result.data as Record<string, unknown>).type).toBe("COMPONENT");
  });

  it("routes create_instance through the full stack", async () => {
    autoRespondToCommands((cmd) => ({
      id: cmd.id,
      success: true,
      data: {
        nodeId: "100:2",
        type: "INSTANCE",
        name: "Card Instance",
        x: 200,
        y: 300,
      },
    }));

    const router = mcpServer.getRouter();
    const result = await router.routeStructuredCommand("create_instance", {
      componentId: "50:1",
      x: 200,
      y: 300,
    });

    expect(result.success).toBe(true);
    expect((result.data as Record<string, unknown>).type).toBe("INSTANCE");
  });

  it("routes create_page through the full stack", async () => {
    autoRespondToCommands((cmd) => ({
      id: cmd.id,
      success: true,
      data: { nodeId: "200:1", type: "PAGE", name: "Settings" },
    }));

    const router = mcpServer.getRouter();
    const result = await router.routeStructuredCommand("create_page", {
      name: "Settings",
    });

    expect(result.success).toBe(true);
    expect((result.data as Record<string, unknown>).name).toBe("Settings");
  });

  it("routes boolean_operation through the full stack", async () => {
    autoRespondToCommands((cmd) => ({
      id: cmd.id,
      success: true,
      data: {
        nodeId: "300:1",
        type: "BOOLEAN_OPERATION",
        operation: "UNION",
      },
    }));

    const router = mcpServer.getRouter();
    const result = await router.routeStructuredCommand("boolean_operation", {
      nodeIds: ["50:1", "50:2"],
      operation: "UNION",
    });

    expect(result.success).toBe(true);
    expect((result.data as Record<string, unknown>).operation).toBe("UNION");
  });

  it("routes a compound batch with Phase 4 commands", async () => {
    let callCount = 0;
    autoRespondToCommands((cmd) => {
      if (cmd.type === "batch" && cmd.batch) {
        const batchResults = cmd.batch.map((sub) => ({
          id: sub.id,
          success: true,
          data: { nodeId: `batch-${++callCount}:1` },
        }));
        return {
          id: cmd.id,
          success: true,
          data: { batchResults },
        };
      }
      return { id: cmd.id, success: true, data: {} };
    });

    const router = mcpServer.getRouter();
    const result = await router.routeBatch([
      { command: "create_page", params: { name: "New Page" } },
      { command: "create_component", params: { nodeId: "$0" } },
      {
        command: "create_instance",
        params: { componentId: "$1", x: 100, y: 100 },
      },
    ]);

    expect(result.success).toBe(true);
    expect(result.operations).toHaveLength(3);
    expect(result.nodeIds).toHaveLength(3);
  });

  it("handles plugin errors for Phase 4 commands", async () => {
    autoRespondToCommands((cmd) => ({
      id: cmd.id,
      success: false,
      error: "Node 999:999 not found",
    }));

    const router = mcpServer.getRouter();
    const result = await router.routeStructuredCommand("swap_instance", {
      instanceId: "999:999",
      newComponentId: "1:1",
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("not found");
  });

  it("correctly categorizes all 13 Phase 4 commands", () => {
    const router = mcpServer.getRouter();

    // Components (6)
    expect(router.getCategory("create_component")).toBe("components");
    expect(router.getCategory("create_component_set")).toBe("components");
    expect(router.getCategory("create_instance")).toBe("components");
    expect(router.getCategory("swap_instance")).toBe("components");
    expect(router.getCategory("set_instance_override")).toBe("components");
    expect(router.getCategory("detach_instance")).toBe("components");

    // Pages (4)
    expect(router.getCategory("create_page")).toBe("pages");
    expect(router.getCategory("switch_page")).toBe("pages");
    expect(router.getCategory("create_section")).toBe("pages");
    expect(router.getCategory("set_page_background")).toBe("pages");

    // Vectors (3)
    expect(router.getCategory("boolean_operation")).toBe("vectors");
    expect(router.getCategory("flatten_node")).toBe("vectors");
    expect(router.getCategory("set_mask")).toBe("vectors");
  });
});
