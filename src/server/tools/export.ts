// src/server/tools/export.ts

import { BULK_TIMEOUT } from "../../../shared/protocol.js";

export const EXPORT_TOOL_NAME = "figma_export";

export const EXPORT_TOOL_DESCRIPTION =
  `Export assets from Figma. Commands: export_node, set_export_settings, set_image_fill, get_node_css. ` +
  `Use export_node to render a node as PNG/SVG/PDF/JPG (returns base64). ` +
  `Use set_export_settings to configure export presets on a node. ` +
  `Use set_image_fill to set an image fill from base64 data. ` +
  `Use get_node_css to extract CSS properties or Tailwind classes from a node.`;

export const EXPORT_TOOL_SCHEMA = {
  type: "object" as const,
  properties: {
    command: {
      type: "string" as const,
      enum: [
        "export_node",
        "set_export_settings",
        "set_image_fill",
        "get_node_css",
      ],
      description: "The export command to execute",
    },
    params: {
      type: "object" as const,
      description:
        "Parameters for the command. " +
        "export_node: { nodeId, format: 'PNG'|'SVG'|'PDF'|'JPG', scale?: 0.5-4, constraint?: { type: 'SCALE'|'WIDTH'|'HEIGHT', value } }. " +
        "set_export_settings: { nodeId, settings: [{ format, suffix?, constraint? }] }. " +
        "set_image_fill: { nodeId, imageBase64?, imageUrl?, scaleMode?: 'FILL'|'FIT'|'CROP'|'TILE' }. " +
        "get_node_css: { nodeId, format?: 'css'|'tailwind' }.",
    },
  },
  required: ["command", "params"],
};

export const EXPORT_COMMANDS = [
  "export_node",
  "set_export_settings",
  "set_image_fill",
  "get_node_css",
];

export function getExportTimeout(command: string): number {
  switch (command) {
    case "export_node":
      return BULK_TIMEOUT; // 120s — large exports take time
    case "set_image_fill":
      return BULK_TIMEOUT; // 120s — image decoding
    default:
      return 30_000;
  }
}
