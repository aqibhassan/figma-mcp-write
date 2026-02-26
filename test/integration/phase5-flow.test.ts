// test/integration/phase5-flow.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { WebSocketManager } from "../../src/server/websocket.js";
import { FigmaMcpServer } from "../../src/server/mcp.js";
import { DesignSystemManager } from "../../src/server/design-system.js";
import WebSocket from "ws";
import type {
  Command,
  CommandResponse,
  DesignSystemContext,
} from "../../shared/protocol.js";

describe("Phase 5 Integration: Export + Variables + Design System", () => {
  let wsManager: WebSocketManager;
  let mcpServer: FigmaMcpServer;
  let pluginClient: WebSocket;
  let dsManager: DesignSystemManager;

  beforeEach(async () => {
    dsManager = new DesignSystemManager();
    wsManager = new WebSocketManager();
    await wsManager.start(0); // random port
    mcpServer = new FigmaMcpServer(wsManager, dsManager);

    const port = wsManager.port;
    pluginClient = new WebSocket(`ws://localhost:${port}`);
    await new Promise<void>((resolve) => pluginClient.on("open", resolve));

    // Handshake
    pluginClient.send(
      JSON.stringify({
        type: "handshake",
        fileInfo: {
          name: "Phase 5 Test File",
          id: "file-phase5",
          pages: [{ id: "page-1", name: "Home" }],
          nodeCount: 100,
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
    dsManager.clear();
  });

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

  // ============================================================
  // Export Commands
  // ============================================================

  it("routes export_node through the full stack", async () => {
    autoRespondToCommands((cmd) => ({
      id: cmd.id,
      success: true,
      data: {
        nodeId: "50:1",
        format: "PNG",
        base64: "iVBORw0KGgoAAAANSUhEUg==",
        byteLength: 20,
      },
    }));

    const router = mcpServer.getRouter();
    const result = await router.routeStructuredCommand("export_node", {
      nodeId: "50:1",
      format: "PNG",
      scale: 2,
    });

    expect(result.success).toBe(true);
    expect((result.data as Record<string, unknown>).format).toBe("PNG");
    expect((result.data as Record<string, unknown>).base64).toBeDefined();
  });

  it("routes get_node_css through the full stack", async () => {
    autoRespondToCommands((cmd) => ({
      id: cmd.id,
      success: true,
      data: {
        nodeId: "50:1",
        css: "width: 200px;\nheight: 100px;\nborder-radius: 8px;",
      },
    }));

    const router = mcpServer.getRouter();
    const result = await router.routeStructuredCommand("get_node_css", {
      nodeId: "50:1",
    });

    expect(result.success).toBe(true);
    expect((result.data as Record<string, unknown>).css).toBeDefined();
  });

  it("routes set_image_fill through the full stack", async () => {
    autoRespondToCommands((cmd) => ({
      id: cmd.id,
      success: true,
      data: {
        nodeId: "50:1",
        imageHash: "image-hash-123",
        scaleMode: "FILL",
      },
    }));

    const router = mcpServer.getRouter();
    const result = await router.routeStructuredCommand("set_image_fill", {
      nodeId: "50:1",
      imageBase64: "iVBORw0KGgoAAAANSUhEUg==",
    });

    expect(result.success).toBe(true);
    expect((result.data as Record<string, unknown>).imageHash).toBeDefined();
  });

  // ============================================================
  // Variable Commands
  // ============================================================

  it("routes create_variable_collection through the full stack", async () => {
    autoRespondToCommands((cmd) => ({
      id: cmd.id,
      success: true,
      data: {
        collectionId: "VariableCollectionID:1:1",
        name: "Theme",
        modes: [
          { modeId: "mode-0", name: "Light" },
          { modeId: "mode-1", name: "Dark" },
        ],
      },
    }));

    const router = mcpServer.getRouter();
    const result = await router.routeStructuredCommand(
      "create_variable_collection",
      { name: "Theme", modes: ["Light", "Dark"] }
    );

    expect(result.success).toBe(true);
    expect(
      (result.data as Record<string, unknown>).collectionId
    ).toBeDefined();
  });

  it("routes create_variable through the full stack", async () => {
    autoRespondToCommands((cmd) => ({
      id: cmd.id,
      success: true,
      data: {
        variableId: "VariableID:1:1",
        name: "primary/500",
        resolvedType: "COLOR",
      },
    }));

    const router = mcpServer.getRouter();
    const result = await router.routeStructuredCommand("create_variable", {
      name: "primary/500",
      collectionId: "VariableCollectionID:1:1",
      resolvedType: "COLOR",
      value: { r: 0.2, g: 0.4, b: 0.8, a: 1 },
    });

    expect(result.success).toBe(true);
    expect(
      (result.data as Record<string, unknown>).variableId
    ).toBeDefined();
  });

  it("routes bind_variable through the full stack", async () => {
    autoRespondToCommands((cmd) => ({
      id: cmd.id,
      success: true,
      data: {
        nodeId: "50:1",
        property: "fills",
        variableId: "VariableID:1:1",
        variableName: "primary/500",
      },
    }));

    const router = mcpServer.getRouter();
    const result = await router.routeStructuredCommand("bind_variable", {
      nodeId: "50:1",
      property: "fills",
      variableId: "VariableID:1:1",
    });

    expect(result.success).toBe(true);
  });

  // ============================================================
  // Design System Context
  // ============================================================

  it("receives and stores design system context from plugin", async () => {
    const sampleContext: DesignSystemContext = {
      variables: {
        collections: [
          {
            id: "VariableCollectionID:1:1",
            name: "Brand",
            modes: [{ id: "mode-0", name: "Default" }],
            variableCount: 2,
          },
        ],
        colorTokens: [
          {
            id: "VariableID:1:1",
            name: "primary/500",
            type: "COLOR",
            value: { r: 0.2, g: 0.4, b: 0.8 },
            collectionId: "VariableCollectionID:1:1",
          },
        ],
        spacingTokens: [],
        typographyTokens: [],
      },
      styles: {
        textStyles: [],
        colorStyles: [],
        effectStyles: [],
        gridStyles: [],
      },
      components: { local: [], external: [] },
      conventions: {
        namingPattern: "unknown",
        spacingScale: [],
        colorPalette: [],
      },
    };

    // Simulate plugin sending design system result
    pluginClient.send(
      JSON.stringify({
        type: "design_system_result",
        payload: sampleContext,
      })
    );

    // Wait for the server to process the message
    await new Promise<void>((resolve) => setTimeout(resolve, 100));

    expect(dsManager.hasContext()).toBe(true);
    const ctx = dsManager.getContext();
    expect(ctx!.variables.collections).toHaveLength(1);
    expect(ctx!.variables.colorTokens).toHaveLength(1);
  });

  it("handles plugin errors for Phase 5 commands", async () => {
    autoRespondToCommands((cmd) => ({
      id: cmd.id,
      success: false,
      error: "Node 999:999 not found",
    }));

    const router = mcpServer.getRouter();
    const result = await router.routeStructuredCommand("export_node", {
      nodeId: "999:999",
      format: "PNG",
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("not found");
  });

  // ============================================================
  // Compound Operations
  // ============================================================

  it("routes a compound batch: create collection + variable + bind", async () => {
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
      {
        command: "create_variable_collection",
        params: { name: "Colors" },
      },
      {
        command: "create_variable",
        params: {
          name: "primary",
          collectionId: "$0",
          resolvedType: "COLOR",
        },
      },
      {
        command: "bind_variable",
        params: {
          nodeId: "1:1",
          property: "fills",
          variableId: "$1",
        },
      },
    ]);

    expect(result.success).toBe(true);
    expect(result.operations).toHaveLength(3);
  });

  it("correctly categorizes all 8 Phase 5 commands", () => {
    const router = mcpServer.getRouter();

    // Export (4)
    expect(router.getCategory("export_node")).toBe("export");
    expect(router.getCategory("set_export_settings")).toBe("export");
    expect(router.getCategory("set_image_fill")).toBe("export");
    expect(router.getCategory("get_node_css")).toBe("export");

    // Variables (4)
    expect(router.getCategory("create_variable")).toBe("variables");
    expect(router.getCategory("set_variable_value")).toBe("variables");
    expect(router.getCategory("create_variable_collection")).toBe("variables");
    expect(router.getCategory("bind_variable")).toBe("variables");
  });
});
