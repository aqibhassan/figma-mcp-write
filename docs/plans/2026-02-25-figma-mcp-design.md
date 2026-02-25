# figma-mcp-write Design Document

**Date:** 2026-02-25
**Status:** Approved
**Author:** Hassan + Claude

## Problem

The official Figma MCP server is read-only for existing designs. You can screenshot, read metadata, and get design context, but you can't rename a frame, edit text, create a node, or modify anything. There's no open-source MCP that gives Claude (or any AI) full read/write control over Figma files.

## Solution

A custom MCP server + Figma plugin that gives Claude Code full UX/UI developer capabilities in Figma. 58 tools covering everything a senior designer does, plus 6 AI-only superpowers.

## Architecture

```
Claude Code (stdio) → MCP Server + WebSocket Server (single Node.js process) → Figma Plugin (full Plugin API)
```

- **MCP Server** (stdio transport): Receives tool calls from Claude Code
- **WebSocket Server** (ws://localhost:3846): Bridges commands to the Figma plugin
- **Figma Plugin**: Runs inside Figma (desktop + browser), executes commands via Plugin API

Single process. One `npm start` boots both servers.

## Communication Protocol

```typescript
interface Command {
  id: string;        // UUID
  type: string;      // tool name
  params: Record<string, any>;
}

interface CommandResponse {
  id: string;
  success: boolean;
  data?: any;
  error?: string;
}
```

- 30s timeout per command (120s for bulk/export ops)
- Plugin auto-reconnects every 2s on disconnect
- Server buffers commands for 5s during brief disconnects

## Tool Suite (58 tools)

### Layer Management (8)
create_node, create_text, delete_node, duplicate_node, move_node, resize_node, rename_node, reorder_node

### Text (5)
set_text_content, set_text_style, set_text_color, set_text_alignment, find_replace_text

### Styling (8)
set_fill, set_stroke, set_corner_radius, set_opacity, set_effects, set_blend_mode, set_constraints, apply_style

### Layout (5)
set_auto_layout, add_to_auto_layout, set_layout_grid, group_nodes, ungroup_nodes

### Components & Variants (6)
create_component, create_component_set, create_instance, swap_instance, set_instance_override, detach_instance

### Pages & Structure (4)
create_page, switch_page, create_section, set_page_background

### Boolean & Vector (3)
boolean_operation, flatten_node, set_mask

### Export & Assets (4)
export_node, set_export_settings, set_image_fill, get_node_css

### Design Tokens & Variables (4)
create_variable, set_variable_value, create_variable_collection, bind_variable

### Reading & Navigation (5)
get_node, get_selection, get_page_nodes, search_nodes, scroll_to_node

### Superpowers (6)
bulk_rename, bulk_style, design_lint, accessibility_check, localize_text, generate_layout

## Tech Stack

- TypeScript (both server and plugin)
- @modelcontextprotocol/sdk (MCP server)
- ws (WebSocket server)
- esbuild (plugin bundling)
- vitest (testing)

## User Setup

```bash
npm install -g figma-mcp-write
claude mcp add figma-write -- figma-mcp-write
# In Figma: Plugins > figma-mcp-write > Run
```

## Distribution

- npm package (MCP server CLI)
- Figma Community plugin (or local install from source)
- MIT license
