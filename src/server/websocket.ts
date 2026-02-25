// src/server/websocket.ts
import { WebSocketServer, WebSocket as WS } from "ws";
import {
  Command,
  CommandResponse,
  PluginEvent,
  FileInfo,
  HandshakeMessage,
  WebSocketMessage,
  SERVER_VERSION,
  DEFAULT_PORT,
} from "../../shared/protocol.js";

type ResponseListener = (response: CommandResponse) => void;
type EventListener = (event: PluginEvent) => void;
type ConnectionListener = () => void;

export class WebSocketManager {
  private wss: WebSocketServer | null = null;
  private pluginSocket: WS | null = null;
  private _port = 0;
  private _fileInfo: FileInfo | null = null;

  private responseListeners: ResponseListener[] = [];
  private eventListeners: EventListener[] = [];
  private connectListeners: ConnectionListener[] = [];
  private disconnectListeners: ConnectionListener[] = [];

  get port(): number {
    return this._port;
  }

  get isRunning(): boolean {
    return this.wss !== null;
  }

  get isConnected(): boolean {
    return (
      this.pluginSocket !== null &&
      this.pluginSocket.readyState === WS.OPEN
    );
  }

  get fileInfo(): FileInfo | null {
    return this._fileInfo;
  }

  async start(port: number = DEFAULT_PORT): Promise<void> {
    return new Promise((resolve, reject) => {
      this.wss = new WebSocketServer({ port }, () => {
        const addr = this.wss!.address();
        this._port = addr !== null && typeof addr === "object" ? addr.port : port;
        resolve();
      });

      this.wss.on("error", reject);

      this.wss.on("connection", (ws) => {
        this.handleConnection(ws);
      });
    });
  }

  private handleConnection(ws: WS): void {
    // Only allow one plugin connection at a time
    if (this.pluginSocket && this.pluginSocket.readyState === WS.OPEN) {
      this.pluginSocket.close(1000, "New connection replacing old one");
    }

    ws.on("message", (data) => {
      try {
        const message = JSON.parse(data.toString()) as WebSocketMessage;
        this.handleMessage(ws, message);
      } catch {
        // Ignore malformed messages
      }
    });

    ws.on("close", () => {
      if (ws === this.pluginSocket) {
        this.pluginSocket = null;
        this._fileInfo = null;
        for (const listener of this.disconnectListeners) {
          listener();
        }
      }
    });

    ws.on("error", () => {
      // Error handled by close event
    });
  }

  private handleMessage(ws: WS, message: WebSocketMessage): void {
    switch (message.type) {
      case "handshake":
        this.handleHandshake(ws, message as HandshakeMessage);
        break;
      case "response":
        for (const listener of this.responseListeners) {
          listener(message.payload);
        }
        break;
      case "event":
        for (const listener of this.eventListeners) {
          listener(message.payload);
        }
        break;
      case "design_system_result":
        // Forward as a response-like event
        for (const listener of this.responseListeners) {
          listener({
            id: "design_system_scan",
            success: true,
            data: message.payload,
          });
        }
        break;
    }
  }

  private handleHandshake(ws: WS, message: HandshakeMessage): void {
    this.pluginSocket = ws;
    this._fileInfo = message.fileInfo;

    ws.send(
      JSON.stringify({
        type: "handshake_ack",
        serverVersion: SERVER_VERSION,
      })
    );

    for (const listener of this.connectListeners) {
      listener();
    }
  }

  sendCommand(command: Command): void {
    if (!this.isConnected) {
      throw new Error("No plugin connected");
    }

    this.pluginSocket!.send(
      JSON.stringify({ type: "command", payload: command })
    );
  }

  requestDesignSystemScan(): void {
    if (!this.isConnected) {
      throw new Error("No plugin connected");
    }

    this.pluginSocket!.send(
      JSON.stringify({ type: "scan_design_system" })
    );
  }

  onResponse(listener: ResponseListener): void {
    this.responseListeners.push(listener);
  }

  onPluginEvent(listener: EventListener): void {
    this.eventListeners.push(listener);
  }

  onConnect(listener: ConnectionListener): void {
    this.connectListeners.push(listener);
  }

  onDisconnect(listener: ConnectionListener): void {
    this.disconnectListeners.push(listener);
  }

  async close(): Promise<void> {
    if (this.pluginSocket) {
      this.pluginSocket.close();
      this.pluginSocket = null;
    }
    if (this.wss) {
      return new Promise((resolve) => {
        this.wss!.close(() => {
          this.wss = null;
          resolve();
        });
      });
    }
  }
}
