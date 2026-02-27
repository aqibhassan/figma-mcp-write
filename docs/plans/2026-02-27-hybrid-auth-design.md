# Hybrid REST API + Plugin Architecture Design

**Date:** 2026-02-27
**Status:** Approved
**Goal:** Make figma-mcp-write as simple as Notion MCP — one-time setup, connect once, works forever for reads. Plugin only needed for writes.

---

## User Experience

### Setup (one time, ~60 seconds)

```bash
npx figma-mcp-write setup
```

1. Opens browser to Figma PAT page (https://www.figma.com/settings)
2. User creates token with `file_content:read` scope, pastes it
3. Token validated via `GET /v1/me`, stored at `~/.figma-mcp-write/config.json`
4. Runs `claude mcp add figma -- npx figma-mcp-write` automatically
5. Prints Figma Community plugin link for write access (optional)

### Daily use

```
claude> Show me all frames in figma.com/design/abc123/MyFile
→ Works immediately via REST API (no plugin needed)

claude> Create a card with auto layout in my file
→ If plugin running: executes via Plugin API
→ If plugin not running: "To write, run the figma-mcp-write plugin in Figma."
```

### Alternative setup (manual)

```bash
# Environment variable
FIGMA_API_TOKEN=figd_xxx claude mcp add figma -- npx figma-mcp-write

# CLI argument
claude mcp add figma -- npx figma-mcp-write --token=figd_xxx
```

---

## Architecture

```
Claude Code (stdio)
    |
    v
MCP Server (13 tools)
    |
    v
Smart Router
    |-- Plugin connected? --> WebSocket --> Figma Plugin --> Plugin API (full R/W)
    |
    |-- Plugin NOT connected? --> Figma REST API (reads only)
    |                             GET /v1/files/:key
    |                             GET /v1/files/:key/nodes
    |                             GET /v1/images/:key
    |
    |-- Write without plugin? --> Helpful error message
```

### Priority: Plugin > REST API

When the plugin IS connected, ALL commands (reads + writes) go through the plugin. It's faster (real-time, no HTTP round-trip) and has full capability.

When the plugin is NOT connected, reads fall back to REST API. Writes return a clear error with instructions to install/run the plugin.

---

## Token Management

### Storage

```
~/.figma-mcp-write/config.json
{
  "token": "figd_xxxxxxxxxxxxxxxxxxxxxxxx",
  "userName": "Hassan",
  "createdAt": "2026-02-27T12:00:00Z"
}
```

File permissions: 0600 (owner read/write only).

### Token resolution order

1. `--token=xxx` CLI argument (highest priority)
2. `FIGMA_API_TOKEN` environment variable
3. `~/.figma-mcp-write/config.json` file
4. No token → reads require plugin, setup prompted

---

## File Targeting

REST API needs a file key. Two ways to specify:

### 1. Figma URL in tool params

```
figma_reading({ command: 'get_page_nodes', params: { fileUrl: 'https://www.figma.com/design/abc123/MyFile' } })
```

Server extracts file key `abc123` from the URL.

### 2. Auto-detect from plugin

When plugin is connected, it sends `fileInfo` in the handshake (includes file key). Server caches this as the "current file" for REST API calls too.

### 3. Set file explicitly

```
figma_status({ fileUrl: 'https://www.figma.com/design/abc123/MyFile' })
```

Sets the active file for subsequent REST API calls.

---

## REST API Client

### Endpoints used

| Operation | Endpoint | Notes |
|-----------|----------|-------|
| Verify token | `GET /v1/me` | Returns user info |
| Get file | `GET /v1/files/:key` | Full document tree |
| Get nodes | `GET /v1/files/:key/nodes?ids=X` | Specific nodes by ID |
| Get images | `GET /v1/images/:key?ids=X&format=png` | Export node as image |
| Get styles | `GET /v1/files/:key/styles` | All styles in file |
| Get components | `GET /v1/files/:key/components` | All components |

### Response mapping

REST API responses are transformed to match the existing CommandResponse format so the MCP tools return identical shapes regardless of source (REST API vs Plugin).

---

## Smart Router Changes

### Command classification

```typescript
const READ_COMMANDS = [
  'get_node', 'get_page_nodes', 'search_nodes',
  'get_node_css', 'export_node',
  // Superpowers that only read:
  'design_lint', 'accessibility_check', 'color_palette_extract',
  'typography_audit', 'spacing_audit', 'component_coverage',
  'duplicate_detector', 'design_system_scan', 'responsive_check',
  'export_tokens',
];

const PLUGIN_ONLY_COMMANDS = [
  'get_selection', 'scroll_to_node',  // Require live Figma session
];

// Everything else is a WRITE command
```

### Routing logic

```
routeCommand(command, params):
  if plugin.isConnected:
    return plugin.execute(command, params)   // Always prefer plugin

  if command in READ_COMMANDS:
    return restApi.execute(command, params)   // Fallback to REST API

  if command in PLUGIN_ONLY_COMMANDS:
    return error("This command requires the Figma plugin to be running.")

  // Write command without plugin
  return error(
    "Write operations require the Figma plugin. " +
    "Install it from the Figma Community: [link]. " +
    "Then run it in your Figma file (Plugins menu)."
  )
```

---

## Setup CLI

### `npx figma-mcp-write setup`

```typescript
// src/server/setup.ts

async function setup():
  print banner

  // Step 1: Token
  openBrowser('https://www.figma.com/settings')
  token = prompt('Paste your Figma Personal Access Token:')
  user = await fetch('https://api.figma.com/v1/me', { headers: { 'X-Figma-Token': token } })
  if !user.ok: error('Invalid token')
  saveConfig({ token, userName: user.handle, createdAt: new Date() })

  // Step 2: Claude Code
  exec('claude mcp add figma -- npx figma-mcp-write')

  // Step 3: Plugin
  print('For write access, install the plugin:')
  print('https://www.figma.com/community/plugin/xxxxx')

  print('Done! Open Claude Code and start designing.')
```

### `npx figma-mcp-write` (normal mode)

Starts the MCP server (stdio transport + WebSocket). Loads token from config/env/CLI.

---

## New Files

| File | Purpose |
|------|---------|
| `src/server/figma-api.ts` | REST API client — fetch wrapper, response mapping |
| `src/server/config.ts` | Token storage/loading, config file management |
| `src/server/setup.ts` | Interactive setup CLI |

## Modified Files

| File | Changes |
|------|---------|
| `src/server/index.ts` | Handle `setup` subcommand, load config on boot |
| `src/server/router.ts` | Smart routing: classify commands, REST API fallback |
| `src/server/mcp.ts` | File URL parsing, pass REST API client to router |
| `src/server/tools/status.ts` | Show REST API mode vs plugin mode, file URL |
| `package.json` | Bump version, add `readline` for setup prompts |

## Unchanged

| Component | Why |
|-----------|-----|
| `plugin/` | Plugin code stays exactly the same |
| `shared/protocol.ts` | Protocol unchanged |
| `src/server/websocket.ts` | WebSocket unchanged |
| `src/server/command-queue.ts` | Queue unchanged |

---

## Dependencies

**Zero new production dependencies.** Node.js built-in `fetch` (Node 18+) and `readline` for setup prompts.

---

## Error Messages

### No token, no plugin
```
No Figma connection available.
Run 'npx figma-mcp-write setup' to configure your Figma token (for reads).
For write access, install the plugin from Figma Community.
```

### Token but no plugin, write attempted
```
Write operations require the Figma plugin.
Install it once: https://www.figma.com/community/plugin/xxxxx
Then run it in your Figma file (Plugins > figma-mcp-write).
Reads are working via REST API.
```

### Token but no plugin, read works
```
(silently works — no message needed)
```

### Token invalid
```
Figma API token is invalid or expired.
Run 'npx figma-mcp-write setup' to update your token.
```

---

## Testing Plan

1. Unit tests: REST API client with mocked fetch
2. Unit tests: Config load/save/resolution order
3. Unit tests: Router command classification + fallback logic
4. Integration tests: REST API mode (mock HTTP) → verify response shapes match plugin shapes
5. E2E test: Full setup flow simulation
6. Manual test: Real Figma file via REST API
