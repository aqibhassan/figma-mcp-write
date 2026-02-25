// shared/protocol.ts
import { randomUUID } from "crypto";

// ============================================================
// Commands (Client → Plugin)
// ============================================================

export interface Command {
  id: string;
  type: string;
  params: Record<string, unknown>;
  batch?: Command[];
  contextRequest?: boolean;
}

export interface CommandResponse {
  id: string;
  success: boolean;
  data?: unknown;
  error?: string;
  batchResults?: CommandResponse[];
  context?: DesignSystemContext;
}

// ============================================================
// Plugin Events (Plugin → Client, push-based)
// ============================================================

export type PluginEventType =
  | "selection_changed"
  | "page_changed"
  | "file_saved"
  | "design_system_updated";

export interface PluginEvent {
  event: PluginEventType;
  data: unknown;
}

// ============================================================
// Handshake
// ============================================================

export interface HandshakeMessage {
  type: "handshake";
  fileInfo: FileInfo;
}

export interface HandshakeAck {
  type: "handshake_ack";
  serverVersion: string;
}

export interface FileInfo {
  name: string;
  id: string;
  pages: PageInfo[];
  nodeCount: number;
}

export interface PageInfo {
  id: string;
  name: string;
}

// ============================================================
// Design System Context
// ============================================================

export interface DesignSystemContext {
  variables: {
    collections: VariableCollectionInfo[];
    colorTokens: VariableInfo[];
    spacingTokens: VariableInfo[];
    typographyTokens: VariableInfo[];
  };
  styles: {
    textStyles: StyleInfo[];
    colorStyles: StyleInfo[];
    effectStyles: StyleInfo[];
    gridStyles: StyleInfo[];
  };
  components: {
    local: ComponentInfo[];
    external: LibraryInfo[];
  };
  conventions: {
    namingPattern: "BEM" | "atomic" | "flat" | "unknown";
    spacingScale: number[];
    colorPalette: ColorGroupInfo[];
  };
}

export interface VariableCollectionInfo {
  id: string;
  name: string;
  modes: { id: string; name: string }[];
  variableCount: number;
}

export interface VariableInfo {
  id: string;
  name: string;
  type: string;
  value: unknown;
  collectionId: string;
}

export interface StyleInfo {
  id: string;
  name: string;
  type: string;
  description: string;
}

export interface ComponentInfo {
  id: string;
  name: string;
  description: string;
  variantProperties?: Record<string, string[]>;
}

export interface LibraryInfo {
  name: string;
  componentCount: number;
  enabled: boolean;
}

export interface ColorGroupInfo {
  name: string;
  colors: string[];
}

// ============================================================
// WebSocket Message Wrapper
// ============================================================

export type WebSocketMessage =
  | { type: "command"; payload: Command }
  | { type: "response"; payload: CommandResponse }
  | { type: "event"; payload: PluginEvent }
  | HandshakeMessage
  | HandshakeAck
  | { type: "scan_design_system" }
  | { type: "design_system_result"; payload: DesignSystemContext };

// ============================================================
// Constants
// ============================================================

export const DEFAULT_PORT = 3846;
export const DEFAULT_TIMEOUT = 30_000;
export const BULK_TIMEOUT = 120_000;
export const DESIGN_SYSTEM_SCAN_TIMEOUT = 60_000;
export const RECONNECT_INTERVAL = 2_000;
export const DISCONNECT_BUFFER = 5_000;
export const MAX_BATCH_SIZE = 100;
export const MAX_BULK_NODES = 1000;
export const SERVER_VERSION = "0.2.0";

// ============================================================
// Helpers
// ============================================================

export function createCommand(type: string, params: Record<string, unknown>): Command {
  return { id: randomUUID(), type, params };
}

export function createSuccessResponse(id: string, data?: unknown): CommandResponse {
  return { id, success: true, data };
}

export function createErrorResponse(id: string, error: string): CommandResponse {
  return { id, success: false, error };
}

// ============================================================
// Validation
// ============================================================

export const NODE_ID_PATTERN = /^\d+:\d+$/;

export function isValidNodeId(id: string): boolean {
  return NODE_ID_PATTERN.test(id);
}

export function isValidHexColor(color: string): boolean {
  return /^#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/.test(color);
}
