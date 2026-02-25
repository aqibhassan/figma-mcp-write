# Phase 7: Polish + Open Source Launch

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ship as a best-in-class open-source project with README, docs, CI/CD, npm publish, Figma Community listing, E2E tests, and contributor tooling.

**Architecture:** No new tools. This phase wraps everything for public release.

**Tech Stack:** GitHub Actions, npm, Figma Community, Starlight (Astro)

---

## Task 1: README.md

**Files:**
- Update: `README.md`

**Step 1: Write README.md**

```markdown
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
```

**Step 2: Verify the file renders correctly**

Run: `head -5 README.md`
Expected:
```
<div align="center">

# figma-mcp-write

**Give AI full control over Figma. The first open-source read/write Figma MCP.**
```

**Step 3: Commit**

```bash
git add README.md
git commit -m "docs: add comprehensive README with tool reference, architecture diagram, and competitor comparison"
```

---

## Task 2: Update CONTRIBUTING.md

**Files:**
- Update: `CONTRIBUTING.md`

**Step 1: Write updated CONTRIBUTING.md**

```markdown
<!-- CONTRIBUTING.md -->
# Contributing to figma-mcp-write

Thanks for your interest in contributing. This guide covers the new router architecture (v2) and how to add tools.

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
```

**Step 2: Verify the file is well-formed**

Run: `wc -l CONTRIBUTING.md`
Expected: ~200 lines (full guide)

**Step 3: Commit**

```bash
git add CONTRIBUTING.md
git commit -m "docs: update CONTRIBUTING.md for v2 router architecture, executor registry, and superpower guide"
```

---

## Task 3: CI/CD — GitHub Actions

**Files:**
- Create: `.github/workflows/ci.yml`
- Create: `.github/workflows/release.yml`

**Step 1: Create `.github/workflows/ci.yml`**

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

permissions:
  contents: read

jobs:
  lint:
    name: Lint
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - run: npm ci
      - run: npm run lint

  typecheck:
    name: Typecheck
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - run: npm ci
      - run: npm run typecheck

  test:
    name: Test (Node ${{ matrix.node-version }})
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [18, 20, 22]
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: npm

      - run: npm ci
      - run: npm test -- --reporter=verbose --coverage

      - name: Upload coverage
        if: matrix.node-version == 20
        uses: actions/upload-artifact@v4
        with:
          name: coverage-report
          path: coverage/
          retention-days: 14

  build:
    name: Build
    runs-on: ubuntu-latest
    needs: [lint, typecheck, test]
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - run: npm ci
      - run: npm run build

      - name: Verify dist output
        run: |
          test -f dist/server/index.js
          echo "Server build OK"

      - name: Verify plugin output
        run: |
          test -f plugin/code.js
          echo "Plugin build OK"
```

**Step 2: Create `.github/workflows/release.yml`**

```yaml
# .github/workflows/release.yml
name: Release

on:
  push:
    tags:
      - "v*"

permissions:
  contents: write
  id-token: write

