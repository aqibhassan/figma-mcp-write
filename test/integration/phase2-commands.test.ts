// test/integration/phase2-commands.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { WebSocketManager } from "../../src/server/websocket.js";
import { FigmaMcpServer } from "../../src/server/mcp.js";
import WebSocket from "ws";
import {
  setupMockFigma,
  teardownMockFigma,
  MockNode,
  registerNode,
} from "../mocks/figma-api.js";
import { getExecutor } from "../../plugin/executors/index.js";

describe("Phase 2 Integration: Command Flow", () => {
  let wsManager: WebSocketManager;
  let mcpServer: FigmaMcpServer;

  beforeEach(async () => {
    wsManager = new WebSocketManager();
    await wsManager.start(0);
    mcpServer = new FigmaMcpServer(wsManager);
  });

  afterEach(async () => {
    await wsManager.close();
  });

  it("routes a reading command through the full stack", async () => {
    const port = wsManager.port;
    const queue = mcpServer.getQueue();

    // Connect mock plugin
    const client = new WebSocket(`ws://localhost:${port}`);
    await new Promise<void>((resolve) => client.on("open", resolve));

    client.send(
      JSON.stringify({
        type: "handshake",
        fileInfo: { name: "Test", id: "f1", pages: [], nodeCount: 10 },
      })
    );

    await new Promise<void>((resolve) => {
      client.on("message", (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === "handshake_ack") resolve();
      });
    });

    // Plugin simulates executor: when it receives get_selection, respond
    client.on("message", (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === "command") {
        const cmd = msg.payload;
        if (cmd.type === "get_selection") {
          client.send(
            JSON.stringify({
              type: "response",
              payload: {
                id: cmd.id,
                success: true,
                data: { nodes: [] },
              },
            })
          );
        }
      }
    });

    const result = await queue.enqueue("get_selection", {});
    expect(result.success).toBe(true);
    expect((result.data as Record<string, unknown>).nodes).toBeDefined();

    client.close();
  });

  it("routes a layer command through the full stack", async () => {
    const port = wsManager.port;
    const queue = mcpServer.getQueue();

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

    client.on("message", (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === "command") {
        const cmd = msg.payload;
        if (cmd.type === "create_node") {
          client.send(
            JSON.stringify({
              type: "response",
              payload: {
                id: cmd.id,
                success: true,
                data: {
                  nodeId: "100:1",
                  type: cmd.params.type,
                  name: cmd.params.name ?? "Frame",
                },
              },
            })
          );
        }
      }
    });

    const result = await queue.enqueue("create_node", {
      type: "FRAME",
      name: "Test Frame",
      width: 320,
      height: 200,
    });

    expect(result.success).toBe(true);
    const data = result.data as Record<string, unknown>;
    expect(data.nodeId).toBe("100:1");
    expect(data.type).toBe("FRAME");

    client.close();
  });

  it("routes a text command through the full stack", async () => {
    const port = wsManager.port;
    const queue = mcpServer.getQueue();

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

    client.on("message", (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === "command") {
        const cmd = msg.payload;
        if (cmd.type === "set_text_content") {
          client.send(
            JSON.stringify({
              type: "response",
              payload: {
                id: cmd.id,
                success: true,
                data: {
                  nodeId: cmd.params.nodeId,
                  characters: cmd.params.text,
                },
              },
            })
          );
        }
      }
    });

    const result = await queue.enqueue("set_text_content", {
      nodeId: "50:1",
      text: "Updated text",
    });

    expect(result.success).toBe(true);
    const data = result.data as Record<string, unknown>;
    expect(data.characters).toBe("Updated text");

    client.close();
  });
});

describe("Phase 2 Integration: Executor Unit Coverage", () => {
  let mockFigma: ReturnType<typeof setupMockFigma>;

  beforeEach(() => {
    mockFigma = setupMockFigma();
  });

  afterEach(() => {
    teardownMockFigma();
  });

  it("all 18 executors are registered and callable", () => {
    const commands = [
      "get_node",
      "get_selection",
      "get_page_nodes",
      "search_nodes",
      "scroll_to_node",
      "create_node",
      "create_text",
      "delete_node",
      "duplicate_node",
      "move_node",
      "resize_node",
      "rename_node",
      "reorder_node",
      "set_text_content",
      "set_text_style",
      "set_text_color",
      "set_text_alignment",
      "find_replace_text",
    ];

    for (const cmd of commands) {
      const executor = getExecutor(cmd);
      expect(executor, `Executor for '${cmd}' not found`).toBeDefined();
    }
  });

  it("create_node + get_node round-trip works", async () => {
    const createExec = getExecutor("create_node")!;
    const createResult = await createExec({
      type: "FRAME",
      name: "RoundTrip",
      x: 10,
      y: 20,
      width: 300,
      height: 150,
    });

    expect(createResult.success).toBe(true);
    const nodeId = (createResult.data as Record<string, unknown>)
      .nodeId as string;

    const getExec = getExecutor("get_node")!;
    const getResult = await getExec({ nodeId, depth: 0 });

    expect(getResult.success).toBe(true);
    const data = getResult.data as Record<string, unknown>;
    expect(data.name).toBe("RoundTrip");
    expect(data.type).toBe("FRAME");
  });

  it("create_text + set_text_content round-trip works", async () => {
    const createExec = getExecutor("create_text")!;
    const createResult = await createExec({ text: "Original" });

    expect(createResult.success).toBe(true);
    const nodeId = (createResult.data as Record<string, unknown>)
      .nodeId as string;

    const setExec = getExecutor("set_text_content")!;
    const setResult = await setExec({ nodeId, text: "Modified" });

    expect(setResult.success).toBe(true);

    const getExec = getExecutor("get_node")!;
    const getResult = await getExec({ nodeId });

    expect(getResult.success).toBe(true);
    expect(
      (getResult.data as Record<string, unknown>).characters
    ).toBe("Modified");
  });

  it("create_node + rename_node + delete_node lifecycle", async () => {
    const createExec = getExecutor("create_node")!;
    const createResult = await createExec({ type: "RECTANGLE", name: "Temp" });
    const nodeId = (createResult.data as Record<string, unknown>)
      .nodeId as string;

    const renameExec = getExecutor("rename_node")!;
    const renameResult = await renameExec({ nodeId, name: "Renamed" });
    expect(renameResult.success).toBe(true);
    expect(
      (renameResult.data as Record<string, unknown>).newName
    ).toBe("Renamed");

    const deleteExec = getExecutor("delete_node")!;
    const deleteResult = await deleteExec({ nodeId });
    expect(deleteResult.success).toBe(true);

    // Verify it's gone
    const getExec = getExecutor("get_node")!;
    const getResult = await getExec({ nodeId });
    expect(getResult.success).toBe(false);
  });
});
