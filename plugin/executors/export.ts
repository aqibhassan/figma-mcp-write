// plugin/executors/export.ts
import { registerExecutor } from "./registry.js";

interface CommandResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

// ============================================================
// Helpers
// ============================================================

function getNode(nodeId: string): SceneNode | null {
  return figma.getNodeById(nodeId) as SceneNode | null;
}

function errorResponse(error: string): CommandResult {
  return { success: false, error };
}

function successResponse(data: unknown): CommandResult {
  return { success: true, data };
}

const VALID_FORMATS = ["PNG", "SVG", "PDF", "JPG"] as const;
type ExportFormat = (typeof VALID_FORMATS)[number];

const VALID_SCALE_MODES = ["FILL", "FIT", "CROP", "TILE"] as const;
type ScaleMode = (typeof VALID_SCALE_MODES)[number];

// ============================================================
// export_node
// ============================================================

export async function exportNode(
  params: Record<string, unknown>
): Promise<CommandResult> {
  const nodeId = params.nodeId as string | undefined;
  const format = params.format as string | undefined;
  const scale = params.scale as number | undefined;
  const constraint = params.constraint as
    | { type: "SCALE" | "WIDTH" | "HEIGHT"; value: number }
    | undefined;

  if (!nodeId) {
    return errorResponse("Missing required parameter: nodeId");
  }

  if (!format) {
    return errorResponse(
      "Missing required parameter: format (PNG, SVG, PDF, or JPG)"
    );
  }

  if (!VALID_FORMATS.includes(format as ExportFormat)) {
    return errorResponse(
      `Invalid format '${format}'. Must be one of: ${VALID_FORMATS.join(", ")}`
    );
  }

  if (scale !== undefined) {
    if (typeof scale !== "number" || scale < 0.5 || scale > 4) {
      return errorResponse(
        `Invalid scale '${scale}'. Must be a number between 0.5 and 4. ` +
          `Common values: 1 (1x), 2 (2x/Retina), 3 (3x), 4 (4x).`
      );
    }
  }

  const node = getNode(nodeId);
  if (!node) {
    return errorResponse(
      `Node '${nodeId}' not found. Verify the node ID is correct and the node exists on the current page.`
    );
  }

  // Build export settings
  const exportSettings: ExportSettings = {
    format: format as ExportFormat,
  };

  if (constraint) {
    exportSettings.constraint = constraint;
  } else if (scale !== undefined) {
    exportSettings.constraint = { type: "SCALE", value: scale };
  }

  try {
    const bytes = await node.exportAsync(exportSettings);

    // Convert Uint8Array to base64
    const base64 = uint8ArrayToBase64(bytes);

    return successResponse({
      nodeId: node.id,
      name: node.name,
      format,
      base64,
      byteLength: bytes.length,
    });
  } catch (err) {
    return errorResponse(
      `Export failed for node '${nodeId}': ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

// ============================================================
// set_export_settings
// ============================================================

export async function setExportSettings(
  params: Record<string, unknown>
): Promise<CommandResult> {
  const nodeId = params.nodeId as string | undefined;
  const settings = params.settings as
    | Array<{
        format: string;
        suffix?: string;
        constraint?: { type: string; value: number };
      }>
    | undefined;

  if (!nodeId) {
    return errorResponse("Missing required parameter: nodeId");
  }

  if (!settings || !Array.isArray(settings)) {
    return errorResponse(
      "Missing required parameter: settings (array of export setting objects)"
    );
  }

  if (settings.length === 0) {
    return errorResponse(
      "settings array must contain at least one export setting. " +
        `Each setting needs: format (PNG/SVG/PDF/JPG), optional suffix, optional constraint.`
    );
  }

  const node = getNode(nodeId);
  if (!node) {
    return errorResponse(
      `Node '${nodeId}' not found. Verify the node ID is correct and the node exists on the current page.`
    );
  }

  // Validate and build export settings
  const exportSettings: ExportSettings[] = [];

  for (const setting of settings) {
    const fmt = setting.format?.toUpperCase();
    if (!VALID_FORMATS.includes(fmt as ExportFormat)) {
      return errorResponse(
        `Invalid format '${setting.format}' in export settings. ` +
          `Must be one of: ${VALID_FORMATS.join(", ")}`
      );
    }

    exportSettings.push({
      format: fmt as ExportFormat,
      suffix: setting.suffix ?? "",
      constraint: setting.constraint
        ? {
            type: setting.constraint.type as "SCALE" | "WIDTH" | "HEIGHT",
            value: setting.constraint.value,
          }
        : { type: "SCALE", value: 1 },
    } as ExportSettings);
  }

  node.exportSettings = exportSettings;

  return successResponse({
    nodeId: node.id,
    name: node.name,
    exportSettings: exportSettings.map((s) => ({
      format: s.format,
      suffix: (s as ExportSettingsImage).suffix ?? "",
      constraint: (s as ExportSettingsImage).constraint,
    })),
  });
}

// ============================================================
// set_image_fill
// ============================================================

export async function setImageFill(
  params: Record<string, unknown>
): Promise<CommandResult> {
  const nodeId = params.nodeId as string | undefined;
  const imageBase64 = params.imageBase64 as string | undefined;
  const imageUrl = params.imageUrl as string | undefined;
  const scaleMode = params.scaleMode as string | undefined;

  if (!nodeId) {
    return errorResponse("Missing required parameter: nodeId");
  }

  if (!imageBase64 && !imageUrl) {
    return errorResponse(
      "Missing required parameter: provide either imageBase64 or imageUrl to set the image fill"
    );
  }

  if (scaleMode && !VALID_SCALE_MODES.includes(scaleMode as ScaleMode)) {
    return errorResponse(
      `Invalid scaleMode '${scaleMode}'. Must be one of: ${VALID_SCALE_MODES.join(", ")}`
    );
  }

  const node = getNode(nodeId);
  if (!node) {
    return errorResponse(
      `Node '${nodeId}' not found. Verify the node ID is correct and the node exists on the current page.`
    );
  }

  if (!("fills" in node)) {
    return errorResponse(
      `Node '${nodeId}' (${node.name}) of type ${node.type} does not support fills. ` +
        `Use a rectangle, frame, or ellipse for image fills.`
    );
  }

  let imageData: Uint8Array;

  if (imageBase64) {
    // Decode base64 to Uint8Array
    imageData = base64ToUint8Array(imageBase64);
  } else {
    // URL-based image loading would require network access from the plugin
    // For now, return an error asking to use base64 instead
    return errorResponse(
      "imageUrl is not yet supported in the plugin environment. " +
        "Please provide imageBase64 instead. Convert the image to base64 first."
    );
  }

  const image = figma.createImage(imageData);

  const fillNode = node as GeometryMixin;
  fillNode.fills = [
    {
      type: "IMAGE",
      imageHash: image.hash,
      scaleMode: (scaleMode as ScaleMode) ?? "FILL",
    },
  ];

  return successResponse({
    nodeId: node.id,
    name: node.name,
    imageHash: image.hash,
    scaleMode: scaleMode ?? "FILL",
  });
}

// ============================================================
// get_node_css
// ============================================================

export async function getNodeCss(
  params: Record<string, unknown>
): Promise<CommandResult> {
  const nodeId = params.nodeId as string | undefined;
  const format = (params.format as string | undefined) ?? "css";

  if (!nodeId) {
    return errorResponse("Missing required parameter: nodeId");
  }

  const node = getNode(nodeId);
  if (!node) {
    return errorResponse(
      `Node '${nodeId}' not found. Verify the node ID is correct and the node exists on the current page.`
    );
  }

  const cssProperties: string[] = [];
  const tailwindClasses: string[] = [];

  // Dimensions
  if ("width" in node && "height" in node) {
    cssProperties.push(`width: ${Math.round(node.width)}px`);
    cssProperties.push(`height: ${Math.round(node.height)}px`);
    tailwindClasses.push(`w-[${Math.round(node.width)}px]`);
    tailwindClasses.push(`h-[${Math.round(node.height)}px]`);
  }

  // Border radius
  if ("cornerRadius" in node) {
    const radius = (node as unknown as { cornerRadius: number }).cornerRadius;
    if (typeof radius === "number" && radius > 0) {
      cssProperties.push(`border-radius: ${radius}px`);
      tailwindClasses.push(`rounded-[${radius}px]`);
    }
  }

  // Opacity
  if ("opacity" in node && (node as SceneNode).opacity < 1) {
    const op = (node as SceneNode).opacity;
    cssProperties.push(`opacity: ${op}`);
    tailwindClasses.push(`opacity-${Math.round(op * 100)}`);
  }

  // Fills (first solid fill → background-color)
  if ("fills" in node) {
    const fills = (node as unknown as { fills: unknown[] }).fills;
    if (Array.isArray(fills) && fills.length > 0) {
      const firstFill = fills[0] as {
        type: string;
        color?: { r: number; g: number; b: number };
        opacity?: number;
      };
      if (firstFill.type === "SOLID" && firstFill.color) {
        const { r, g, b } = firstFill.color;
        const hex = rgbToHex(r, g, b);
        cssProperties.push(`background-color: ${hex}`);
        tailwindClasses.push(`bg-[${hex}]`);
      }
    }
  }

  // Strokes
  if ("strokes" in node) {
    const strokes = (node as unknown as { strokes: unknown[] }).strokes;
    if (Array.isArray(strokes) && strokes.length > 0) {
      const stroke = strokes[0] as {
        type: string;
        color?: { r: number; g: number; b: number };
      };
      if (stroke.type === "SOLID" && stroke.color) {
        const hex = rgbToHex(stroke.color.r, stroke.color.g, stroke.color.b);
        cssProperties.push(`border-color: ${hex}`);
        tailwindClasses.push(`border-[${hex}]`);
      }
    }
  }

  // Effects (drop shadow)
  if ("effects" in node) {
    const effects = (node as unknown as { effects: unknown[] }).effects;
    if (Array.isArray(effects)) {
      for (const effect of effects) {
        const e = effect as {
          type: string;
          color?: { r: number; g: number; b: number; a: number };
          offset?: { x: number; y: number };
          radius?: number;
          visible?: boolean;
        };
        if (e.type === "DROP_SHADOW" && e.visible !== false) {
          const c = e.color ?? { r: 0, g: 0, b: 0, a: 0.25 };
          const ox = e.offset?.x ?? 0;
          const oy = e.offset?.y ?? 4;
          const r = e.radius ?? 8;
          cssProperties.push(
            `box-shadow: ${ox}px ${oy}px ${r}px rgba(${Math.round(c.r * 255)}, ${Math.round(c.g * 255)}, ${Math.round(c.b * 255)}, ${c.a ?? 0.25})`
          );
          tailwindClasses.push("shadow");
        }
      }
    }
  }

  // Text properties
  if (node.type === "TEXT") {
    const textNode = node as TextNode;

    if ("fontName" in textNode) {
      const fontName = textNode.fontName as { family: string; style: string };
      if (fontName && typeof fontName === "object") {
        cssProperties.push(`font-family: '${fontName.family}', sans-serif`);
        tailwindClasses.push(`font-['${fontName.family}']`);
      }
    }

    if ("fontSize" in textNode) {
      const size = textNode.fontSize as number;
      if (typeof size === "number") {
        cssProperties.push(`font-size: ${size}px`);
        tailwindClasses.push(`text-[${size}px]`);
      }
    }

    if ("fontWeight" in textNode) {
      const weight = (textNode as unknown as { fontWeight: number }).fontWeight;
      if (typeof weight === "number" && weight !== 400) {
        cssProperties.push(`font-weight: ${weight}`);
        tailwindClasses.push(`font-[${weight}]`);
      }
    }

    if ("lineHeight" in textNode) {
      const lh = textNode.lineHeight as
        | { value: number; unit: string }
        | { unit: "AUTO" };
      if (lh && "value" in lh) {
        cssProperties.push(`line-height: ${lh.value}px`);
        tailwindClasses.push(`leading-[${lh.value}px]`);
      }
    }

    if ("letterSpacing" in textNode) {
      const ls = textNode.letterSpacing as { value: number; unit: string };
      if (ls && ls.value !== 0) {
        cssProperties.push(`letter-spacing: ${ls.value}px`);
        tailwindClasses.push(`tracking-[${ls.value}px]`);
      }
    }
  }

  // Auto-layout (frame)
  if ("layoutMode" in node) {
    const frameNode = node as FrameNode;
    if (frameNode.layoutMode !== "NONE") {
      cssProperties.push("display: flex");
      tailwindClasses.push("flex");

      if (frameNode.layoutMode === "VERTICAL") {
        cssProperties.push("flex-direction: column");
        tailwindClasses.push("flex-col");
      } else {
        cssProperties.push("flex-direction: row");
        tailwindClasses.push("flex-row");
      }

      if ("itemSpacing" in frameNode) {
        const spacing = frameNode.itemSpacing;
        cssProperties.push(`gap: ${spacing}px`);
        tailwindClasses.push(`gap-[${spacing}px]`);
      }

      if ("paddingTop" in frameNode) {
        const pt = frameNode.paddingTop;
        const pr = frameNode.paddingRight;
        const pb = frameNode.paddingBottom;
        const pl = frameNode.paddingLeft;
        cssProperties.push(`padding: ${pt}px ${pr}px ${pb}px ${pl}px`);

        if (pt === pr && pr === pb && pb === pl) {
          tailwindClasses.push(`p-[${pt}px]`);
        } else {
          tailwindClasses.push(`pt-[${pt}px]`);
          tailwindClasses.push(`pr-[${pr}px]`);
          tailwindClasses.push(`pb-[${pb}px]`);
          tailwindClasses.push(`pl-[${pl}px]`);
        }
      }
    }
  }

  const cssString = cssProperties.join(";\n") + ";";
  const tailwindString = tailwindClasses.join(" ");

  if (format === "tailwind") {
    return successResponse({
      nodeId: node.id,
      name: node.name,
      tailwind: tailwindString,
    });
  }

  return successResponse({
    nodeId: node.id,
    name: node.name,
    css: cssString,
  });
}

// ============================================================
// Utility: Base64 Encoding/Decoding
// ============================================================

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  // In Figma plugin environment, btoa is available
  if (typeof btoa === "function") {
    return btoa(binary);
  }
  // Fallback for Node.js test environment
  return Buffer.from(bytes).toString("base64");
}

function base64ToUint8Array(base64: string): Uint8Array {
  // In Figma plugin environment, atob is available
  if (typeof atob === "function") {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
  // Fallback for Node.js test environment
  return new Uint8Array(Buffer.from(base64, "base64"));
}

// ============================================================
// Utility: Color Conversion
// ============================================================

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (c: number) =>
    Math.round(c * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

// ============================================================
// Register all export commands in the executor registry
// ============================================================

registerExecutor("export_node", (p) => exportNode(p));
registerExecutor("set_export_settings", (p) => setExportSettings(p));
registerExecutor("set_image_fill", (p) => setImageFill(p));
registerExecutor("get_node_css", (p) => getNodeCss(p));
