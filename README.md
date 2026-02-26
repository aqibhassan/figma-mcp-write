<!-- README.md -->
<div align="center">

# figma-mcp-write

**Give AI full control over Figma. The first open-source read/write Figma MCP.**

[![npm version](https://img.shields.io/npm/v/figma-mcp-write.svg)](https://www.npmjs.com/package/figma-mcp-write)
[![license](https://img.shields.io/npm/l/figma-mcp-write.svg)](https://github.com/anthropics/figma-mcp-write/blob/main/LICENSE)
[![build](https://img.shields.io/github/actions/workflow/status/anthropics/figma-mcp-write/ci.yml?branch=main)](https://github.com/anthropics/figma-mcp-write/actions)
[![GitHub stars](https://img.shields.io/github/stars/anthropics/figma-mcp-write.svg)](https://github.com/anthropics/figma-mcp-write/stargazers)

68 tools (50 core + 18 AI-only superpowers) exposed through a smart router of just 13 MCP tools.
Design system intelligence. Compound operations. No API token required.

<!-- TODO: Replace with actual demo GIF after recording -->
<!-- ![Demo GIF](docs/assets/demo.gif) -->

[Quick Start](#quick-start) · [Tool Reference](#tool-reference) · [Architecture](#architecture) · [Contributing](CONTRIBUTING.md)

</div>

---

## Quick Start

### 1. Install the MCP server

```bash
# Add to Claude Code (recommended)
claude mcp add figma -- npx figma-mcp-write

# Or install globally
npm install -g figma-mcp-write
```

### 2. Install the Figma plugin

1. Open Figma (desktop or browser)
2. Go to **Plugins > Development > Import plugin from manifest...**
3. Select `node_modules/figma-mcp-write/plugin/manifest.json`
4. Run the plugin from the Plugins menu

### 3. Start designing with AI

Open Claude Code and start talking to your Figma file:

```
> Create a card component with a hero image, title, subtitle, and CTA button.
  Use 16px spacing and rounded corners.
```

Claude will use the MCP tools to create, style, and lay out the design directly in your Figma file.

---

## Architecture

```
Claude Code (stdio)
    |
    v
MCP Server (13 tools: 1 meta + 11 category + 1 status)
    |
    v
Smart Router (pattern matching + compound operations)
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
Figma Plugin API (full read/write access)
```

Single Node.js process. No API tokens. No external services. The plugin runs inside your Figma session, so it has full access to the Figma Plugin API.

### Why 13 MCP tools instead of 68?

Most Figma MCPs expose every operation as a separate tool. With 56+ tools, Claude spends 2-30x more tokens just reading tool definitions. Our **smart router** groups 68 operations into 13 category tools. Claude picks the category, then specifies the command. Same power, fraction of the token cost.

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
| Tool count | 68 | 2 | ~30 | ~56 | 4-5 |
| MCP tool overhead | 13 tools | 2 tools | ~30 tools | ~56 tools | 4-5 tools |
| Compound operations | Yes | No | No | No | No |
| Design system aware | Yes | No | No | Partial | Partial |
| Accessibility audit | Yes | No | No | No | No |
| Design linting | Yes | No | No | No | No |
| Localization | Yes | No | No | No | No |
| Bulk operations | Yes | No | Partial | Partial | No |
| Token export/import | Yes | No | No | Partial | No |
| No API token needed | Yes | No | Yes | Mixed | No |
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
git clone https://github.com/anthropics/figma-mcp-write.git
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

## License

[MIT](LICENSE)
