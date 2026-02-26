// plugin/executors/vectors.ts
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

const VALID_BOOLEAN_OPS = ["UNION", "SUBTRACT", "INTERSECT", "EXCLUDE"] as const;
type BooleanOp = (typeof VALID_BOOLEAN_OPS)[number];

// ============================================================
// boolean_operation
// ============================================================

export async function booleanOperation(
  params: Record<string, unknown>
): Promise<CommandResult> {
  const nodeIds = params.nodeIds as string[] | undefined;
  const operation = params.operation as string | undefined;

  if (!nodeIds || !Array.isArray(nodeIds)) {
    return errorResponse(
      "Missing required parameter: nodeIds (array of node IDs to combine)"
    );
  }

  if (nodeIds.length < 2) {
    return errorResponse(
      `Boolean operations require at least 2 nodes, but got ${nodeIds.length}. ` +
        `Provide 2 or more node IDs to combine.`
    );
  }

  if (!operation) {
    return errorResponse(
      "Missing required parameter: operation (UNION, SUBTRACT, INTERSECT, or EXCLUDE)"
    );
  }

  if (!VALID_BOOLEAN_OPS.includes(operation as BooleanOp)) {
    return errorResponse(
      `Invalid operation '${operation}'. ` +
        `Must be one of: ${VALID_BOOLEAN_OPS.join(", ")}`
    );
  }

  // Resolve all nodes
  const nodes: SceneNode[] = [];
  for (const id of nodeIds) {
    const node = getNode(id);
    if (!node) {
      return errorResponse(
        `Node '${id}' not found. Verify the node ID is correct and the node exists on the current page.`
      );
    }
    nodes.push(node);
  }

  // All nodes must share the same parent for boolean operations
  const parent = nodes[0].parent;
  if (!parent) {
    return errorResponse(
      `Node '${nodes[0].id}' has no parent. Nodes must be on a page or inside a frame.`
    );
  }

  const mismatch = nodes.find((n) => n.parent?.id !== parent.id);
  if (mismatch) {
    return errorResponse(
      `All nodes must share the same parent for a boolean operation. ` +
        `Node '${mismatch.id}' (${mismatch.name}) is in a different container. ` +
        `Move all nodes into the same frame or page before combining them.`
    );
  }

  // Perform the boolean operation
  let result: BooleanOperationNode;

  switch (operation as BooleanOp) {
    case "UNION":
      result = figma.union(
        nodes,
        parent as BaseNode & ChildrenMixin
      );
      break;
    case "SUBTRACT":
      result = figma.subtract(
        nodes,
        parent as BaseNode & ChildrenMixin
      );
      break;
    case "INTERSECT":
      result = figma.intersect(
        nodes,
        parent as BaseNode & ChildrenMixin
      );
      break;
    case "EXCLUDE":
      result = figma.exclude(
        nodes,
        parent as BaseNode & ChildrenMixin
      );
      break;
  }

  return successResponse({
    nodeId: result.id,
    name: result.name,
    type: "BOOLEAN_OPERATION",
    operation,
    x: result.x,
    y: result.y,
    width: result.width,
    height: result.height,
  });
}

// ============================================================
// flatten_node
// ============================================================

export async function flattenNode(
  params: Record<string, unknown>
): Promise<CommandResult> {
  const nodeId = params.nodeId as string | undefined;

  if (!nodeId) {
    return errorResponse("Missing required parameter: nodeId");
  }

  const node = getNode(nodeId);
  if (!node) {
    return errorResponse(
      `Node '${nodeId}' not found. Verify the node ID is correct and the node exists on the current page.`
    );
  }

  const vector = figma.flatten([node]);

  return successResponse({
    nodeId: vector.id,
    name: vector.name,
    type: "VECTOR",
    x: vector.x,
    y: vector.y,
    width: vector.width,
    height: vector.height,
  });
}

// ============================================================
// set_mask
// ============================================================

export async function setMask(
  params: Record<string, unknown>
): Promise<CommandResult> {
  const nodeId = params.nodeId as string | undefined;
  const isMask = params.isMask as boolean | undefined;

  if (!nodeId) {
    return errorResponse("Missing required parameter: nodeId");
  }

  if (isMask === undefined || typeof isMask !== "boolean") {
    return errorResponse(
      "Missing required parameter: isMask (boolean — true to set as mask, false to remove mask)"
    );
  }

  const node = getNode(nodeId);
  if (!node) {
    return errorResponse(
      `Node '${nodeId}' not found. Verify the node ID is correct and the node exists on the current page.`
    );
  }

  // Verify the node is inside a group or frame (not a direct page child)
  const parent = node.parent;
  if (
    !parent ||
    (parent.type !== "FRAME" &&
      parent.type !== "GROUP" &&
      parent.type !== "COMPONENT" &&
      parent.type !== "INSTANCE" &&
      parent.type !== "SECTION" &&
      parent.type !== "BOOLEAN_OPERATION")
  ) {
    return errorResponse(
      `Node '${nodeId}' (${node.name}) must be inside a group or frame to be used as a mask. ` +
        `Currently its parent is ${parent ? `a ${parent.type}` : "none"} — ` +
        `move the node into a frame or group first.`
    );
  }

  // Check that the node supports isMask
  if (!("isMask" in node)) {
    return errorResponse(
      `Node '${nodeId}' (${node.name}) of type ${node.type} does not support the mask property.`
    );
  }

  (node as SceneNode & { isMask: boolean }).isMask = isMask;

  return successResponse({
    nodeId: node.id,
    name: node.name,
    type: node.type,
    isMask,
  });
}

// ============================================================
// Register all vector commands in the executor registry
// ============================================================

registerExecutor("boolean_operation", (p) => booleanOperation(p));
registerExecutor("flatten_node", (p) => flattenNode(p));
registerExecutor("set_mask", (p) => setMask(p));
