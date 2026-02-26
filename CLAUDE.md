# figma-mcp-write

## What This Is
An open-source MCP server + Figma plugin that gives Claude Code full read/write control over Figma files. 68 tools (50 core + 18 AI-only superpowers) exposed through a **smart router architecture** of just 13 MCP tools. Design system intelligence, compound operations, best-in-class open-source DX.

## Status: Planning Complete, Implementation Not Started

### Implementation Progress
| Phase | Name | Tools | Status |
|-------|------|-------|--------|
| 1 | Foundation + Router | 0 (architecture) | COMPLETE ✅ |
| 2 | Read + Basic Write | 18 tools | COMPLETE ✅ |
| 3 | Styling + Layout | 13 tools | NOT STARTED |
| 4 | Components + Structure | 13 tools | NOT STARTED |
| 5 | Export + Variables + Design System | 8 tools + context | NOT STARTED |
| 6 | Superpowers | 18 tools | NOT STARTED |
| 7 | Polish + Open Source Launch | DX only | NOT STARTED |

### Key Planning Docs (ALL COMPLETE)
- `docs/plans/2026-02-25-figma-mcp-v2-design.md` — Full design doc (approved)
- `docs/plans/2026-02-25-v2-implementation-plan.md` — Master implementation plan
- `docs/plans/phase-1-foundation.md` — Phase 1: Foundation + Router (2,874 lines)
- `docs/plans/phase-2-read-write.md` — Phase 2: Read + Basic Write, 18 tools (3,783 lines)
- `docs/plans/phase-3-styling-layout.md` — Phase 3: Styling + Layout, 13 tools (3,372 lines)
- `docs/plans/phase-4-components-structure.md` — Phase 4: Components + Structure, 13 tools (3,468 lines)
- `docs/plans/phase-5-export-variables.md` — Phase 5: Export + Variables + Design System, 8 tools + context (4,834 lines)
- `docs/plans/phase-6-superpowers.md` — Phase 6: Superpowers, 18 tools (6,420 lines)
- `docs/plans/phase-7-polish.md` — Phase 7: Polish + Open Source Launch (2,397 lines)

## Architecture (v2 — Smart Router)

```
Claude Code (stdio)
    ↓
MCP Server (13 tools: 1 meta + 11 category + 1 status)
    ↓
Smart Router (pattern matching + dispatch)
    ↓
Executor Layer (68 executors)
    ↓
WebSocket (ws://localhost:3846)
    ↓
Figma Plugin (desktop + browser)
    ↓
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
| 12 | `figma_superpowers` | 18 AI-only tools (see below) |
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
  e2e/              — Real Figma E2E tests
  fixtures/         — Sample node structures as JSON
  mocks/            — Mock Figma API + WebSocket

docs/plans/         — Design docs and implementation plans
scripts/            — Build scripts and tool generators
```

## Tool Categories (68 total)
| Category | Count | Tools |
|----------|-------|-------|
| Layer management | 8 | create_node, create_text, delete/duplicate/move/resize/rename/reorder_node |
| Text | 5 | set_text_content/style/color/alignment, find_replace_text |
| Styling | 8 | set_fill/stroke/corner_radius/opacity/effects/blend_mode/constraints, apply_style |
| Layout | 5 | set_auto_layout, add_to_auto_layout, set_layout_grid, group/ungroup_nodes |
| Components | 6 | create_component/component_set/instance, swap/override/detach_instance |
| Pages | 4 | create_page, switch_page, create_section, set_page_background |
| Vectors | 3 | boolean_operation, flatten_node, set_mask |
| Export | 4 | export_node, set_export_settings, set_image_fill, get_node_css |
| Variables | 4 | create/set_variable, create_variable_collection, bind_variable |
| Reading | 5 | get_node/selection/page_nodes, search_nodes, scroll_to_node |
| **Superpowers** | **18** | bulk_rename/style/resize, smart_align, design_lint, accessibility_check, design_system_scan, responsive_check, color_palette_extract, typography/spacing_audit, component_coverage, export/import_tokens, localize_text, annotation_generate, generate_layout, duplicate_detector |

## Key Differentiators (vs competitors)
1. **Smart Router** — 13 MCP tools instead of 68 (80% less token overhead)
2. **Compound Operations** — create full UI components in one call
3. **Design System Intelligence** — auto-scans file, suggests tokens, warns on violations
4. **18 AI-Only Superpowers** — no competitor has these as MCP tools
5. **No API Token Required** — runs inside user's Figma session

## Communication Protocol
- Command/Response with UUID pairing
- Batch support for compound operations
- Variable references ($0, $1, $0.property) for chaining
- Push events (selection_changed, page_changed, etc.)
- Design system context injection

## Timeouts
- Default: 30s per command
- Bulk/export/superpowers: 120s
- Design system scan: 60s
- Plugin reconnect: 2s interval
- Disconnect buffer: 5s

## Coding Conventions
- Strict TypeScript, no `any` (use `unknown`)
- All colors accept hex strings (`#FF0000`) — parsing in plugin
- Node IDs: strings in Figma format (`1234:5678`)
- Error messages: clear enough for Claude to self-correct
- No LLM calls inside the server — router is deterministic
- Max 3 production dependencies

## Testing (4 layers)
1. Unit tests: tool param validation + executor behavior
2. Integration tests: mock WebSocket end-to-end
3. Manual testing: each tool against real Figma file
4. E2E tests: automated tests against real running Figma

## Hard Rules
- Never push to remote without explicit user approval
- Plugin must work in both Figma desktop and browser
- Every tool description must be self-documenting for Claude
- No API tokens required
- No `child_process.exec` ever
- Input sanitization on every tool (node IDs, colors, etc.)
- Keep production dependencies under 5
