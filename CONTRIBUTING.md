<!-- CONTRIBUTING.md -->
# Contributing to figma-mcp-write

Thanks for your interest in contributing. This guide covers the new router architecture (v2) and how to add tools.

## Setup

```bash
git clone https://github.com/aqibhassan/figma-mcp-write.git
cd figma-mcp-write
npm install
```

## Development

```bash
# Run server in dev mode (auto-restart on changes)
npm run dev

# Build everything (server + plugin)
npm run build

# Run tests
npm test

# Type check (both server and plugin)
npm run typecheck

# Lint
npm run lint

# Create a new tool from template
npx tsx scripts/create-tool.ts <tool-name> <category>
```

## Architecture Overview

```
Claude Code (stdio)
    |
    v
MCP Server (13 tools)        <-- src/server/mcp.ts
    |
    v
Smart Router                  <-- src/server/router.ts
    |
    v
Executor Layer (68 executors) <-- plugin/executors/
    |
    v
WebSocket                     <-- src/server/websocket.ts
    |
    v
Figma Plugin                  <-- plugin/code.ts
```

### Key files

| File | Purpose |
|------|---------|
| `src/server/mcp.ts` | MCP server + 13 tool registrations |
| `src/server/router.ts` | Smart router: command dispatch, compound ops, variable refs |
| `src/server/websocket.ts` | WebSocket server + connection management |
| `src/server/command-queue.ts` | UUID-keyed request/response pairing with timeouts |
| `src/server/design-system.ts` | Design system context manager |
| `src/server/tools/` | 13 MCP tool definitions (one per category) |
| `plugin/code.ts` | Plugin main: WebSocket client + command router |
| `plugin/executors/` | 68 command executors (one file per category, mirrors tools/) |
| `plugin/utils/` | Helpers for colors, nodes, styles, design system scanning |
| `shared/protocol.ts` | Shared types: Command, CommandResponse, PluginEvent, etc. |

## Adding a New Tool

Every tool needs three things:

1. **Executor function** in `plugin/executors/<category>.ts`
2. **Router registration** in the executor registry (the executor is auto-discovered by function name)
3. **Tests** in `plugin/__tests__/<category>.test.ts` and `src/server/__tests__/<category>.test.ts`

### Step 1: Generate the scaffold

```bash
npx tsx scripts/create-tool.ts my_new_tool styling
```

This creates:
- Executor stub in `plugin/executors/styling.ts`
- Test stub in `plugin/__tests__/styling.test.ts`
- Prints instructions for what to wire up

### Step 2: Write the executor

```typescript
// plugin/executors/<category>.ts

export async function my_new_tool(params: Record<string, unknown>): Promise<unknown> {
  const nodeId = params.nodeId as string;
  if (!nodeId) throw new Error("nodeId is required");

  const node = figma.getNodeById(nodeId);
  if (!node) throw new Error(`Node '${nodeId}' not found`);

  // ... perform the operation using Figma Plugin API ...

  return { nodeId: node.id, name: node.name };
}
```

### Step 3: Write tests

```typescript
// plugin/__tests__/<category>.test.ts

import { describe, it, expect, vi, beforeEach } from "vitest";
import { my_new_tool } from "../executors/<category>.js";

// Mock figma global
const mockNode = { id: "1:2", name: "TestNode", type: "FRAME" };
vi.stubGlobal("figma", {
  getNodeById: vi.fn(() => mockNode),
});

describe("my_new_tool", () => {
  it("performs the operation on the target node", async () => {
    const result = await my_new_tool({ nodeId: "1:2" });
    expect(result).toEqual({ nodeId: "1:2", name: "TestNode" });
  });

  it("throws if node not found", async () => {
    vi.mocked(figma.getNodeById).mockReturnValueOnce(null);
    await expect(my_new_tool({ nodeId: "999:999" })).rejects.toThrow("not found");
  });

  it("throws if nodeId is missing", async () => {
    await expect(my_new_tool({})).rejects.toThrow("nodeId is required");
  });
});
```

### Step 4: Update tool description in the MCP category tool

The MCP tool definition in `src/server/tools/<category>.ts` lists available commands in its description and enum. Add your new command to:
- The `command` enum in the tool's input schema
- The tool description string (so Claude knows it exists)

### Rules

- Executor function name must **exactly match** the command name
- Descriptions must be clear enough for Claude to use without reading docs
- All colors accept hex strings (`#FF0000`) — parse in the executor using `plugin/utils/color.ts`
- Always return the node ID + relevant data in the response
- Throw descriptive errors — Claude reads them to self-correct
- Never use `any` — use `unknown` and validate at runtime
- Node IDs must be validated against the pattern `^\d+:\d+$`

## Adding a New Superpower Tool

Superpower tools follow the same pattern but live under the `superpowers` category:

1. Add executor to `plugin/executors/superpowers.ts`
2. Command is routed via `figma_superpowers` MCP tool
3. Use `BULK_TIMEOUT` (120s) for operations that touch many nodes
4. Superpowers should return rich, structured reports — these are AI-only capabilities

Example superpower structure:

```typescript
export async function my_audit(params: Record<string, unknown>): Promise<unknown> {
  const scope = (params.scope as string) || "page";
  const nodes = scope === "file"
    ? figma.root.findAll()
    : figma.currentPage.findAll();

  const issues: Array<{ nodeId: string; nodeName: string; issue: string; severity: string }> = [];

  for (const node of nodes) {
    // ... analyze each node ...
    // issues.push({ nodeId: node.id, nodeName: node.name, issue: "...", severity: "warning" });
  }

  return {
    totalNodes: nodes.length,
    issueCount: issues.length,
    issues,
    summary: `Found ${issues.length} issues across ${nodes.length} nodes`,
  };
}
```

## Testing

```bash
npm test                    # All tests
npm run test:watch          # Watch mode
npx vitest run <file>       # Single file
npm run test:e2e            # E2E tests (requires running Figma)
```

### Test layers

1. **Unit tests** — param validation + executor behavior (mocked Figma API)
2. **Integration tests** — mock WebSocket end-to-end
3. **E2E tests** — real Figma plugin connection (optional, CI-skippable)

## Pull Requests

1. Create a branch from `main`
2. Add tests for new tools
3. Run `npm run typecheck && npm run lint && npm test` before submitting
4. Keep PR scope focused — one tool category per PR is ideal
5. Fill out the PR template completely

### PR Checklist

- [ ] Tests added and passing
- [ ] TypeScript compiles without errors (`npm run typecheck`)
- [ ] Linting passes (`npm run lint`)
- [ ] Tool description is clear enough for Claude to use without docs
- [ ] Manual testing done in Figma (desktop or browser)
- [ ] CHANGELOG.md updated (if user-facing change)

## Commit Style

Use conventional commits:

```
feat: add set_opacity tool
fix: handle missing node in rename_node
docs: add tool reference for superpowers
test: add executor tests for text tools
refactor: extract color parsing to shared utility
chore: update dependencies
```
