<!-- CLAUDE.md -->
# figma-mcp-write

## What This Is
An open-source MCP server + Figma plugin that gives Claude Code full read/write control over Figma files. 68 tools (50 core + 18 AI-only superpowers) exposed through a **smart router architecture** of just 13 MCP tools. Design system intelligence, compound operations, best-in-class open-source DX.

## Status: v0.2.0 Released

### Implementation Progress
| Phase | Name | Tools | Status |
|-------|------|-------|--------|
| 1 | Foundation + Router | 0 (architecture) | COMPLETE |
| 2 | Read + Basic Write | 18 tools | COMPLETE |
| 3 | Styling + Layout | 13 tools | COMPLETE |
| 4 | Components + Structure | 13 tools | COMPLETE |
| 5 | Export + Variables + Design System | 8 tools + context | COMPLETE |
| 6 | Superpowers | 18 tools | COMPLETE |
| 7 | Polish + Open Source Launch | DX only | COMPLETE |

### Key Docs
- `docs/plans/2026-02-25-figma-mcp-v2-design.md` — Full design doc (approved)
- `docs/plans/2026-02-25-v2-implementation-plan.md` — Master implementation plan
- `docs/plans/phase-1-foundation.md` through `phase-7-polish.md` — Phase plans

## Architecture (v2 — Smart Router)

```
Claude Code (stdio)
    |
    v
MCP Server (13 tools: 1 meta + 11 category + 1 status)
    |
    v
Smart Router (pattern matching + dispatch)
    |
    v
Executor Layer (68 executors)
    |
    v
WebSocket (ws://localhost:3846)
    |
    v
Figma Plugin (desktop + browser)
    |
    v
Figma Plugin API (full access)
```

### The 13 MCP Tools
| # | Tool | Purpose |
|---|------|---------|
| 1 | `figma` | Meta-tool: natural language or structured commands, compound ops |
| 2 | `figma_layers` | create_node, create_text, delete/duplicate/move/resize/rename/reorder |
| 3 | `figma_text` | set_text_content/style/color/alignment, find_replace_text |
| 4 | `figma_styling` | set_fill/stroke/corner_radius/opacity/effects/blend_mode/constraints, apply_style |
| 5 | `figma_layout` | set_auto_layout, add_to_auto_layout, set_layout_grid, group/ungroup |
| 6 | `figma_components` | create_component/component_set/instance, swap/override/detach |
| 7 | `figma_pages` | create_page, switch_page, create_section, set_page_background |
| 8 | `figma_vectors` | boolean_operation, flatten_node, set_mask |
| 9 | `figma_export` | export_node, set_export_settings, set_image_fill, get_node_css |
| 10 | `figma_variables` | create/set_variable, create_collection, bind_variable |
| 11 | `figma_reading` | get_node/selection/page_nodes, search_nodes, scroll_to_node |
| 12 | `figma_superpowers` | 18 AI-only tools (see design doc for full list) |
| 13 | `figma_status` | Connection status, file info, available commands |

## Tech Stack
- TypeScript (strict, both server and plugin)
- `@modelcontextprotocol/sdk` — MCP server
- `ws` — WebSocket server
- `uuid` — command ID generation
- `@figma/plugin-typings` — Figma Plugin API types
- `esbuild` — plugin bundling
- `vitest` — testing

## Project Structure
```
src/server/
  index.ts          — Entry point (boots MCP + WebSocket)
  mcp.ts            — MCP server + 13 tool registrations
  websocket.ts      — WebSocket server + connection manager
  command-queue.ts  — UUID-keyed request/response pairing
  router.ts         — Smart router (meta-tool dispatch + compound ops)
  design-system.ts  — Design system context manager
  tools/            — 13 MCP tool definitions (one per category + meta + status)
  __tests__/        — Server-side tests

plugin/
  manifest.json     — Figma plugin manifest
  code.ts           — Plugin main: WebSocket client + command router
  ui.html           — Status panel UI
  executors/        — 68 command executors (one file per category)
  utils/            — Node/style/color helpers
  __tests__/        — Plugin-side tests

shared/
  protocol.ts       — Command, CommandResponse, PluginEvent, DesignSystemContext types

test/
  integration/      — End-to-end integration tests
  e2e/              — E2E tests with mock plugin client
  fixtures/         — Sample node structures as JSON
  mocks/            — Mock Figma API + WebSocket

docs/plans/         — Design docs and implementation plans
scripts/            — Build scripts and tool generators
```

