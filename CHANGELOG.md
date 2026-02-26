<!-- CHANGELOG.md -->
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-02-25

### Added

- **Smart Router Architecture** — 68 tools exposed through 13 MCP tools (80% less token overhead)
- **Meta-tool (`figma`)** — natural language or structured commands with compound operation support
- **Variable references** — chain commands with `$0`, `$1`, `$0.property` in compound operations
- **Layer management** — `create_node`, `create_text`, `delete_node`, `duplicate_node`, `move_node`, `resize_node`, `rename_node`, `reorder_node`
- **Text tools** — `set_text_content`, `set_text_style`, `set_text_color`, `set_text_alignment`, `find_replace_text`
- **Styling tools** — `set_fill`, `set_stroke`, `set_corner_radius`, `set_opacity`, `set_effects`, `set_blend_mode`, `set_constraints`, `apply_style`
- **Layout tools** — `set_auto_layout`, `add_to_auto_layout`, `set_layout_grid`, `group_nodes`, `ungroup_nodes`
- **Component tools** — `create_component`, `create_component_set`, `create_instance`, `swap_instance`, `set_instance_override`, `detach_instance`
- **Page tools** — `create_page`, `switch_page`, `create_section`, `set_page_background`
- **Vector tools** — `boolean_operation`, `flatten_node`, `set_mask`
- **Export tools** — `export_node`, `set_export_settings`, `set_image_fill`, `get_node_css`
- **Variable tools** — `create_variable`, `set_variable_value`, `create_variable_collection`, `bind_variable`
- **Reading tools** — `get_node`, `get_selection`, `get_page_nodes`, `search_nodes`, `scroll_to_node`
- **18 Superpower tools** — bulk operations, design linting, accessibility checks, localization, design system analysis, typography/spacing/color audits, token export/import, annotation generation, duplicate detection, responsive checks, layout generation
- **Design system intelligence** — auto-scan on connect, token suggestions, violation warnings, context injection
- **Figma plugin** — WebSocket client with auto-reconnect, status panel UI, full Plugin API access
- **CI/CD pipeline** — GitHub Actions for lint, typecheck, test, build, npm publish, GitHub releases
- **Tool template generator** — `npx tsx scripts/create-tool.ts <name> <category>`
- **E2E test framework** — mock plugin connection for full workflow testing
- **Docker support** — multi-stage Dockerfile for headless/CI use

### Changed

- Migrated from flat 58-tool architecture to smart router with 13 MCP tools
- Protocol updated with batch support, variable references, and design system context

### Security

- Input sanitization on all tools (node IDs, colors, hex patterns)
- No `child_process.exec` — enforced via ESLint rule
- WebSocket origin validation
- Rate limiting on bulk operations (max 1000 nodes, max 100 batch commands)

## [0.1.0] - 2026-02-25

### Added

- Initial project scaffold
- Package.json with dependencies
- TypeScript configuration (server + plugin)
- MIT license
- Basic CONTRIBUTING.md
