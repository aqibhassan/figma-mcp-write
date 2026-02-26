// src/server/__tests__/tools-phase5.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { Router } from "../router.js";
import { CommandQueue } from "../command-queue.js";

describe("Phase 5 Server Tool Routing", () => {
  let router: Router;
  let queue: CommandQueue;

  beforeEach(() => {
    queue = new CommandQueue();
    router = new Router(queue);
  });

  // ============================================================
  // Export Commands — Category Routing
  // ============================================================

  describe("export commands", () => {
    const exportCommands = [
      "export_node",
      "set_export_settings",
      "set_image_fill",
      "get_node_css",
    ];

    it("all export commands are valid", () => {
      for (const cmd of exportCommands) {
        expect(router.isValidCommand(cmd)).toBe(true);
      }
    });

    it("all export commands belong to 'export' category", () => {
      for (const cmd of exportCommands) {
        expect(router.getCategory(cmd)).toBe("export");
      }
    });

    it("routes export commands through category tool", async () => {
      const spy = vi.fn();
      queue.onCommand(spy);

      for (const cmd of exportCommands) {
        const promise = router.routeCategoryCommand("export", cmd, {});
        const command = spy.mock.calls[spy.mock.calls.length - 1][0];
        queue.resolve(command.id, { nodeId: "1:1" });
        const result = await promise;
        expect(result.success).toBe(true);
      }
    });

    it("rejects export commands routed to wrong category", async () => {
      for (const cmd of exportCommands) {
        const result = await router.routeCategoryCommand("layers", cmd, {});
        expect(result.success).toBe(false);
        expect(result.error).toContain("does not belong to category");
      }
    });
  });

  // ============================================================
  // Variable Commands — Category Routing
  // ============================================================

  describe("variable commands", () => {
    const variableCommands = [
      "create_variable",
      "set_variable_value",
      "create_variable_collection",
      "bind_variable",
    ];

    it("all variable commands are valid", () => {
      for (const cmd of variableCommands) {
        expect(router.isValidCommand(cmd)).toBe(true);
      }
    });

    it("all variable commands belong to 'variables' category", () => {
      for (const cmd of variableCommands) {
        expect(router.getCategory(cmd)).toBe("variables");
      }
    });

    it("routes variable commands through category tool", async () => {
      const spy = vi.fn();
      queue.onCommand(spy);

      for (const cmd of variableCommands) {
        const promise = router.routeCategoryCommand("variables", cmd, {});
        const command = spy.mock.calls[spy.mock.calls.length - 1][0];
        queue.resolve(command.id, { variableId: "VariableID:1:1" });
        const result = await promise;
        expect(result.success).toBe(true);
      }
    });

    it("rejects variable commands routed to wrong category", async () => {
      for (const cmd of variableCommands) {
        const result = await router.routeCategoryCommand("styling", cmd, {});
        expect(result.success).toBe(false);
        expect(result.error).toContain("does not belong to category");
      }
    });
  });

  // ============================================================
  // Meta-tool Routing
  // ============================================================

  describe("meta-tool routing for Phase 5 commands", () => {
    it("routes Phase 5 commands through the meta-tool", async () => {
      const spy = vi.fn();
      queue.onCommand(spy);

      const allPhase5Commands = [
        "export_node",
        "set_export_settings",
        "set_image_fill",
        "get_node_css",
        "create_variable",
        "set_variable_value",
        "create_variable_collection",
        "bind_variable",
      ];

      for (const cmd of allPhase5Commands) {
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

  describe("batch operations with Phase 5 commands", () => {
    it("routes a batch with mixed export and variable commands", async () => {
      const spy = vi.fn();
      queue.onCommand(spy);

      const promise = router.routeBatch([
        { command: "create_variable_collection", params: { name: "Colors" } },
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
          params: { nodeId: "1:1", property: "fills", variableId: "$1" },
        },
      ]);

      const batchCmd = spy.mock.calls[0][0];
      queue.resolve(batchCmd.id, {
        batchResults: [
          {
            id: "s1",
            success: true,
            data: { collectionId: "VariableCollectionID:1:1" },
          },
          {
            id: "s2",
            success: true,
            data: { variableId: "VariableID:1:1" },
          },
          { id: "s3", success: true, data: { nodeId: "1:1" } },
        ],
      });

      const result = await promise;
      expect(result.success).toBe(true);
      expect(result.operations).toHaveLength(3);
    });
  });
});
