// scripts/create-tool.ts
//
// Usage: npx tsx scripts/create-tool.ts <tool-name> <category>
// Example: npx tsx scripts/create-tool.ts set_opacity styling
//
// Creates:
//   - Executor stub in plugin/executors/<category>.ts
//   - Test stub in plugin/__tests__/<category>.test.ts
//   - Prints next steps

import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, "..");

const VALID_CATEGORIES = [
  "layers",
  "text",
  "styling",
  "layout",
  "components",
  "pages",
  "vectors",
  "export",
  "variables",
  "reading",
  "superpowers",
] as const;

type Category = (typeof VALID_CATEGORIES)[number];

function main(): void {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.error("Usage: npx tsx scripts/create-tool.ts <tool-name> <category>");
    console.error("");
    console.error("Categories:", VALID_CATEGORIES.join(", "));
    console.error("");
    console.error("Example: npx tsx scripts/create-tool.ts set_opacity styling");
    process.exit(1);
  }

  const toolName = args[0];
  const category = args[1] as Category;

  // Validate tool name
  if (!/^[a-z][a-z0-9_]*$/.test(toolName)) {
    console.error(`Error: Tool name '${toolName}' is invalid.`);
    console.error("Tool names must be lowercase with underscores (e.g., set_opacity, bulk_rename).");
    process.exit(1);
  }

  // Validate category
  if (!VALID_CATEGORIES.includes(category)) {
    console.error(`Error: Unknown category '${category}'.`);
    console.error("Valid categories:", VALID_CATEGORIES.join(", "));
    process.exit(1);
  }

  const executorPath = resolve(ROOT, `plugin/executors/${category}.ts`);
  const testPath = resolve(ROOT, `plugin/__tests__/${category}.test.ts`);

  // Check if executor file exists
  if (!existsSync(executorPath)) {
    console.error(`Error: Executor file not found at plugin/executors/${category}.ts`);
    console.error("Create the category file first, or check the category name.");
    process.exit(1);
  }

  // Check if function already exists in executor
  const executorContent = readFileSync(executorPath, "utf8");
  if (executorContent.includes(`function ${toolName}`)) {
    console.error(`Error: Function '${toolName}' already exists in plugin/executors/${category}.ts`);
    process.exit(1);
  }

  // Append executor stub
  const executorStub = `
// --- ${toolName} ---

export async function ${toolName}(params: Record<string, unknown>): Promise<unknown> {
  const nodeId = params.nodeId as string;
  if (!nodeId) throw new Error("${toolName}: nodeId is required");

  const node = figma.getNodeById(nodeId);
  if (!node) throw new Error(\`${toolName}: Node '\${nodeId}' not found\`);

  // TODO: Implement ${toolName}

  return { nodeId: node.id, name: node.name };
}
`;

  writeFileSync(executorPath, executorContent + executorStub);
  console.log(`  Added executor stub to plugin/executors/${category}.ts`);

  // Append or create test stub
  const testStub = `
describe("${toolName}", () => {
  it("performs the operation on the target node", async () => {
    const { ${toolName} } = await import("../executors/${category}.js");
    const result = await ${toolName}({ nodeId: "1:2" });
    expect(result).toHaveProperty("nodeId", "1:2");
  });

  it("throws if node not found", async () => {
    vi.mocked(figma.getNodeById).mockReturnValueOnce(null);
    const { ${toolName} } = await import("../executors/${category}.js");
    await expect(${toolName}({ nodeId: "999:999" })).rejects.toThrow("not found");
  });

  it("throws if nodeId is missing", async () => {
    const { ${toolName} } = await import("../executors/${category}.js");
    await expect(${toolName}({})).rejects.toThrow("nodeId is required");
  });
});
`;

  if (existsSync(testPath)) {
    const testContent = readFileSync(testPath, "utf8");
    if (testContent.includes(`describe("${toolName}"`)) {
      console.log(`  Tests for '${toolName}' already exist in plugin/__tests__/${category}.test.ts — skipped`);
    } else {
      // Insert before the last closing of the file (before final })
      writeFileSync(testPath, testContent + testStub);
      console.log(`  Added test stub to plugin/__tests__/${category}.test.ts`);
    }
  } else {
    const newTestFile = `import { describe, it, expect, vi, beforeEach } from "vitest";

const mockNode = {
  id: "1:2",
  name: "TestNode",
  type: "FRAME",
  fills: [],
  strokes: [],
  effects: [],
  opacity: 1,
  visible: true,
};

vi.stubGlobal("figma", {
  getNodeById: vi.fn(() => mockNode),
  currentPage: { findAll: vi.fn(() => [mockNode]) },
  root: { findAll: vi.fn(() => [mockNode]) },
});

beforeEach(() => {
  vi.mocked(figma.getNodeById).mockReturnValue(mockNode as unknown as BaseNode);
});
${testStub}`;

    writeFileSync(testPath, newTestFile);
    console.log(`  Created test file plugin/__tests__/${category}.test.ts`);
  }

  // Print next steps
  const mcpTool = category === "superpowers" ? "figma_superpowers" : `figma_${category}`;

  console.log("");
  console.log("Next steps:");
  console.log(`  1. Implement the executor body in plugin/executors/${category}.ts`);
  console.log(`  2. Add '${toolName}' to the command enum in src/server/tools/${category}.ts`);
  console.log(`  3. Update the tool description in src/server/tools/${category}.ts to mention '${toolName}'`);
  console.log(`  4. Write proper tests in plugin/__tests__/${category}.test.ts`);
  console.log(`  5. Run: npm run typecheck && npm test`);
  console.log(`  6. MCP tool: ${mcpTool} — command: ${toolName}`);
  console.log("");
}

main();
