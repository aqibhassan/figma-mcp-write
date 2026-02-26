// plugin/executors/styling.ts
import { hexToRgb, hexToSolidPaint, parseGradientStops } from "../utils/color.js";
import { registerExecutor } from "./registry.js";

// ============================================================
// Types
// ============================================================

interface CommandResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

interface GradientInput {
  stops: { color: string; position: number }[];
  transform?: number[][];
}

interface EffectInput {
  type: string;
  color?: string;
  offset?: { x: number; y: number };
  radius?: number;
  spread?: number;
  visible?: boolean;
}

// ============================================================
// Constants
// ============================================================

const VALID_BLEND_MODES = [
  "NORMAL",
  "DARKEN",
  "MULTIPLY",
  "LINEAR_BURN",
  "COLOR_BURN",
  "LIGHTEN",
  "SCREEN",
  "LINEAR_DODGE",
  "COLOR_DODGE",
  "OVERLAY",
  "SOFT_LIGHT",
  "HARD_LIGHT",
  "DIFFERENCE",
  "EXCLUSION",
  "HUE",
  "SATURATION",
  "COLOR",
  "LUMINOSITY",
];

const VALID_CONSTRAINTS = ["MIN", "CENTER", "MAX", "STRETCH", "SCALE"];

const VALID_STROKE_ALIGNS = ["INSIDE", "OUTSIDE", "CENTER"];

const VALID_EFFECT_TYPES = ["DROP_SHADOW", "INNER_SHADOW", "LAYER_BLUR", "BACKGROUND_BLUR"];

const VALID_STYLE_TYPES = ["fill", "stroke", "text", "effect", "grid"];

const VALID_FILL_TYPES = [
  "SOLID",
  "GRADIENT_LINEAR",
  "GRADIENT_RADIAL",
  "GRADIENT_ANGULAR",
  "GRADIENT_DIAMOND",
  "IMAGE",
];

// ============================================================
// Main Dispatcher
// ============================================================

export async function executeStylingCommand(
  command: string,
  params: Record<string, unknown>
): Promise<CommandResult> {
  switch (command) {
    case "set_fill":
      return executeSetFill(params);
    case "set_stroke":
      return executeSetStroke(params);
    case "set_corner_radius":
      return executeSetCornerRadius(params);
    case "set_opacity":
      return executeSetOpacity(params);
    case "set_effects":
      return executeSetEffects(params);
    case "set_blend_mode":
      return executeSetBlendMode(params);
    case "set_constraints":
      return executeSetConstraints(params);
    case "apply_style":
      return executeApplyStyle(params);
    default:
      return { success: false, error: `Unknown styling command: '${command}'` };
  }
}

// ============================================================
// Helpers
// ============================================================

function getNode(nodeId: unknown): { node: SceneNode; error?: string } | { node: null; error: string } {
  if (!nodeId || typeof nodeId !== "string") {
    return { node: null, error: "Missing required parameter 'nodeId' (string, e.g. '1:2')." };
  }

  const node = figma.getNodeById(nodeId as string);
  if (!node) {
    return { node: null, error: `Node '${nodeId}' not found. Verify the node ID exists in the current file.` };
  }

  return { node: node as SceneNode };
}

// Default gradient transform: top-left to bottom-right
const DEFAULT_GRADIENT_TRANSFORM: Transform = [
  [1, 0, 0],
  [0, 1, 0],
];

// ============================================================
// set_fill
// ============================================================

