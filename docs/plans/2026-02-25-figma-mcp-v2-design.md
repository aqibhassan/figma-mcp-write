# figma-mcp-write v2 Design Document

**Date:** 2026-02-25
**Status:** Approved
**Author:** Hassan + Claude
**Supersedes:** `2026-02-25-figma-mcp-design.md` (original 58-tool flat architecture)

---

## 1. Problem

The official Figma MCP server is read-only. Community alternatives (Framelink at 13K stars, Grab TalkToFigma at 6.3K stars, figma-console-mcp at 363 stars) offer limited write access with 30-56 tools, but none deliver:

- **Design system intelligence** — tools that respect and leverage design tokens, variables, and component libraries
- **AI-only superpowers** — accessibility auditing, design linting, localization, bulk operations as MCP tools
- **Token efficiency** — 58+ individual MCP tools create 2-30x token overhead
- **Compound operations** — creating a full UI component requires 5-10 separate tool calls

## 2. Solution

A custom MCP server + Figma plugin that gives Claude Code full UX/UI developer capabilities. 68 tools (50 core + 18 superpowers) exposed through a **smart router architecture** of just 13 MCP tools. First-class design system integration. Best-in-class open-source DX.

## 3. Architecture

### 3.1 Overview

```
Claude Code (stdio)
    ↓
MCP Server (13 tools)
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

Single Node.js process boots both MCP server (stdio transport) and WebSocket server.

### 3.2 The 13 MCP Tools

| # | Tool | Purpose |
|---|------|---------|
| 1 | `figma` | **Meta-tool.** Primary interface. Accepts natural language or structured commands. Routes internally. Supports compound operations. |
| 2 | `figma_layers` | Layer management: create, delete, duplicate, move, resize, rename, reorder |
| 3 | `figma_text` | Text operations: content, style, color, alignment, find/replace |
| 4 | `figma_styling` | Visual styling: fill, stroke, corners, opacity, effects, blend mode, constraints |
| 5 | `figma_layout` | Layout: auto-layout, grid, group, ungroup |
| 6 | `figma_components` | Components: create, instances, variants, overrides, detach |
| 7 | `figma_pages` | Page management: create, switch, sections, backgrounds |
| 8 | `figma_vectors` | Boolean ops, flatten, masks |
| 9 | `figma_export` | Export: PNG/SVG/PDF/JPG, image fills, CSS extraction |
| 10 | `figma_variables` | Design tokens: create, set values, collections, binding |
| 11 | `figma_reading` | Read: node details, selection, page nodes, search, scroll |
| 12 | `figma_superpowers` | AI-only: bulk ops, linting, accessibility, localization, design system analysis |
| 13 | `figma_status` | Connection status, file info, available commands |

Category tools (2-12) each accept a `command` enum + typed `params`. Claude can choose the meta-tool for convenience or category tools for precision.

### 3.3 Smart Router

The `figma` meta-tool is the primary interface. It accepts:

**Option A: Structured commands (precision mode)**
```typescript
{
  commands: [
    { command: "create_node", params: { type: "FRAME", name: "Card", width: 320, height: 200 } },
    { command: "set_auto_layout", params: { nodeId: "$0", direction: "VERTICAL", spacing: 16 } },
    { command: "create_text", params: { text: "Title", parentId: "$0", fontSize: 24 } },
  ]
}
```

**Option B: Natural language**
```typescript
{
  instruction: "Create a card component with title, subtitle, image placeholder, and CTA button. Use 16px spacing and the existing design system colors."
}
```

**Option C: Hybrid (natural language + structured hints)**
```typescript
{
  instruction: "Add a header to the login screen",
  context: { targetNodeId: "1234:5678", designSystem: "material-3" }
}
```

#### Variable References

In compound operations, results from earlier commands are referenced with `$N`:
- `$0` = nodeId from first command's result
- `$1` = nodeId from second command's result
- `$0.width` = width property from first result

#### Response Format

```typescript
{
  success: boolean,
  operations: [
    { command: "create_node", nodeId: "1234:5678", status: "ok" },
    { command: "set_auto_layout", nodeId: "1234:5678", status: "ok" },
  ],
  summary: "Created frame 'Card' (1234:5678) with auto-layout and 2 child nodes",
  nodeIds: ["1234:5678", "1234:5679", "1234:5680"]
}
```

#### Rollback on Failure

If step N of a compound operation fails:
1. All previous steps are undone via `figma.undo()` (called N-1 times)
2. Error response includes: which step failed, why, and what was rolled back
3. Claude can fix and retry the entire batch

#### Important: No LLM Inside the Router

The router uses pattern matching and structured dispatch, not AI inference. The "smartness" comes from how Claude constructs instructions, not from the server parsing them. Natural language instructions are parsed with keyword matching and structural patterns, not an LLM.

## 4. Tool Catalog (68 tools)

### 4.1 Core Operations (50 tools)

#### Layer Management (8)

| Tool | Description | Key Params |
|------|-------------|------------|
| `create_node` | Create frame, rectangle, ellipse, line, polygon, star | `type`, `name`, `width`, `height`, `x`, `y`, `parentId?` |
| `create_text` | Create text node with font, size, color | `text`, `fontFamily?`, `fontSize?`, `color?`, `parentId?` |
| `delete_node` | Delete a node by ID | `nodeId` |
| `duplicate_node` | Duplicate with optional offset | `nodeId`, `offsetX?`, `offsetY?` |
| `move_node` | Move to absolute or relative position | `nodeId`, `x?`, `y?`, `relativeX?`, `relativeY?` |
| `resize_node` | Resize with optional constraints | `nodeId`, `width?`, `height?`, `constrainProportions?` |
| `rename_node` | Rename a node | `nodeId`, `name` |
| `reorder_node` | Change z-index | `nodeId`, `position: "front" \| "back" \| number` |

#### Text (5)

| Tool | Description | Key Params |
|------|-------------|------------|
| `set_text_content` | Set text string | `nodeId`, `text` |
| `set_text_style` | Font family, size, weight, line height, letter spacing | `nodeId`, `fontFamily?`, `fontSize?`, `fontWeight?`, `lineHeight?`, `letterSpacing?` |
| `set_text_color` | Set text color | `nodeId`, `color` (hex string) |
| `set_text_alignment` | Horizontal + vertical alignment | `nodeId`, `horizontal?`, `vertical?` |
| `find_replace_text` | Find and replace with regex support | `pattern`, `replacement`, `scope: "file" \| "page" \| nodeId`, `regex?` |

#### Styling (8)

| Tool | Description | Key Params |
|------|-------------|------------|
| `set_fill` | Solid, gradient (linear/radial/angular/diamond), image | `nodeId`, `type`, `color?`, `gradient?`, `imageUrl?` |
| `set_stroke` | Color, weight, alignment, dash pattern | `nodeId`, `color`, `weight?`, `alignment?`, `dashPattern?` |
| `set_corner_radius` | All corners or individual | `nodeId`, `radius?`, `topLeft?`, `topRight?`, `bottomLeft?`, `bottomRight?` |
| `set_opacity` | Node opacity | `nodeId`, `opacity` (0-1) |
| `set_effects` | Drop shadow, inner shadow, layer blur, bg blur | `nodeId`, `effects: Effect[]` |
| `set_blend_mode` | Blend mode | `nodeId`, `blendMode` |
| `set_constraints` | Horizontal + vertical constraints | `nodeId`, `horizontal?`, `vertical?` |
| `apply_style` | Apply shared style by name | `nodeId`, `styleName`, `styleType: "fill" \| "stroke" \| "text" \| "effect" \| "grid"` |

#### Layout (5)

| Tool | Description | Key Params |
|------|-------------|------------|
| `set_auto_layout` | Direction, spacing, padding, alignment, wrap, sizing | `nodeId`, `direction?`, `spacing?`, `paddingTop?`, `paddingRight?`, `paddingBottom?`, `paddingLeft?`, `alignment?`, `wrap?`, `primarySizing?`, `counterSizing?` |
| `add_to_auto_layout` | Insert child at index | `parentId`, `childId`, `index?` |
| `set_layout_grid` | Columns, rows, pixel grid | `nodeId`, `grids: LayoutGrid[]` |
| `group_nodes` | Group or frame selection | `nodeIds`, `type: "group" \| "frame"`, `name?` |
| `ungroup_nodes` | Ungroup | `nodeId` |

#### Components & Variants (6)

| Tool | Description | Key Params |
|------|-------------|------------|
| `create_component` | Convert frame/group to component | `nodeId` |
| `create_component_set` | Create variant set from components | `componentIds`, `name?` |
| `create_instance` | Place component instance | `componentId`, `x?`, `y?`, `parentId?` |
| `swap_instance` | Swap instance to different component | `instanceId`, `newComponentId` |
| `set_instance_override` | Override text, fills, visibility | `instanceId`, `overrides: Override[]` |
| `detach_instance` | Detach instance from component | `instanceId` |

#### Pages & Structure (4)

| Tool | Description | Key Params |
|------|-------------|------------|
| `create_page` | Create new page | `name` |
| `switch_page` | Switch active page | `pageId \| pageName` |
| `create_section` | Create section on canvas | `name`, `x?`, `y?`, `width?`, `height?` |
| `set_page_background` | Set page background color | `pageId?`, `color` |

#### Boolean & Vector (3)

| Tool | Description | Key Params |
|------|-------------|------------|
| `boolean_operation` | Union, subtract, intersect, exclude | `nodeIds`, `operation` |
| `flatten_node` | Flatten to vector | `nodeId` |
| `set_mask` | Set node as mask | `nodeId`, `isMask` |

#### Export & Assets (4)

| Tool | Description | Key Params |
|------|-------------|------------|
| `export_node` | Export as PNG, SVG, PDF, JPG | `nodeId`, `format`, `scale?`, `suffix?` |
| `set_export_settings` | Configure export presets | `nodeId`, `settings: ExportSetting[]` |
| `set_image_fill` | Set image fill from URL or base64 | `nodeId`, `imageUrl?`, `imageBase64?`, `scaleMode?` |
| `get_node_css` | Extract CSS properties | `nodeId`, `format: "css" \| "tailwind"?` |

#### Design Tokens & Variables (4)

| Tool | Description | Key Params |
|------|-------------|------------|
| `create_variable` | Create color, number, string, boolean variable | `name`, `type`, `collectionId`, `value` |
| `set_variable_value` | Set variable value per mode | `variableId`, `modeId`, `value` |
| `create_variable_collection` | Create collection with modes | `name`, `modes: string[]` |
| `bind_variable` | Bind variable to node property | `nodeId`, `property`, `variableId` |

#### Reading & Navigation (5)

| Tool | Description | Key Params |
|------|-------------|------------|
| `get_node` | Full node details (position, size, styles, children, variables) | `nodeId`, `depth?` |
| `get_selection` | Currently selected nodes | (none) |
| `get_page_nodes` | List all nodes with optional type filter | `pageId?`, `typeFilter?`, `depth?` |
| `search_nodes` | Search by name, type, or text content | `query`, `searchIn: "name" \| "type" \| "text"`, `pageId?` |
| `scroll_to_node` | Pan viewport to node | `nodeId`, `zoom?` |

### 4.2 Superpowers (18 tools)

These are AI-only capabilities that no designer has natively. Our primary differentiator.

| Tool | Description | Key Params |
|------|-------------|------------|
| `bulk_rename` | Rename multiple nodes with regex, prefix, sequential numbering | `nodeIds \| scope`, `pattern`, `replacement?`, `prefix?`, `sequential?` |
| `bulk_style` | Apply style changes across all matching nodes | `selector: { type?, name?, style? }`, `changes` |
| `design_lint` | Detect detached styles, inconsistent spacing, orphan components, naming violations | `scope: "file" \| "page" \| nodeId`, `rules?` |
| `accessibility_check` | WCAG contrast ratios, touch target sizes, text sizes, focus order | `scope`, `level: "A" \| "AA" \| "AAA"` |
| `localize_text` | Swap text nodes to locale mapping, detect hardcoded strings | `localeMap: Record<string, string>`, `scope?`, `detectHardcoded?` |
| `generate_layout` | Describe layout in natural language → auto-laid-out frames | `description`, `parentId?`, `width?`, `height?` |
| `design_system_scan` | Scan file for design system usage, violations, token coverage | `scope?` |
| `responsive_check` | Test layout at multiple breakpoints, report overflow/clipping | `nodeId`, `breakpoints: number[]` |
| `color_palette_extract` | Extract all colors, find near-duplicates, suggest consolidation | `scope?`, `threshold?` |
| `typography_audit` | List all font/size/weight combos, flag inconsistencies | `scope?` |
| `spacing_audit` | Analyze spacing patterns, flag irregular spacing | `scope?`, `baseUnit?` |
| `component_coverage` | % of file using components vs raw nodes, suggest componentization | `scope?` |
| `bulk_resize` | Resize multiple nodes with constraints and scale factors | `nodeIds`, `scaleX?`, `scaleY?`, `width?`, `height?` |
| `smart_align` | Auto-distribute, align, and space a selection (Tidy Up on steroids) | `nodeIds`, `direction?`, `spacing?`, `alignment?` |
| `export_tokens` | Export design tokens as JSON, CSS custom properties, or Tailwind config | `format: "json" \| "css" \| "tailwind"`, `collections?` |
| `import_tokens` | Import design tokens from JSON/CSS and apply to file | `tokens`, `format`, `collectionName?` |
| `annotation_generate` | Auto-generate dev handoff annotations (specs, redlines, measurements) | `nodeId`, `type: "specs" \| "redlines" \| "measurements"` |
| `duplicate_detector` | Find visually duplicate components/patterns in the file | `scope?`, `threshold?` |

## 5. Design System Integration

### 5.1 Auto-Scan on Connect

When the plugin connects, it scans the file and builds a Design System Context:

```typescript
interface DesignSystemContext {
  variables: {
    collections: VariableCollection[];
    colorTokens: Variable[];
    spacingTokens: Variable[];
    typographyTokens: Variable[];
  };
  styles: {
    textStyles: Style[];
    colorStyles: Style[];
    effectStyles: Style[];
    gridStyles: Style[];
  };
  components: {
    local: ComponentInfo[];
    external: LibraryInfo[];
  };
  conventions: {
    namingPattern: "BEM" | "atomic" | "flat" | "unknown";
    spacingScale: number[];
    colorPalette: ColorGroup[];
  };
}
```

### 5.2 How It Affects Tools

- **`create_node`** — auto-suggests spacing tokens instead of arbitrary pixel values
- **`set_fill`** — warns if color doesn't match any design token, suggests closest match
- **`create_instance`** — can reference components by name from linked libraries
- **`design_system_scan`** — returns report: "84% component coverage, 12 detached styles, 3 non-token colors"
- **Smart Router** — when Claude says "create a button," checks if a Button component exists in the design system and creates an instance instead of building from scratch

### 5.3 Design System-Aware Error Messages

Instead of: `"Error: invalid color"`
Return: `"Color #3B82F6 doesn't match any design token. Closest match: 'blue/500' (#3B82F6) in 'Brand Colors' collection. Use bind_variable to connect this node to the token."`

This enables Claude to self-correct and use the design system properly without human intervention.

### 5.4 Context Cache

- Design system context is scanned once on connect, cached in the plugin
- Push event `design_system_updated` fires when variables/styles change during the session
- Server can request a fresh scan at any time via `scan_design_system` command
- Context is included in responses when a tool's `contextRequest` flag is set

## 6. Communication Protocol

### 6.1 Messages

```typescript
// Client → Plugin (request)
interface Command {
  id: string;                          // UUID
  type: string;                        // executor name
  params: Record<string, unknown>;
  batch?: Command[];                   // For compound operations
  contextRequest?: boolean;            // Include design system context in response
}

