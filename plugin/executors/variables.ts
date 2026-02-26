// plugin/executors/variables.ts
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

const VALID_RESOLVED_TYPES = [
  "COLOR",
  "FLOAT",
  "STRING",
  "BOOLEAN",
] as const;
type ResolvedType = (typeof VALID_RESOLVED_TYPES)[number];

// ============================================================
// create_variable_collection
// ============================================================

export async function createVariableCollection(
  params: Record<string, unknown>
): Promise<CommandResult> {
  const name = params.name as string | undefined;
  const modes = params.modes as string[] | undefined;

  if (!name || typeof name !== "string" || name.trim() === "") {
    return errorResponse(
      "Missing required parameter: name (non-empty string for the variable collection)"
    );
  }

  const collection = figma.variables.createVariableCollection(name.trim());

  // If modes are requested, rename the auto-created first mode and add the rest
  if (modes && Array.isArray(modes) && modes.length > 0) {
    // Figma creates a default mode automatically — rename it to the first requested name
    if (collection.modes.length > 0) {
      collection.renameMode(collection.modes[0].modeId, modes[0]);
    }
    // Add remaining modes
    for (let i = 1; i < modes.length; i++) {
      collection.addMode(modes[i]);
    }
  }

  return successResponse({
    collectionId: collection.id,
    name: collection.name,
    modes: collection.modes.map((m) => ({
      modeId: m.modeId,
      name: m.name,
    })),
  });
}

// ============================================================
// create_variable
// ============================================================

export async function createVariable(
  params: Record<string, unknown>
): Promise<CommandResult> {
  const name = params.name as string | undefined;
  const collectionId = params.collectionId as string | undefined;
  const resolvedType = params.resolvedType as string | undefined;
  const value = params.value;

  if (!name || typeof name !== "string" || name.trim() === "") {
    return errorResponse(
      "Missing required parameter: name (non-empty string for the variable name)"
    );
  }

  if (!collectionId) {
    return errorResponse(
      "Missing required parameter: collectionId (ID of the variable collection)"
    );
  }

  if (!resolvedType) {
    return errorResponse(
      "Missing required parameter: resolvedType (COLOR, FLOAT, STRING, or BOOLEAN)"
    );
  }

  if (!VALID_RESOLVED_TYPES.includes(resolvedType as ResolvedType)) {
    return errorResponse(
      `Invalid resolvedType '${resolvedType}'. Must be one of: ${VALID_RESOLVED_TYPES.join(", ")}`
    );
  }

  // Verify collection exists
  const collection =
    figma.variables.getVariableCollectionById(collectionId);
  if (!collection) {
    return errorResponse(
      `Variable collection '${collectionId}' not found. ` +
        `Create a collection first with create_variable_collection, or verify the collection ID.`
    );
  }

  const variable = figma.variables.createVariable(
    name.trim(),
    collectionId,
    resolvedType as ResolvedType
  );

  // Set initial value if provided
  if (value !== undefined && collection.modes.length > 0) {
    const defaultModeId = collection.modes[0].modeId;
    try {
      variable.setValueForMode(defaultModeId, value);
    } catch (err) {
      return errorResponse(
        `Variable '${name}' created but failed to set initial value: ` +
          `${err instanceof Error ? err.message : String(err)}. ` +
          `Ensure the value type matches resolvedType '${resolvedType}'.`
      );
    }
  }

  return successResponse({
    variableId: variable.id,
    name: variable.name,
    resolvedType: variable.resolvedType,
    collectionId: variable.variableCollectionId,
  });
}

// ============================================================
// set_variable_value
// ============================================================

export async function setVariableValue(
  params: Record<string, unknown>
): Promise<CommandResult> {
  const variableId = params.variableId as string | undefined;
  const modeId = params.modeId as string | undefined;
  const value = params.value;

  if (!variableId) {
    return errorResponse(
      "Missing required parameter: variableId (ID of the variable to update)"
    );
  }

  if (!modeId) {
    return errorResponse(
      "Missing required parameter: modeId (ID of the mode to set the value for)"
    );
  }

  if (value === undefined) {
    return errorResponse(
      "Missing required parameter: value (the value to set for this variable in the specified mode)"
    );
  }

  const variable = figma.variables.getVariableById(variableId);
  if (!variable) {
    return errorResponse(
      `Variable '${variableId}' not found. Verify the variable ID is correct. ` +
        `Use figma_variables with command 'create_variable' to create one first.`
    );
  }

  variable.setValueForMode(modeId, value);

  return successResponse({
    variableId: variable.id,
    name: variable.name,
    modeId,
    value,
  });
}

// ============================================================
// bind_variable
// ============================================================

export async function bindVariable(
  params: Record<string, unknown>
): Promise<CommandResult> {
  const nodeId = params.nodeId as string | undefined;
  const property = params.property as string | undefined;
  const variableId = params.variableId as string | undefined;

  if (!nodeId) {
    return errorResponse("Missing required parameter: nodeId");
  }

  if (!property) {
    return errorResponse(
      "Missing required parameter: property (the node property to bind, e.g., 'fills', 'cornerRadius', 'itemSpacing', 'opacity')"
    );
  }

  if (!variableId) {
    return errorResponse(
      "Missing required parameter: variableId (ID of the variable to bind)"
    );
  }

  const node = getNode(nodeId);
  if (!node) {
    return errorResponse(
      `Node '${nodeId}' not found. Verify the node ID is correct and the node exists on the current page.`
    );
  }

  const variable = figma.variables.getVariableById(variableId);
  if (!variable) {
    return errorResponse(
      `Variable '${variableId}' not found. Verify the variable ID is correct. ` +
        `Use figma_variables with command 'create_variable' to create one first.`
    );
  }

  try {
    (node as SceneNode & { setBoundVariable: (field: string, variable: Variable) => void })
      .setBoundVariable(property, variable as unknown as Variable);
  } catch (err) {
    return errorResponse(
      `Failed to bind variable '${variable.name}' to property '${property}' on node '${nodeId}': ` +
        `${err instanceof Error ? err.message : String(err)}. ` +
        `Ensure the property exists on this node type and the variable type is compatible.`
    );
  }

  return successResponse({
    nodeId: node.id,
    name: node.name,
    property,
    variableId: variable.id,
    variableName: variable.name,
  });
}

// ============================================================
// Register all variable commands in the executor registry
// ============================================================

registerExecutor("create_variable_collection", (p) => createVariableCollection(p));
registerExecutor("create_variable", (p) => createVariable(p));
registerExecutor("set_variable_value", (p) => setVariableValue(p));
registerExecutor("bind_variable", (p) => bindVariable(p));