function executeSetFill(params: Record<string, unknown>): CommandResult {
  const { node, error } = getNode(params.nodeId);
  if (!node) return { success: false, error };

  const type = params.type as string | undefined;
  if (!type) {
    return {
      success: false,
      error: `Missing required parameter 'type'. Must be one of: ${VALID_FILL_TYPES.join(", ")}.`,
    };
  }

  if (!VALID_FILL_TYPES.includes(type)) {
    return {
      success: false,
      error: `Invalid fill type '${type}'. Must be one of: ${VALID_FILL_TYPES.join(", ")}.`,
    };
  }

  if (!("fills" in node)) {
    return {
      success: false,
      error: `Node '${params.nodeId}' (type: ${node.type}) does not support fills. Use a FRAME, RECTANGLE, ELLIPSE, POLYGON, STAR, VECTOR, or TEXT node.`,
    };
  }

  try {
    if (type === "SOLID") {
      if (!params.color) {
        return {
          success: false,
          error: "Missing required parameter 'color' for SOLID fill. Provide a hex color string (e.g., '#FF0000').",
        };
      }
      const paint = hexToSolidPaint(params.color as string);
      (node as GeometryMixin).fills = [paint as Paint];
    } else if (type.startsWith("GRADIENT_")) {
      const gradientInput = params.gradient as GradientInput | undefined;
      if (!gradientInput || !gradientInput.stops) {
        return {
          success: false,
          error: `Missing required parameter 'gradient' with 'stops' array for ${type} fill. Example: { stops: [{ color: "#FF0000", position: 0 }, { color: "#0000FF", position: 1 }] }`,
        };
      }

      const gradientStops = parseGradientStops(gradientInput.stops);
      const figmaStops = gradientStops.map((stop) => ({
        color: stop.color,
        position: stop.position,
      }));

      const transform: Transform = gradientInput.transform
        ? (gradientInput.transform as unknown as Transform)
        : DEFAULT_GRADIENT_TRANSFORM;

      const gradientPaint = {
        type,
        gradientStops: figmaStops,
        gradientTransform: transform,
      };

      (node as GeometryMixin).fills = [gradientPaint as Paint];
    } else if (type === "IMAGE") {
      return {
        success: false,
        error: "IMAGE fills should be set using the 'set_image_fill' command (available in Phase 5). Use set_fill for SOLID or GRADIENT types.",
      };
    }

    return {
      success: true,
      data: {
        nodeId: node.id,
        fillType: type,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: `Failed to set fill: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}

// ============================================================
// set_stroke
// ============================================================

function executeSetStroke(params: Record<string, unknown>): CommandResult {
  const { node, error } = getNode(params.nodeId);
  if (!node) return { success: false, error };

  if (!params.color || typeof params.color !== "string") {
    return {
      success: false,
      error: "Missing required parameter 'color' (hex string, e.g. '#0000FF').",
    };
  }

  if (params.alignment && !VALID_STROKE_ALIGNS.includes(params.alignment as string)) {
    return {
      success: false,
      error: `Invalid stroke alignment '${params.alignment}'. Must be one of: ${VALID_STROKE_ALIGNS.join(", ")}.`,
    };
  }

  if (!("strokes" in node)) {
    return {
      success: false,
      error: `Node '${params.nodeId}' (type: ${node.type}) does not support strokes.`,
    };
  }

  try {
    const paint = hexToSolidPaint(params.color as string);
    (node as GeometryMixin).strokes = [paint as Paint];

    const weight = typeof params.weight === "number" ? params.weight : 1;
    (node as GeometryMixin).strokeWeight = weight;

    if (params.alignment) {
      (node as GeometryMixin).strokeAlign = params.alignment as "INSIDE" | "OUTSIDE" | "CENTER";
    }

    if (params.dashPattern && Array.isArray(params.dashPattern)) {
      (node as GeometryMixin).dashPattern = params.dashPattern as number[];
    }

    return {
      success: true,
      data: {
        nodeId: node.id,
        strokeColor: params.color,
        strokeWeight: weight,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: `Failed to set stroke: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}

// ============================================================
// set_corner_radius
// ============================================================

function executeSetCornerRadius(params: Record<string, unknown>): CommandResult {
  const { node, error } = getNode(params.nodeId);
  if (!node) return { success: false, error };

  const hasUniformRadius = typeof params.radius === "number";
  const hasIndividualRadius =
    typeof params.topLeft === "number" ||
    typeof params.topRight === "number" ||
    typeof params.bottomLeft === "number" ||
    typeof params.bottomRight === "number";

  if (!hasUniformRadius && !hasIndividualRadius) {
    return {
      success: false,
      error: "Provide either 'radius' for uniform corners, or individual values: 'topLeft', 'topRight', 'bottomLeft', 'bottomRight'.",
    };
  }

  if (!("cornerRadius" in node)) {
    return {
      success: false,
      error: `Node '${params.nodeId}' (type: ${node.type}) does not support corner radius. Use RECTANGLE, FRAME, or COMPONENT nodes.`,
    };
  }

  if (hasUniformRadius && (params.radius as number) < 0) {
    return {
      success: false,
      error: "Corner radius cannot be negative. Provide a value >= 0.",
    };
  }

  if (hasIndividualRadius) {
    const values = [params.topLeft, params.topRight, params.bottomLeft, params.bottomRight];
    for (const v of values) {
      if (typeof v === "number" && v < 0) {
        return {
          success: false,
          error: "Corner radius cannot be negative. Provide values >= 0.",
        };
      }
    }
  }

  try {
    const cornerNode = node as RectangleNode;

    if (hasUniformRadius) {
      cornerNode.cornerRadius = params.radius as number;
    }

    if (hasIndividualRadius) {
      if (typeof params.topLeft === "number") {
        cornerNode.topLeftRadius = params.topLeft as number;
      }
      if (typeof params.topRight === "number") {
        cornerNode.topRightRadius = params.topRight as number;
      }
      if (typeof params.bottomLeft === "number") {
        cornerNode.bottomLeftRadius = params.bottomLeft as number;
      }
      if (typeof params.bottomRight === "number") {
        cornerNode.bottomRightRadius = params.bottomRight as number;
      }
    }

    return {
      success: true,
      data: {
        nodeId: node.id,
        cornerRadius: hasUniformRadius ? params.radius : {
          topLeft: cornerNode.topLeftRadius,
          topRight: cornerNode.topRightRadius,
          bottomLeft: cornerNode.bottomLeftRadius,
          bottomRight: cornerNode.bottomRightRadius,
        },
      },
    };
  } catch (e) {
    return {
      success: false,
      error: `Failed to set corner radius: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}

// ============================================================
// set_opacity
// ============================================================

function executeSetOpacity(params: Record<string, unknown>): CommandResult {
  const { node, error } = getNode(params.nodeId);
  if (!node) return { success: false, error };

  if (typeof params.opacity !== "number") {
    return {
      success: false,
      error: "Missing required parameter 'opacity' (number between 0 and 1).",
    };
  }

  const opacity = params.opacity as number;
  if (opacity < 0 || opacity > 1) {
    return {
      success: false,
      error: `Opacity must be between 0 and 1. Got: ${opacity}.`,
    };
  }

  try {
    (node as SceneNode).opacity = opacity;

    return {
      success: true,
      data: {
        nodeId: node.id,
        opacity,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: `Failed to set opacity: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}

// ============================================================
// set_effects
// ============================================================

function executeSetEffects(params: Record<string, unknown>): CommandResult {
  const { node, error } = getNode(params.nodeId);
  if (!node) return { success: false, error };

  if (!params.effects || !Array.isArray(params.effects)) {
    return {
      success: false,
      error: "Missing required parameter 'effects' (array of effect objects). Example: [{ type: 'DROP_SHADOW', color: '#00000040', offset: { x: 0, y: 4 }, radius: 8 }]",
    };
  }

  if (!("effects" in node)) {
    return {
      success: false,
      error: `Node '${params.nodeId}' (type: ${node.type}) does not support effects.`,
    };
  }

  const effectInputs = params.effects as EffectInput[];

  try {
    const figmaEffects: Effect[] = effectInputs.map((input) => {
      if (!VALID_EFFECT_TYPES.includes(input.type)) {
        throw new Error(
          `Invalid effect type '${input.type}'. Must be one of: ${VALID_EFFECT_TYPES.join(", ")}.`
        );
      }

      const visible = input.visible !== undefined ? input.visible : true;

      if (input.type === "DROP_SHADOW" || input.type === "INNER_SHADOW") {
        const colorHex = input.color || "#00000040";
        const { r, g, b, a } = hexToRgb(colorHex);
        const offset = input.offset || { x: 0, y: 4 };
        const radius = input.radius || 0;
        const spread = input.spread || 0;

        return {
          type: input.type,
          color: { r, g, b, a },
          offset: { x: offset.x, y: offset.y },
          radius,
          spread,
          visible,
        } as Effect;
      }

      if (input.type === "LAYER_BLUR" || input.type === "BACKGROUND_BLUR") {
        const radius = input.radius || 0;

        return {
          type: input.type,
          radius,
          visible,
        } as Effect;
      }

      throw new Error(`Unhandled effect type: ${input.type}`);
    });

    (node as BlendMixin).effects = figmaEffects;

    return {
      success: true,
      data: {
        nodeId: node.id,
        effectCount: figmaEffects.length,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: `Failed to set effects: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}

// ============================================================
// set_blend_mode
// ============================================================

function executeSetBlendMode(params: Record<string, unknown>): CommandResult {
  const { node, error } = getNode(params.nodeId);
  if (!node) return { success: false, error };

  if (!params.blendMode || typeof params.blendMode !== "string") {
    return {
      success: false,
      error: `Missing required parameter 'blendMode'. Must be one of: ${VALID_BLEND_MODES.join(", ")}.`,
    };
  }

  if (!VALID_BLEND_MODES.includes(params.blendMode as string)) {
    return {
      success: false,
      error: `Invalid blendMode '${params.blendMode}'. Must be one of: ${VALID_BLEND_MODES.join(", ")}.`,
    };
  }

  if (!("blendMode" in node)) {
    return {
      success: false,
      error: `Node '${params.nodeId}' (type: ${node.type}) does not support blend modes.`,
    };
  }

  try {
    (node as BlendMixin).blendMode = params.blendMode as BlendMode;

    return {
      success: true,
      data: {
        nodeId: node.id,
        blendMode: params.blendMode,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: `Failed to set blend mode: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}

// ============================================================
// set_constraints
// ============================================================

function executeSetConstraints(params: Record<string, unknown>): CommandResult {
  const { node, error } = getNode(params.nodeId);
  if (!node) return { success: false, error };

  const horizontal = params.horizontal as string | undefined;
  const vertical = params.vertical as string | undefined;

  if (!horizontal && !vertical) {
    return {
      success: false,
      error: `Provide at least one of 'horizontal' or 'vertical'. Valid values: ${VALID_CONSTRAINTS.join(", ")}.`,
    };
  }

  if (horizontal && !VALID_CONSTRAINTS.includes(horizontal)) {
    return {
      success: false,
      error: `Invalid horizontal constraint '${horizontal}'. Must be one of: ${VALID_CONSTRAINTS.join(", ")}.`,
    };
  }

  if (vertical && !VALID_CONSTRAINTS.includes(vertical)) {
    return {
      success: false,
      error: `Invalid vertical constraint '${vertical}'. Must be one of: ${VALID_CONSTRAINTS.join(", ")}.`,
    };
  }

  if (!("constraints" in node)) {
    return {
      success: false,
      error: `Node '${params.nodeId}' (type: ${node.type}) does not support constraints. Must be a direct child of a non-auto-layout frame.`,
    };
  }

  try {
    const constraintNode = node as ConstraintMixin;
    const current = constraintNode.constraints;

    constraintNode.constraints = {
      horizontal: (horizontal || current.horizontal) as Constraints["horizontal"],
      vertical: (vertical || current.vertical) as Constraints["vertical"],
    };

    return {
      success: true,
      data: {
        nodeId: node.id,
        constraints: constraintNode.constraints,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: `Failed to set constraints: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}

// ============================================================
// apply_style
// ============================================================

function executeApplyStyle(params: Record<string, unknown>): CommandResult {
  const { node, error } = getNode(params.nodeId);
  if (!node) return { success: false, error };

  if (!params.styleName || typeof params.styleName !== "string") {
    return {
      success: false,
      error: "Missing required parameter 'styleName' (string). Provide the name of the style to apply (e.g., 'Brand/Primary').",
    };
  }

  if (!params.styleType || typeof params.styleType !== "string") {
    return {
      success: false,
      error: `Missing required parameter 'styleType'. Must be one of: ${VALID_STYLE_TYPES.join(", ")}.`,
    };
  }

  if (!VALID_STYLE_TYPES.includes(params.styleType as string)) {
    return {
      success: false,
      error: `Invalid styleType '${params.styleType}'. Must be one of: ${VALID_STYLE_TYPES.join(", ")}.`,
    };
  }

  const styleName = params.styleName as string;
  const styleType = params.styleType as string;

  try {
    switch (styleType) {
      case "fill": {
        const styles = figma.getLocalPaintStyles();
        const style = styles.find((s) => s.name === styleName);
        if (!style) {
          return {
            success: false,
            error: `Fill style '${styleName}' not found. Available fill styles: ${styles.map((s) => s.name).join(", ") || "(none)"}`,
          };
        }
        if (!("fillStyleId" in node)) {
          return { success: false, error: `Node '${params.nodeId}' does not support fill styles.` };
        }
        (node as GeometryMixin).fillStyleId = style.id;
        break;
      }
      case "stroke": {
        const styles = figma.getLocalPaintStyles();
        const style = styles.find((s) => s.name === styleName);
        if (!style) {
          return {
            success: false,
            error: `Stroke style '${styleName}' not found. Available paint styles: ${styles.map((s) => s.name).join(", ") || "(none)"}`,
          };
        }
        if (!("strokeStyleId" in node)) {
          return { success: false, error: `Node '${params.nodeId}' does not support stroke styles.` };
        }
        (node as GeometryMixin).strokeStyleId = style.id;
        break;
      }
      case "text": {
        const styles = figma.getLocalTextStyles();
        const style = styles.find((s) => s.name === styleName);
        if (!style) {
          return {
            success: false,
            error: `Text style '${styleName}' not found. Available text styles: ${styles.map((s) => s.name).join(", ") || "(none)"}`,
          };
        }
        if (!("textStyleId" in node)) {
          return { success: false, error: `Node '${params.nodeId}' does not support text styles. Use a TEXT node.` };
        }
        (node as TextNode).textStyleId = style.id;
        break;
      }
      case "effect": {
        const styles = figma.getLocalEffectStyles();
        const style = styles.find((s) => s.name === styleName);
        if (!style) {
          return {
            success: false,
            error: `Effect style '${styleName}' not found. Available effect styles: ${styles.map((s) => s.name).join(", ") || "(none)"}`,
          };
        }
        if (!("effectStyleId" in node)) {
          return { success: false, error: `Node '${params.nodeId}' does not support effect styles.` };
        }
        (node as BlendMixin).effectStyleId = style.id;
        break;
      }
      case "grid": {
        const styles = figma.getLocalGridStyles();
        const style = styles.find((s) => s.name === styleName);
        if (!style) {
          return {
            success: false,
            error: `Grid style '${styleName}' not found. Available grid styles: ${styles.map((s) => s.name).join(", ") || "(none)"}`,
          };
        }
        if (!("gridStyleId" in node)) {
          return { success: false, error: `Node '${params.nodeId}' does not support grid styles. Use a FRAME node.` };
        }
        (node as FrameNode).gridStyleId = style.id;
        break;
      }
    }

    return {
      success: true,
      data: {
        nodeId: node.id,
        styleName,
        styleType,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: `Failed to apply style: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}

// ============================================================
// Register all styling commands in the executor registry
// ============================================================

const STYLING_COMMANDS = [
  "set_fill",
  "set_stroke",
  "set_corner_radius",
  "set_opacity",
  "set_effects",
  "set_blend_mode",
  "set_constraints",
  "apply_style",
] as const;

for (const cmd of STYLING_COMMANDS) {
  registerExecutor(cmd, (params) => executeStylingCommand(cmd, params));
}