// Plugin → Client (response)
interface CommandResponse {
  id: string;
  success: boolean;
  data?: unknown;
  error?: string;
  batchResults?: CommandResponse[];    // Results for compound operations
  context?: DesignSystemContext;       // If contextRequest was true
}

// Plugin → Client (push, not request/response)
interface PluginEvent {
  event: "selection_changed" | "page_changed" | "file_saved" | "design_system_updated";
  data: unknown;
}
```

### 6.2 Timeouts

| Operation | Timeout |
|-----------|---------|
| Standard command | 30s |
| Bulk operations | 120s |
| Export operations | 120s |
| Design system scan | 60s |
| Compound operation (per step) | 30s each |

### 6.3 Connection Lifecycle

1. Plugin opens WebSocket to `ws://localhost:3846`
2. Plugin sends handshake: `{ type: "handshake", fileInfo: { name, id, pages, nodeCount } }`
3. Server responds: `{ type: "handshake_ack", serverVersion }`
4. Server sends: `{ type: "scan_design_system" }`
5. Plugin scans and caches design system context, sends result
6. Normal command/response flow begins
7. Plugin sends push events as they occur
8. On disconnect: server buffers commands for 5s, then rejects with clear error
9. Plugin auto-reconnects every 2s

## 7. Testing Strategy