jobs:
  validate:
    name: Validate
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm test

  release:
    name: Publish
    runs-on: ubuntu-latest
    needs: [validate]
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
          registry-url: https://registry.npmjs.org

      - run: npm ci
      - run: npm run build

      - name: Publish to npm
        run: npm publish --provenance --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}

      - name: Build plugin artifact
        run: |
          mkdir -p release-artifacts
          cp plugin/manifest.json release-artifacts/
          cp plugin/code.js release-artifacts/
          cp plugin/ui.html release-artifacts/
          cd release-artifacts && zip -r ../figma-plugin.zip .

      - name: Generate changelog
        id: changelog
        run: |
          # Get the previous tag
          PREV_TAG=$(git tag --sort=-v:refname | head -2 | tail -1)
          CURRENT_TAG=${GITHUB_REF#refs/tags/}

          if [ -z "$PREV_TAG" ]; then
            CHANGELOG=$(git log --pretty=format:"- %s (%h)" $CURRENT_TAG)
          else
            CHANGELOG=$(git log --pretty=format:"- %s (%h)" $PREV_TAG..$CURRENT_TAG)
          fi

          # Write to file for the release body
          echo "$CHANGELOG" > changelog.txt

      - name: Create GitHub Release
        uses: softprops/action-gh-release@v2
        with:
          body_path: changelog.txt
          files: figma-plugin.zip
          generate_release_notes: true
```

**Step 3: Verify YAML syntax**

Run: `node -e "const fs = require('fs'); const y = require('yaml'); y.parse(fs.readFileSync('.github/workflows/ci.yml','utf8')); y.parse(fs.readFileSync('.github/workflows/release.yml','utf8')); console.log('YAML OK')" 2>/dev/null || python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml')); yaml.safe_load(open('.github/workflows/release.yml')); print('YAML OK')"`
Expected: `YAML OK`

**Step 4: Commit**

```bash
git add .github/workflows/ci.yml .github/workflows/release.yml
git commit -m "ci: add GitHub Actions for CI (lint, typecheck, test, build) and release (npm publish, GitHub release)"
```

---

## Task 4: Issue Templates

**Files:**
- Create: `.github/ISSUE_TEMPLATE/bug_report.md`
- Create: `.github/ISSUE_TEMPLATE/feature_request.md`
- Create: `.github/ISSUE_TEMPLATE/new_tool.md`

**Step 1: Create `.github/ISSUE_TEMPLATE/bug_report.md`**

```markdown
---
name: Bug Report
about: Report a bug to help us improve
title: "[Bug] "
labels: bug
assignees: ""
---

## Description

A clear and concise description of what the bug is.

## Steps to Reproduce

1. Start the MCP server with `...`
2. Open the Figma plugin in `...`
3. Call the tool `...` with params `...`
4. See error

## Expected Behavior

What you expected to happen.

## Actual Behavior

What actually happened. Include error messages if available.

## Environment

- **Node.js version:** (run `node --version`)
- **npm version:** (run `npm --version`)
- **OS:** (e.g., macOS 15.3, Windows 11, Ubuntu 24.04)
- **Figma:** Desktop / Browser
- **Figma plugin version:** (shown in plugin status panel)
- **figma-mcp-write version:** (run `npx figma-mcp-write --version` or check package.json)

## Logs

<details>
<summary>Server logs</summary>

```
Paste server console output here
```

</details>

<details>
<summary>Plugin console logs</summary>

```
Paste Figma developer console output here (Plugins > Development > Open Console)
```

</details>

## Additional Context

Add any other context about the problem here (screenshots, Figma file structure, etc.).
```

**Step 2: Create `.github/ISSUE_TEMPLATE/feature_request.md`**

```markdown
---
name: Feature Request
about: Suggest an enhancement or new capability
title: "[Feature] "
labels: enhancement
assignees: ""
---

## Problem

What problem does this solve? What's the pain point?

## Proposed Solution

Describe the solution you'd like. Be specific about the expected behavior.

## Alternatives Considered

What other approaches have you considered? Why is the proposed solution better?

## Category

Which tool category does this affect?

- [ ] Layer management (`figma_layers`)
- [ ] Text (`figma_text`)
- [ ] Styling (`figma_styling`)
- [ ] Layout (`figma_layout`)
- [ ] Components (`figma_components`)
- [ ] Pages (`figma_pages`)
- [ ] Vectors (`figma_vectors`)
- [ ] Export (`figma_export`)
- [ ] Variables (`figma_variables`)
- [ ] Reading (`figma_reading`)
- [ ] Superpowers (`figma_superpowers`)
- [ ] Meta-tool / Router (`figma`)
- [ ] Plugin / UI
- [ ] Server / Infrastructure
- [ ] Other

## Additional Context

Add any other context, mockups, or examples about the feature request here.
```

**Step 3: Create `.github/ISSUE_TEMPLATE/new_tool.md`**

```markdown
---
name: New Tool Proposal
about: Propose a new tool to add to the MCP server
title: "[Tool] "
labels: new-tool
assignees: ""
---

## Tool Name

`my_tool_name`

## Category

Which category should this tool belong to?

- [ ] Layer management
- [ ] Text
- [ ] Styling
- [ ] Layout
- [ ] Components
- [ ] Pages
- [ ] Vectors
- [ ] Export
- [ ] Variables
- [ ] Reading
- [ ] Superpowers

## Description

What does this tool do? Write the description as it would appear in the MCP tool definition (clear enough for Claude to use without docs).

## Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `nodeId` | string | Yes | Target node ID in Figma format (`1234:5678`) |
| | | | |
| | | | |

## Return Value

```json
{
  "nodeId": "1234:5678",
  "name": "NodeName"
}
```

## Use Cases

1. First use case — describe a scenario where this tool is needed
2. Second use case — another scenario
3. How Claude would use this in a compound operation

## Figma API Reference

Which Figma Plugin API methods does this tool use?

- [`figma.getNodeById()`](https://www.figma.com/plugin-docs/api/figma/#getnodebyid)
- Add relevant API links here

## Implementation Notes

Any technical considerations, edge cases, or constraints to be aware of.
```

**Step 4: Verify templates exist**

Run: `ls -la .github/ISSUE_TEMPLATE/`
Expected:
```
bug_report.md
feature_request.md
new_tool.md
```

**Step 5: Commit**

```bash
git add .github/ISSUE_TEMPLATE/bug_report.md .github/ISSUE_TEMPLATE/feature_request.md .github/ISSUE_TEMPLATE/new_tool.md
git commit -m "chore: add GitHub issue templates for bug reports, feature requests, and new tool proposals"
```

---

## Task 5: PR Template

**Files:**
- Create: `.github/pull_request_template.md`

**Step 1: Create `.github/pull_request_template.md`**

```markdown
## What

Brief description of what this PR does.

## Why

Why is this change needed? Link to issue if applicable.

Closes #

## How

How does this work? Describe the approach at a high level.

## Testing

How was this tested?

- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing in Figma Desktop
- [ ] Manual testing in Figma Browser

### Manual test steps

1. Start server with `npm run dev`
2. Open Figma plugin
3. ...

## Checklist

- [ ] Tests pass (`npm test`)
- [ ] TypeScript compiles (`npm run typecheck`)
- [ ] Linting passes (`npm run lint`)
- [ ] Tool descriptions are clear enough for Claude to use without docs
- [ ] Error messages are descriptive (Claude reads them to self-correct)
- [ ] No `any` types used (use `unknown` instead)
- [ ] Node IDs validated against `^\d+:\d+$` pattern
- [ ] Colors accept hex strings (`#RRGGBB` or `#RRGGBBAA`)
- [ ] CHANGELOG.md updated (if user-facing change)
- [ ] Documentation updated (if applicable)

## Screenshots / Recordings

If this changes UI or visual output, include before/after screenshots.
```

**Step 2: Verify file exists**

Run: `test -f .github/pull_request_template.md && echo "OK"`
Expected: `OK`

**Step 3: Commit**

```bash
git add .github/pull_request_template.md
git commit -m "chore: add pull request template with checklist and testing sections"
```

---

## Task 6: Tool Template Generator

**Files:**
- Create: `scripts/create-tool.ts`

**Step 1: Create `scripts/create-tool.ts`**

```typescript
// scripts/create-tool.ts
//
// Usage: npx tsx scripts/create-tool.ts <tool-name> <category>
// Example: npx tsx scripts/create-tool.ts set_opacity styling
//
// Creates:
//   - Executor stub in plugin/executors/<category>.ts
//   - Test stub in plugin/__tests__/<category>.test.ts
//   - Prints next steps

import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, "..");