## Key Pattern: Tool -> Router -> Executor
Every MCP tool call goes through the smart router which dispatches to the correct executor in the plugin. The router handles:
- Command dispatch (single command)
- Compound operations (batch with variable references $0, $1)
- Design system context injection

## Communication Flow
1. Claude calls MCP tool (e.g. `figma_layers` with command `rename_node`)
2. Router resolves command to executor, wraps as Command with UUID
3. Command sent over WebSocket to plugin
4. Plugin executor runs against Figma Plugin API
5. Plugin sends CommandResponse back over WebSocket
6. Server resolves promise, returns to Claude

## Timeouts
- Default: 30s per command
- Bulk/export/superpowers: 120s
- Design system scan: 60s
- Plugin reconnect: 2s interval
- Disconnect buffer: 5s (commands queue, then reject)

## Coding Conventions
- Strict TypeScript, no `any` (use `unknown` for untyped params)
- All colors accept hex strings (`#FF0000`) — parsing in plugin
- Node IDs: strings in Figma format (`1234:5678`)
- Error messages: clear enough for Claude to self-correct
- No LLM calls inside the server — router is deterministic
- Max 3 production dependencies

## Testing (4 layers)
1. **Unit tests** — tool param validation + executor behavior (mocked Figma API)
2. **Integration tests** — mock WebSocket end-to-end
3. **E2E tests** — mock plugin client against real server (`npm run test:e2e`)
4. **Manual testing** — each tool against real Figma file

## Build
- Server: `tsc` -> `dist/`
- Plugin: `esbuild` bundle -> single `code.js` for Figma
- Docker: `docker build -t figma-mcp-write .`
- Separate tsconfigs (server targets Node, plugin targets browser)

## Scripts
```bash
npm run dev          # Dev mode (auto-restart)
npm run build        # Build server + plugin
npm test             # Run all tests
npm run test:e2e     # Run E2E tests only
npm run typecheck    # Type check server + plugin
npm run lint         # ESLint
npm run create-tool  # Generate tool scaffold
```

## Hard Rules
- Never push to remote without explicit user approval
- Plugin must work in both Figma desktop and browser
- Every tool description must be self-documenting for Claude
- No API tokens required
- No `child_process.exec` ever (enforced via ESLint)
- Input sanitization on every tool (node IDs, colors, etc.)
- Keep production dependencies under 5

## Troubleshooting

### Plugin won't connect
1. Verify the MCP server is running: `npm run dev`
2. Check the port is free: `lsof -i :3846`
3. In Figma, check Plugins > Development > Open Console for errors
4. Try restarting the plugin from the Plugins menu

### Command times out
1. Default timeout is 30s, bulk ops get 120s
2. Check the Figma plugin console for errors
3. The plugin may be unresponsive — restart it
4. For bulk operations on large files (10K+ nodes), timeouts are expected on very slow machines

### TypeScript errors after pulling
1. Run `npm install` to update dependencies
2. Run `npm run build` to regenerate dist/
3. Check that your Node.js version is >= 18

### Tests fail
1. Run `npm run typecheck` first to catch type errors
2. Run tests with verbose output: `npm test -- --reporter=verbose`
3. For E2E tests, ensure no other process is using port 13846

## How to Extend

### Adding a new tool
```bash
npx tsx scripts/create-tool.ts my_tool_name category_name
```
This creates the executor stub and test stub. See CONTRIBUTING.md for the full guide.

### Adding a new superpower
Same as above, but use `superpowers` as the category. Superpowers should return rich structured reports (not just success/fail) and use `BULK_TIMEOUT` for operations touching many nodes.

### Adding a new MCP tool (category)
This is rare — we have 13 MCP tools covering all categories. If you need a new category:
1. Create tool definition in `src/server/tools/<name>.ts`
2. Register in `src/server/mcp.ts`
3. Create executor file in `plugin/executors/<name>.ts`
4. Update the router in `src/server/router.ts`
5. Update CLAUDE.md, README.md, and the design doc
