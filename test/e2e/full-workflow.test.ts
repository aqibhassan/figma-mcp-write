// test/e2e/full-workflow.test.ts
//
// End-to-end tests using a mock plugin connected to the real server.
// These tests verify the full flow: MCP tool call -> router -> WebSocket -> plugin -> response.

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { MockPluginClient, createNodeIdGenerator, wait } from "./setup.js";
import { WebSocketManager } from "../../src/server/websocket.js";
import { CommandQueue } from "../../src/server/command-queue.js";

const TEST_PORT = 13846; // Use non-default port to avoid conflicts

describe("E2E: Full Workflow", () => {
  let wsManager: WebSocketManager;
  let queue: CommandQueue;
  let mockPlugin: MockPluginClient;
  let nextNodeId: () => string;

  beforeAll(async () => {
    // Start WebSocket server
    wsManager = new WebSocketManager();
    await wsManager.start(TEST_PORT);

    // Set up command queue
    queue = new CommandQueue();
    queue.onCommand((command) => {
      wsManager.sendCommand(command);
    });

    // Forward responses from WebSocket to command queue
    wsManager.onResponse((response) => {
      if (response.success) {
        queue.resolve(response.id, response.data);
      } else {
        queue.reject(response.id, response.error || "Unknown error");
      }
    });
  });

  afterAll(async () => {
    if (mockPlugin?.isConnected) {
      await mockPlugin.disconnect();
    }
    await wsManager.close();
    queue.clear();
  });

  beforeEach(() => {
    nextNodeId = createNodeIdGenerator();
  });

  describe("Create frame -> add text -> style -> export", () => {
    it("should execute a full design workflow", async () => {
      // Connect mock plugin with handlers
      mockPlugin = new MockPluginClient(TEST_PORT);

      mockPlugin.onCommand("create_node", (params) => {
        const nodeId = nextNodeId();
        return {
          nodeId,
          name: params.name || "Frame",
          type: params.type || "FRAME",
          x: params.x || 0,
          y: params.y || 0,
          width: params.width || 100,
          height: params.height || 100,
        };
      });

      mockPlugin.onCommand("create_text", (params) => {
        const nodeId = nextNodeId();
        return {
          nodeId,
          name: params.text || "Text",
          type: "TEXT",
          text: params.text,
          fontSize: params.fontSize || 16,
          fontFamily: params.fontFamily || "Inter",
        };
      });

      mockPlugin.onCommand("set_fill", (params) => {
        return {
          nodeId: params.nodeId,
          fill: { type: "SOLID", color: params.color },
        };
      });

      mockPlugin.onCommand("export_node", (params) => {
        return {
          nodeId: params.nodeId,
          format: params.format || "PNG",
          data: "base64-encoded-image-data-placeholder",
        };
      });

      await mockPlugin.connect();
      expect(mockPlugin.isConnected).toBe(true);

      // Step 1: Create a frame
      const createFrameResult = await queue.enqueue("create_node", {
        type: "FRAME",
        name: "Card",
        width: 320,
        height: 200,
        x: 0,
        y: 0,
      });

      expect(createFrameResult.success).toBe(true);
      expect(createFrameResult.data).toHaveProperty("nodeId");
      expect(createFrameResult.data).toHaveProperty("type", "FRAME");
      const frameNodeId = (createFrameResult.data as Record<string, unknown>).nodeId as string;

      // Step 2: Create text inside the frame
      const createTextResult = await queue.enqueue("create_text", {
        text: "Hello World",
        parentId: frameNodeId,
        fontSize: 24,
        fontFamily: "Inter",
      });

      expect(createTextResult.success).toBe(true);
      expect(createTextResult.data).toHaveProperty("text", "Hello World");
      expect(createTextResult.data).toHaveProperty("fontSize", 24);

      // Step 3: Style the frame with a fill
      const styleFillResult = await queue.enqueue("set_fill", {
        nodeId: frameNodeId,
        type: "SOLID",
        color: "#FFFFFF",
      });

      expect(styleFillResult.success).toBe(true);
      expect(styleFillResult.data).toHaveProperty("nodeId", frameNodeId);

      // Step 4: Export the frame
      const exportResult = await queue.enqueue("export_node", {
        nodeId: frameNodeId,
        format: "PNG",
        scale: 2,
      });

      expect(exportResult.success).toBe(true);
      expect(exportResult.data).toHaveProperty("format", "PNG");
      expect(exportResult.data).toHaveProperty("data");

      await mockPlugin.disconnect();
    });
  });

  describe("Create component -> instantiate -> override -> verify", () => {
    it("should handle the full component lifecycle", async () => {
      mockPlugin = new MockPluginClient(TEST_PORT);

      const componentId = "comp:1";
      const instanceId = "inst:1";

      mockPlugin.onCommand("create_node", (params) => {
        return {
          nodeId: nextNodeId(),
          name: params.name || "Frame",
          type: params.type || "FRAME",
          width: params.width || 100,
          height: params.height || 100,
        };
      });

      mockPlugin.onCommand("create_component", (params) => {
        return {
          componentId,
          nodeId: params.nodeId,
          name: "Button",
          type: "COMPONENT",
        };
      });

      mockPlugin.onCommand("create_instance", (params) => {
        return {
          instanceId,
          componentId: params.componentId,
          name: "Button",
          type: "INSTANCE",
          x: params.x || 0,
          y: params.y || 0,
        };
      });

      mockPlugin.onCommand("set_instance_override", (params) => {
        return {
          instanceId: params.instanceId,
          overrides: params.overrides,
          applied: true,
        };
      });

      await mockPlugin.connect();

      // Step 1: Create a frame for the component
      const frameResult = await queue.enqueue("create_node", {
        type: "FRAME",
        name: "Button",
        width: 120,
        height: 40,
      });
      expect(frameResult.success).toBe(true);
      const frameId = (frameResult.data as Record<string, unknown>).nodeId as string;

      // Step 2: Convert to component
      const componentResult = await queue.enqueue("create_component", {
        nodeId: frameId,
      });
      expect(componentResult.success).toBe(true);
      expect(componentResult.data).toHaveProperty("componentId", componentId);

      // Step 3: Create instance
      const instanceResult = await queue.enqueue("create_instance", {
        componentId,
        x: 200,
        y: 0,
      });
      expect(instanceResult.success).toBe(true);
      expect(instanceResult.data).toHaveProperty("instanceId", instanceId);

      // Step 4: Override instance text
      const overrideResult = await queue.enqueue("set_instance_override", {
        instanceId,
        overrides: [
          { type: "text", property: "characters", value: "Submit" },
        ],
      });
      expect(overrideResult.success).toBe(true);
      expect(overrideResult.data).toHaveProperty("applied", true);

      await mockPlugin.disconnect();
    });
  });

  describe("Design system scan -> verify context", () => {
    it("should receive design system context on connect", async () => {
      mockPlugin = new MockPluginClient(TEST_PORT);

      await mockPlugin.connect();

      // After connection, the server should have file info
      expect(wsManager.isConnected).toBe(true);
      expect(wsManager.fileInfo).toBeTruthy();
      expect(wsManager.fileInfo!.name).toBe("E2E Test File");
      expect(wsManager.fileInfo!.pages).toHaveLength(2);
      expect(wsManager.fileInfo!.nodeCount).toBe(42);

      await mockPlugin.disconnect();
    });
  });

  describe("Error handling", () => {
    it("should handle command errors from the plugin", async () => {
      mockPlugin = new MockPluginClient(TEST_PORT);

      mockPlugin.onCommand("get_node", () => {
        throw new Error("Node '999:999' not found");
      });

      await mockPlugin.connect();

      const result = await queue.enqueue("get_node", { nodeId: "999:999" });
      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");

      await mockPlugin.disconnect();
    });

    it("should handle disconnection gracefully", async () => {
      mockPlugin = new MockPluginClient(TEST_PORT);
      await mockPlugin.connect();
      expect(wsManager.isConnected).toBe(true);

      await mockPlugin.disconnect();
      await wait(100); // Give time for close event to propagate

      expect(wsManager.isConnected).toBe(false);
    });
  });
});