### Layer 1: Unit Tests (per tool)

- Every tool definition: validate required params, reject invalid types, test defaults
- Every executor: mock Figma Plugin API, verify correct API calls made
- Router: test command parsing, variable substitution (`$0`, `$1`), batch sequencing, rollback logic

### Layer 2: Integration Tests

- Mock WebSocket: send command, verify response shape and content
- End-to-end flow: MCP tool call → router → executor → response
- Design system context: verify scan, cache, injection, and refresh
- Error paths: timeout, disconnect during command, invalid node IDs, batch partial failure

### Layer 3: Manual Testing Checklist

- Test each tool against a real Figma file (desktop + browser)
- Compound operations: create full UI flows in one call
- Design system detection: test with files using variables, styles, libraries
- Edge cases: empty file, huge file (10K+ nodes), component-heavy file

### Layer 4: E2E Tests (Real Figma)

- Dedicated test Figma file with known structure (shipped with the repo as a .fig or documented setup)
- Automated test suite connects to running plugin, executes tools, reads back node state to verify
- Tests run against both Figma Desktop and Figma Browser
- Covers create → read → modify → delete lifecycle for every node type
- CI-compatible: `npm run test:e2e` (skippable with `--skip-e2e`)
- Requires a running Figma instance with the plugin installed

