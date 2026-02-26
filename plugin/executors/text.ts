// plugin/executors/text.ts
import { registerExecutor } from "./registry.js";

// ============================================================
// Helpers
// ============================================================

const NODE_ID_PATTERN = /^\d+:\d+$/;

const VALID_HORIZONTAL_ALIGN = ["LEFT", "CENTER", "RIGHT", "JUSTIFIED"];
const VALID_VERTICAL_ALIGN = ["TOP", "CENTER", "BOTTOM"];

function validateNodeId(nodeId: unknown): string | null {
  if (typeof nodeId !== "string" || !nodeId) {
    return "Required parameter 'nodeId' is missing or not a string.";
  }
  if (!NODE_ID_PATTERN.test(nodeId)) {
    return `Invalid node ID format '${nodeId}'. Expected format: '123:456'.`;
  }
  return null;
}

function getTextNodeOrError(nodeId: string): {
  node?: TextNode;
  error?: string;
} {
  const validationError = validateNodeId(nodeId);
  if (validationError) return { error: validationError };

  const node = figma.getNodeById(nodeId);
  if (!node) {
    return { error: `Node '${nodeId}' not found. It may have been deleted.` };
  }
  if (node.type !== "TEXT") {
    return {
      error: `Node '${nodeId}' is a ${node.type}, not a TEXT node. This command only works on text layers.`,
    };
  }
  return { node: node as unknown as TextNode };
}