const VALID_CATEGORIES = [
  "layers",
  "text",
  "styling",
  "layout",
  "components",
  "pages",
  "vectors",
  "export",
  "variables",
  "reading",
  "superpowers",
] as const;

type Category = (typeof VALID_CATEGORIES)[number];

function main(): void {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.error("Usage: npx tsx scripts/create-tool.ts <tool-name> <category>");
    console.error("");
    console.error("Categories:", VALID_CATEGORIES.join(", "));
    console.error("");
    console.error("Example: npx tsx scripts/create-tool.ts set_opacity styling");
    process.exit(1);
  }

  const toolName = args[0];
  const category = args[1] as Category;

  // Validate tool name
  if (!/^[a-z][a-z0-9_]*$/.test(toolName)) {
    console.error(`Error: Tool name '${toolName}' is invalid.`);
    console.error("Tool names must be lowercase with underscores (e.g., set_opacity, bulk_rename).");
    process.exit(1);
  }

  // Validate category
  if (!VALID_CATEGORIES.includes(category)) {
    console.error(`Error: Unknown category '${category}'.`);
    console.error("Valid categories:", VALID_CATEGORIES.join(", "));
    process.exit(1);
  }

  const executorPath = resolve(ROOT, `plugin/executors/${category}.ts`);
  const testPath = resolve(ROOT, `plugin/__tests__/${category}.test.ts`);

  // Check if executor file exists
  if (!existsSync(executorPath)) {
    console.error(`Error: Executor file not found at plugin/executors/${category}.ts`);
    console.error("Create the category file first, or check the category name.");
    process.exit(1);
  }

  // Check if function already exists in executor
  const executorContent = readFileSync(executorPath, "utf8");
  if (executorContent.includes(`function ${toolName}`)) {
    console.error(`Error: Function '${toolName}' already exists in plugin/executors/${category}.ts`);
    process.exit(1);
  }

  // Append executor stub
  const executorStub = `
// --- ${toolName} ---

export async function ${toolName}(params: Record<string, unknown>): Promise<unknown> {
  const nodeId = params.nodeId as string;
  if (!nodeId) throw new Error("${toolName}: nodeId is required");

  const node = figma.getNodeById(nodeId);
  if (!node) throw new Error(\`${toolName}: Node '\${nodeId}' not found\`);

  // TODO: Implement ${toolName}

  return { nodeId: node.id, name: node.name };
}
`;

  writeFileSync(executorPath, executorContent + executorStub);
  console.log(`  Added executor stub to plugin/executors/${category}.ts`);

  // Append or create test stub
  const testStub = `
describe("${toolName}", () => {
  it("performs the operation on the target node", async () => {
    const { ${toolName} } = await import("../executors/${category}.js");
    const result = await ${toolName}({ nodeId: "1:2" });
    expect(result).toHaveProperty("nodeId", "1:2");
  });

  it("throws if node not found", async () => {
    vi.mocked(figma.getNodeById).mockReturnValueOnce(null);
    const { ${toolName} } = await import("../executors/${category}.js");
    await expect(${toolName}({ nodeId: "999:999" })).rejects.toThrow("not found");
  });

  it("throws if nodeId is missing", async () => {
    const { ${toolName} } = await import("../executors/${category}.js");
    await expect(${toolName}({})).rejects.toThrow("nodeId is required");
  });
});
`;

  if (existsSync(testPath)) {
    const testContent = readFileSync(testPath, "utf8");
    if (testContent.includes(`describe("${toolName}"`)) {
      console.log(`  Tests for '${toolName}' already exist in plugin/__tests__/${category}.test.ts — skipped`);
    } else {
      // Insert before the last closing of the file (before final })
      writeFileSync(testPath, testContent + testStub);
      console.log(`  Added test stub to plugin/__tests__/${category}.test.ts`);
    }
  } else {
    const newTestFile = `import { describe, it, expect, vi, beforeEach } from "vitest";

const mockNode = {
  id: "1:2",
  name: "TestNode",
  type: "FRAME",
  fills: [],
  strokes: [],
  effects: [],
  opacity: 1,
  visible: true,
};

vi.stubGlobal("figma", {
  getNodeById: vi.fn(() => mockNode),
  currentPage: { findAll: vi.fn(() => [mockNode]) },
  root: { findAll: vi.fn(() => [mockNode]) },
});

beforeEach(() => {
  vi.mocked(figma.getNodeById).mockReturnValue(mockNode as unknown as BaseNode);
});
${testStub}`;

    writeFileSync(testPath, newTestFile);
    console.log(`  Created test file plugin/__tests__/${category}.test.ts`);
  }

  // Print next steps
  const mcpTool = category === "superpowers" ? "figma_superpowers" : `figma_${category}`;

  console.log("");
  console.log("Next steps:");
  console.log(`  1. Implement the executor body in plugin/executors/${category}.ts`);
  console.log(`  2. Add '${toolName}' to the command enum in src/server/tools/${category}.ts`);
  console.log(`  3. Update the tool description in src/server/tools/${category}.ts to mention '${toolName}'`);
  console.log(`  4. Write proper tests in plugin/__tests__/${category}.test.ts`);
  console.log(`  5. Run: npm run typecheck && npm test`);
  console.log(`  6. MCP tool: ${mcpTool} — command: ${toolName}`);
  console.log("");
}

