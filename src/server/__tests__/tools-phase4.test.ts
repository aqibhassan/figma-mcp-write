// src/server/__tests__/tools-phase4.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { Router } from "../router.js";
import { CommandQueue } from "../command-queue.js";

describe("Phase 4 Server Tool Routing", () => {
  let router: Router;
  let queue: CommandQueue;

  beforeEach(() => {
    queue = new CommandQueue();
    router = new Router(queue);
  });

  // ============================================================
  // Component Commands — Category Routing
  // ============================================================

  describe("component commands", () => {
    const componentCommands = [
      "create_component",
      "create_component_set",
      "create_instance",
      "swap_instance",
      "set_instance_override",
      "detach_instance",
    ];

    it("all component commands are valid", () => {
      for (const cmd of componentCommands) {
        expect(router.isValidCommand(cmd)).toBe(true);
      }
    });

    it("all component commands belong to 'components' category", () => {
      for (const cmd of componentCommands) {
        expect(router.getCategory(cmd)).toBe("components");
      }
    });

    it("routes component commands through category tool", async () => {
      const spy = vi.fn();
      queue.onCommand(spy);

      for (const cmd of componentCommands) {
        const promise = router.routeCategoryCommand("components", cmd, {});
        const command = spy.mock.calls[spy.mock.calls.length - 1][0];
        queue.resolve(command.id, { nodeId: "1:1" });
        const result = await promise;
        expect(result.success).toBe(true);
      }
    });

    it("rejects component commands routed to wrong category", async () => {
      for (const cmd of componentCommands) {
        const result = await router.routeCategoryCommand("layers", cmd, {});
        expect(result.success).toBe(false);
        expect(result.error).toContain("does not belong to category");
      }
    });
  });

  // ============================================================
  // Page Commands — Category Routing
  // ============================================================

  describe("page commands", () => {
    const pageCommands = [
      "create_page",
      "switch_page",
      "create_section",
      "set_page_background",
    ];

    it("all page commands are valid", () => {
      for (const cmd of pageCommands) {
        expect(router.isValidCommand(cmd)).toBe(true);
      }
    });

    it("all page commands belong to 'pages' category", () => {
      for (const cmd of pageCommands) {
        expect(router.getCategory(cmd)).toBe("pages");
      }
    });

    it("routes page commands through category tool", async () => {
      const spy = vi.fn();
      queue.onCommand(spy);

      for (const cmd of pageCommands) {
        const promise = router.routeCategoryCommand("pages", cmd, {});
        const command = spy.mock.calls[spy.mock.calls.length - 1][0];
        queue.resolve(command.id, { nodeId: "1:1" });
        const result = await promise;
        expect(result.success).toBe(true);
      }
    });

    it("rejects page commands routed to wrong category", async () => {
      for (const cmd of pageCommands) {
        const result = await router.routeCategoryCommand("styling", cmd, {});
        expect(result.success).toBe(false);
        expect(result.error).toContain("does not belong to category");
      }
    });
  });

  // ============================================================
  // Vector Commands — Category Routing
  // ============================================================

  describe("vector commands", () => {
    const vectorCommands = [
      "boolean_operation",
      "flatten_node",
      "set_mask",
    ];

    it("all vector commands are valid", () => {
      for (const cmd of vectorCommands) {
        expect(router.isValidCommand(cmd)).toBe(true);
      }
    });

    it("all vector commands belong to 'vectors' category", () => {
      for (const cmd of vectorCommands) {
        expect(router.getCategory(cmd)).toBe("vectors");
      }
    });

    it("routes vector commands through category tool", async () => {
      const spy = vi.fn();
      queue.onCommand(spy);

      for (const cmd of vectorCommands) {
        const promise = router.routeCategoryCommand("vectors", cmd, {});
        const command = spy.mock.calls[spy.mock.calls.length - 1][0];
        queue.resolve(command.id, { nodeId: "1:1" });
        const result = await promise;
        expect(result.success).toBe(true);
      }
    });

    it("rejects vector commands routed to wrong category", async () => {
      for (const cmd of vectorCommands) {
        const result = await router.routeCategoryCommand("text", cmd, {});
        expect(result.success).toBe(false);
        expect(result.error).toContain("does not belong to category");
      }
    });
  });

  // ============================================================
  // Meta-tool Routing
  // ============================================================

  describe("meta-tool routing for Phase 4 commands", () => {
    it("routes Phase 4 commands through the meta-tool", async () => {
      const spy = vi.fn();
      queue.onCommand(spy);

      const allPhase4Commands = [
        "create_component",
        "create_component_set",
        "create_instance",
        "swap_instance",
        "set_instance_override",
        "detach_instance",
        "create_page",
        "switch_page",
        "create_section",
        "set_page_background",
        "boolean_operation",
        "flatten_node",
        "set_mask",
      ];

      for (const cmd of allPhase4Commands) {
        const promise = router.routeStructuredCommand(cmd, {});
        const command = spy.mock.calls[spy.mock.calls.length - 1][0];
        queue.resolve(command.id, { nodeId: "1:1" });
        const result = await promise;
        expect(result.success).toBe(true);
      }
    });
  });

  // ============================================================
  // Batch Support
  // ============================================================

  describe("batch operations with Phase 4 commands", () => {
    it("routes a batch with mixed Phase 4 commands", async () => {
      const spy = vi.fn();
      queue.onCommand(spy);

      const promise = router.routeBatch([
        { command: "create_page", params: { name: "New Page" } },
        { command: "create_component", params: { nodeId: "1:1" } },
        { command: "boolean_operation", params: { nodeIds: ["1:1", "1:2"], operation: "UNION" } },
      ]);

      const batchCmd = spy.mock.calls[0][0];
      queue.resolve(batchCmd.id, {
        batchResults: [
          { id: "s1", success: true, data: { nodeId: "10:1" } },
          { id: "s2", success: true, data: { nodeId: "10:2" } },
          { id: "s3", success: true, data: { nodeId: "10:3" } },
        ],
      });

      const result = await promise;
      expect(result.success).toBe(true);
      expect(result.operations).toHaveLength(3);
    });
  });
});
