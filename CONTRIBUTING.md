# Contributing to figma-mcp-write

Thanks for your interest. Here's how to get started.

## Setup

```bash
git clone https://github.com/anthropics/figma-mcp-write.git
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

# Type check
npm run typecheck
```

## Project layout

- `src/server/` - MCP server + WebSocket server
- `src/server/tools/` - Tool definitions (one file per category)
- `plugin/` - Figma plugin (code + UI)
- `plugin/executors/` - Command executors (mirrors tools/ 1:1)
- `shared/` - Types shared between server and plugin
- `test/` - Tests

## Adding a new tool

Every tool needs two things:

1. **Tool definition** in `src/server/tools/<category>.ts`
2. **Executor** in `plugin/executors/<category>.ts`

The tool definition describes the MCP interface (name, description, parameters). The executor runs inside Figma.

### Tool definition template

```typescript
// src/server/tools/<category>.ts
{
  name: "my_new_tool",
  description: "What this tool does. Be specific enough for AI to use without docs.",
  inputSchema: {
    type: "object",
    properties: {
      nodeId: { type: "string", description: "Target node ID" },
      // ... more params
    },
    required: ["nodeId"],
  },
}
```

### Executor template

```typescript
// plugin/executors/<category>.ts
export function my_new_tool(params: { nodeId: string }) {
  const node = figma.getNodeById(params.nodeId);
  if (!node) throw new Error(`Node ${params.nodeId} not found`);
  // ... do the work
  return { nodeId: node.id, name: node.name };
}
```

### Rules

- Tool name = executor function name (exact match)
- Descriptions must be clear enough for Claude to use without reading docs
- All colors accept hex strings - parse in the executor
- Always return the node ID + relevant data in the response
- Throw descriptive errors (Claude reads them to self-correct)

## Testing

```bash
npm test              # all tests
npm run test:watch    # watch mode
```

- Tool tests: validate parameter schemas
- Executor tests: mock the Figma Plugin API
- Integration tests: mock WebSocket end-to-end

## Pull requests

1. Create a branch from `main`
2. Add tests for new tools
3. Run `npm run typecheck && npm test` before submitting
4. Keep PR scope focused - one tool category per PR is ideal

## Commit style

Use conventional commits:
- `feat: add set_opacity tool`
- `fix: handle missing node in rename_node`
- `docs: add tool reference for superpowers`
- `test: add executor tests for text tools`
