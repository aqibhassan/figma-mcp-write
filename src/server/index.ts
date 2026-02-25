#!/usr/bin/env node

import { WebSocketManager } from "./websocket.js";
import { FigmaMcpServer } from "./mcp.js";
import { DEFAULT_PORT } from "../../shared/protocol.js";

async function main(): Promise<void> {
  const port = parseInt(process.env.FIGMA_MCP_PORT ?? "", 10) || DEFAULT_PORT;

  // Boot WebSocket server
  const wsManager = new WebSocketManager();
  await wsManager.start(port);
  console.error(`[figma-mcp-write] WebSocket server listening on ws://localhost:${port}`);

  // Boot MCP server (stdio)
  const mcpServer = new FigmaMcpServer(wsManager);
  await mcpServer.start();
  console.error(`[figma-mcp-write] MCP server started (stdio transport)`);

  // Log plugin connection events
  wsManager.onConnect(() => {
    const info = wsManager.fileInfo;
    console.error(`[figma-mcp-write] Plugin connected: "${info?.name}" (${info?.nodeCount} nodes)`);
  });

  wsManager.onDisconnect(() => {
    console.error(`[figma-mcp-write] Plugin disconnected`);
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
