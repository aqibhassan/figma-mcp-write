#!/usr/bin/env node

import { WebSocketManager } from "./websocket.js";
import { FigmaMcpServer } from "./mcp.js";
import { FigmaApiClient } from "./figma-api.js";
import { RestReadAdapter } from "./rest-adapter.js";
import { resolveToken } from "./config.js";
import { DEFAULT_PORT } from "../../shared/protocol.js";

async function main(): Promise<void> {
  // Handle setup subcommand
  if (process.argv[2] === "setup") {
    const { runSetup } = await import("./setup.js");
    await runSetup();
    return;
  }

  const port = parseInt(process.env.FIGMA_MCP_PORT ?? "", 10) || DEFAULT_PORT;

  // Resolve token: --token=xxx > FIGMA_API_TOKEN env > config file
  const cliToken = process.argv.find((a) => a.startsWith("--token="))?.split("=")[1];
  const token = resolveToken({ cliToken, envToken: process.env.FIGMA_API_TOKEN });

  // Create REST API client if token available
  let restAdapter: RestReadAdapter | undefined;
  if (token) {
    const apiClient = new FigmaApiClient(token);
    restAdapter = new RestReadAdapter(apiClient);
    console.error(`[figma-mcp-write] REST API enabled (reads work without plugin)`);
  } else {
    console.error(`[figma-mcp-write] No API token — reads require plugin. Run 'npx figma-mcp-write setup' to configure.`);
  }

  // Boot WebSocket server
  const wsManager = new WebSocketManager();
  await wsManager.start(port);
  console.error(`[figma-mcp-write] WebSocket server listening on ws://localhost:${port}`);

  // Boot MCP server (stdio)
  const mcpServer = new FigmaMcpServer(wsManager, undefined, restAdapter);
  await mcpServer.start();
  console.error(`[figma-mcp-write] MCP server started (stdio transport)`);

  // When plugin connects, set its file key on the REST adapter
  wsManager.onConnect(() => {
    const info = wsManager.fileInfo;
    console.error(`[figma-mcp-write] Plugin connected: "${info?.name}" (${info?.nodeCount} nodes)`);
    // Auto-set file key from plugin handshake for REST adapter too
    if (restAdapter && info?.id) {
      restAdapter.setFileKey(info.id);
    }
  });

  wsManager.onDisconnect(() => {
    console.error(`[figma-mcp-write] Plugin disconnected — falling back to REST API for reads`);
  });

  // Graceful shutdown
  const shutdown = async () => {
    console.error(`[figma-mcp-write] Shutting down...`);
    await wsManager.close();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error) => {
  console.error(`[figma-mcp-write] Fatal error:`, error);
  process.exit(1);
});
