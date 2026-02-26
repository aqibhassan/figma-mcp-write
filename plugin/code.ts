// plugin/code.ts

// ============================================================
// Types (duplicated from shared/protocol.ts for browser context)
// ============================================================

interface Command {
  id: string;
  type: string;
  params: Record<string, unknown>;
  batch?: Command[];
  contextRequest?: boolean;
}

interface CommandResponse {
  id: string;
  success: boolean;
  data?: unknown;
  error?: string;
  batchResults?: CommandResponse[];
  context?: unknown;
}

type WebSocketMessage =
  | { type: "command"; payload: Command }
  | { type: "handshake_ack"; serverVersion: string }
  | { type: "scan_design_system" };

// ============================================================
// Constants
// ============================================================

const RECONNECT_INTERVAL = 2000;
const DEFAULT_URL = "ws://localhost:3846";

// ============================================================
// State
// ============================================================

let ws: WebSocket | null = null;
let serverUrl = DEFAULT_URL;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let isIntentionalClose = false;

// ============================================================
// UI Communication
// ============================================================

figma.showUI(__html__, { width: 280, height: 320 });

function sendToUI(msg: Record<string, unknown>): void {
  figma.ui.postMessage(msg);
}

function log(message: string, level = ""): void {
  sendToUI({ type: "log", message, level });
}

function setStatus(status: string, text: string): void {
  sendToUI({ type: "status", status, text });
}

// ============================================================
// File Info
// ============================================================

function getFileInfo() {
  const pages = figma.root.children.map((page) => ({
    id: page.id,
    name: page.name,
  }));

  let nodeCount = 0;
  for (const page of figma.root.children) {
    nodeCount += countNodes(page);
  }

  return {
    name: figma.root.name,
    id: figma.root.id ?? "unknown",
    pages,
    nodeCount,
  };
}

function countNodes(node: BaseNode): number {
  let count = 1;
  if ("children" in node) {
    for (const child of (node as ChildrenMixin).children) {
      count += countNodes(child);
    }
  }
  return count;
}

// ============================================================
// WebSocket Connection
// ============================================================

function connect(url: string): void {
  serverUrl = url;
  isIntentionalClose = false;

  if (ws && ws.readyState === WebSocket.OPEN) {
    isIntentionalClose = true;
    ws.close();
  }

  setStatus("connecting", `Connecting to ${url}...`);

  try {
    ws = new WebSocket(url);
  } catch (error) {
    setStatus("error", `Failed to create WebSocket: ${error}`);
    scheduleReconnect();
    return;
  }

  ws.onopen = () => {
    log("WebSocket connected");
    // Send handshake
    const fileInfo = getFileInfo();
    ws!.send(JSON.stringify({ type: "handshake", fileInfo }));
    sendToUI({ type: "fileInfo", name: fileInfo.name, nodeCount: fileInfo.nodeCount });
  };

  ws.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data as string) as WebSocketMessage;
      handleMessage(message);
    } catch {
      log("Failed to parse message", "error");
    }
  };

  ws.onclose = () => {
    setStatus("", "Disconnected");
    ws = null;
    if (!isIntentionalClose) {
      scheduleReconnect();
    }
  };

  ws.onerror = () => {
    setStatus("error", "Connection error");
  };
}

function scheduleReconnect(): void {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(() => {
    log("Reconnecting...");
    connect(serverUrl);
  }, RECONNECT_INTERVAL);
}

function disconnect(): void {
  isIntentionalClose = true;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (ws) {
    ws.close();
    ws = null;
  }
  setStatus("", "Disconnected");
}

// ============================================================
// Message Handling
// ============================================================

function handleMessage(message: WebSocketMessage): void {
  switch (message.type) {
    case "handshake_ack":
      setStatus("connected", `Connected (server v${message.serverVersion})`);
      log(`Handshake complete. Server v${message.serverVersion}`);
      break;

    case "command":
      handleCommand(message.payload);
      break;

    case "scan_design_system":
      void handleDesignSystemScan();
      break;
  }
}