### Test Infrastructure

- **vitest** for unit + integration tests
- **Mock Figma API** — lightweight mock of `figma.*` globals for plugin-side unit tests
- **Mock WebSocket** — in-memory WebSocket pair for server-side integration tests
- **Test fixtures** — sample Figma node structures as JSON for consistent, repeatable tests

## 8. Security

### 8.1 Principles (Lessons from Framelink CVE-2025-53967)

1. **No `child_process.exec`** — never. Use `execFile` only if system calls are unavoidable (they shouldn't be)
2. **Input sanitization on every tool** — node IDs must match `^\d+:\d+$`, colors must match hex pattern, reject unexpected types
3. **No user-supplied strings in shell templates** — all string interpolation is parameterized
4. **WebSocket origin validation** — accept connections only from Figma plugin origins
5. **No secrets in error messages** — errors describe what failed, not system state or paths
6. **Rate limiting** — max 1000 nodes per bulk operation, max 100 commands per batch
7. **Content Security Policy** — plugin UI follows Figma CSP guidelines strictly

### 8.2 Dependency Hygiene

- Minimal production dependencies (3: `@modelcontextprotocol/sdk`, `ws`, `uuid`)
- Dependabot enabled for automated vulnerability scanning
- Lock file committed, exact versions in CI
- No additional runtime dependencies without security review

## 9. Open-Source DX Strategy

### 9.1 Documentation

- **README.md** — Hero section with demo GIF, one-liner install, quick start guide, architecture diagram, full tool reference table
- **Docs site** — Built with Starlight (Astro-based). Sections: Getting Started, Tool Reference (auto-generated from schemas), Architecture, Contributing, FAQ
- **In-tool docs** — every tool description is a self-contained mini-doc. Claude should never need external docs to use a tool correctly

### 9.2 CI/CD Pipeline

- **PR checks**: ESLint + TypeScript typecheck + unit tests + integration tests
- **Release automation**: semantic versioning, auto-generated changelog, npm publish on git tag, Figma plugin build artifact
- **Security**: Dependabot, input validation tests, no `child_process.exec` lint rule

### 9.3 Contributor Experience

- **CONTRIBUTING.md** — updated for new router architecture
- **Issue templates**: Bug report, Feature request, New tool proposal
- **PR template**: Checklist (tool def + executor + router registration + tests + docs)
- **"Good first issue" labels**: Pre-tagged issues for new contributors
- **Tool template generator**: `npm run create-tool <name>` scaffolds tool def + executor + test file automatically

### 9.4 Distribution

| Channel | Command/URL |
|---------|-------------|
| npm (global) | `npm install -g figma-mcp-write` |
| npx (no install) | `npx figma-mcp-write` |
| Claude Code | `claude mcp add figma -- npx figma-mcp-write` |
| Figma Community | Plugin listing with setup instructions |
| Docker | `docker run figma-mcp-write` (for CI/headless use) |

### 9.5 Branding

- **Name**: figma-mcp-write
- **Tagline**: "Give AI full control over Figma. The first open-source read/write Figma MCP."
- **Logo/icon**: For Figma Community listing and README
- **Demo video**: Screen recording of Claude Code creating a full UI in Figma from natural language

## 10. Phasing

### Phase 1: Foundation + Router
**Deliverables:** Architecture proven, 0 tools usable
- WebSocket server + connection manager
- MCP server with stdio transport
- Smart router (meta-tool + 11 category tools + status tool)
- Plugin skeleton (WebSocket client + command routing)
- Plugin UI (status panel: connected/disconnected, server URL, file info)
- Shared protocol types (Command, CommandResponse, PluginEvent, DesignSystemContext)
- `figma_status` tool working end-to-end

### Phase 2: Read + Basic Write (18 tools)
**Milestone:** Claude can read a file and create/edit basic content
- Reading tools (5): get_node, get_selection, get_page_nodes, search_nodes, scroll_to_node
- Layer tools (8): create_node, create_text, delete_node, duplicate_node, move_node, resize_node, rename_node, reorder_node
- Text tools (5): set_text_content, set_text_style, set_text_color, set_text_alignment, find_replace_text

### Phase 3: Styling + Layout (13 tools)
**Milestone:** Claude can create styled, laid-out designs
- Styling tools (8): set_fill, set_stroke, set_corner_radius, set_opacity, set_effects, set_blend_mode, set_constraints, apply_style
- Layout tools (5): set_auto_layout, add_to_auto_layout, set_layout_grid, group_nodes, ungroup_nodes

### Phase 4: Components + Structure (13 tools)
**Milestone:** Claude can work with design systems and multi-page files
- Component tools (6): create_component, create_component_set, create_instance, swap_instance, set_instance_override, detach_instance
- Page tools (4): create_page, switch_page, create_section, set_page_background
- Vector tools (3): boolean_operation, flatten_node, set_mask

### Phase 5: Export + Variables + Design System Context (8 tools + context)
**Milestone:** Claude can export assets and manage design tokens
- Export tools (4): export_node, set_export_settings, set_image_fill, get_node_css
- Variable tools (4): create_variable, set_variable_value, create_variable_collection, bind_variable
- Design system auto-scan + context injection implementation

### Phase 6: Superpowers (18 tools)
**Milestone:** Claude has capabilities no designer has natively
- Bulk operations (4): bulk_rename, bulk_style, bulk_resize, smart_align
- Design intelligence (6): design_lint, accessibility_check, design_system_scan, responsive_check, component_coverage, duplicate_detector
- Auditing (3): color_palette_extract, typography_audit, spacing_audit
- Design system bridge (2): export_tokens, import_tokens
- Content (2): localize_text, annotation_generate
- Generative (1): generate_layout

### Phase 7: Polish + Open Source Launch
**Milestone:** Public launch
- README.md with demo GIF, install instructions, full tool reference
- Docs site (Starlight)
- CI/CD pipeline (lint, typecheck, test, release, npm publish)
- npm publish setup + Figma Community plugin publish
- E2E test suite against real Figma
- Updated CONTRIBUTING.md for new architecture
- Issue/PR templates
- Tool template generator (`npm run create-tool`)
- Demo video
- Launch on Product Hunt, Hacker News, Twitter/X

## 11. Project Structure (Updated)

```
figma-mcp-write/
├── src/server/
│   ├── index.ts              — Entry point (boots MCP + WebSocket)
│   ├── mcp.ts                — MCP server + 13 tool registrations
│   ├── websocket.ts          — WebSocket server + connection manager
│   ├── command-queue.ts      — UUID-keyed request/response pairing
│   ├── router.ts             — Smart router (meta-tool dispatch + compound ops)
│   ├── design-system.ts      — Design system context manager
│   ├── tools/                — 13 MCP tool definitions
│   │   ├── meta.ts           — figma (meta-tool)
│   │   ├── layers.ts         — figma_layers
│   │   ├── text.ts           — figma_text
│   │   ├── styling.ts        — figma_styling
│   │   ├── layout.ts         — figma_layout
│   │   ├── components.ts     — figma_components
│   │   ├── pages.ts          — figma_pages
│   │   ├── vectors.ts        — figma_vectors
│   │   ├── export.ts         — figma_export
│   │   ├── variables.ts      — figma_variables
│   │   ├── reading.ts        — figma_reading
│   │   ├── superpowers.ts    — figma_superpowers
│   │   └── status.ts         — figma_status
│   └── __tests__/            — Server-side tests
│
├── plugin/
│   ├── manifest.json         — Figma plugin manifest
│   ├── code.ts               — Plugin main: WebSocket client + command router
│   ├── ui.html               — Status panel UI
│   ├── executors/            — 68 command executors (mirrors tools 1:1)
│   │   ├── layers.ts
│   │   ├── text.ts
│   │   ├── styling.ts
│   │   ├── layout.ts
│   │   ├── components.ts
│   │   ├── pages.ts
│   │   ├── vectors.ts
│   │   ├── export.ts
│   │   ├── variables.ts
│   │   ├── reading.ts
│   │   └── superpowers.ts
│   ├── utils/
│   │   ├── color.ts          — Hex parsing, color conversions
│   │   ├── node.ts           — Node helpers (find, traverse, serialize)
│   │   ├── style.ts          — Style application helpers
│   │   └── design-system.ts  — Design system scanner
│   └── __tests__/            — Plugin-side tests (mocked Figma API)
│
├── shared/
│   └── protocol.ts           — Command, CommandResponse, PluginEvent, DesignSystemContext types
│
├── test/
│   ├── fixtures/             — Sample Figma node structures as JSON
│   ├── mocks/
│   │   ├── figma-api.ts      — Mock figma.* globals
│   │   └── websocket.ts      — Mock WebSocket pair
│   ├── integration/          — End-to-end integration tests
│   └── e2e/                  — Real Figma E2E tests
│
├── docs/
│   ├── plans/                — Design docs and implementation plans
│   └── site/                 — Starlight docs site source
│
├── scripts/
│   ├── build-plugin.js       — esbuild plugin bundler
│   └── create-tool.ts        — Tool template generator
│
├── .github/
│   ├── workflows/
│   │   ├── ci.yml            — PR checks (lint, typecheck, test)
│   │   └── release.yml       — npm publish on tag
│   ├── ISSUE_TEMPLATE/
│   │   ├── bug_report.md
│   │   ├── feature_request.md
│   │   └── new_tool.md
│   └── pull_request_template.md
│
├── package.json
├── tsconfig.json             — Server TypeScript config
├── tsconfig.plugin.json      — Plugin TypeScript config
├── vitest.config.ts          — Test configuration
├── eslint.config.js          — ESLint flat config
├── .gitignore
├── LICENSE                   — MIT
├── README.md
├── CONTRIBUTING.md
└── CHANGELOG.md
```

## 12. Tech Stack

### Production Dependencies
| Package | Version | Purpose |
|---------|---------|---------|
| `@modelcontextprotocol/sdk` | ^1.12.0 | MCP server framework |
| `ws` | ^8.18.0 | WebSocket server |
| `uuid` | ^11.1.0 | Command ID generation |

### Dev Dependencies
| Package | Version | Purpose |
|---------|---------|---------|
| `typescript` | ^5.7.0 | Type safety (strict mode) |
| `esbuild` | ^0.24.0 | Plugin bundling |
| `tsx` | ^4.19.0 | Dev mode runner |
| `vitest` | ^2.1.0 | Testing framework |
| `eslint` | ^9.0.0 | Linting |
| `@figma/plugin-typings` | ^1.100.0 | Figma API types |
| `@types/node` | ^22.0.0 | Node.js types |
| `@types/ws` | ^8.5.0 | WebSocket types |
| `@types/uuid` | ^10.0.0 | UUID types |

### Build Targets
- Server: `tsc` → `dist/` (Node.js ESM)
- Plugin: `esbuild` → single `code.js` (browser, IIFE)
- Separate tsconfigs (server targets Node, plugin targets browser)

### Node Engine
- Minimum: Node.js 18.0.0

## 13. Competitive Positioning

| Feature | Us | Framelink (13K★) | Grab TalkToFigma (6.3K★) | figma-console-mcp (363★) | Official Figma MCP |
|---------|----|-------------------|---------------------------|---------------------------|-------------------|
| Read access | ✅ | ✅ | ✅ | ✅ | ✅ |
| Write access | ✅ (full) | ❌ | ✅ (partial) | ✅ (partial) | ❌ (screenshot only) |
| Tool count | 68 | 2 | ~30 | ~56 | 4-5 |
| MCP tool overhead | 13 tools | 2 tools | ~30 tools | ~56 tools | 4-5 tools |
| Compound operations | ✅ | ❌ | ❌ | ❌ | ❌ |
| Design system aware | ✅ | ❌ | ❌ | Partial | Partial |
| Accessibility audit | ✅ | ❌ | ❌ | ❌ | ❌ |
| Design linting | ✅ | ❌ | ❌ | ❌ | ❌ |
| Localization | ✅ | ❌ | ❌ | ❌ | ❌ |
| Bulk operations | ✅ | ❌ | Partial | Partial | ❌ |
| Token export/import | ✅ | ❌ | ❌ | Partial | ❌ |
| No API token needed | ✅ | ❌ (needs token) | ✅ | Mixed | ❌ (needs Dev Mode) |
| Open source | ✅ MIT | ✅ MIT | ✅ MIT | ✅ MIT | ❌ |

## 14. Coding Conventions

- Strict TypeScript, no `any` (use `unknown` for untyped params)
- Server tool files export a tool registration function
- Plugin executor files export functions matching command names
- All colors accept hex strings (`#FF0000`) — parsing happens in plugin
- Node IDs are always strings in Figma format (`1234:5678`)
- Error messages must be clear enough for Claude to self-correct
- No over-engineering — implement what's needed, not what might be needed
- Test every tool: param validation + executor behavior + integration flow

## 15. Hard Rules

1. Never push to remote without explicit user approval
2. Plugin must work in both Figma desktop and browser
3. Every tool must have a description clear enough for Claude to use without docs
4. Keep the protocol simple — one Command in, one CommandResponse out (with optional batching)
5. No API tokens required — the plugin runs inside the user's Figma session
6. No LLM calls inside the MCP server — the router is deterministic pattern matching
7. Minimal production dependencies — currently 3, keep it under 5
8. Security first — sanitize all inputs, no `child_process.exec`, no secrets in errors
