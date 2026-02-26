// plugin/executors/layout.ts
import { hexToRgb } from "../utils/color.js";
import { registerExecutor } from "./registry.js";

// ============================================================
// Types
// ============================================================

interface CommandResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

interface GridInput {
  pattern: string;
  count?: number;
  sectionSize?: number;
  offset?: number;
  gutterSize?: number;
  alignment?: string;
  color?: string;
}

// ============================================================
// Constants
// ============================================================

const VALID_DIRECTIONS = ["HORIZONTAL", "VERTICAL"];
const VALID_SIZING = ["FIXED", "HUG", "FILL"];
const VALID_ALIGN = ["MIN", "CENTER", "MAX", "SPACE_BETWEEN"];
const VALID_GRID_PATTERNS = ["COLUMNS", "ROWS", "GRID"];
const VALID_GRID_ALIGNMENTS = ["MIN", "MAX", "CENTER", "STRETCH"];
const FRAME_LIKE_TYPES = ["FRAME", "COMPONENT", "COMPONENT_SET", "INSTANCE"];

// ============================================================
// Main Dispatcher
// ============================================================

export async function executeLayoutCommand(
  command: string,
  params: Record<string, unknown>
): Promise<CommandResult> {
  switch (command) {
    case "set_auto_layout":
      return executeSetAutoLayout(params);
    case "add_to_auto_layout":
      return executeAddToAutoLayout(params);
    case "set_layout_grid":
      return executeSetLayoutGrid(params);
    case "group_nodes":
      return executeGroupNodes(params);
    case "ungroup_nodes":
      return executeUngroupNodes(params);
    default:
      return { success: false, error: `Unknown layout command: '${command}'` };
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

function isFrameLike(node: SceneNode): boolean {
  return FRAME_LIKE_TYPES.includes(node.type);
}

// ============================================================
// set_auto_layout
// ============================================================

function executeSetAutoLayout(params: Record<string, unknown>): CommandResult {
  const { node, error } = getNode(params.nodeId);
  if (!node) return { success: false, error };

  if (!isFrameLike(node)) {
    return {
      success: false,
      error: `Node '${params.nodeId}' is type '${node.type}'. Auto-layout can only be set on FRAME, COMPONENT, or INSTANCE nodes. Convert to a frame first using 'group_nodes' with type 'frame'.`,
    };
  }

  const direction = params.direction as string | undefined;
  if (direction && !VALID_DIRECTIONS.includes(direction)) {
    return {
      success: false,
      error: `Invalid direction '${direction}'. Must be one of: ${VALID_DIRECTIONS.join(", ")}.`,
    };
  }

  const frame = node as FrameNode;

  try {
    // Set direction (also enables auto-layout if currently NONE)
    if (direction) {
      frame.layoutMode = direction as "HORIZONTAL" | "VERTICAL";
    } else if (frame.layoutMode === "NONE") {
      // If no direction specified and not already auto-layout, default to VERTICAL
      frame.layoutMode = "VERTICAL";
    }

    // Spacing
    if (typeof params.spacing === "number") {
      frame.itemSpacing = params.spacing as number;
    }

    // Padding
    if (typeof params.paddingTop === "number") {
      frame.paddingTop = params.paddingTop as number;
    }
    if (typeof params.paddingRight === "number") {
      frame.paddingRight = params.paddingRight as number;
    }
    if (typeof params.paddingBottom === "number") {
      frame.paddingBottom = params.paddingBottom as number;
    }
    if (typeof params.paddingLeft === "number") {
      frame.paddingLeft = params.paddingLeft as number;
    }

    // Primary axis sizing: HUG → AUTO, FIXED → FIXED, FILL → FIXED (FILL is for children)
    if (params.primarySizing) {
      const sizing = params.primarySizing as string;
      if (!VALID_SIZING.includes(sizing)) {
        return {
          success: false,
          error: `Invalid primarySizing '${sizing}'. Must be one of: ${VALID_SIZING.join(", ")}.`,
        };
      }
      frame.primaryAxisSizingMode = sizing === "HUG" ? "AUTO" : "FIXED";
    }

    // Counter axis sizing
    if (params.counterSizing) {
      const sizing = params.counterSizing as string;
      if (!VALID_SIZING.includes(sizing)) {
        return {
          success: false,
          error: `Invalid counterSizing '${sizing}'. Must be one of: ${VALID_SIZING.join(", ")}.`,
        };
      }
      frame.counterAxisSizingMode = sizing === "HUG" ? "AUTO" : "FIXED";
    }

    // Alignment (maps to counter axis alignment for simplicity)
    if (params.alignment) {
      const alignment = params.alignment as string;
      if (!VALID_ALIGN.includes(alignment)) {
        return {
          success: false,
          error: `Invalid alignment '${alignment}'. Must be one of: ${VALID_ALIGN.join(", ")}.`,
        };
      }
      frame.counterAxisAlignItems = alignment as "MIN" | "CENTER" | "MAX";
    }

    // Wrap
    if (typeof params.wrap === "boolean") {
      frame.layoutWrap = params.wrap ? "WRAP" : "NO_WRAP";
    }

    return {
      success: true,
      data: {
        nodeId: node.id,
        layoutMode: frame.layoutMode,
        itemSpacing: frame.itemSpacing,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: `Failed to set auto-layout: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}

// ============================================================
// add_to_auto_layout
// ============================================================

function executeAddToAutoLayout(params: Record<string, unknown>): CommandResult {
  if (!params.parentId || typeof params.parentId !== "string") {
    return {
      success: false,
      error: "Missing required parameter 'parentId' (string). The ID of the auto-layout frame to add the child to.",
    };
  }

  if (!params.childId || typeof params.childId !== "string") {
    return {
      success: false,
      error: "Missing required parameter 'childId' (string). The ID of the node to add to the auto-layout frame.",
    };
  }

  const parent = figma.getNodeById(params.parentId as string);
  if (!parent) {
    return {
      success: false,
      error: `Parent node '${params.parentId}' not found. Verify the node ID exists in the current file.`,
    };
  }

  const child = figma.getNodeById(params.childId as string);
  if (!child) {
    return {
      success: false,
      error: `Child node '${params.childId}' not found. Verify the node ID exists in the current file.`,
    };
  }

  if (!("appendChild" in parent)) {
    return {
      success: false,
      error: `Parent node '${params.parentId}' (type: ${parent.type}) cannot contain children. Use a FRAME or GROUP node.`,
    };
  }

  try {
    const parentNode = parent as FrameNode;

    if (typeof params.index === "number") {
      parentNode.insertChild(params.index as number, child as SceneNode);
    } else {
      parentNode.appendChild(child as SceneNode);
    }

    return {
      success: true,
      data: {
        parentId: parent.id,
        childId: child.id,
        index: params.index ?? "end",
      },
    };
  } catch (e) {
    return {
      success: false,
      error: `Failed to add to auto-layout: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}

// ============================================================
// set_layout_grid
// ============================================================

function executeSetLayoutGrid(params: Record<string, unknown>): CommandResult {
  const { node, error } = getNode(params.nodeId);
  if (!node) return { success: false, error };

  if (!isFrameLike(node)) {
    return {
      success: false,
      error: `Node '${params.nodeId}' is type '${node.type}'. Layout grids can only be set on FRAME, COMPONENT, or INSTANCE nodes.`,
    };
  }

  if (!params.grids || !Array.isArray(params.grids)) {
    return {
      success: false,
      error: "Missing required parameter 'grids' (array of grid objects). Example: [{ pattern: 'COLUMNS', count: 12, gutterSize: 16 }]",
    };
  }

  const gridInputs = params.grids as GridInput[];

  try {
    const figmaGrids: LayoutGrid[] = gridInputs.map((input) => {
      if (!VALID_GRID_PATTERNS.includes(input.pattern)) {
        throw new Error(
          `Invalid grid pattern '${input.pattern}'. Must be one of: ${VALID_GRID_PATTERNS.join(", ")}.`
        );
      }

      const color = input.color
        ? { ...hexToRgb(input.color) }
        : { r: 1, g: 0, b: 0, a: 0.1 };

      if (input.pattern === "GRID") {
        return {
          pattern: "GRID",
          sectionSize: input.sectionSize || 8,
          visible: true,
          color,
        } as LayoutGrid;
      }

      // COLUMNS or ROWS
      const alignment = input.alignment || "STRETCH";
      if (!VALID_GRID_ALIGNMENTS.includes(alignment)) {
        throw new Error(
          `Invalid grid alignment '${alignment}'. Must be one of: ${VALID_GRID_ALIGNMENTS.join(", ")}.`
        );
      }

      return {
        pattern: input.pattern,
        alignment: alignment as "MIN" | "MAX" | "CENTER" | "STRETCH",
        gutterSize: input.gutterSize || 0,
        count: input.count || 1,
        sectionSize: input.sectionSize || 0,
        offset: input.offset || 0,
        visible: true,
        color,
      } as LayoutGrid;
    });

    (node as FrameNode).layoutGrids = figmaGrids;

    return {
      success: true,
      data: {
        nodeId: node.id,
        gridCount: figmaGrids.length,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: `Failed to set layout grid: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}

// ============================================================
// group_nodes
// ============================================================

function executeGroupNodes(params: Record<string, unknown>): CommandResult {
  if (!params.nodeIds || !Array.isArray(params.nodeIds)) {
    return {
      success: false,
      error: "Missing required parameter 'nodeIds' (array of strings). Provide at least 2 node IDs to group.",
    };
  }

  const nodeIds = params.nodeIds as string[];

  if (nodeIds.length < 2) {
    return {
      success: false,
      error: "Grouping requires at least 2 nodes. Provide 2 or more node IDs.",
    };
  }

  const groupType = params.type as string | undefined;
  if (!groupType || (groupType !== "group" && groupType !== "frame")) {
    return {
      success: false,
      error: `Missing or invalid 'type'. Must be 'group' or 'frame'.`,
    };
  }

  // Resolve all nodes
  const nodes: SceneNode[] = [];
  for (const id of nodeIds) {
    const node = figma.getNodeById(id);
    if (!node) {
      return {
        success: false,
        error: `Node '${id}' not found. All nodes must exist in the current file.`,
      };
    }
    nodes.push(node as SceneNode);
  }

  // All nodes must share the same parent
  const firstParent = nodes[0].parent;
  if (!firstParent) {
    return {
      success: false,
      error: `Node '${nodeIds[0]}' has no parent. Cannot group root-level nodes.`,
    };
  }

  try {
    if (groupType === "group") {
      const group = figma.group(nodes, firstParent as BaseNode & ChildrenMixin);
      if (params.name && typeof params.name === "string") {
        group.name = params.name as string;
      }
      return {
        success: true,
        data: {
          nodeId: group.id,
          type: "GROUP",
          name: group.name,
          childCount: nodes.length,
        },
      };
    }

    // Frame mode: create a frame, position it to encompass all nodes, reparent
    const frame = figma.createFrame();
    frame.name = (params.name as string) || "Frame";

    // Calculate bounding box of all nodes
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const node of nodes) {
      const n = node as SceneNode & { x: number; y: number; width: number; height: number };
      minX = Math.min(minX, n.x);
      minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x + n.width);
      maxY = Math.max(maxY, n.y + n.height);
    }

    frame.x = minX;
    frame.y = minY;
    frame.resize(maxX - minX, maxY - minY);

    // Insert frame at the parent level
    if ("appendChild" in firstParent) {
      (firstParent as FrameNode).appendChild(frame);
    }

    // Reparent children into the frame, adjusting positions
    for (const node of nodes) {
      const n = node as SceneNode & { x: number; y: number };
      n.x -= minX;
      n.y -= minY;
      frame.appendChild(node);
    }

    return {
      success: true,
      data: {
        nodeId: frame.id,
        type: "FRAME",
        name: frame.name,
        childCount: nodes.length,
        bounds: { x: minX, y: minY, width: maxX - minX, height: maxY - minY },
      },
    };
  } catch (e) {
    return {
      success: false,
      error: `Failed to group nodes: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}

// ============================================================
// ungroup_nodes
// ============================================================

function executeUngroupNodes(params: Record<string, unknown>): CommandResult {
  const { node, error } = getNode(params.nodeId);
  if (!node) return { success: false, error };

  if (!("children" in node)) {
    return {
      success: false,
      error: `Node '${params.nodeId}' (type: ${node.type}) has no children and cannot be ungrouped. Use a GROUP or FRAME node.`,
    };
  }

  const containerNode = node as FrameNode | GroupNode;

  if (!containerNode.parent) {
    return {
      success: false,
      error: `Node '${params.nodeId}' has no parent. Cannot ungroup a root-level node.`,
    };
  }

  try {
    const parent = containerNode.parent as BaseNode & ChildrenMixin;
    const children = [...containerNode.children]; // Copy to avoid mutation during iteration

    // Move all children to the parent
    for (const child of children) {
      // Adjust position relative to the container's position in the parent
      if ("x" in containerNode && "x" in child) {
        (child as SceneNode & { x: number; y: number }).x += (containerNode as FrameNode).x;
        (child as SceneNode & { x: number; y: number }).y += (containerNode as FrameNode).y;
      }
      parent.appendChild(child);
    }

    // Remove the now-empty container
    containerNode.remove();

    return {
      success: true,
      data: {
        removedNodeId: params.nodeId,
        childrenMoved: children.map((c) => c.id),
      },
    };
  } catch (e) {
    return {
      success: false,
      error: `Failed to ungroup: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}

// ============================================================
// Register all layout commands in the executor registry
// ============================================================

const LAYOUT_COMMANDS = [
  "set_auto_layout",
  "add_to_auto_layout",
  "set_layout_grid",
  "group_nodes",
  "ungroup_nodes",
] as const;

for (const cmd of LAYOUT_COMMANDS) {
  registerExecutor(cmd, (params) => executeLayoutCommand(cmd, params));
}
