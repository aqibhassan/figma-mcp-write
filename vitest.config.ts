// vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: false,
    environment: "node",
    include: [
      "src/**/__tests__/**/*.test.ts",
      "plugin/**/__tests__/**/*.test.ts",
      "test/**/*.test.ts",
    ],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts", "plugin/**/*.ts", "shared/**/*.ts"],
      exclude: ["**/__tests__/**", "**/*.d.ts"],
    },
    testTimeout: 10_000,
  },
});