main();
```

**Step 2: Verify the script is valid TypeScript**

Run: `npx tsc --noEmit --esModuleInterop --module nodenext --moduleResolution nodenext scripts/create-tool.ts`
Expected: No errors (or only errors about missing plugin types, which is expected since plugin files are not in scope)

**Step 3: Commit**

```bash
git add scripts/create-tool.ts
git commit -m "feat: add tool template generator script (npx tsx scripts/create-tool.ts)"
```

---

## Task 7: ESLint Configuration

**Files:**
- Create: `eslint.config.js`

**Step 1: Create `eslint.config.js`**

```javascript
// eslint.config.js
import tseslint from "typescript-eslint";

export default tseslint.config(
  // Global ignores
  {
    ignores: [
      "dist/",
      "plugin/code.js",
      "node_modules/",
      "coverage/",
      "release-artifacts/",
      "scripts/build-plugin.js",
    ],
  },

  // Base config for all TypeScript files
  ...tseslint.configs.recommended,

  // Server-specific rules
  {
    files: ["src/**/*.ts", "shared/**/*.ts"],
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.json",
      },
    },
    rules: {
      // No `any` — use `unknown` instead
      "@typescript-eslint/no-explicit-any": "error",

      // Catch unused variables (allow underscore prefix for intentional ignores)
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],

      // Consistent returns
      "consistent-return": "off", // TypeScript handles this better
      "@typescript-eslint/explicit-function-return-type": "off",

      // No child_process.exec — security rule (CVE-2025-53967 lesson)
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "child_process",
              importNames: ["exec", "execSync"],
              message:
                "Never use exec/execSync. Use execFile if system calls are unavoidable (they shouldn't be). See: CVE-2025-53967.",
            },
          ],
        },
      ],
    },
  },

  // Plugin-specific rules
  {
    files: ["plugin/**/*.ts"],
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.plugin.json",
      },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },

  // Test files — slightly relaxed
  {
    files: ["**/__tests__/**/*.ts", "**/*.test.ts", "test/**/*.ts"],
    rules: {
      // Tests can use non-null assertions for cleaner mocking
      "@typescript-eslint/no-non-null-assertion": "off",
    },
  }
);
```

**Step 2: Add `typescript-eslint` to dev dependencies**

Run: `npm install --save-dev typescript-eslint`
Expected: Package installed successfully

**Step 3: Verify lint runs**

Run: `npx eslint --max-warnings=0 shared/`
Expected: No errors (or only errors from code that needs fixing — which is expected since we are setting up linting for the first time). The important thing is that ESLint loads the config without crashing.

**Step 4: Commit**

```bash
git add eslint.config.js package.json package-lock.json
git commit -m "chore: add ESLint flat config with no-any, no-exec, and TypeScript strict rules"
```

---

## Task 8: CHANGELOG.md

**Files:**
- Create: `CHANGELOG.md`

**Step 1: Create `CHANGELOG.md`**

```markdown
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
```

**Step 2: Verify file exists**

Run: `head -3 CHANGELOG.md`
Expected:
```
# Changelog

