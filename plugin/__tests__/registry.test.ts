// plugin/__tests__/registry.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  setupMockFigma,
  teardownMockFigma,
} from "../../test/mocks/figma-api.js";
import { executorRegistry, getExecutor } from "../executors/index.js";

describe("Executor Registry", () => {
  beforeEach(() => {
    setupMockFigma();
  });

  afterEach(() => {
    teardownMockFigma();
  });

  it("has executors registered for all 18 Phase 2 commands", () => {
    const phase2Commands = [
      // Reading (5)
      "get_node",
      "get_selection",
      "get_page_nodes",
      "search_nodes",
      "scroll_to_node",
      // Layers (8)
      "create_node",
      "create_text",
      "delete_node",
      "duplicate_node",
      "move_node",
      "resize_node",
      "rename_node",
      "reorder_node",
      // Text (5)
      "set_text_content",
      "set_text_style",
      "set_text_color",
      "set_text_alignment",
      "find_replace_text",
    ];

    for (const cmd of phase2Commands) {
      const executor = getExecutor(cmd);
      expect(executor, `Missing executor for '${cmd}'`).toBeDefined();
      expect(typeof executor).toBe("function");
    }
  });

  it("returns undefined for unknown commands", () => {
    const executor = getExecutor("nonexistent_command");
    expect(executor).toBeUndefined();
  });

  it("executors are callable async functions", async () => {
    const executor = getExecutor("get_selection");
    expect(executor).toBeDefined();
    // Should return a promise
    const result = executor!({});
    expect(result).toBeInstanceOf(Promise);
  });
});
