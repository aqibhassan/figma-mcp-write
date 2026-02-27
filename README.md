<!-- README.md -->
<div align="center">

# figma-mcp-write

**Give AI full control over Figma. The first open-source read/write Figma MCP.**

[![npm version](https://img.shields.io/npm/v/figma-mcp-write.svg)](https://www.npmjs.com/package/figma-mcp-write)
[![license](https://img.shields.io/npm/l/figma-mcp-write.svg)](https://github.com/aqibhassan/figma-mcp-write/blob/main/LICENSE)
[![build](https://img.shields.io/github/actions/workflow/status/aqibhassan/figma-mcp-write/ci.yml?branch=main)](https://github.com/aqibhassan/figma-mcp-write/actions)
[![GitHub stars](https://img.shields.io/github/stars/aqibhassan/figma-mcp-write.svg)](https://github.com/aqibhassan/figma-mcp-write/stargazers)

70 tools (52 core + 18 AI-only superpowers) exposed through a smart router of just 13 MCP tools.
Design system intelligence. Compound operations. No API token required.

<!-- TODO: Replace with actual demo GIF after recording -->
<!-- ![Demo GIF](docs/assets/demo.gif) -->

[Quick Start](#quick-start) · [Tool Reference](#tool-reference) · [Architecture](#architecture) · [Contributing](CONTRIBUTING.md)

</div>

---

## Quick Start

### Option A: One-command setup (recommended)

```bash
npx figma-mcp-write setup
```

This will:
1. Open your browser to create a Figma API token
2. Verify and save the token locally
3. Configure Claude Code automatically

Reads work immediately. For write access, install the [Figma plugin](#install-the-figma-plugin).

### Option B: Environment variable

```bash
# Set your Figma token
export FIGMA_API_TOKEN=figd_your_token_here

# Add to Claude Code
claude mcp add figma -- npx figma-mcp-write
```

### Option C: Clone and build (development)

```bash
git clone https://github.com/aqibhassan/figma-mcp-write.git
cd figma-mcp-write
npm install && npm run build
claude mcp add figma -- node /absolute/path/to/figma-mcp-write/dist/src/server/index.js
```

### Install the Figma plugin

For write access (creating/modifying designs), install the Figma plugin:

1. Open Figma (desktop or browser)
2. Go to **Plugins > Development > Import plugin from manifest...**
3. Select the `plugin/manifest.json` file from your cloned repo
4. Run the plugin — it shows a status panel when the MCP server connects

> Without the plugin, all read operations (inspecting files, exporting, searching) work via the REST API. The plugin is only needed for creating and modifying designs.

### Start designing with AI

```
> Show me all frames in figma.com/design/abc123/MyFile
  → Works immediately via REST API (no plugin needed)

> Create a card component with a hero image, title, subtitle, and CTA button
  → Requires plugin running in Figma
```

---

## Connection Modes

| Mode | Setup | Reads | Writes |
|------|-------|-------|--------|
| **REST API** | Token only (no plugin needed) | Via Figma API | Not available |
| **Plugin** | Plugin running in Figma | Real-time | Full access |
| **Hybrid** | Token + Plugin running | Plugin preferred | Full access |

The server automatically uses the best available mode. When the plugin is connected, all operations go through it (faster, real-time). When disconnected, reads fall back to the REST API.

---

## Architecture

```
Claude Code (stdio)
    |
    v
MCP Server (13 tools: 1 meta + 11 category + 1 status)
    |
    v
Smart Router (pattern matching + REST API fallback)
    |
    ├── Plugin connected → WebSocket → Figma Plugin → Plugin API (full R/W)
    |
    └── Plugin disconnected → Figma REST API (reads only, via PAT token)
```

Single Node.js process. No external services. The plugin runs inside your Figma session for full read/write access. Without the plugin, reads work via the Figma REST API with a personal access token.

### Why 13 MCP tools instead of 68?

Most Figma MCPs expose every operation as a separate tool. With 56+ tools, Claude spends 2-30x more tokens just reading tool definitions. Our **smart router** groups 70 operations into 13 category tools. Claude picks the category, then specifies the command. Same power, fraction of the token cost.

---

## Tool Reference

### The 13 MCP Tools

| # | Tool | Commands | Description |
|---|------|----------|-------------|
| 1 | `figma` | all | **Meta-tool.** Natural language or structured commands. Supports compound operations with variable references (`$0`, `$1`). |
| 2 | `figma_layers` | 8 | `create_node`, `create_text`, `delete_node`, `duplicate_node`, `move_node`, `resize_node`, `rename_node`, `reorder_node` |
| 3 | `figma_text` | 5 | `set_text_content`, `set_text_style`, `set_text_color`, `set_text_alignment`, `find_replace_text` |
| 4 | `figma_styling` | 8 | `set_fill`, `set_stroke`, `set_corner_radius`, `set_opacity`, `set_effects`, `set_blend_mode`, `set_constraints`, `apply_style` |
| 5 | `figma_layout` | 5 | `set_auto_layout`, `add_to_auto_layout`, `set_layout_grid`, `group_nodes`, `ungroup_nodes` |
| 6 | `figma_components` | 6 | `create_component`, `create_component_set`, `create_instance`, `swap_instance`, `set_instance_override`, `detach_instance` |
| 7 | `figma_pages` | 4 | `create_page`, `switch_page`, `create_section`, `set_page_background` |
| 8 | `figma_vectors` | 3 | `boolean_operation`, `flatten_node`, `set_mask` |
| 9 | `figma_export` | 4 | `export_node`, `set_export_settings`, `set_image_fill`, `get_node_css` |
| 10 | `figma_variables` | 4 | `create_variable`, `set_variable_value`, `create_variable_collection`, `bind_variable` |
| 11 | `figma_reading` | 5 | `get_node`, `get_selection`, `get_page_nodes`, `search_nodes`, `scroll_to_node` |
| 12 | `figma_superpowers` | 18 | See [Superpowers](#superpowers) below |
| 13 | `figma_status` | 1 | Connection status, file info, available commands |

### Superpowers (18 AI-only tools)

These are capabilities no designer has natively. Our primary differentiator.

| Tool | Description |
|------|-------------|
| `bulk_rename` | Rename nodes with regex, prefix, sequential numbering |
| `bulk_style` | Apply style changes across all matching nodes |
| `bulk_resize` | Resize multiple nodes with constraints and scale factors |
| `smart_align` | Auto-distribute, align, and space a selection |
| `design_lint` | Detect detached styles, inconsistent spacing, naming violations |
| `accessibility_check` | WCAG contrast ratios, touch target sizes, text sizes |
| `design_system_scan` | Scan for design system usage, violations, token coverage |
| `responsive_check` | Test layout at multiple breakpoints, report overflow |
| `color_palette_extract` | Extract colors, find near-duplicates, suggest consolidation |
| `typography_audit` | List all font/size/weight combos, flag inconsistencies |
| `spacing_audit` | Analyze spacing patterns, flag irregular spacing |
| `component_coverage` | % of file using components vs raw nodes |
| `export_tokens` | Export tokens as JSON, CSS custom properties, or Tailwind config |
| `import_tokens` | Import design tokens from JSON/CSS and apply to file |
| `localize_text` | Swap text to locale mapping, detect hardcoded strings |
| `annotation_generate` | Auto-generate dev handoff annotations |
| `generate_layout` | Natural language description to auto-laid-out frames |
| `duplicate_detector` | Find visually duplicate components/patterns |

---

## Comparison

| Feature | figma-mcp-write | Framelink (13K stars) | Grab TalkToFigma (6.3K stars) | figma-console-mcp (363 stars) | Official Figma MCP |
|---------|:-:|:-:|:-:|:-:|:-:|
| Read access | Yes | Yes | Yes | Yes | Yes |
| Write access | Full | No | Partial | Partial | No |
| Tool count | 70 | 2 | ~30 | ~56 | 4-5 |
| MCP tool overhead | 13 tools | 2 tools | ~30 tools | ~56 tools | 4-5 tools |
| Compound operations | Yes | No | No | No | No |
| Design system aware | Yes | No | No | Partial | Partial |
| Accessibility audit | Yes | No | No | No | No |
| Design linting | Yes | No | No | No | No |
| Localization | Yes | No | No | No | No |
| Bulk operations | Yes | No | Partial | Partial | No |
| Token export/import | Yes | No | No | Partial | No |
| No API token needed | Optional | No | Yes | Mixed | No |
| Open source | MIT | MIT | MIT | MIT | No |

---

## Design System Intelligence

When the plugin connects, it auto-scans your file and builds a design system context:

- **Variables** — color tokens, spacing tokens, typography tokens
- **Styles** — text, color, effect, and grid styles
- **Components** — local components and external library info
- **Conventions** — naming patterns, spacing scale, color palette

Every tool is design-system-aware. Use a color that does not match a token? The error message tells you the closest match and how to bind it. Ask Claude to create a button? If a Button component exists in your design system, it creates an instance instead of building from scratch.

---

## Development

```bash
git clone https://github.com/aqibhassan/figma-mcp-write.git
cd figma-mcp-write
npm install

# Dev mode (auto-restart)
npm run dev

# Build everything
npm run build

# Run tests
npm test

# Type check
npm run typecheck

# Lint
npm run lint
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full contributor guide.

---

## Troubleshooting

**Plugin won't connect to server**
- Verify the MCP server is running (Claude Code should start it automatically when you use a `figma_*` tool)
- Check the port is free: `lsof -i :3846`
- In Figma desktop: Plugins > Development > Open Console to see plugin errors
- Try closing and re-running the plugin

**"No Figma plugin connected" error in Claude**
- The plugin must be running in Figma before you call a tool
- The plugin shows a green "Connected" badge when the MCP server is reachable

**Command times out**
- Default timeout is 30s; bulk/superpowers ops get 120s
- Check the Figma plugin console for errors
- For very large files (10K+ nodes), bulk operations may need a timeout increase

**TypeScript errors after pulling**
- Run `npm install` then `npm run build`
- Requires Node.js >= 18

---

## License

[MIT](LICENSE)
