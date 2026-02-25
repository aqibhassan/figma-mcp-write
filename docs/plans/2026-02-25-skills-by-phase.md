# Skills by Phase

31 skills installed in `.agents/skills/`. Each phase uses specific skills.

---

## Phase 1: Foundation (Server + Plugin Skeleton)

| Skill | Use for |
|-------|---------|
| `mcp-server-development` | MCP server architecture, stdio transport, tool registration |
| `nodejs-backend-patterns` | Node.js server patterns, process management, graceful shutdown |
| `nodejs-backend-typescript` | TypeScript + Node.js patterns, module system, build config |
| `mastering-typescript` | Strict types, generics for tool schemas, type-safe protocol |
| `typescript-skills` | TS project setup, tsconfig, path resolution |
| `javascript-typescript-typescript-scaffold` | Project scaffolding, config files, directory structure |
| `websocket-engineer` | WebSocket server setup, connection lifecycle, heartbeat |
| `websocket-realtime-builder` | Real-time bidirectional messaging, reconnect logic |
| `npm-library-setup` | package.json, bin entry, module exports, engine requirements |
| `esbuild-bundler` | Plugin bundling, Figma plugin build pipeline |
| `figma-plugin` | Figma Plugin API, manifest.json, plugin architecture |
| `error-handling-patterns` | Command timeouts, disconnect handling, error propagation |

---

## Phase 2: Core Tools (26 tools)

| Skill | Use for |
|-------|---------|
| `api-design-principles` | Tool schema design, parameter naming, consistency |
| `api-contract-testing` | Tool input/output contracts, schema validation tests |
| `figma` | Figma API knowledge, node types, property names |
| `figma-design` | Figma design patterns, frame/text/style properties |
| `interface-design` | UI/UX patterns for the tool interactions |
| `color-palette` | Color parsing, hex/rgba conversion, gradient building |
| `design-tokens` | Design token types, variable binding patterns |
| `mastering-typescript` | Typed tool handlers, generic executor patterns |
| `vitest-testing` | Unit test setup, mocking, test patterns |
| `vitest-testing-patterns` | Advanced test patterns, fixtures, async testing |

---

## Phase 3: Advanced Tools (22 tools)

| Skill | Use for |
|-------|---------|
| `design-system-patterns` | Component creation, variant sets, instance overrides |
| `figma` | Advanced Figma API: boolean ops, vectors, masks |
| `figma-design` | Component/variant architecture in Figma |
| `lit-and-figma` | Component-to-Figma patterns, Code Connect |
| `design-tokens` | Variable collections, mode binding, token architecture |
| `accessibility-a11y` | WCAG standards for the accessibility_check tool |
| `api-design-principles` | Consistent schema patterns across 22 new tools |
| `error-handling-patterns` | Edge cases in component/vector operations |

---

## Phase 4: Superpowers (6 tools)

| Skill | Use for |
|-------|---------|
| `accessibility-a11y` | WCAG contrast ratios, touch targets, text size rules |
| `color-palette` | Color contrast calculation, palette analysis |
| `design-system-patterns` | Design lint rules, style consistency checks |
| `interface-design` | Layout generation from descriptions |
| `figma-design` | Bulk operations on Figma node trees |
| `mastering-typescript` | Regex patterns for bulk_rename, tree traversal |

---

## Phase 5: Polish + Open Source

| Skill | Use for |
|-------|---------|
| `readme-generator` | README.md with install, demo, tool reference |
| `technical-writer` | Clear documentation, API reference |
| `quality-documentation-manager` | Doc structure, completeness checks |
| `npm-publish` | npm publish workflow, versioning, registry setup |
| `github-actions-expert` | CI workflow design, matrix builds, caching |
| `github-actions-pipeline-creator` | CI/CD pipeline for lint + test + publish |
| `code-quality` | Pre-publish code quality checks |
| `npm-library-setup` | Package distribution, bin setup, exports field |

---

## Full Skill Inventory (31 total)

| # | Skill | Category | Source |
|---|-------|----------|--------|
| 1 | `accessibility-a11y` | Design | mindrally/skills |
| 2 | `api-contract-testing` | Testing | aj-geddes/useful-ai-prompts |
| 3 | `api-design-principles` | Architecture | wshobson/agents |
| 4 | `code-quality` | Quality | tursodatabase/turso |
| 5 | `color-palette` | Design | jezweb/claude-skills |
| 6 | `design-system-patterns` | Design | wshobson/agents |
| 7 | `design-tokens` | Design | dylanfeltus/skills |
| 8 | `error-handling-patterns` | Architecture | wshobson/agents |
| 9 | `esbuild-bundler` | Build | mindrally/skills |
| 10 | `figma` | Figma | hoodini/ai-agents-skills |
| 11 | `figma-design` | Figma | manutej/luxor-claude-marketplace |
| 12 | `figma-plugin` | Figma | srstomp/pokayokay |
| 13 | `github-actions-expert` | CI/CD | cin12211/orca-q |
| 14 | `github-actions-pipeline-creator` | CI/CD | patricio0312rev/skills |
| 15 | `interface-design` | Design | dammyjay93/interface-design |
| 16 | `javascript-typescript-typescript-scaffold` | Setup | sickn33/antigravity-awesome-skills |
| 17 | `lit-and-figma` | Figma | rodydavis/skills |
| 18 | `mastering-typescript` | TypeScript | spillwavesolutions/mastering-typescript-skill |
| 19 | `mcp-server-development` | MCP | akiojin/llmlb |
| 20 | `nodejs-backend-patterns` | Backend | wshobson/agents |
| 21 | `nodejs-backend-typescript` | Backend | bobmatnyc/claude-mpm-skills |
| 22 | `npm-library-setup` | Publish | huozhi/npm-skills |
| 23 | `npm-publish` | Publish | b-open-io/prompts |
| 24 | `quality-documentation-manager` | Docs | davila7/claude-code-templates |
| 25 | `readme-generator` | Docs | dmccreary/claude-skills |
| 26 | `technical-writer` | Docs | onewave-ai/claude-skills |
| 27 | `typescript-skills` | TypeScript | llama-farm/llamafarm |
| 28 | `vitest-testing` | Testing | existential-birds/beagle |
| 29 | `vitest-testing-patterns` | Testing | erichowens/some_claude_skills |
| 30 | `websocket-engineer` | WebSocket | jeffallan/claude-skills |
| 31 | `websocket-realtime-builder` | WebSocket | patricio0312rev/skills |

---

## Skill usage by category

| Category | Count | Skills |
|----------|-------|--------|
| Figma | 4 | figma, figma-design, figma-plugin, lit-and-figma |
| TypeScript | 3 | mastering-typescript, typescript-skills, js-ts-scaffold |
| Backend/Server | 3 | nodejs-backend-patterns, nodejs-backend-typescript, mcp-server-development |
| WebSocket | 2 | websocket-engineer, websocket-realtime-builder |
| Architecture | 3 | api-design-principles, error-handling-patterns, api-contract-testing |
| Design | 5 | design-system-patterns, design-tokens, color-palette, interface-design, accessibility-a11y |
| Testing | 2 | vitest-testing, vitest-testing-patterns |
| Build | 1 | esbuild-bundler |
| Docs | 3 | technical-writer, readme-generator, quality-documentation-manager |
| Publish | 2 | npm-library-setup, npm-publish |
| CI/CD | 2 | github-actions-expert, github-actions-pipeline-creator |
| Quality | 1 | code-quality |
