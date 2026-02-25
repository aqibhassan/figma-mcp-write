# figma-mcp-write v2 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the first open-source read/write Figma MCP with 68 tools, smart router architecture (13 MCP tools), design system intelligence, and best-in-class open-source DX.

**Architecture:** Single Node.js process serves both an MCP server (stdio) and a WebSocket server (ws://localhost:3846). 13 MCP tools (1 meta-tool + 11 category tools + 1 status tool) route to 68 internal executors. A Figma plugin connects via WebSocket, executes commands against the Figma Plugin API, and pushes events back.

**Tech Stack:** TypeScript (strict), @modelcontextprotocol/sdk, ws, uuid, esbuild, vitest, @figma/plugin-typings

**Design Doc:** `docs/plans/2026-02-25-figma-mcp-v2-design.md`

---

## Phase Overview

| Phase | Name | Tools | Detail File |
|-------|------|-------|-------------|
| 1 | Foundation + Router | 0 (architecture only) | `phase-1-foundation.md` |
| 2 | Read + Basic Write | 18 tools | `phase-2-read-write.md` |
| 3 | Styling + Layout | 13 tools | `phase-3-styling-layout.md` |
| 4 | Components + Structure | 13 tools | `phase-4-components-structure.md` |
| 5 | Export + Variables + Design System | 8 tools + context | `phase-5-export-variables.md` |
| 6 | Superpowers | 18 tools | `phase-6-superpowers.md` |
| 7 | Polish + Open Source Launch | 0 (DX only) | `phase-7-polish.md` |

## Prerequisites

Before starting any phase:

```bash
cd /Users/hassan/Desktop/project/figma-mcp-write
npm install
```

Dependencies are already in `package.json`. If `node_modules/` doesn't exist, install first.

## File Naming Conventions

- Server tools: `src/server/tools/<category>.ts`
- Plugin executors: `plugin/executors/<category>.ts`
- Server tests: `src/server/__tests__/<category>.test.ts`
- Plugin tests: `plugin/__tests__/<category>.test.ts`
- Integration tests: `test/integration/<name>.test.ts`
- Test fixtures: `test/fixtures/<name>.json`
- Test mocks: `test/mocks/<name>.ts`

## Commit Convention

```
feat: add <tool/feature> — new tool or feature
fix: handle <edge case> — bug fix
test: add <what> tests — test only
docs: <what> — documentation only
refactor: <what> — code improvement, no behavior change
chore: <what> — build, CI, config changes
```

## Execution Order

Phases MUST be executed in order (1 → 2 → 3 → 4 → 5 → 6 → 7). Within each phase, tasks must be executed in order unless explicitly marked as parallelizable.

## Phase Summaries

### Phase 1: Foundation + Router
Build the skeleton: WebSocket server, MCP server, smart router, plugin shell, shared types. At the end, `figma_status` tool works end-to-end.

### Phase 2: Read + Basic Write (18 tools)
Implement reading tools (5), layer tools (8), and text tools (5). At the end, Claude can read a Figma file and create/edit text and shapes.

### Phase 3: Styling + Layout (13 tools)
Implement styling tools (8) and layout tools (5). At the end, Claude can create styled, auto-laid-out designs.

### Phase 4: Components + Structure (13 tools)
Implement component tools (6), page tools (4), and vector tools (3). At the end, Claude can work with component libraries and multi-page files.

### Phase 5: Export + Variables + Design System Context (8 tools + context)
Implement export tools (4), variable tools (4), and the design system auto-scan/context injection system. At the end, Claude can export assets and manage design tokens.

### Phase 6: Superpowers (18 tools)
Implement all 18 AI-only superpower tools. At the end, Claude has capabilities no human designer has natively.

### Phase 7: Polish + Open Source Launch
README, docs site, CI/CD, npm publish, Figma Community publish, E2E tests, contributor tooling.

---

## Detailed Phase Plans

Each phase has its own detailed file in this directory. Open the relevant file for step-by-step implementation instructions with full code.
