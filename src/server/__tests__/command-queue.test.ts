// src/server/__tests__/command-queue.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { CommandQueue } from "../command-queue.js";

describe("CommandQueue", () => {
  let queue: CommandQueue;

  beforeEach(() => {
    queue = new CommandQueue();
  });

  afterEach(() => {
    queue.clear();
  });

  describe("enqueue", () => {
    it("creates a pending command and returns a promise", () => {
      const promise = queue.enqueue("test_cmd", { key: "value" });
      expect(promise).toBeInstanceOf(Promise);
      expect(queue.pendingCount).toBe(1);
    });

    it("assigns a UUID to the command", () => {
      const spy = vi.fn();
      queue.onCommand(spy);
      queue.enqueue("test_cmd", { key: "value" });
      expect(spy).toHaveBeenCalledOnce();
      const command = spy.mock.calls[0][0];
      expect(command.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
      );
      expect(command.type).toBe("test_cmd");
      expect(command.params).toEqual({ key: "value" });
    });
  });

  describe("resolve", () => {
    it("resolves the promise when response arrives", async () => {
      const spy = vi.fn();
      queue.onCommand(spy);
      const promise = queue.enqueue("test_cmd", {});
      const command = spy.mock.calls[0][0];

      queue.resolve(command.id, { nodeId: "1:2" });

      const result = await promise;
      expect(result).toEqual({
        id: command.id,
        success: true,
        data: { nodeId: "1:2" },
      });
      expect(queue.pendingCount).toBe(0);
    });
  });

  describe("reject", () => {
    it("resolves with error when rejection arrives", async () => {
      const spy = vi.fn();
      queue.onCommand(spy);
      const promise = queue.enqueue("test_cmd", {});
      const command = spy.mock.calls[0][0];

      queue.reject(command.id, "Node not found");

      const result = await promise;
      expect(result).toEqual({
        id: command.id,
        success: false,
        error: "Node not found",
      });
    });
  });

  describe("timeout", () => {
    it("rejects after default timeout", async () => {
      vi.useFakeTimers();
      const promise = queue.enqueue("test_cmd", {});
      vi.advanceTimersByTime(30_001);

      const result = await promise;
      expect(result.success).toBe(false);
      expect(result.error).toContain("timed out");
      vi.useRealTimers();
    });

    it("uses custom timeout when provided", async () => {
      vi.useFakeTimers();
      const promise = queue.enqueue("test_cmd", {}, 5_000);
      vi.advanceTimersByTime(5_001);

      const result = await promise;
      expect(result.success).toBe(false);
      expect(result.error).toContain("timed out");
      vi.useRealTimers();
    });
  });

  describe("clear", () => {
    it("rejects all pending commands", async () => {
      const p1 = queue.enqueue("cmd1", {});
      const p2 = queue.enqueue("cmd2", {});

      queue.clear();

      const r1 = await p1;
      const r2 = await p2;
      expect(r1.success).toBe(false);
      expect(r2.success).toBe(false);
      expect(queue.pendingCount).toBe(0);
    });
  });

  describe("batch", () => {
    it("enqueues a batch command with sub-commands", () => {
      const spy = vi.fn();
      queue.onCommand(spy);

      queue.enqueueBatch([
        { type: "create_node", params: { type: "FRAME" } },
        { type: "set_fill", params: { color: "#FF0000" } },
      ]);

      expect(spy).toHaveBeenCalledOnce();
      const command = spy.mock.calls[0][0];
      expect(command.type).toBe("batch");
      expect(command.batch).toHaveLength(2);
    });

    it("rejects batch exceeding MAX_BATCH_SIZE", async () => {
      const commands = Array.from({ length: 101 }, (_, i) => ({
        type: `cmd_${i}`,
        params: {},
      }));

      const result = await queue.enqueueBatch(commands);
      expect(result.success).toBe(false);
      expect(result.error).toContain("exceeds maximum");
    });
  });
});
