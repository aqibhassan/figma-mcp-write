// plugin/executors/layers.ts
import { registerExecutor } from "./registry.js";

// ============================================================
// Helpers
// ============================================================

const NODE_ID_PATTERN = /^\d+:\d+$/;

const VALID_NODE_TYPES = [
  "FRAME",
  "RECTANGLE",
  "ELLIPSE",
  "LINE",
  "POLYGON",
  "STAR",
] as const;

type CreateNodeType = (typeof VALID_NODE_TYPES)[number];

function validateNodeId(nodeId: unknown): string | null {
  if (typeof nodeId !== "string" || !nodeId) {
    return "Required parameter 'nodeId' is missing or not a string.";
  }
  if (!NODE_ID_PATTERN.test(nodeId)) {
    return `Invalid node ID format '${nodeId}'. Expected format: '123:456'.`;
  }
  return null;
}

function getNodeOrError(nodeId: string): {
  node?: SceneNode;
  error?: string;
} {
  const validationError = validateNodeId(nodeId);
  if (validationError) return { error: validationError };

  const node = figma.getNodeById(nodeId);
  if (!node) {
    return { error: `Node '${nodeId}' not found. It may have been deleted.` };
  }
  return { node: node as SceneNode };
}

function resolveParent(
  parentId: string | undefined
): { parent?: SceneNode & ChildrenMixin; error?: string } {
  if (!parentId) {
    return { parent: figma.currentPage as unknown as SceneNode & ChildrenMixin };
  }

  const validationError = validateNodeId(parentId);
  if (validationError) return { error: validationError };

  const parentNode = figma.getNodeById(parentId);
  if (!parentNode) {
    return {
      error: `Parent node '${parentId}' not found. It may have been deleted.`,
    };
  }
  if (!("children" in parentNode)) {
    return {
      error: `Node '${parentId}' (${parentNode.type}) cannot have children. Use a FRAME or GROUP as parent.`,
    };
  }

  return { parent: parentNode as SceneNode & ChildrenMixin };
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
// create_node
// ============================================================

registerExecutor("create_node", async (params) => {
  const type = params.type as string | undefined;

  if (!type) {
    return {
      success: false,
      error:
        "Required parameter 'type' is missing. Must be one of: FRAME, RECTANGLE, ELLIPSE, LINE, POLYGON, STAR.",
    };
  }

  if (!VALID_NODE_TYPES.includes(type as CreateNodeType)) {
    return {
      success: false,
      error: `Invalid node type '${type}'. Must be one of: ${VALID_NODE_TYPES.join(", ")}.`,
    };
  }

  const { parent, error: parentError } = resolveParent(
    params.parentId as string | undefined
  );
  if (parentError) return { success: false, error: parentError };

  let node: SceneNode;

  switch (type) {
    case "FRAME":
      node = figma.createFrame();
      break;
    case "RECTANGLE":
      node = figma.createRectangle();
      break;
    case "ELLIPSE":
      node = figma.createEllipse();
      break;
    case "LINE":
      node = figma.createLine();
      break;
    case "POLYGON":
      node = figma.createPolygon();
      break;
    case "STAR":
      node = figma.createStar();
      break;
    default:
      return { success: false, error: `Unsupported type '${type}'.` };
  }

  // Apply optional properties
  type ResizableNode = SceneNode & { resize(w: number, h: number): void; width: number; height: number };
  if (typeof params.name === "string") node.name = params.name;
  if (typeof params.x === "number") node.x = params.x;
  if (typeof params.y === "number") node.y = params.y;
  if (typeof params.width === "number" && typeof params.height === "number") {
    (node as unknown as ResizableNode).resize(params.width as number, params.height as number);
  } else if (typeof params.width === "number") {
    (node as unknown as ResizableNode).resize(params.width as number, (node as unknown as ResizableNode).height);
  } else if (typeof params.height === "number") {
    (node as unknown as ResizableNode).resize((node as unknown as ResizableNode).width, params.height as number);
  }

  // Reparent if needed (createX always adds to currentPage first)
  if (params.parentId) {
    (parent as ChildrenMixin).appendChild(node as unknown as SceneNode);
  }

  const resizable = node as unknown as ResizableNode;
  return {
    success: true,
    data: {
      nodeId: node.id,
      type: node.type,
      name: node.name,
      x: node.x,
      y: node.y,
      width: resizable.width,
      height: resizable.height,
    },
  };
});

// ============================================================
// create_text
// ============================================================

registerExecutor("create_text", async (params) => {
  const text = params.text as string | undefined;

  if (typeof text !== "string") {
    return {
      success: false,
      error:
        "Required parameter 'text' is missing. Provide the text content for the new text node.",
    };
  }

  const fontFamily =
    typeof params.fontFamily === "string" ? params.fontFamily : "Inter";
  const fontStyle = "Regular";
  const fontSize =
    typeof params.fontSize === "number" ? params.fontSize : 16;

  const { parent, error: parentError } = resolveParent(
    params.parentId as string | undefined
  );
  if (parentError) return { success: false, error: parentError };

  // Must load font before modifying text
  await figma.loadFontAsync({ family: fontFamily, style: fontStyle });

  const textNode = figma.createText();
  textNode.fontName = { family: fontFamily, style: fontStyle };
  textNode.fontSize = fontSize;
  textNode.characters = text;

  if (typeof params.name === "string") textNode.name = params.name;
  if (typeof params.x === "number") textNode.x = params.x;
  if (typeof params.y === "number") textNode.y = params.y;

  // Apply color if provided
  if (typeof params.color === "string") {
    const hex = params.color as string;
    const rgb = hexToRgb(hex);
    if (rgb) {
      textNode.fills = [
        { type: "SOLID", color: rgb, visible: true },
      ] as Paint[];
    }
  }

  // Reparent if needed
  if (params.parentId) {
    (parent as ChildrenMixin).appendChild(textNode as unknown as SceneNode);
  }

  return {
    success: true,
    data: {
      nodeId: textNode.id,
      type: "TEXT",
      name: textNode.name,
      characters: textNode.characters,
      fontFamily,
      fontSize,
    },
  };
});

// ============================================================
// delete_node
// ============================================================

registerExecutor("delete_node", async (params) => {
  const nodeId = params.nodeId as string | undefined;

  if (!nodeId) {
    return {
      success: false,
      error: "Required parameter 'nodeId' is missing.",
    };
  }

  const { node, error } = getNodeOrError(nodeId);
  if (error) return { success: false, error };

  const name = node!.name;
  node!.remove();

  return {
    success: true,
    data: { deleted: true, nodeId, name },
  };
});

// ============================================================
// duplicate_node
// ============================================================

registerExecutor("duplicate_node", async (params) => {
  const nodeId = params.nodeId as string | undefined;

  if (!nodeId) {
    return {
      success: false,
      error: "Required parameter 'nodeId' is missing.",
    };
  }

  const { node, error } = getNodeOrError(nodeId);
  if (error) return { success: false, error };

  const cloned = node!.clone();

  // Apply offset if provided
  if (typeof params.offsetX === "number") {
    cloned.x = node!.x + (params.offsetX as number);
  }
  if (typeof params.offsetY === "number") {
    cloned.y = node!.y + (params.offsetY as number);
  }

  return {
    success: true,
    data: {
      nodeId: cloned.id,
      originalNodeId: nodeId,
      name: cloned.name,
      x: cloned.x,
      y: cloned.y,
    },
  };
});

// ============================================================
// move_node
// ============================================================

registerExecutor("move_node", async (params) => {
  const nodeId = params.nodeId as string | undefined;

  if (!nodeId) {
    return {
      success: false,
      error: "Required parameter 'nodeId' is missing.",
    };
  }

  const { node, error } = getNodeOrError(nodeId);
  if (error) return { success: false, error };

  const hasAbsolute =
    typeof params.x === "number" || typeof params.y === "number";
  const hasRelative =
    typeof params.relativeX === "number" ||
    typeof params.relativeY === "number";

  if (!hasAbsolute && !hasRelative) {
    return {
      success: false,
      error:
        "No position parameters provided. Use 'x'/'y' for absolute or 'relativeX'/'relativeY' for relative positioning.",
    };
  }

  if (hasAbsolute) {
    if (typeof params.x === "number") node!.x = params.x as number;
    if (typeof params.y === "number") node!.y = params.y as number;
  }

  if (hasRelative) {
    if (typeof params.relativeX === "number")
      node!.x += params.relativeX as number;
    if (typeof params.relativeY === "number")
      node!.y += params.relativeY as number;
  }

  return {
    success: true,
    data: { nodeId, x: node!.x, y: node!.y },
  };
});

// ============================================================
// resize_node
// ============================================================

registerExecutor("resize_node", async (params) => {
  const nodeId = params.nodeId as string | undefined;

  if (!nodeId) {
    return {
      success: false,
      error: "Required parameter 'nodeId' is missing.",
    };
  }

  const { node, error } = getNodeOrError(nodeId);
  if (error) return { success: false, error };

  const newWidth =
    typeof params.width === "number" ? (params.width as number) : null;
  const newHeight =
    typeof params.height === "number" ? (params.height as number) : null;

  if (newWidth === null && newHeight === null) {
    return {
      success: false,
      error:
        "At least one of 'width' or 'height' must be provided.",
    };
  }

  if ((newWidth !== null && newWidth <= 0) || (newHeight !== null && newHeight <= 0)) {
    return {
      success: false,
      error: "Dimensions must be positive numbers.",
    };
  }

  type ResizableNode2 = SceneNode & { resize(w: number, h: number): void; width: number; height: number };
  const resizableNode = node! as unknown as ResizableNode2;
  const finalWidth = newWidth ?? resizableNode.width;
  const finalHeight = newHeight ?? resizableNode.height;

  resizableNode.resize(finalWidth, finalHeight);

  return {
    success: true,
    data: {
      nodeId,
      width: resizableNode.width,
      height: resizableNode.height,
    },
  };
});

// ============================================================
// rename_node
// ============================================================

registerExecutor("rename_node", async (params) => {
  const nodeId = params.nodeId as string | undefined;
  const name = params.name as string | undefined;

  if (!nodeId) {
    return {
      success: false,
      error: "Required parameter 'nodeId' is missing.",
    };
  }

  if (typeof name !== "string" || !name) {
    return {
      success: false,
      error:
        "Required parameter 'name' is missing or empty.",
    };
  }

  const { node, error } = getNodeOrError(nodeId);
  if (error) return { success: false, error };

  const oldName = node!.name;
  node!.name = name;

  return {
    success: true,
    data: { nodeId, oldName, newName: name },
  };
});

// ============================================================
// reorder_node
// ============================================================

registerExecutor("reorder_node", async (params) => {
  const nodeId = params.nodeId as string | undefined;
  const position = params.position;

  if (!nodeId) {
    return {
      success: false,
      error: "Required parameter 'nodeId' is missing.",
    };
  }

  if (position === undefined || position === null) {
    return {
      success: false,
      error:
        "Required parameter 'position' is missing. Use 'front', 'back', or a number.",
    };
  }

  const { node, error } = getNodeOrError(nodeId);
  if (error) return { success: false, error };

  const parentNode = node!.parent;
  if (!parentNode || !("children" in parentNode)) {
    return {
      success: false,
      error:
        "Cannot reorder a node without a parent container. The node must be inside a frame, group, or page.",
    };
  }

  const siblings = (parentNode as ChildrenMixin & BaseNode).children as SceneNode[];
  const currentIndex = siblings.indexOf(node as unknown as SceneNode);

  if (currentIndex === -1) {
    return {
      success: false,
      error: "Node not found in parent's children list.",
    };
  }

  // Remove from current position
  siblings.splice(currentIndex, 1);

  let targetIndex: number;

  if (position === "front") {
    targetIndex = siblings.length; // Last = visually on top
    siblings.push(node as unknown as SceneNode);
  } else if (position === "back") {
    targetIndex = 0; // First = visually on bottom
    siblings.unshift(node as unknown as SceneNode);
  } else if (typeof position === "number") {
    targetIndex = Math.max(0, Math.min(position, siblings.length));
    siblings.splice(targetIndex, 0, node as unknown as SceneNode);
  } else {
    // Put it back where it was
    siblings.splice(currentIndex, 0, node as unknown as SceneNode);
    return {
      success: false,
      error:
        "Parameter 'position' must be 'front', 'back', or a number.",
    };
  }

  return {
    success: true,
    data: { nodeId, position: targetIndex },
  };
});