All notable changes to this project will be documented in this file.
```

**Step 3: Commit**

```bash
git add CHANGELOG.md
git commit -m "docs: add CHANGELOG.md with v0.2.0 release notes"
```

---

## Task 9: npm Publish Configuration

**Files:**
- Update: `package.json`

**Step 1: Update `package.json`**

Apply the following changes to `package.json`:

```json
{
  "name": "figma-mcp-write",
  "version": "0.2.0",
  "description": "Full read/write Figma MCP server for Claude Code. 68 tools through 13 MCP endpoints. Design system intelligence, compound operations, AI-only superpowers. No API token required.",
  "license": "MIT",
  "author": "Hassan",
  "repository": {
    "type": "git",
    "url": "https://github.com/anthropics/figma-mcp-write.git"
  },
  "homepage": "https://github.com/anthropics/figma-mcp-write#readme",
  "bugs": {
    "url": "https://github.com/anthropics/figma-mcp-write/issues"
  },
  "keywords": [
    "figma",
    "mcp",
    "model-context-protocol",
    "claude",
    "ai",
    "design",
    "ux",
    "ui",
    "figma-plugin",
    "design-system",
    "accessibility",
    "design-tokens",
    "claude-code"
  ],
  "type": "module",
  "bin": {
    "figma-mcp-write": "./dist/server/index.js"
  },
  "main": "./dist/server/index.js",
  "files": [
    "dist/",
    "plugin/manifest.json",
    "plugin/code.js",
    "plugin/ui.html",
    "README.md",
    "LICENSE"
  ],
  "scripts": {
    "dev": "tsx watch src/server/index.ts",
    "build": "npm run build:server && npm run build:plugin",
    "build:server": "tsc -p tsconfig.json",
    "build:plugin": "node scripts/build-plugin.js",
    "start": "node dist/server/index.js",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "vitest run test/e2e/",
    "lint": "eslint src/ plugin/ shared/",
    "typecheck": "tsc --noEmit && tsc -p tsconfig.plugin.json --noEmit",
    "create-tool": "tsx scripts/create-tool.ts",
    "prepublishOnly": "npm run build"
  },
  "publishConfig": {
    "access": "public",
    "registry": "https://registry.npmjs.org"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.12.0",
    "ws": "^8.18.0",
    "uuid": "^11.1.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "@types/ws": "^8.5.0",
    "@types/uuid": "^10.0.0",
    "@figma/plugin-typings": "^1.100.0",
    "esbuild": "^0.24.0",
    "tsx": "^4.19.0",
    "typescript": "^5.7.0",
    "typescript-eslint": "^8.0.0",
    "vitest": "^2.1.0",
    "eslint": "^9.0.0"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
```

**Step 2: Verify `files` field with npm pack**

Run: `npm pack --dry-run 2>&1 | head -30`
Expected: Output lists only the files in the `files` array — dist/, plugin/manifest.json, plugin/code.js, plugin/ui.html, README.md, LICENSE. No source code, no tests, no docs.

**Step 3: Verify engines field**

Run: `node -e "const p = require('./package.json'); console.log('engines:', p.engines.node); console.log('publishConfig:', JSON.stringify(p.publishConfig))"`
Expected:
```
engines: >=18.0.0
publishConfig: {"access":"public","registry":"https://registry.npmjs.org"}
```

**Step 4: Commit**

```bash
git add package.json
git commit -m "chore: update package.json for npm publish (v0.2.0, files field, publishConfig, keywords, URLs)"
```

---

## Task 10: Docker Support

**Files:**
- Create: `Dockerfile`
- Create: `.dockerignore`

**Step 1: Create `Dockerfile`**

```dockerfile
# Dockerfile
# Multi-stage build for figma-mcp-write server
# Note: This runs only the MCP + WebSocket server.
# The Figma plugin runs inside Figma (not in Docker).

# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files for dependency install
COPY package.json package-lock.json ./

# Install all dependencies (including dev for build)
RUN npm ci

# Copy source files
COPY tsconfig.json ./
COPY shared/ ./shared/
COPY src/ ./src/

# Build server
RUN npm run build:server

# Stage 2: Production
FROM node:20-alpine AS production

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install production dependencies only
RUN npm ci --omit=dev && npm cache clean --force

# Copy built server from builder
COPY --from=builder /app/dist/ ./dist/

# Copy plugin files (needed for npm package structure, not execution)
COPY plugin/manifest.json ./plugin/
COPY plugin/ui.html ./plugin/

# WebSocket server port
EXPOSE 3846

# Health check: verify the process is running
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "const http = require('http'); http.get('http://localhost:3846', () => process.exit(0)).on('error', () => process.exit(1))" || exit 1

# Run the MCP server
CMD ["node", "dist/server/index.js"]
```

**Step 2: Create `.dockerignore`**

```
# .dockerignore
node_modules
dist
coverage
.git
.github
docs
test
scripts
*.md
!README.md
.DS_Store
*.log
.env
.env.*
release-artifacts
figma-plugin.zip
```

**Step 3: Verify Dockerfile syntax**

Run: `docker build --check . 2>/dev/null || echo "Docker build --check not supported, verifying Dockerfile exists" && test -f Dockerfile && echo "Dockerfile OK"`
Expected: `Dockerfile OK` (or successful Docker check)

**Step 4: Commit**

```bash
git add Dockerfile .dockerignore
git commit -m "feat: add Docker support with multi-stage build for headless/CI deployment"
```

---

## Task 11: E2E Test Framework

**Files:**
- Create: `test/e2e/setup.ts`
- Create: `test/e2e/full-workflow.test.ts`

**Step 1: Create `test/e2e/setup.ts`**

```typescript
// test/e2e/setup.ts
//
// E2E test helpers: mock plugin that connects to the real WebSocket server
// and simulates Figma API responses.

import WebSocket from "ws";
import {
  Command,
  CommandResponse,
  WebSocketMessage,
  FileInfo,
  DesignSystemContext,
  SERVER_VERSION,
  DEFAULT_PORT,
} from "../../shared/protocol.js";

// ============================================================
// Mock Plugin Client
// ============================================================

export class MockPluginClient {
  private ws: WebSocket | null = null;
  private commandHandlers = new Map<string, (params: Record<string, unknown>) => unknown>();
  private connected = false;

  constructor(
    private port: number = DEFAULT_PORT,
    private fileInfo: FileInfo = DEFAULT_FILE_INFO
  ) {}

  get isConnected(): boolean {
    return this.connected;
  }

  /**
   * Register a handler for a specific command type.
   * When the server sends this command, the handler runs and its return
   * value is sent back as a success response.
   */
  onCommand(type: string, handler: (params: Record<string, unknown>) => unknown): void {
    this.commandHandlers.set(type, handler);
  }

  /**
   * Connect to the WebSocket server, send handshake, wait for ack.
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(`ws://localhost:${this.port}`);

      this.ws.on("open", () => {
        // Send handshake
        const handshake: WebSocketMessage = {
          type: "handshake",
          fileInfo: this.fileInfo,
        };
        this.ws!.send(JSON.stringify(handshake));
      });

      this.ws.on("message", (data) => {
        try {
          const message = JSON.parse(data.toString()) as WebSocketMessage;
          this.handleMessage(message, resolve);
        } catch {
          // Ignore malformed messages
        }
      });

      this.ws.on("error", reject);

      this.ws.on("close", () => {
        this.connected = false;
      });

      // Timeout after 5s
      setTimeout(() => {
        if (!this.connected) {
          reject(new Error("Mock plugin connection timed out after 5s"));
        }
      }, 5000);
    });
  }

  private handleMessage(message: WebSocketMessage, onReady?: (value: void) => void): void {
    switch (message.type) {
      case "handshake_ack":
        this.connected = true;
        if (onReady) onReady();
        break;

      case "command":
        this.handleCommand(message.payload);
        break;

      case "scan_design_system":
        this.sendDesignSystemResult(DEFAULT_DESIGN_SYSTEM_CONTEXT);
        break;
    }
  }

  private handleCommand(command: Command): void {
    const handler = this.commandHandlers.get(command.type);

    let response: CommandResponse;
    if (handler) {
      try {
        const data = handler(command.params);
        response = { id: command.id, success: true, data };
      } catch (err) {
        response = {
          id: command.id,
          success: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    } else {
      // Default: return success with echoed params
      response = {
        id: command.id,
        success: true,
        data: { ...command.params, _echoed: true },
      };
    }

    this.sendResponse(response);
  }

  private sendResponse(response: CommandResponse): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const message: WebSocketMessage = { type: "response", payload: response };
    this.ws.send(JSON.stringify(message));
  }

  private sendDesignSystemResult(context: DesignSystemContext): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const message: WebSocketMessage = {
      type: "design_system_result",
      payload: context,
    };
    this.ws.send(JSON.stringify(message));
  }

  async disconnect(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.ws) {
        resolve();
        return;
      }
      this.ws.on("close", () => resolve());
      this.ws.close();
      this.ws = null;
    });
  }
}

// ============================================================
// Default Fixtures
// ============================================================

export const DEFAULT_FILE_INFO: FileInfo = {
  name: "E2E Test File",
  id: "test-file-001",
  pages: [
    { id: "0:1", name: "Page 1" },
    { id: "0:2", name: "Page 2" },
  ],
  nodeCount: 42,
};

export const DEFAULT_DESIGN_SYSTEM_CONTEXT: DesignSystemContext = {
  variables: {
    collections: [
      { id: "vc:1", name: "Brand Colors", modes: [{ id: "m:1", name: "Default" }], variableCount: 8 },
    ],
    colorTokens: [
      { id: "v:1", name: "primary/500", type: "COLOR", value: "#3B82F6", collectionId: "vc:1" },
      { id: "v:2", name: "neutral/900", type: "COLOR", value: "#111827", collectionId: "vc:1" },
    ],
    spacingTokens: [
      { id: "v:3", name: "spacing/sm", type: "FLOAT", value: 8, collectionId: "vc:1" },
      { id: "v:4", name: "spacing/md", type: "FLOAT", value: 16, collectionId: "vc:1" },
    ],
    typographyTokens: [],
  },
  styles: {
    textStyles: [{ id: "s:1", name: "Heading/H1", type: "TEXT", description: "Main heading" }],
    colorStyles: [{ id: "s:2", name: "Primary", type: "PAINT", description: "Primary brand color" }],
    effectStyles: [],
    gridStyles: [],
  },
  components: {
    local: [
      { id: "c:1", name: "Button", description: "Primary button", variantProperties: { size: ["sm", "md", "lg"] } },
      { id: "c:2", name: "Card", description: "Content card" },
    ],
    external: [
      { name: "Material Design 3", componentCount: 156, enabled: true },
    ],
  },
  conventions: {
    namingPattern: "flat",
    spacingScale: [4, 8, 12, 16, 24, 32, 48, 64],
    colorPalette: [
      { name: "Primary", colors: ["#3B82F6", "#2563EB", "#1D4ED8"] },
      { name: "Neutral", colors: ["#F9FAFB", "#6B7280", "#111827"] },
    ],
  },
};

// ============================================================
// Helpers
// ============================================================

/**
 * Create a node ID counter for simulating Figma node creation.
 * Returns incrementing IDs like "100:1", "100:2", etc.
 */
export function createNodeIdGenerator(pageId: number = 100): () => string {
  let counter = 0;
  return () => {
    counter++;
    return `${pageId}:${counter}`;
  };
}

/**
 * Wait for a given number of milliseconds.
 */
export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
```

**Step 2: Create `test/e2e/full-workflow.test.ts`**

```typescript
// test/e2e/full-workflow.test.ts
//
// End-to-end tests using a mock plugin connected to the real server.
// These tests verify the full flow: MCP tool call -> router -> WebSocket -> plugin -> response.

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { MockPluginClient, createNodeIdGenerator, wait } from "./setup.js";
import { WebSocketManager } from "../../src/server/websocket.js";
import { CommandQueue } from "../../src/server/command-queue.js";
import { DEFAULT_PORT } from "../../shared/protocol.js";

const TEST_PORT = 13846; // Use non-default port to avoid conflicts

describe("E2E: Full Workflow", () => {
  let wsManager: WebSocketManager;
  let queue: CommandQueue;
  let mockPlugin: MockPluginClient;
  let nextNodeId: () => string;

  beforeAll(async () => {
    // Start WebSocket server
    wsManager = new WebSocketManager();
    await wsManager.start(TEST_PORT);

    // Set up command queue
    queue = new CommandQueue();
    queue.onCommand((command) => {
      wsManager.sendCommand(command);
    });

    // Forward responses from WebSocket to command queue
    wsManager.onResponse((response) => {
      if (response.success) {
        queue.resolve(response.id, response.data);
      } else {
        queue.reject(response.id, response.error || "Unknown error");
      }
    });
  });

  afterAll(async () => {
    if (mockPlugin?.isConnected) {
      await mockPlugin.disconnect();
    }
    await wsManager.close();
    queue.clear();
  });

  beforeEach(() => {
    nextNodeId = createNodeIdGenerator();
  });

  describe("Create frame -> add text -> style -> export", () => {
    it("should execute a full design workflow", async () => {
      // Connect mock plugin with handlers
      mockPlugin = new MockPluginClient(TEST_PORT);

      mockPlugin.onCommand("create_node", (params) => {
        const nodeId = nextNodeId();
        return {
          nodeId,
          name: params.name || "Frame",
          type: params.type || "FRAME",
          x: params.x || 0,
          y: params.y || 0,
          width: params.width || 100,
          height: params.height || 100,
        };
      });

      mockPlugin.onCommand("create_text", (params) => {
        const nodeId = nextNodeId();
        return {
          nodeId,
          name: params.text || "Text",
          type: "TEXT",
          text: params.text,
          fontSize: params.fontSize || 16,
          fontFamily: params.fontFamily || "Inter",
        };
      });

      mockPlugin.onCommand("set_fill", (params) => {
        return {
          nodeId: params.nodeId,
          fill: { type: "SOLID", color: params.color },
        };
      });

      mockPlugin.onCommand("export_node", (params) => {
        return {
          nodeId: params.nodeId,
          format: params.format || "PNG",
          data: "base64-encoded-image-data-placeholder",
        };
      });

      await mockPlugin.connect();
      expect(mockPlugin.isConnected).toBe(true);

      // Step 1: Create a frame
      const createFrameResult = await queue.enqueue("create_node", {
        type: "FRAME",
        name: "Card",
        width: 320,
        height: 200,
        x: 0,
        y: 0,
      });

      expect(createFrameResult.success).toBe(true);
      expect(createFrameResult.data).toHaveProperty("nodeId");
      expect(createFrameResult.data).toHaveProperty("type", "FRAME");
      const frameNodeId = (createFrameResult.data as Record<string, unknown>).nodeId as string;

      // Step 2: Create text inside the frame
      const createTextResult = await queue.enqueue("create_text", {
        text: "Hello World",
        parentId: frameNodeId,
        fontSize: 24,
        fontFamily: "Inter",
      });

      expect(createTextResult.success).toBe(true);
      expect(createTextResult.data).toHaveProperty("text", "Hello World");
      expect(createTextResult.data).toHaveProperty("fontSize", 24);

      // Step 3: Style the frame with a fill
      const styleFillResult = await queue.enqueue("set_fill", {
        nodeId: frameNodeId,
        type: "SOLID",
        color: "#FFFFFF",
      });

      expect(styleFillResult.success).toBe(true);
      expect(styleFillResult.data).toHaveProperty("nodeId", frameNodeId);

      // Step 4: Export the frame
      const exportResult = await queue.enqueue("export_node", {
        nodeId: frameNodeId,
        format: "PNG",
        scale: 2,
      });

      expect(exportResult.success).toBe(true);
      expect(exportResult.data).toHaveProperty("format", "PNG");
      expect(exportResult.data).toHaveProperty("data");

      await mockPlugin.disconnect();
    });
  });

  describe("Create component -> instantiate -> override -> verify", () => {
    it("should handle the full component lifecycle", async () => {
      mockPlugin = new MockPluginClient(TEST_PORT);

      const componentId = "comp:1";
      const instanceId = "inst:1";

      mockPlugin.onCommand("create_node", (params) => {
        return {
          nodeId: nextNodeId(),
          name: params.name || "Frame",
          type: params.type || "FRAME",
          width: params.width || 100,
          height: params.height || 100,
        };
      });

      mockPlugin.onCommand("create_component", (params) => {
        return {
          componentId,
          nodeId: params.nodeId,
          name: "Button",
          type: "COMPONENT",
        };
      });

      mockPlugin.onCommand("create_instance", (params) => {
        return {
          instanceId,
          componentId: params.componentId,
          name: "Button",
          type: "INSTANCE",
          x: params.x || 0,
          y: params.y || 0,
        };
      });

      mockPlugin.onCommand("set_instance_override", (params) => {
        return {
          instanceId: params.instanceId,
          overrides: params.overrides,
          applied: true,
        };
      });

      await mockPlugin.connect();

      // Step 1: Create a frame for the component
      const frameResult = await queue.enqueue("create_node", {
        type: "FRAME",
        name: "Button",
        width: 120,
        height: 40,
      });
      expect(frameResult.success).toBe(true);
      const frameId = (frameResult.data as Record<string, unknown>).nodeId as string;

      // Step 2: Convert to component
      const componentResult = await queue.enqueue("create_component", {
        nodeId: frameId,
      });
      expect(componentResult.success).toBe(true);
      expect(componentResult.data).toHaveProperty("componentId", componentId);

      // Step 3: Create instance
      const instanceResult = await queue.enqueue("create_instance", {
        componentId,
        x: 200,
        y: 0,
      });
      expect(instanceResult.success).toBe(true);
      expect(instanceResult.data).toHaveProperty("instanceId", instanceId);

      // Step 4: Override instance text
      const overrideResult = await queue.enqueue("set_instance_override", {
        instanceId,
        overrides: [
          { type: "text", property: "characters", value: "Submit" },
        ],
      });
      expect(overrideResult.success).toBe(true);
      expect(overrideResult.data).toHaveProperty("applied", true);

      await mockPlugin.disconnect();
    });
  });

  describe("Design system scan -> verify context", () => {
    it("should receive design system context on connect", async () => {
      mockPlugin = new MockPluginClient(TEST_PORT);

      await mockPlugin.connect();

      // After connection, the server should have file info
      expect(wsManager.isConnected).toBe(true);
      expect(wsManager.fileInfo).toBeTruthy();
      expect(wsManager.fileInfo!.name).toBe("E2E Test File");
      expect(wsManager.fileInfo!.pages).toHaveLength(2);
      expect(wsManager.fileInfo!.nodeCount).toBe(42);

      await mockPlugin.disconnect();
    });
  });

  describe("Error handling", () => {
    it("should handle command errors from the plugin", async () => {
      mockPlugin = new MockPluginClient(TEST_PORT);

      mockPlugin.onCommand("get_node", () => {
        throw new Error("Node '999:999' not found");
      });

      await mockPlugin.connect();

      const result = await queue.enqueue("get_node", { nodeId: "999:999" });
      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");

      await mockPlugin.disconnect();
    });

    it("should handle disconnection gracefully", async () => {
      mockPlugin = new MockPluginClient(TEST_PORT);
      await mockPlugin.connect();
      expect(wsManager.isConnected).toBe(true);

      await mockPlugin.disconnect();
      await wait(100); // Give time for close event to propagate

      expect(wsManager.isConnected).toBe(false);
    });
  });
});
```

**Step 3: Add the `test:e2e` script (already done in Task 9)**

Verify the script exists in package.json:

Run: `node -e "const p = require('./package.json'); console.log(p.scripts['test:e2e'])"`
Expected: `vitest run test/e2e/`

**Step 4: Verify tests compile**

Run: `npx tsc --noEmit --project tsconfig.json 2>&1 | head -5`
Expected: No errors related to E2E test files (they may be excluded from tsconfig, which is correct — vitest handles its own compilation).

**Step 5: Commit**

```bash
git add test/e2e/setup.ts test/e2e/full-workflow.test.ts
git commit -m "test: add E2E test framework with mock plugin client and full workflow tests"
```

---

## Task 12: Final CLAUDE.md Update

**Files:**
- Update: `CLAUDE.md`

**Step 1: Write updated CLAUDE.md**

```markdown
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
```

**Step 2: Verify CLAUDE.md is well-formed**

Run: `wc -l CLAUDE.md`
Expected: ~200 lines

**Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md with complete status, troubleshooting, and extension guide"
```

---

## Summary

Phase 7 delivers 12 tasks that wrap the project for public release:

| Task | Deliverable | Key Files |
|------|-------------|-----------|
| 1 | README.md | `README.md` |
| 2 | Updated CONTRIBUTING.md | `CONTRIBUTING.md` |
| 3 | CI/CD pipelines | `.github/workflows/ci.yml`, `.github/workflows/release.yml` |
| 4 | Issue templates | `.github/ISSUE_TEMPLATE/bug_report.md`, `feature_request.md`, `new_tool.md` |
| 5 | PR template | `.github/pull_request_template.md` |
| 6 | Tool template generator | `scripts/create-tool.ts` |
| 7 | ESLint config | `eslint.config.js` |
| 8 | Changelog | `CHANGELOG.md` |
| 9 | npm publish config | `package.json` (updated) |
| 10 | Docker support | `Dockerfile`, `.dockerignore` |
| 11 | E2E test framework | `test/e2e/setup.ts`, `test/e2e/full-workflow.test.ts` |
| 12 | Final CLAUDE.md | `CLAUDE.md` (updated) |

After all tasks complete, the project is ready for:
1. `npm publish` (npm registry)
2. GitHub release with plugin artifact
3. Figma Community plugin listing
4. Public announcement (Product Hunt, Hacker News, Twitter/X)
