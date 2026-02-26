// plugin/executors/components.ts
import { registerExecutor } from "./registry.js";

interface CommandResponse {
  id?: string;
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

function errorResponse(error: string): CommandResponse {
  return { success: false, error };
}

function successResponse(data: unknown): CommandResponse {
  return { success: true, data };
}

function serializeNode(
  node: SceneNode
): Record<string, unknown> {
  const base: Record<string, unknown> = {
    nodeId: node.id,
    name: node.name,
    type: node.type,
  };
  if ("x" in node) base.x = node.x;
  if ("y" in node) base.y = node.y;
  if ("width" in node) base.width = node.width;
  if ("height" in node) base.height = node.height;
  return base;
}

// ============================================================
// create_component
// ============================================================

export async function createComponent(
  params: Record<string, unknown>
): Promise<CommandResponse> {
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

  if (node.type === "COMPONENT") {
    return errorResponse(
      `Node '${nodeId}' is already a COMPONENT. No conversion needed.`
    );
  }

  if (node.type !== "FRAME" && node.type !== "GROUP") {
    return errorResponse(
      `Node '${nodeId}' is a ${node.type}, but must be a FRAME or GROUP to convert to a component. ` +
        `Only frames and groups can be converted to components.`
    );
  }

  // Create a new component and copy properties from the source node
  const component = figma.createComponent();
  component.name = node.name;

  // Copy geometric properties
  component.x = node.x;
  component.y = node.y;
  component.resize(node.width, node.height);

  // Copy children from source to component
  const sourceWithChildren = node as FrameNode | GroupNode;
  const childrenToMove = [...sourceWithChildren.children];
  for (const child of childrenToMove) {
    component.appendChild(child);
  }

  // Copy layout properties if source is a frame
  if (node.type === "FRAME") {
    const frame = node as FrameNode;
    component.layoutMode = frame.layoutMode;
    if (frame.layoutMode !== "NONE") {
      component.itemSpacing = frame.itemSpacing;
      component.paddingTop = frame.paddingTop;
      component.paddingRight = frame.paddingRight;
      component.paddingBottom = frame.paddingBottom;
      component.paddingLeft = frame.paddingLeft;
      component.primaryAxisAlignItems = frame.primaryAxisAlignItems;
      component.counterAxisAlignItems = frame.counterAxisAlignItems;
    }
    component.fills = frame.fills as Paint[];
    component.strokes = frame.strokes as Paint[];
    component.cornerRadius = frame.cornerRadius;
    component.clipsContent = frame.clipsContent;
  }

  // Insert component at the same position in parent
  const parent = node.parent;
  if (parent && "children" in parent) {
    const index = (parent as ChildrenMixin).children.indexOf(node);
    if (index !== -1) {
      (parent as ChildrenMixin).insertChild(index, component);
    } else {
      (parent as ChildrenMixin).appendChild(component);
    }
  }

  // Remove the original node
  node.remove();

  return successResponse({
    ...serializeNode(component),
    type: "COMPONENT",
    key: component.key,
  });
}

// ============================================================
// create_component_set
// ============================================================

export async function createComponentSet(
  params: Record<string, unknown>
): Promise<CommandResponse> {
  const componentIds = params.componentIds as string[] | undefined;
  const name = params.name as string | undefined;

  if (!componentIds || !Array.isArray(componentIds)) {
    return errorResponse(
      "Missing required parameter: componentIds (array of component node IDs)"
    );
  }

  if (componentIds.length < 2) {
    return errorResponse(
      `Need at least 2 components to create a component set, but got ${componentIds.length}. ` +
        `A component set (variant group) requires multiple component variants.`
    );
  }

  // Resolve and validate all components
  const components: ComponentNode[] = [];

  for (const id of componentIds) {
    const node = figma.getNodeById(id);
    if (!node) {
      return errorResponse(
        `Component '${id}' not found. Verify the node ID is correct and the node exists.`
      );
    }
    if (node.type !== "COMPONENT") {
      return errorResponse(
        `Node '${id}' (${node.name}) is a ${node.type}, not a COMPONENT. ` +
          `All nodes in a component set must be components.`
      );
    }
    components.push(node as ComponentNode);
  }

  // All components must be on the same page — use the first component's parent
  const parent = components[0].parent;
  if (!parent) {
    return errorResponse(
      `Component '${components[0].id}' has no parent. Components must be on a page.`
    );
  }

  const componentSet = figma.combineAsVariants(
    components,
    parent as BaseNode & ChildrenMixin
  );

  if (name) {
    componentSet.name = name;
  }

  return successResponse({
    nodeId: componentSet.id,
    name: componentSet.name,
    type: "COMPONENT_SET",
    childCount: componentSet.children.length,
  });
}

// ============================================================
// create_instance
// ============================================================

export async function createInstance(
  params: Record<string, unknown>
): Promise<CommandResponse> {
  const componentId = params.componentId as string | undefined;
  const x = params.x as number | undefined;
  const y = params.y as number | undefined;
  const parentId = params.parentId as string | undefined;

  if (!componentId) {
    return errorResponse("Missing required parameter: componentId");
  }

  const node = figma.getNodeById(componentId);
  if (!node) {
    return errorResponse(
      `Component '${componentId}' not found. Verify the component ID is correct.`
    );
  }

  if (node.type !== "COMPONENT") {
    return errorResponse(
      `Node '${componentId}' (${node.name}) is a ${node.type}, not a COMPONENT. ` +
        `You can only create instances from components.`
    );
  }

  const component = node as ComponentNode;
  const instance = component.createInstance();

  // Position
  if (x !== undefined) instance.x = x;
  if (y !== undefined) instance.y = y;

  // Reparent if specified
  if (parentId) {
    const parentNode = figma.getNodeById(parentId);
    if (!parentNode) {
      return errorResponse(
        `Parent '${parentId}' not found. The instance was created but could not be moved to the specified parent.`
      );
    }
    if ("appendChild" in parentNode) {
      (parentNode as BaseNode & ChildrenMixin).appendChild(instance);
    } else {
      return errorResponse(
        `Parent '${parentId}' (${parentNode.name}) cannot contain children. ` +
          `Choose a frame, group, or page as the parent.`
      );
    }
  }

  return successResponse({
    nodeId: instance.id,
    name: instance.name,
    type: "INSTANCE",
    x: instance.x,
    y: instance.y,
    width: instance.width,
    height: instance.height,
    mainComponentId: component.id,
  });
}

// ============================================================
// swap_instance
// ============================================================

export async function swapInstance(
  params: Record<string, unknown>
): Promise<CommandResponse> {
  const instanceId = params.instanceId as string | undefined;
  const newComponentId = params.newComponentId as string | undefined;

  if (!instanceId) {
    return errorResponse("Missing required parameter: instanceId");
  }

  if (!newComponentId) {
    return errorResponse("Missing required parameter: newComponentId");
  }

  const instanceNode = figma.getNodeById(instanceId);
  if (!instanceNode) {
    return errorResponse(
      `Instance '${instanceId}' not found. Verify the instance node ID is correct.`
    );
  }

  if (instanceNode.type !== "INSTANCE") {
    return errorResponse(
      `Node '${instanceId}' (${instanceNode.name}) is a ${instanceNode.type}, not an INSTANCE. ` +
        `Only instances can be swapped to a different component.`
    );
  }

  const newComponent = figma.getNodeById(newComponentId);
  if (!newComponent) {
    return errorResponse(
      `New component '${newComponentId}' not found. Verify the component ID is correct.`
    );
  }

  if (newComponent.type !== "COMPONENT") {
    return errorResponse(
      `Node '${newComponentId}' (${newComponent.name}) is a ${newComponent.type}, not a COMPONENT. ` +
        `You can only swap an instance to a component.`
    );
  }

  const instance = instanceNode as InstanceNode;
  instance.swapComponent(newComponent as ComponentNode);

  return successResponse({
    nodeId: instance.id,
    name: instance.name,
    type: "INSTANCE",
    newComponentId: newComponent.id,
    newComponentName: newComponent.name,
  });
}

// ============================================================
// set_instance_override
// ============================================================

const SUPPORTED_OVERRIDE_PROPERTIES = ["text", "fill", "visible", "opacity"];

export async function setInstanceOverride(
  params: Record<string, unknown>
): Promise<CommandResponse> {
  const instanceId = params.instanceId as string | undefined;
  const overrides = params.overrides as
    | Array<{
        property: string;
        nodeId?: string;
        value: unknown;
      }>
    | undefined;

  if (!instanceId) {
    return errorResponse("Missing required parameter: instanceId");
  }

  if (!overrides || !Array.isArray(overrides)) {
    return errorResponse(
      "Missing required parameter: overrides (array of override objects with property, nodeId?, and value)"
    );
  }

  if (overrides.length === 0) {
    return errorResponse(
      "overrides array must contain at least one override. " +
        `Supported properties: ${SUPPORTED_OVERRIDE_PROPERTIES.join(", ")}`
    );
  }

  const instanceNode = figma.getNodeById(instanceId);
  if (!instanceNode) {
    return errorResponse(
      `Instance '${instanceId}' not found. Verify the instance node ID is correct.`
    );
  }

  if (instanceNode.type !== "INSTANCE") {
    return errorResponse(
      `Node '${instanceId}' (${instanceNode.name}) is a ${instanceNode.type}, not an INSTANCE. ` +
        `Overrides can only be applied to component instances.`
    );
  }

  const instance = instanceNode as InstanceNode;
  const applied: Array<{
    property: string;
    nodeId?: string;
    status: string;
  }> = [];

  for (const override of overrides) {
    const { property, nodeId, value } = override;

    if (!SUPPORTED_OVERRIDE_PROPERTIES.includes(property)) {
      return errorResponse(
        `Unsupported override property '${property}'. ` +
          `Supported properties: ${SUPPORTED_OVERRIDE_PROPERTIES.join(", ")}`
      );
    }

    // Find the target node (either specified by nodeId or the instance itself)
    let targetNode: SceneNode;
    if (nodeId) {
      const found = figma.getNodeById(nodeId);
      if (!found) {
        return errorResponse(
          `Override target node '${nodeId}' not found within instance '${instanceId}'.`
        );
      }
      targetNode = found as SceneNode;
    } else {
      targetNode = instance;
    }

    switch (property) {
      case "text": {
        if (targetNode.type !== "TEXT") {
          return errorResponse(
            `Cannot set text on node '${targetNode.id}' (${targetNode.name}) — it is a ${targetNode.type}, not a TEXT node.`
          );
        }
        const textNode = targetNode as TextNode;
        await figma.loadFontAsync(textNode.fontName as FontName);
        textNode.characters = String(value);
        applied.push({ property, nodeId, status: "ok" });
        break;
      }

      case "fill": {
        if (!("fills" in targetNode)) {
          return errorResponse(
            `Cannot set fill on node '${targetNode.id}' (${targetNode.name}) — it does not support fills.`
          );
        }
        const color = parseHexColor(String(value));
        if (!color) {
          return errorResponse(
            `Invalid hex color '${value}'. Use format #RRGGBB or #RRGGBBAA.`
          );
        }
        (targetNode as GeometryMixin).fills = [
          { type: "SOLID", color, opacity: 1 },
        ];
        applied.push({ property, nodeId, status: "ok" });
        break;
      }

      case "visible": {
        targetNode.visible = Boolean(value);
        applied.push({ property, nodeId, status: "ok" });
        break;
      }

      case "opacity": {
        const opacityValue = Number(value);
        if (isNaN(opacityValue) || opacityValue < 0 || opacityValue > 1) {
          return errorResponse(
            `Invalid opacity value '${value}'. Must be a number between 0 and 1.`
          );
        }
        (targetNode as SceneNode).opacity = opacityValue;
        applied.push({ property, nodeId, status: "ok" });
        break;
      }
    }
  }

  return successResponse({
    nodeId: instance.id,
    name: instance.name,
    type: "INSTANCE",
    overridesApplied: applied,
  });
}

// ============================================================
// detach_instance
// ============================================================

export async function detachInstance(
  params: Record<string, unknown>
): Promise<CommandResponse> {
  const instanceId = params.instanceId as string | undefined;

  if (!instanceId) {
    return errorResponse("Missing required parameter: instanceId");
  }

  const node = figma.getNodeById(instanceId);
  if (!node) {
    return errorResponse(
      `Instance '${instanceId}' not found. Verify the instance node ID is correct.`
    );
  }

  if (node.type !== "INSTANCE") {
    return errorResponse(
      `Node '${instanceId}' (${node.name}) is a ${node.type}, not an INSTANCE. ` +
        `Only instances can be detached.`
    );
  }

  const instance = node as InstanceNode;
  const frame = instance.detachInstance();

  return successResponse({
    nodeId: frame.id,
    name: frame.name,
    type: "FRAME",
    x: frame.x,
    y: frame.y,
    width: frame.width,
    height: frame.height,
  });
}

// ============================================================
// Color Parsing Helper
// ============================================================

function parseHexColor(
  hex: string
): { r: number; g: number; b: number } | null {
  const match = hex.match(/^#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/);
  if (!match) return null;

  const h = match[1];
  return {
    r: parseInt(h.substring(0, 2), 16) / 255,
    g: parseInt(h.substring(2, 4), 16) / 255,
    b: parseInt(h.substring(4, 6), 16) / 255,
  };
}

// ============================================================
// Register all component commands in the executor registry
// ============================================================

registerExecutor("create_component", (p) => createComponent(p));
registerExecutor("create_component_set", (p) => createComponentSet(p));
registerExecutor("create_instance", (p) => createInstance(p));
registerExecutor("swap_instance", (p) => swapInstance(p));
registerExecutor("set_instance_override", (p) => setInstanceOverride(p));
registerExecutor("detach_instance", (p) => detachInstance(p));