async function handleCommand(command: Command): Promise<void> {
  try {
    // Handle batch commands
    if (command.type === "batch" && command.batch) {
      const batchResults: CommandResponse[] = [];
      for (const subCommand of command.batch) {
        const result = await executeCommand(subCommand);
        batchResults.push(result);
        if (!result.success) {
          // Rollback: undo all previous successful operations
          for (let i = 0; i < batchResults.length - 1; i++) {
            if (batchResults[i].success) {
              (figma as unknown as { undo(): void }).undo();
            }
          }
          break;
        }
      }

      sendResponse({
        id: command.id,
        success: batchResults.every((r) => r.success),
        data: { batchResults },
        error: batchResults.find((r) => !r.success)?.error,
      });
      return;
    }

    // Single command
    const result = await executeCommand(command);
    sendResponse({
      id: command.id,
      success: result.success,
      data: result.data,
      error: result.error,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    sendResponse({
      id: command.id,
      success: false,
      error: errorMessage,
    });
    sendToUI({ type: "commandError", command: command.type, error: errorMessage });
  }
}

// ============================================================
// Executor Registry
// ============================================================

import { getExecutor } from "./executors/index.js";
import { scanDesignSystem } from "./utils/design-system-scanner.js";

// ============================================================
// Command Execution
// ============================================================

async function executeCommand(command: Command): Promise<CommandResponse> {
  const executor = getExecutor(command.type);

  if (!executor) {
    sendToUI({ type: "commandError", command: command.type, error: "Not implemented" });
    return {
      id: command.id,
      success: false,
      error: `Command '${command.type}' is not yet implemented. It will be available in a future phase.`,
    };
  }

  try {
    const result = await executor(command.params);
    sendToUI({ type: "commandExecuted", command: command.type });
    return {
      id: command.id,
      success: result.success,
      data: result.data,
      error: result.error,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    sendToUI({ type: "commandError", command: command.type, error: errorMessage });
    return {
      id: command.id,
      success: false,
      error: errorMessage,
    };
  }
}

function sendResponse(response: CommandResponse): void {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: "response", payload: response }));
  }
}

// ============================================================
// Design System Scanner
// ============================================================

async function handleDesignSystemScan(): Promise<void> {
  try {
    const context = await scanDesignSystem();
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(
        JSON.stringify({
          type: "design_system_result",
          payload: context,
        })
      );
    }
    sendToUI({ type: "statusUpdate", message: "Design system scanned successfully" });
  } catch (err) {
    sendToUI({
      type: "statusUpdate",
      message: `Design system scan failed: ${err instanceof Error ? err.message : String(err)}`,
    });
  }
}

// ============================================================
// Plugin Events
// ============================================================

figma.on("selectionchange", () => {
  const selectedNodes = figma.currentPage.selection.map((node) => ({
    id: node.id,
    name: node.name,
    type: node.type,
  }));

  sendPluginEvent("selection_changed", { nodes: selectedNodes });
});

figma.on("currentpagechange", () => {
  sendPluginEvent("page_changed", {
    pageId: figma.currentPage.id,
    pageName: figma.currentPage.name,
  });
});

function sendPluginEvent(event: string, data: unknown): void {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(
      JSON.stringify({
        type: "event",
        payload: { event, data },
      })
    );
  }
}

// ============================================================
// UI Message Handling
// ============================================================

figma.ui.onmessage = (msg: { type: string; url?: string }) => {
  switch (msg.type) {
    case "connect":
      if (ws && ws.readyState === WebSocket.OPEN) {
        disconnect();
      } else {
        connect(msg.url ?? DEFAULT_URL);
      }
      break;
  }
};

// ============================================================
// Auto-connect on launch
// ============================================================

connect(DEFAULT_URL);
