// plugin/executors/reading.ts
import { registerExecutor } from "./registry.js";

// ============================================================
// Helpers
// ============================================================

const NODE_ID_PATTERN = /^\d+:\d+$/;

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

function serializeNode(
  node: BaseNode & Record<string, unknown>,
  depth: number = 0
): Record<string, unknown> {
  const result: Record<string, unknown> = {
    id: node.id,
    name: node.name,
    type: node.type,
  };

  // Position and size (if applicable)
  if ("x" in node) result.x = node.x;
  if ("y" in node) result.y = node.y;
  if ("width" in node) result.width = node.width;
  if ("height" in node) result.height = node.height;

  // Visibility and opacity
  if ("visible" in node) result.visible = node.visible;
  if ("opacity" in node) result.opacity = node.opacity;

  // Text properties
  if (node.type === "TEXT") {
    if ("characters" in node) result.characters = node.characters;
    if ("fontSize" in node) result.fontSize = typeof node.fontSize === "symbol" ? "mixed" : node.fontSize;
    if ("fontName" in node) result.fontName = typeof node.fontName === "symbol" ? "mixed" : node.fontName;
    if ("textAlignHorizontal" in node)
      result.textAlignHorizontal = typeof node.textAlignHorizontal === "symbol" ? "mixed" : node.textAlignHorizontal;
    if ("textAlignVertical" in node)
      result.textAlignVertical = typeof node.textAlignVertical === "symbol" ? "mixed" : node.textAlignVertical;
  }

  // Fills — clone to strip non-serializable Symbol properties
  if ("fills" in node) {
    try {
      result.fills = JSON.parse(JSON.stringify(node.fills));
    } catch {
      result.fills = [];
    }
  }

  // Children
  if (depth > 0 && "children" in node) {
    const children = node.children as BaseNode[];
    result.children = children.map((child) =>
      serializeNode(child as BaseNode & Record<string, unknown>, depth - 1)
    );
  } else if ("children" in node) {
    const children = node.children as BaseNode[];
    result.childCount = children.length;
  }

  return result;
}

// ============================================================
// get_node
// ============================================================

registerExecutor("get_node", async (params) => {
  const nodeId = params.nodeId as string | undefined;

  if (!nodeId) {
    return {
      success: false,
      error: "Required parameter 'nodeId' is missing.",
    };
  }

  const { node, error } = getNodeOrError(nodeId);
  if (error) return { success: false, error };

  const depth =
    typeof params.depth === "number" ? params.depth : 0;

  const data = serializeNode(
    node as unknown as BaseNode & Record<string, unknown>,
    depth
  );

  return { success: true, data };
});

// ============================================================
// get_selection
// ============================================================

registerExecutor("get_selection", async (_params) => {
  const selection = figma.currentPage.selection;
  const nodes = selection.map((node) =>
    serializeNode(node as unknown as BaseNode & Record<string, unknown>, 0)
  );

  return {
    success: true,
    data: { nodes },
  };
});

// ============================================================
// get_page_nodes
// ============================================================

registerExecutor("get_page_nodes", async (params) => {
  const typeFilter = params.typeFilter as string | undefined;
  const depth =
    typeof params.depth === "number" ? params.depth : 0;

  const page = figma.currentPage;
  let nodes: BaseNode[];

  if (typeFilter) {
    nodes = page.findAll(
      (node) => node.type === typeFilter
    );
  } else {
    nodes = page.findAll();
  }

  const serialized = nodes.map((node) =>
    serializeNode(node as unknown as BaseNode & Record<string, unknown>, depth)
  );

  return {
    success: true,
    data: { nodes: serialized },
  };
});

// ============================================================
// search_nodes
// ============================================================

registerExecutor("search_nodes", async (params) => {
  const query = params.query as string | undefined;
  const searchIn = params.searchIn as string | undefined;

  if (!query) {
    return {
      success: false,
      error:
        "Required parameter 'query' is missing. Provide the search term.",
    };
  }

  if (!searchIn || !["name", "type", "text"].includes(searchIn)) {
    return {
      success: false,
      error:
        "Required parameter 'searchIn' must be one of: 'name', 'type', 'text'.",
    };
  }

  const page = figma.currentPage;
  let results: BaseNode[];

  switch (searchIn) {
    case "name":
      results = page.findAll(
        (node) =>
          node.name.toLowerCase().includes(query.toLowerCase())
      );
      break;
    case "type":
      results = page.findAll(
        (node) => node.type === query.toUpperCase()
      );
      break;
    case "text":
      results = page.findAll(
        (node) =>
          node.type === "TEXT" &&
          "characters" in node &&
          (node as unknown as { characters: string }).characters
            .toLowerCase()
            .includes(query.toLowerCase())
      );
      break;
    default:
      results = [];
  }

  const serialized = results.map((node) =>
    serializeNode(node as unknown as BaseNode & Record<string, unknown>, 0)
  );

  return {
    success: true,
    data: { nodes: serialized },
  };
});

// ============================================================
// scroll_to_node
// ============================================================

registerExecutor("scroll_to_node", async (params) => {
  const nodeId = params.nodeId as string | undefined;

  if (!nodeId) {
    return {
      success: false,
      error: "Required parameter 'nodeId' is missing.",
    };
  }

  const { node, error } = getNodeOrError(nodeId);
  if (error) return { success: false, error };

  figma.viewport.scrollAndZoomIntoView([node!]);

  return {
    success: true,
    data: { nodeId: node!.id, scrolledTo: true },
  };
});
