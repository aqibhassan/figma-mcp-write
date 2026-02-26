// vitest.e2e.config.ts — runs E2E tests against the real WebSocket server
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: false,
    environment: "node",
    include: ["test/e2e/**/*.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 15_000,
  },
});
