// src/server/__tests__/websocket.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { WebSocketManager } from "../websocket.js";
import WebSocket from "ws";
import {
  Command,
  CommandResponse,
  HandshakeMessage,
} from "../../../shared/protocol.js";

describe("WebSocketManager", () => {
  let manager: WebSocketManager;

  beforeEach(() => {
    manager = new WebSocketManager();
  });

  afterEach(async () => {
    await manager.close();
  });

  describe("start", () => {
    it("starts a WebSocket server on the specified port", async () => {
      await manager.start(0); // port 0 = random available port
      expect(manager.port).toBeGreaterThan(0);
      expect(manager.isRunning).toBe(true);
    });
  });

  describe("connection", () => {
    it("accepts a plugin connection and completes handshake", async () => {
      await manager.start(0);
      const port = manager.port;

      const client = new WebSocket(`ws://localhost:${port}`);
      await new Promise<void>((resolve) => client.on("open", resolve));

      // Send handshake
      const handshake: HandshakeMessage = {
        type: "handshake",
        fileInfo: {
          name: "Test File",
          id: "file123",
          pages: [{ id: "page1", name: "Page 1" }],
          nodeCount: 42,
        },
      };
      client.send(JSON.stringify(handshake));

      // Wait for ack
      const ack = await new Promise<string>((resolve) => {
        client.on("message", (data) => resolve(data.toString()));
      });
      const parsed = JSON.parse(ack);
      expect(parsed.type).toBe("handshake_ack");
      expect(parsed.serverVersion).toBeDefined();

      // Connection state
      expect(manager.isConnected).toBe(true);
      expect(manager.fileInfo?.name).toBe("Test File");

      client.close();
    });

    it("emits disconnect when plugin disconnects", async () => {
      await manager.start(0);
      const port = manager.port;

      const onDisconnect = vi.fn();
      manager.onDisconnect(onDisconnect);

      const client = new WebSocket(`ws://localhost:${port}`);
      await new Promise<void>((resolve) => client.on("open", resolve));

      // Handshake
      client.send(
        JSON.stringify({
          type: "handshake",
          fileInfo: { name: "Test", id: "f1", pages: [], nodeCount: 0 },
        })
      );
      await new Promise<void>((resolve) => {
        client.on("message", () => resolve());
      });

      client.close();

      // Wait for disconnect
      await new Promise<void>((resolve) => setTimeout(resolve, 100));
      expect(onDisconnect).toHaveBeenCalledOnce();
      expect(manager.isConnected).toBe(false);
    });
  });

  describe("sendCommand", () => {
    it("sends a command to the plugin", async () => {
      await manager.start(0);
      const port = manager.port;

      const client = new WebSocket(`ws://localhost:${port}`);
      await new Promise<void>((resolve) => client.on("open", resolve));

      // Handshake
      client.send(
        JSON.stringify({
          type: "handshake",
          fileInfo: { name: "Test", id: "f1", pages: [], nodeCount: 0 },
        })
      );
      await new Promise<void>((resolve) => {
        client.on("message", () => resolve());
      });

      // Send command
      const command: Command = {
        id: "cmd-123",
        type: "get_selection",
        params: {},
      };

      const received = new Promise<Command>((resolve) => {
        client.on("message", (data) => {
          const msg = JSON.parse(data.toString());
          if (msg.type === "command") {
            resolve(msg.payload);
          }
        });
      });

      manager.sendCommand(command);
      const result = await received;
      expect(result.id).toBe("cmd-123");
      expect(result.type).toBe("get_selection");
    });

    it("throws when no plugin is connected", () => {
      const command: Command = {
        id: "cmd-1",
        type: "test",
        params: {},
      };
      expect(() => manager.sendCommand(command)).toThrow("No plugin connected");
    });
  });

  describe("handleResponse", () => {
    it("emits response events", async () => {
      await manager.start(0);
      const port = manager.port;

      const onResponse = vi.fn();
      manager.onResponse(onResponse);

      const client = new WebSocket(`ws://localhost:${port}`);
      await new Promise<void>((resolve) => client.on("open", resolve));

      // Handshake
      client.send(
        JSON.stringify({
          type: "handshake",
          fileInfo: { name: "Test", id: "f1", pages: [], nodeCount: 0 },
        })
      );
      await new Promise<void>((resolve) => {
        client.on("message", () => resolve());
      });

      // Send response from plugin
      const response: CommandResponse = {
        id: "cmd-456",
        success: true,
        data: { nodeId: "1:2" },
      };
      client.send(JSON.stringify({ type: "response", payload: response }));

      await new Promise<void>((resolve) => setTimeout(resolve, 50));
      expect(onResponse).toHaveBeenCalledWith(response);
    });
  });

  describe("handleEvent", () => {
    it("emits plugin events", async () => {
      await manager.start(0);
      const port = manager.port;

      const onEvent = vi.fn();
      manager.onPluginEvent(onEvent);

      const client = new WebSocket(`ws://localhost:${port}`);
      await new Promise<void>((resolve) => client.on("open", resolve));

      // Handshake
      client.send(
        JSON.stringify({
          type: "handshake",
          fileInfo: { name: "Test", id: "f1", pages: [], nodeCount: 0 },
        })
      );
      await new Promise<void>((resolve) => {
        client.on("message", () => resolve());
      });

      // Send event from plugin
      client.send(
        JSON.stringify({
          type: "event",
          payload: {
            event: "selection_changed",
            data: { nodeIds: ["1:2", "3:4"] },
          },
        })
      );

      await new Promise<void>((resolve) => setTimeout(resolve, 50));
      expect(onEvent).toHaveBeenCalledWith({
        event: "selection_changed",
        data: { nodeIds: ["1:2", "3:4"] },
      });
    });
  });
});
