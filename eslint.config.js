// eslint.config.js
import tseslint from "typescript-eslint";

export default tseslint.config(
  // Global ignores
  {
    ignores: [
      "dist/",
      "plugin/code.js",
      "node_modules/",
      "coverage/",
      "release-artifacts/",
      "scripts/build-plugin.js",
    ],
  },

  // Base config for all TypeScript files
  ...tseslint.configs.recommended,

  // Server-specific rules
  {
    files: ["src/**/*.ts", "shared/**/*.ts"],
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.json",
      },
    },
    rules: {
      // No `any` — use `unknown` instead
      "@typescript-eslint/no-explicit-any": "error",

      // Catch unused variables (allow underscore prefix for intentional ignores)
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],

      // Consistent returns
      "consistent-return": "off", // TypeScript handles this better
      "@typescript-eslint/explicit-function-return-type": "off",

      // No child_process.exec — security rule (CVE-2025-53967 lesson)
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "child_process",
              importNames: ["exec", "execSync"],
              message:
                "Never use exec/execSync. Use execFile if system calls are unavoidable (they shouldn't be). See: CVE-2025-53967.",
            },
          ],
        },
      ],
    },
  },

  // Plugin-specific rules
  {
    files: ["plugin/**/*.ts"],
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.plugin.json",
      },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },

  // Test files — slightly relaxed
  {
    files: ["**/__tests__/**/*.ts", "**/*.test.ts", "test/**/*.ts"],
    rules: {
      // Tests can use non-null assertions for cleaner mocking
      "@typescript-eslint/no-non-null-assertion": "off",
    },
  }
);