function hexToRgb(
  hex: string
): { r: number; g: number; b: number } | null {
  const match = hex.match(/^#?([0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/);
  if (!match) return null;
  const h = match[1];
  return {
    r: parseInt(h.substring(0, 2), 16) / 255,
    g: parseInt(h.substring(2, 4), 16) / 255,
    b: parseInt(h.substring(4, 6), 16) / 255,
  };
}

// ============================================================
// set_text_content
// ============================================================

registerExecutor("set_text_content", async (params) => {
  const nodeId = params.nodeId as string | undefined;
  const text = params.text as string | undefined;

  if (!nodeId) {
    return {
      success: false,
      error: "Required parameter 'nodeId' is missing.",
    };
  }

  if (typeof text !== "string") {
    return {
      success: false,
      error:
        "Required parameter 'text' is missing. Provide the new text content.",
    };
  }

  const { node, error } = getTextNodeOrError(nodeId);
  if (error) return { success: false, error };

  // Must load font before modifying text
  const fontName = node!.fontName as FontName;
  await figma.loadFontAsync(fontName);

  node!.characters = text;

  return {
    success: true,
    data: { nodeId, characters: text },
  };
});

// ============================================================
// set_text_style
// ============================================================

registerExecutor("set_text_style", async (params) => {
  const nodeId = params.nodeId as string | undefined;

  if (!nodeId) {
    return {
      success: false,
      error: "Required parameter 'nodeId' is missing.",
    };
  }

  const { node, error } = getTextNodeOrError(nodeId);
  if (error) return { success: false, error };

  const fontFamily = params.fontFamily as string | undefined;
  const fontSize = params.fontSize as number | undefined;
  const fontWeight = params.fontWeight as string | undefined;
  const lineHeight = params.lineHeight as number | undefined;
  const letterSpacing = params.letterSpacing as number | undefined;

  const hasAnyStyle =
    fontFamily !== undefined ||
    fontSize !== undefined ||
    fontWeight !== undefined ||
    lineHeight !== undefined ||
    letterSpacing !== undefined;

  if (!hasAnyStyle) {
    return {
      success: false,
      error:
        "No style parameters provided. Provide at least one of: fontFamily, fontSize, fontWeight, lineHeight, letterSpacing.",
    };
  }

  const currentFontName = node!.fontName as FontName;
  const newFamily = fontFamily ?? currentFontName.family;
  const newStyle = fontWeight ?? currentFontName.style;

  // Load the target font
  await figma.loadFontAsync({ family: newFamily, style: newStyle });

  const len = node!.characters.length;

  if (fontFamily || fontWeight) {
    node!.setRangeFontName(0, len, {
      family: newFamily,
      style: newStyle,
    });
  }

  if (typeof fontSize === "number") {
    node!.setRangeFontSize(0, len, fontSize);
  }

  if (typeof lineHeight === "number") {
    node!.setRangeLineHeight(0, len, {
      value: lineHeight,
      unit: "PIXELS",
    });
  }

  if (typeof letterSpacing === "number") {
    node!.setRangeLetterSpacing(0, len, {
      value: letterSpacing,
      unit: "PIXELS",
    });
  }

  return {
    success: true,
    data: {
      nodeId,
      fontFamily: newFamily,
      fontStyle: newStyle,
      fontSize: fontSize ?? node!.fontSize,
    },
  };
});

// ============================================================
// set_text_color
// ============================================================

registerExecutor("set_text_color", async (params) => {
  const nodeId = params.nodeId as string | undefined;
  const color = params.color as string | undefined;

  if (!nodeId) {
    return {
      success: false,
      error: "Required parameter 'nodeId' is missing.",
    };
  }

  if (!color) {
    return {
      success: false,
      error:
        "Required parameter 'color' is missing. Provide a hex color string (e.g., '#FF0000').",
    };
  }

  const { node, error } = getTextNodeOrError(nodeId);
  if (error) return { success: false, error };

  const rgb = hexToRgb(color);
  if (!rgb) {
    return {
      success: false,
      error: `Invalid hex color '${color}'. Expected format: '#RRGGBB' or '#RRGGBBAA' (e.g., '#FF0000').`,
    };
  }

  // Load font before modifying
  const fontName = node!.fontName as FontName;
  await figma.loadFontAsync(fontName);

  const len = node!.characters.length;
  node!.setRangeFills(0, len, [
    { type: "SOLID", color: rgb, visible: true },
  ]);

  return {
    success: true,
    data: { nodeId, color },
  };
});

// ============================================================
// set_text_alignment
// ============================================================

registerExecutor("set_text_alignment", async (params) => {
  const nodeId = params.nodeId as string | undefined;
  const horizontal = params.horizontal as string | undefined;
  const vertical = params.vertical as string | undefined;

  if (!nodeId) {
    return {
      success: false,
      error: "Required parameter 'nodeId' is missing.",
    };
  }

  if (!horizontal && !vertical) {
    return {
      success: false,
      error:
        "No alignment parameters provided. Provide at least one of: 'horizontal' (LEFT, CENTER, RIGHT, JUSTIFIED) or 'vertical' (TOP, CENTER, BOTTOM).",
    };
  }

  if (horizontal && !VALID_HORIZONTAL_ALIGN.includes(horizontal)) {
    return {
      success: false,
      error: `Invalid horizontal alignment '${horizontal}'. Must be one of: ${VALID_HORIZONTAL_ALIGN.join(", ")}.`,
    };
  }

  if (vertical && !VALID_VERTICAL_ALIGN.includes(vertical)) {
    return {
      success: false,
      error: `Invalid vertical alignment '${vertical}'. Must be one of: ${VALID_VERTICAL_ALIGN.join(", ")}.`,
    };
  }

  const { node, error } = getTextNodeOrError(nodeId);
  if (error) return { success: false, error };

  if (horizontal) {
    (node as unknown as Record<string, unknown>).textAlignHorizontal =
      horizontal;
  }
  if (vertical) {
    (node as unknown as Record<string, unknown>).textAlignVertical = vertical;
  }

  return {
    success: true,
    data: {
      nodeId,
      textAlignHorizontal: (node as unknown as Record<string, unknown>)
        .textAlignHorizontal,
      textAlignVertical: (node as unknown as Record<string, unknown>)
        .textAlignVertical,
    },
  };
});

// ============================================================
// find_replace_text
// ============================================================

registerExecutor("find_replace_text", async (params) => {
  const pattern = params.pattern as string | undefined;
  const replacement = params.replacement as string | undefined;
  const scope = params.scope as string | undefined;
  const useRegex = params.regex === true;

  if (typeof pattern !== "string") {
    return {
      success: false,
      error:
        "Required parameter 'pattern' is missing. Provide the text to find.",
    };
  }

  if (typeof replacement !== "string") {
    return {
      success: false,
      error:
        "Required parameter 'replacement' is missing. Provide the replacement text.",
    };
  }

  if (!scope) {
    return {
      success: false,
      error:
        "Required parameter 'scope' is missing. Use 'file', 'page', or a node ID to scope the search.",
    };
  }

  // Determine the search root
  let searchRoot: BaseNode;

  if (scope === "file" || scope === "page") {
    searchRoot = figma.currentPage;
  } else {
    // scope is a node ID
    const NODE_ID_PATTERN_LOCAL = /^\d+:\d+$/;
    if (!NODE_ID_PATTERN_LOCAL.test(scope)) {
      return {
        success: false,
        error: `Invalid node ID format '${scope}'. Expected format: '123:456'.`,
      };
    }

    const scopeNode = figma.getNodeById(scope);
    if (!scopeNode) {
      return {
        success: false,
        error: `Scope node '${scope}' not found.`,
      };
    }
    searchRoot = scopeNode;
  }

  // Find all text nodes under the search root
  let textNodes: BaseNode[];

  if ("findAll" in searchRoot) {
    textNodes = (searchRoot as ChildrenMixin).findAll(
      (node: BaseNode) => node.type === "TEXT"
    );
  } else if (searchRoot.type === "TEXT") {
    textNodes = [searchRoot];
  } else {
    textNodes = [];
  }

  let replacedCount = 0;
  const replacedNodes: { nodeId: string; oldText: string; newText: string }[] =
    [];

  for (const textNode of textNodes) {
    const tn = textNode as unknown as {
      id: string;
      characters: string;
      fontName: FontName;
    };
    const oldText = tn.characters;
    let newText: string;

    if (useRegex) {
      const regex = new RegExp(pattern, "g");
      newText = oldText.replace(regex, replacement);
    } else {
      newText = oldText.split(pattern).join(replacement);
    }

    if (newText !== oldText) {
      // Load font before modifying
      await figma.loadFontAsync(tn.fontName);
      tn.characters = newText;
      replacedCount++;
      replacedNodes.push({
        nodeId: tn.id,
        oldText,
        newText,
      });
    }
  }

  return {
    success: true,
    data: {
      replacedCount,
      replacedNodes,
    },
  };
});
