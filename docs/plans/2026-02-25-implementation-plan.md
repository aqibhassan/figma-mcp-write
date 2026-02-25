# Implementation Plan

**Date:** 2026-02-25
**Design doc:** `docs/plans/2026-02-25-figma-mcp-design.md`

## Phase 1: Foundation (Server + Plugin skeleton)

### Step 1.1: Project setup
- [x] Create directory structure
- [x] package.json with all dependencies
- [x] tsconfig.json (server) + tsconfig.plugin.json (plugin)
- [x] shared/protocol.ts (command types, constants)
- [ ] .gitignore, LICENSE (MIT), CONTRIBUTING.md
- [ ] npm install + verify builds

### Step 1.2: WebSocket server
- [x] src/server/websocket.ts — WebSocketServer on port 3846
- [x] src/server/command-queue.ts — UUID-keyed request/response pairing
- [ ] Connection lifecycle: handshake, heartbeat, reconnect handling
- [ ] Tests: connection, disconnect, timeout, buffer

### Step 1.3: MCP server
- [ ] src/server/mcp.ts — MCP server with stdio transport
- [ ] Tool registry: auto-discovers tools from tools/ directory
- [ ] Each tool calls `commandQueue.send(type, params)`
- [ ] Connection status tool (is plugin connected? which file?)
- [ ] Tests: tool registration, parameter validation

### Step 1.4: Entry point
- [ ] src/server/index.ts — boots MCP server + WebSocket server
- [ ] CLI: `figma-mcp-write` command (hashbang, args parsing)
- [ ] `--port` flag (default 3846)
- [ ] Graceful shutdown on SIGINT/SIGTERM

### Step 1.5: Figma plugin skeleton
- [ ] plugin/manifest.json — plugin ID, name, permissions
- [ ] plugin/ui.html — status panel (connected/disconnected, server URL input)
- [ ] plugin/code.ts — WebSocket client, command router, handshake
- [ ] Tests: mock WebSocket, command routing

## Phase 2: Core tools (must-have operations)

### Step 2.1: Layer tools (8 tools)
- [ ] create_node — frame, rectangle, ellipse, line, polygon, star
- [ ] create_text — text with font, size, color
- [ ] delete_node
- [ ] duplicate_node — with offset
- [ ] move_node — absolute or relative
- [ ] resize_node
- [ ] rename_node
- [ ] reorder_node — z-index

### Step 2.2: Text tools (5 tools)
- [ ] set_text_content
- [ ] set_text_style — font family/size/weight/lineHeight/letterSpacing
- [ ] set_text_color
- [ ] set_text_alignment — horizontal + vertical
- [ ] find_replace_text — regex support, scoped (file/page/node)

### Step 2.3: Styling tools (8 tools)
- [ ] set_fill — solid, gradient (4 types), image
- [ ] set_stroke — color, weight, alignment, dash
- [ ] set_corner_radius — all or individual corners
- [ ] set_opacity
- [ ] set_effects — drop shadow, inner shadow, layer blur, bg blur
- [ ] set_blend_mode
- [ ] set_constraints — horizontal + vertical
- [ ] apply_style — apply shared style by name

### Step 2.4: Reading tools (5 tools)
- [ ] get_node — full node details
- [ ] get_selection — currently selected nodes
- [ ] get_page_nodes — list all nodes (with type filter)
- [ ] search_nodes — find by name, type, text content
- [ ] scroll_to_node — pan viewport

## Phase 3: Advanced tools

### Step 3.1: Layout tools (5 tools)
- [ ] set_auto_layout — direction, spacing, padding, alignment, wrap, sizing
- [ ] add_to_auto_layout — insert at index
- [ ] set_layout_grid — columns, rows, pixel grid
- [ ] group_nodes — group or frame
- [ ] ungroup_nodes

### Step 3.2: Component tools (6 tools)
- [ ] create_component — frame to component
- [ ] create_component_set — variant set
- [ ] create_instance — place instance
- [ ] swap_instance
- [ ] set_instance_override — text, fills, visibility
- [ ] detach_instance

### Step 3.3: Page tools (4 tools)
- [ ] create_page
- [ ] switch_page
- [ ] create_section
- [ ] set_page_background

### Step 3.4: Vector tools (3 tools)
- [ ] boolean_operation — union, subtract, intersect, exclude
- [ ] flatten_node
- [ ] set_mask

### Step 3.5: Export tools (4 tools)
- [ ] export_node — PNG, SVG, PDF, JPG at any scale
- [ ] set_export_settings — configure presets
- [ ] set_image_fill — from URL or base64
- [ ] get_node_css — extract CSS properties

### Step 3.6: Variable tools (4 tools)
- [ ] create_variable — color, number, string, boolean
- [ ] set_variable_value — per mode
- [ ] create_variable_collection — with modes
- [ ] bind_variable — bind to node property

## Phase 4: Superpowers

### Step 4.1: Bulk operations (2 tools)
- [ ] bulk_rename — regex, prefix, sequential numbering
- [ ] bulk_style — apply changes across all matching nodes

### Step 4.2: Design intelligence (4 tools)
- [ ] design_lint — detached styles, inconsistent spacing, orphan components
- [ ] accessibility_check — WCAG contrast, touch targets, text sizes
- [ ] localize_text — swap all text to locale mapping
- [ ] generate_layout — describe layout in words, get auto-laid-out frames

## Phase 5: Polish + Open Source

### Step 5.1: Documentation
- [ ] README.md with install instructions, demo GIF, full tool reference
- [ ] CONTRIBUTING.md
- [ ] Tool reference docs (auto-generated from schemas)

### Step 5.2: CI/CD
- [ ] .github/workflows/ci.yml — lint + typecheck + test on PR
- [ ] .github/workflows/release.yml — npm publish on tag
- [ ] Issue templates (bug report, feature request)

### Step 5.3: Distribution
- [ ] npm publish setup
- [ ] Figma Community plugin publish
- [ ] `claude mcp add` one-liner in README

### Step 5.4: Testing
- [ ] Unit tests for all 58 tools (parameter validation)
- [ ] Unit tests for all 58 executors (mocked Figma API)
- [ ] Integration tests (mock WebSocket end-to-end)
- [ ] Manual testing checklist (each tool against real Figma file)

## Estimated Effort Per Phase
| Phase | Tools | Complexity |
|-------|-------|------------|
| 1 Foundation | 0 | Server + plugin skeleton |
| 2 Core | 26 | Most-used daily operations |
| 3 Advanced | 22 | Components, vectors, variables |
| 4 Superpowers | 6 | AI-only capabilities |
| 5 Polish | 0 | Docs, CI, publish |
