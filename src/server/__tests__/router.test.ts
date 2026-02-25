// src/server/__tests__/router.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Router } from "../router.js";
import { CommandQueue } from "../command-queue.js";

describe("Router", () => {
  let router: Router;
  let queue: CommandQueue;

  beforeEach(() => {
    queue = new CommandQueue();
    router = new Router(queue);
  });

  describe("routeStructuredCommand", () => {
    it("routes a single command to the queue", async () => {
      const spy = vi.fn();
      queue.onCommand(spy);

      // Immediately resolve the command
      const promise = router.routeStructuredCommand("create_node", {
        type: "FRAME",
        name: "Test",
      });

      const command = spy.mock.calls[0][0];
      queue.resolve(command.id, { nodeId: "1:2" });

      const result = await promise;
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ nodeId: "1:2" });
    });

    it("determines the correct category for a command", () => {
      expect(router.getCategory("create_node")).toBe("layers");
      expect(router.getCategory("set_text_content")).toBe("text");
      expect(router.getCategory("set_fill")).toBe("styling");
      expect(router.getCategory("set_auto_layout")).toBe("layout");
      expect(router.getCategory("create_component")).toBe("components");
      expect(router.getCategory("create_page")).toBe("pages");
      expect(router.getCategory("boolean_operation")).toBe("vectors");
      expect(router.getCategory("export_node")).toBe("export");
      expect(router.getCategory("create_variable")).toBe("variables");
      expect(router.getCategory("get_node")).toBe("reading");
      expect(router.getCategory("design_lint")).toBe("superpowers");
    });

    it("returns error for unknown command", async () => {
      const result = await router.routeStructuredCommand("nonexistent_tool", {});
      expect(result.success).toBe(false);
      expect(result.error).toContain("Unknown command");
    });
  });

  describe("routeBatch", () => {
    it("routes a batch of commands with variable substitution", async () => {
      const commands = [
        { command: "create_node", params: { type: "FRAME", name: "Parent" } },
        { command: "create_text", params: { text: "Hello", parentId: "$0" } },
      ];

      const spy = vi.fn();
      queue.onCommand(spy);

      const promise = router.routeBatch(commands);

      // Resolve first command
      const batchCmd = spy.mock.calls[0][0];
      queue.resolve(batchCmd.id, {
        batchResults: [
          { id: "sub1", success: true, data: { nodeId: "10:1" } },
          { id: "sub2", success: true, data: { nodeId: "10:2" } },
        ],
      });

      const result = await promise;
      expect(result.success).toBe(true);
      expect(result.operations).toHaveLength(2);
      expect(result.nodeIds).toContain("10:1");
      expect(result.nodeIds).toContain("10:2");
    });

    it("substitutes $0 references in batch params", () => {
      const resolved = router.substituteVariables(
        { text: "Hello", parentId: "$0" },
        [{ nodeId: "10:1", name: "Frame" }]
      );
      expect(resolved.parentId).toBe("10:1");
    });

    it("substitutes $N.property references", () => {
      const resolved = router.substituteVariables(
        { width: "$0.width", name: "$1.name" },
        [
          { nodeId: "10:1", width: 200, name: "Frame A" },
          { nodeId: "10:2", width: 100, name: "Frame B" },
        ]
      );
      expect(resolved.width).toBe(200);
      expect(resolved.name).toBe("Frame B");
    });
  });

  describe("routeCategoryCommand", () => {
    it("routes a category command to the correct executor", async () => {
      const spy = vi.fn();
      queue.onCommand(spy);

      const promise = router.routeCategoryCommand("layers", "create_node", {
        type: "FRAME",
      });

      const command = spy.mock.calls[0][0];
      queue.resolve(command.id, { nodeId: "1:2" });

      const result = await promise;
      expect(result.success).toBe(true);
    });

    it("rejects if command doesn't belong to category", async () => {
      const result = await router.routeCategoryCommand(
        "layers",
        "set_fill",
        {}
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain("does not belong to category");
    });
  });
});
