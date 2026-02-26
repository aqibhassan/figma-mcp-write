// plugin/executors/superpowers.ts

import {
  collectNodesInScope,
  walkNodes,
  extractColorsFromNode,
  nodeMatchesSelector,
  fingerprintNode,
  fingerprintSimilarity,
  hexToRgb,
  rgbToHex,
  rgbToLab,
  deltaE,
  hexDeltaE,
  contrastRatio,
  relativeLuminance,
  isOnGrid,
  NodeSelector,
  ExtractedColor,
  RgbColor,
} from "../utils/superpower-helpers.js";
import { registerExecutor } from "./registry.js";

// ============================================================
// Result type used by all executors
// ============================================================

interface ExecutorResult {
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
}

// ============================================================
// 1. bulk_rename
// ============================================================

export async function bulkRename(
  params: Record<string, unknown>,
  figmaApi: PluginAPI
): Promise<ExecutorResult> {
  const nodeIds = params.nodeIds as string[] | undefined;
  const scope = params.scope as string | undefined;
  const pattern = params.pattern as string | undefined;
  const replacement = params.replacement as string | undefined;
  const prefix = params.prefix as string | undefined;
  const sequential = params.sequential as boolean | undefined;

  if (!pattern) {
    return { success: false, error: "Missing required parameter: pattern" };
  }

  if (!nodeIds && !scope) {
    return {
      success: false,
      error: "Must provide either nodeIds or scope to identify target nodes",
    };
  }

  let regex: RegExp;
  try {
    regex = new RegExp(pattern);
  } catch {
    return {
      success: false,
      error: `Invalid regex pattern: '${pattern}'. Ensure it is a valid JavaScript regular expression.`,
    };
  }

  // Collect target nodes
  let nodes: SceneNode[] = [];
  if (nodeIds) {
    for (const id of nodeIds) {
      const node = figmaApi.getNodeById(id);
      if (node && node.type !== "DOCUMENT" && node.type !== "PAGE") {
        nodes.push(node as SceneNode);
      }
    }
  } else if (scope) {
    nodes = collectNodesInScope(scope, figmaApi);
  }

  // Filter to nodes matching the pattern
  const matchingNodes = nodes.filter((n) => regex.test(n.name));
  const renamed: { nodeId: string; oldName: string; newName: string }[] = [];

  let sequentialCounter = 1;
  for (const node of matchingNodes) {
    const oldName = node.name;
    let newName: string;

    if (sequential && replacement !== undefined) {
      newName = `${replacement} ${sequentialCounter}`;
      sequentialCounter++;
    } else if (prefix !== undefined) {
      newName = `${prefix}${node.name}`;
    } else if (replacement !== undefined) {
      newName = node.name.replace(regex, replacement);
    } else {
      continue;
    }

    (node as { name: string }).name = newName;
    renamed.push({ nodeId: node.id, oldName, newName });
  }

  return {
    success: true,
    data: {
      renamedCount: renamed.length,
      totalMatched: matchingNodes.length,
      renamed,
    },
  };
}

// ============================================================
// 2. bulk_style
// ============================================================

export async function bulkStyle(
  params: Record<string, unknown>,
  figmaApi: PluginAPI
): Promise<ExecutorResult> {
  const scope = params.scope as string | undefined;
  const selector = params.selector as NodeSelector | undefined;
  const changes = params.changes as Record<string, unknown> | undefined;

  if (!selector) {
    return {
      success: false,
      error: "Missing required parameter: selector. Provide { type?, name?, style? } to match nodes.",
    };
  }

  if (!changes || Object.keys(changes).length === 0) {
    return {
      success: false,
      error: "Missing required parameter: changes. Provide a Record<string, unknown> of style changes to apply.",
    };
  }

  const targetScope = scope ?? "page";
  const allNodes = collectNodesInScope(targetScope, figmaApi);
  const matching = allNodes.filter((n) => nodeMatchesSelector(n, selector));

  const modified: { nodeId: string; nodeName: string; appliedChanges: string[] }[] = [];

  for (const node of matching) {
    const appliedChanges: string[] = [];

    for (const [key, value] of Object.entries(changes)) {
      switch (key) {
        case "fill": {
          const hex = value as string;
          if (!/^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$/.test(hex)) {
            break; // skip invalid hex — don't crash or corrupt the node
          }
          const rgb = hexToRgb(hex);
          (node as unknown as { fills: Paint[] }).fills = [
            {
              type: "SOLID",
              color: { r: rgb.r, g: rgb.g, b: rgb.b },
              visible: true,
            } as SolidPaint,
          ];
          appliedChanges.push(`fill → ${hex}`);
          break;
        }

        case "stroke": {
          const hex = value as string;
          if (!/^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$/.test(hex)) {
            break; // skip invalid hex — don't crash or corrupt the node
          }
          const rgb = hexToRgb(hex);
          (node as unknown as { strokes: Paint[] }).strokes = [
            {
              type: "SOLID",
              color: { r: rgb.r, g: rgb.g, b: rgb.b },
              visible: true,
            } as SolidPaint,
          ];
          appliedChanges.push(`stroke → ${hex}`);
          break;
        }

        case "opacity": {
          (node as unknown as { opacity: number }).opacity = value as number;
          appliedChanges.push(`opacity → ${value}`);
          break;
        }

        case "fontSize": {
          if (node.type === "TEXT") {
            (node as unknown as { fontSize: number }).fontSize = value as number;
            appliedChanges.push(`fontSize → ${value}`);
          }
          break;
        }

        case "cornerRadius": {
          if ("cornerRadius" in node) {
            (node as unknown as { cornerRadius: number }).cornerRadius = value as number;
            appliedChanges.push(`cornerRadius → ${value}`);
          }
          break;
        }

        default: {
          // Generic property set
          if (key in node) {
            (node as Record<string, unknown>)[key] = value;
            appliedChanges.push(`${key} → ${JSON.stringify(value)}`);
          }
          break;
        }
      }
    }

    if (appliedChanges.length > 0) {
      modified.push({
        nodeId: node.id,
        nodeName: node.name,
        appliedChanges,
      });
    }
  }

  return {
    success: true,
    data: {
      modifiedCount: modified.length,
      totalScanned: allNodes.length,
      totalMatched: matching.length,
      modified,
    },
  };
}

// ============================================================
// 3. bulk_resize
// ============================================================

export async function bulkResize(
  params: Record<string, unknown>,
  figmaApi: PluginAPI
): Promise<ExecutorResult> {
  const nodeIds = params.nodeIds as string[] | undefined;
  const scaleX = params.scaleX as number | undefined;
  const scaleY = params.scaleY as number | undefined;
  const width = params.width as number | undefined;
  const height = params.height as number | undefined;

  if (!nodeIds || nodeIds.length === 0) {
    return {
      success: false,
      error: "Missing required parameter: nodeIds. Provide an array of node IDs to resize.",
    };
  }

  const hasAbsolute = width !== undefined || height !== undefined;
  const hasScale = scaleX !== undefined || scaleY !== undefined;

  if (!hasAbsolute && !hasScale) {
    return {
      success: false,
      error: "Must provide width/height or scaleX/scaleY to determine new size.",
    };
  }

  const resized: { nodeId: string; oldSize: { w: number; h: number }; newSize: { w: number; h: number } }[] = [];
  let skippedCount = 0;

  for (const id of nodeIds) {
    const node = figmaApi.getNodeById(id);
    if (!node || node.type === "DOCUMENT" || node.type === "PAGE") {
      skippedCount++;
      continue;
    }

    const sceneNode = node as SceneNode;
    if (!("resize" in sceneNode)) {
      skippedCount++;
      continue;
    }

    const oldW = (sceneNode as FrameNode).width;
    const oldH = (sceneNode as FrameNode).height;

    let newW: number;
    let newH: number;

    if (hasAbsolute) {
      newW = width ?? oldW;
      newH = height ?? oldH;
    } else {
      const sx = scaleX ?? scaleY ?? 1;
      const sy = scaleY ?? scaleX ?? 1;
      newW = Math.round(oldW * sx);
      newH = Math.round(oldH * sy);
    }

    (sceneNode as FrameNode).resize(newW, newH);
    resized.push({
      nodeId: sceneNode.id,
      oldSize: { w: oldW, h: oldH },
      newSize: { w: newW, h: newH },
    });
  }

  return {
    success: true,
    data: {
      resizedCount: resized.length,
      skippedCount,
      resized,
    },
  };
}

// ============================================================
// 4. smart_align
// ============================================================

export async function smartAlign(
  params: Record<string, unknown>,
  figmaApi: PluginAPI
): Promise<ExecutorResult> {
  const nodeIds = params.nodeIds as string[] | undefined;
  const direction = (params.direction as string) ?? "HORIZONTAL";
  const spacing = params.spacing as number | undefined;
  const alignment = params.alignment as string | undefined;

  if (!nodeIds || nodeIds.length === 0) {
    return {
      success: false,
      error: "Missing required parameter: nodeIds. Provide an array of node IDs to align.",
    };
  }

  // Resolve nodes
  const nodes: SceneNode[] = [];
  for (const id of nodeIds) {
    const node = figmaApi.getNodeById(id);
    if (node && node.type !== "DOCUMENT" && node.type !== "PAGE") {
      nodes.push(node as SceneNode);
    }
  }

  if (nodes.length < 2) {
    return {
      success: false,
      error: "smart_align requires at least 2 valid nodes to align/distribute.",
    };
  }

  const isHorizontal = direction === "HORIZONTAL";

  // Handle alignment (without spacing)
  if (alignment && !spacing) {
    applyAlignment(nodes, alignment, isHorizontal);
    return {
      success: true,
      data: {
        alignedCount: nodes.length,
        alignment,
        direction,
      },
    };
  }

  // Handle distribution with spacing
  if (spacing !== undefined) {
    // Sort by position in the layout direction
    const sorted = [...nodes].sort((a, b) => {
      const posA = isHorizontal ? (a as FrameNode).x : (a as FrameNode).y;
      const posB = isHorizontal ? (b as FrameNode).x : (b as FrameNode).y;
      return posA - posB;
    });

    // First node stays in place, position others relative to it
    let currentPos = isHorizontal
      ? (sorted[0] as FrameNode).x
      : (sorted[0] as FrameNode).y;

    for (let i = 0; i < sorted.length; i++) {
      const node = sorted[i] as FrameNode;
      if (isHorizontal) {
        node.x = currentPos;
        currentPos += node.width + spacing;
      } else {
        node.y = currentPos;
        currentPos += node.height + spacing;
      }
    }

    // Apply alignment perpendicular to distribution direction if specified
    if (alignment) {
      applyAlignment(sorted, alignment, !isHorizontal);
    }

    return {
      success: true,
      data: {
        distributedCount: sorted.length,
        spacing,
        direction,
        alignment: alignment ?? "none",
      },
    };
  }

  // Default: space-between distribution
  const sorted = [...nodes].sort((a, b) => {
    const posA = isHorizontal ? (a as FrameNode).x : (a as FrameNode).y;
    const posB = isHorizontal ? (b as FrameNode).x : (b as FrameNode).y;
    return posA - posB;
  });

  const first = sorted[0] as FrameNode;
  const last = sorted[sorted.length - 1] as FrameNode;

  const totalSize = sorted.reduce((sum, n) => {
    return sum + (isHorizontal ? (n as FrameNode).width : (n as FrameNode).height);
  }, 0);

  const startPos = isHorizontal ? first.x : first.y;
  const endPos = isHorizontal ? last.x + last.width : last.y + last.height;
  const totalSpan = endPos - startPos;
  const gapSpace = totalSpan - totalSize;
  const gap = sorted.length > 1 ? gapSpace / (sorted.length - 1) : 0;

  let currentPos = startPos;
  for (const node of sorted) {
    const frameNode = node as FrameNode;
    if (isHorizontal) {
      frameNode.x = currentPos;
      currentPos += frameNode.width + gap;
    } else {
      frameNode.y = currentPos;
      currentPos += frameNode.height + gap;
    }
  }

  return {
    success: true,
    data: {
      distributedCount: sorted.length,
      calculatedSpacing: Math.round(gap * 100) / 100,
      direction,
    },
  };
}

function applyAlignment(
  nodes: SceneNode[],
  alignment: string,
  isHorizontal: boolean
): void {
  if (nodes.length === 0) return;

  if (alignment === "start") {
    const minPos = Math.min(
      ...nodes.map((n) =>
        isHorizontal ? (n as FrameNode).x : (n as FrameNode).y
      )
    );
    for (const node of nodes) {
      if (isHorizontal) {
        (node as FrameNode).x = minPos;
      } else {
        (node as FrameNode).y = minPos;
      }
    }
  } else if (alignment === "end") {
    const maxEnd = Math.max(
      ...nodes.map((n) =>
        isHorizontal
          ? (n as FrameNode).x + (n as FrameNode).width
          : (n as FrameNode).y + (n as FrameNode).height
      )
    );
    for (const node of nodes) {
      if (isHorizontal) {
        (node as FrameNode).x = maxEnd - (node as FrameNode).width;
      } else {
        (node as FrameNode).y = maxEnd - (node as FrameNode).height;
      }
    }
  } else if (alignment === "center") {
    const centers = nodes.map((n) =>
      isHorizontal
        ? (n as FrameNode).x + (n as FrameNode).width / 2
        : (n as FrameNode).y + (n as FrameNode).height / 2
    );
    const avgCenter = centers.reduce((a, b) => a + b, 0) / centers.length;
    for (const node of nodes) {
      if (isHorizontal) {
        (node as FrameNode).x = avgCenter - (node as FrameNode).width / 2;
      } else {
        (node as FrameNode).y = avgCenter - (node as FrameNode).height / 2;
      }
    }
  }
}

// ============================================================
// 5. design_lint
// ============================================================

interface LintIssue {
  rule: string;
  severity: "error" | "warning" | "info";
  message: string;
  nodeId: string;
  nodeName: string;
  suggestion?: string;
}

const DEFAULT_NAMING_PATTERNS = [
  /^Rectangle \d+$/,
  /^Ellipse \d+$/,
  /^Frame \d+$/,
  /^Group \d+$/,
  /^Line \d+$/,
  /^Polygon \d+$/,
  /^Star \d+$/,
  /^Vector \d+$/,
  /^Text \d*$/,
  /^Image \d*$/,
];

const ALL_LINT_RULES = [
  "naming",
  "corner-radius",
  "spacing",
  "detached-styles",
  "orphan-components",
] as const;

export async function designLint(
  params: Record<string, unknown>,
  figmaApi: PluginAPI
): Promise<ExecutorResult> {
  const scope = (params.scope as string) ?? "page";
  const requestedRules = params.rules as string[] | undefined;
  const activeRules = requestedRules ?? [...ALL_LINT_RULES];

  const nodes = collectNodesInScope(scope, figmaApi);
  const issues: LintIssue[] = [];

  for (const node of nodes) {
    // Rule: naming-violation
    if (activeRules.includes("naming")) {
      if (DEFAULT_NAMING_PATTERNS.some((pattern) => pattern.test(node.name))) {
        issues.push({
          rule: "naming-violation",
          severity: "warning",
          message: `Layer "${node.name}" uses a default Figma name. Rename it to describe its purpose.`,
          nodeId: node.id,
          nodeName: node.name,
          suggestion: `Rename "${node.name}" to something descriptive like "card-background" or "hero-section".`,
        });
      }
    }

    // Rule: inconsistent-corner-radius
    if (activeRules.includes("corner-radius") && "cornerRadius" in node) {
      const radius = node.cornerRadius as number;
      if (typeof radius === "number" && radius > 0 && !isOnGrid(radius, 4)) {
        issues.push({
          rule: "inconsistent-corner-radius",
          severity: "warning",
          message: `Corner radius ${radius}px on "${node.name}" is not on the 4px grid. Nearest: ${Math.round(radius / 4) * 4}px.`,
          nodeId: node.id,
          nodeName: node.name,
          suggestion: `Change corner radius from ${radius}px to ${Math.round(radius / 4) * 4}px.`,
        });
      }
    }

    // Rule: inconsistent-spacing
    if (activeRules.includes("spacing") && "layoutMode" in node) {
      const layoutNode = node as FrameNode;
      if (layoutNode.layoutMode && layoutNode.layoutMode !== "NONE") {
        const spacingValues = [
          layoutNode.itemSpacing,
          layoutNode.paddingTop,
          layoutNode.paddingRight,
          layoutNode.paddingBottom,
          layoutNode.paddingLeft,
        ].filter((v): v is number => typeof v === "number" && v > 0);

        for (const val of spacingValues) {
          if (!isOnGrid(val, 8)) {
            issues.push({
              rule: "inconsistent-spacing",
              severity: "warning",
              message: `Spacing value ${val}px on "${node.name}" is not on the 8px grid. Nearest: ${Math.round(val / 8) * 8}px.`,
              nodeId: node.id,
              nodeName: node.name,
              suggestion: `Change ${val}px to ${Math.round(val / 8) * 8}px to align with the spacing scale.`,
            });
            break; // One issue per node for spacing
          }
        }
      }
    }

    // Rule: detached-styles
    if (activeRules.includes("detached-styles")) {
      if ("fills" in node && Array.isArray(node.fills)) {
        const hasFills = (node.fills as Paint[]).some(
          (f) => f.type === "SOLID" && f.visible !== false
        );
        const hasFillStyleId =
          "fillStyleId" in node &&
          typeof (node as unknown as { fillStyleId: string }).fillStyleId === "string" &&
          (node as unknown as { fillStyleId: string }).fillStyleId !== "";

        if (hasFills && !hasFillStyleId && node.type !== "TEXT") {
          issues.push({
            rule: "detached-styles",
            severity: "warning",
            message: `"${node.name}" has a solid fill not linked to a color style. Consider using a shared color style for consistency.`,
            nodeId: node.id,
            nodeName: node.name,
            suggestion: `Open the fill panel and click the four-dot style icon to attach a color style. Create one first with figma_styling apply_style if needed.`,
          });
        }
      }
    }

    // Rule: orphan-components (instances with no matching component in this file)
    if (activeRules.includes("orphan-components")) {
      if (node.type === "INSTANCE") {
        const instance = node as InstanceNode;
        const mainComponent = instance.mainComponent;
        if (!mainComponent) {
          issues.push({
            rule: "orphan-components",
            severity: "error",
            message: `Instance "${node.name}" has a missing or broken component link (orphaned instance). The master component may have been deleted or moved to an external library.`,
            nodeId: node.id,
            nodeName: node.name,
            suggestion: `Either restore the main component, swap to an existing component via figma_components swap_instance, or detach the instance with detach_instance.`,
          });
        }
      }
    }
  }

  return {
    success: true,
    data: {
      issueCount: issues.length,
      issues,
      scannedNodeCount: nodes.length,
      rulesChecked: activeRules,
    },
  };
}

// ============================================================
// 6. accessibility_check
// ============================================================

interface A11yViolation {
  criterion: string;
  severity: "error" | "warning";
  message: string;
  nodeId: string;
  nodeName: string;
  actual: string;
  required: string;
  suggestion: string;
}

export async function accessibilityCheck(
  params: Record<string, unknown>,
  figmaApi: PluginAPI
): Promise<ExecutorResult> {
  const scope = (params.scope as string) ?? "page";
  const level = (params.level as "A" | "AA" | "AAA") ?? "AA";

  const nodes = collectNodesInScope(scope, figmaApi);
  const violations: A11yViolation[] = [];

  // Thresholds by level
  const contrastNormalText = level === "AAA" ? 7 : 4.5;
  const contrastLargeText = level === "AAA" ? 4.5 : 3;
  const minTouchTarget = level === "AAA" ? 48 : 44;
  const minFontSize = level === "AAA" ? 14 : 12;
  for (const node of nodes) {
    // Contrast check for text nodes
    if (node.type === "TEXT") {
      const textNode = node as TextNode;
      const fontSize = typeof textNode.fontSize === "number" ? textNode.fontSize : 16;
      const fontStyle =
        typeof (textNode as unknown as { fontName?: { style?: string } }).fontName?.style ===
        "string"
          ? ((textNode as unknown as { fontName: { style: string } }).fontName.style.toLowerCase())
          : "";
      const isBold =
        fontStyle.includes("bold") ||
        fontStyle.includes("black") ||
        fontStyle.includes("heavy") ||
        fontStyle.includes("extrabold");
      // WCAG: large text = 18px regular OR 14px bold
      const isLargeText = fontSize >= 18 || (fontSize >= 14 && isBold);
      const requiredRatio = isLargeText ? contrastLargeText : contrastNormalText;

      // Get text color
      const textColor = getFirstSolidColor(textNode.fills as Paint[]);
      if (textColor) {
        // Find parent background color
        const bgColor = findBackgroundColor(textNode);
        if (bgColor) {
          const ratio = contrastRatio(textColor, bgColor);
          if (ratio < requiredRatio) {
            violations.push({
              criterion: "WCAG 1.4.3",
              severity: "error",
              message: `Text "${(textNode as unknown as { characters: string }).characters?.substring(0, 30) ?? node.name}" has insufficient contrast ratio ${ratio.toFixed(2)}:1 (requires ${requiredRatio}:1 for ${isLargeText ? "large" : "normal"} text at ${level}).`,
              nodeId: node.id,
              nodeName: node.name,
              actual: `${ratio.toFixed(2)}:1`,
              required: `${requiredRatio}:1`,
              suggestion: `Increase contrast by darkening the text color or lightening the background. Current text: ${rgbToHex(textColor)}, background: ${rgbToHex(bgColor)}.`,
            });
          }
        }
      }

      // Text size check
      if (fontSize < minFontSize) {
        violations.push({
          criterion: level === "AAA" ? "WCAG 1.4.8" : "WCAG 1.4.4",
          severity: "warning",
          message: `Text "${(textNode as unknown as { characters: string }).characters?.substring(0, 30) ?? node.name}" uses ${fontSize}px font size (minimum ${minFontSize}px for ${level}).`,
          nodeId: node.id,
          nodeName: node.name,
          actual: `${fontSize}px`,
          required: `${minFontSize}px`,
          suggestion: `Increase font size from ${fontSize}px to at least ${minFontSize}px.`,
        });
      }
    }

    // Touch target check (frames and components that look interactive)
    if (
      (node.type === "FRAME" || node.type === "COMPONENT" || node.type === "INSTANCE") &&
      isLikelyInteractive(node)
    ) {
      const width = (node as FrameNode).width;
      const height = (node as FrameNode).height;

      if (width < minTouchTarget || height < minTouchTarget) {
        violations.push({
          criterion: level === "AAA" ? "WCAG 2.5.5" : "WCAG 2.5.8",
          severity: "warning",
          message: `"${node.name}" (${Math.round(width)}x${Math.round(height)}px) is smaller than the minimum touch target of ${minTouchTarget}x${minTouchTarget}px for ${level}.`,
          nodeId: node.id,
          nodeName: node.name,
          actual: `${Math.round(width)}x${Math.round(height)}px`,
          required: `${minTouchTarget}x${minTouchTarget}px`,
          suggestion: `Increase dimensions to at least ${minTouchTarget}x${minTouchTarget}px. If the visual size must be smaller, add invisible padding to the hit area.`,
        });
      }
    }
  }

  return {
    success: true,
    data: {
      violationCount: violations.length,
      violations,
      scannedNodeCount: nodes.length,
      level,
    },
  };
}

function getFirstSolidColor(paints: Paint[]): RgbColor | null {
  if (!Array.isArray(paints)) return null;
  for (const paint of paints) {
    if (paint.type === "SOLID" && paint.visible !== false) {
      const solid = paint as SolidPaint;
      return { r: solid.color.r, g: solid.color.g, b: solid.color.b };
    }
  }
  return null;
}

function findBackgroundColor(node: SceneNode): RgbColor | null {
  let current: BaseNode | null = node.parent;
  while (current && current.type !== "DOCUMENT" && current.type !== "PAGE") {
    if ("fills" in current && Array.isArray((current as FrameNode).fills)) {
      const bg = getFirstSolidColor((current as FrameNode).fills as Paint[]);
      if (bg) return bg;
    }
    current = current.parent;
  }
  // Default: assume white background
  return { r: 1, g: 1, b: 1 };
}

function isLikelyInteractive(node: SceneNode): boolean {
  const name = node.name.toLowerCase();
  const interactivePatterns = [
    "button",
    "btn",
    "link",
    "tab",
    "toggle",
    "switch",
    "checkbox",
    "radio",
    "input",
    "icon-button",
    "fab",
    "chip",
    "cta",
  ];
  return interactivePatterns.some((p) => name.includes(p));
}

// ============================================================
// 7. design_system_scan
// ============================================================

export async function designSystemScan(
  params: Record<string, unknown>,
  figmaApi: PluginAPI
): Promise<ExecutorResult> {
  const scope = (params.scope as string) ?? "page";
  const nodes = collectNodesInScope(scope, figmaApi);

  if (nodes.length === 0) {
    return {
      success: true,
      data: {
        totalNodes: 0,
        instanceCount: 0,
        componentUsagePercent: 100,
        detachedStyleCount: 0,
        nonTokenColorCount: 0,
        violations: [],
        summary: "No nodes found in scope.",
      },
    };
  }

  let instanceCount = 0;
  let detachedStyleCount = 0;
  let nonTokenColorCount = 0;
  const violations: { nodeId: string; nodeName: string; type: string; detail: string }[] = [];

  for (const node of nodes) {
    // Component usage
    if (node.type === "INSTANCE") {
      instanceCount++;
    }

    // Detached styles — node has fill but no fill style ID
    if ("fills" in node && Array.isArray(node.fills)) {
      const hasSolidFill = (node.fills as Paint[]).some(
        (f) => f.type === "SOLID" && f.visible !== false
      );
      const fillStyleId =
        "fillStyleId" in node
          ? (node as unknown as { fillStyleId: string }).fillStyleId
          : "";

      if (hasSolidFill && (!fillStyleId || fillStyleId === "")) {
        detachedStyleCount++;
        violations.push({
          nodeId: node.id,
          nodeName: node.name,
          type: "detached-fill",
          detail: `Fill on "${node.name}" is not linked to a style.`,
        });
      }
    }

    // Non-token colors — node has fill but no bound variable
    if ("fills" in node && Array.isArray(node.fills)) {
      const hasSolidFill = (node.fills as Paint[]).some(
        (f) => f.type === "SOLID" && f.visible !== false
      );
      const hasBoundVariable =
        "boundVariables" in node &&
        node.boundVariables &&
        typeof node.boundVariables === "object" &&
        "fills" in (node.boundVariables as Record<string, unknown>);

      if (hasSolidFill && !hasBoundVariable) {
        nonTokenColorCount++;
      }
    }
  }

  const componentUsagePercent =
    nodes.length > 0
      ? Math.round((instanceCount / nodes.length) * 100)
      : 100;

  return {
    success: true,
    data: {
      totalNodes: nodes.length,
      instanceCount,
      componentUsagePercent,
      detachedStyleCount,
      nonTokenColorCount,
      violations,
      summary: `${componentUsagePercent}% component usage (${instanceCount}/${nodes.length} nodes). ${detachedStyleCount} detached styles. ${nonTokenColorCount} non-token colors.`,
    },
  };
}

// ============================================================
// 8. responsive_check
// ============================================================

interface BreakpointReport {
  breakpoint: number;
  issues: {
    type: "text-overflow" | "element-outside-bounds" | "element-overlap";
    nodeId: string;
    nodeName: string;
    detail: string;
  }[];
}

export async function responsiveCheck(
  params: Record<string, unknown>,
  figmaApi: PluginAPI
): Promise<ExecutorResult> {
  const nodeId = params.nodeId as string | undefined;
  const breakpoints = params.breakpoints as number[] | undefined;

  if (!nodeId) {
    return {
      success: false,
      error: "Missing required parameter: nodeId. Provide the ID of the frame to test responsiveness.",
    };
  }

  if (!breakpoints || breakpoints.length === 0) {
    return {
      success: false,
      error: "Missing required parameter: breakpoints. Provide an array of widths to test (e.g. [320, 768, 1024]).",
    };
  }

  const node = figmaApi.getNodeById(nodeId);
  if (!node || node.type === "DOCUMENT" || node.type === "PAGE") {
    return {
      success: false,
      error: `Node '${nodeId}' not found. Ensure the node ID is valid and the node exists in the current file.`,
    };
  }

  const sourceNode = node as FrameNode;
  const originalWidth = sourceNode.width;
  const originalHeight = sourceNode.height;
  const breakpointReports: BreakpointReport[] = [];

  for (const bp of breakpoints) {
    const report: BreakpointReport = { breakpoint: bp, issues: [] };

    // Check children against the breakpoint width
    if ("children" in sourceNode) {
      for (const child of sourceNode.children) {
        const childNode = child as SceneNode;
        const childWidth = "width" in childNode ? (childNode as FrameNode).width : 0;
        const childX = "x" in childNode ? (childNode as FrameNode).x : 0;

        // Text overflow: text wider than breakpoint
        if (childNode.type === "TEXT" && childWidth > bp) {
          report.issues.push({
            type: "text-overflow",
            nodeId: childNode.id,
            nodeName: childNode.name,
            detail: `Text "${childNode.name}" is ${Math.round(childWidth)}px wide, exceeding ${bp}px breakpoint.`,
          });
        }

        // Element outside bounds: element extends beyond breakpoint width
        if (childX + childWidth > bp) {
          report.issues.push({
            type: "element-outside-bounds",
            nodeId: childNode.id,
            nodeName: childNode.name,
            detail: `"${childNode.name}" extends to ${Math.round(childX + childWidth)}px, exceeding ${bp}px breakpoint by ${Math.round(childX + childWidth - bp)}px.`,
          });
        }
      }

      // Element overlap check (simple: check if bounding boxes overlap)
      const childArray = [...sourceNode.children] as SceneNode[];
      for (let i = 0; i < childArray.length; i++) {
        for (let j = i + 1; j < childArray.length; j++) {
          const a = childArray[i] as FrameNode;
          const b = childArray[j] as FrameNode;
          if (
            "x" in a && "y" in a && "width" in a && "height" in a &&
            "x" in b && "y" in b && "width" in b && "height" in b
          ) {
            const overlapX = a.x < b.x + b.width && a.x + a.width > b.x;
            const overlapY = a.y < b.y + b.height && a.y + a.height > b.y;
            if (overlapX && overlapY) {
              report.issues.push({
                type: "element-overlap",
                nodeId: a.id,
                nodeName: `${a.name} ↔ ${b.name}`,
                detail: `"${a.name}" and "${b.name}" overlap at ${bp}px breakpoint.`,
              });
            }
          }
        }
      }
    }

    breakpointReports.push(report);
  }

  const totalIssues = breakpointReports.reduce(
    (sum, r) => sum + r.issues.length,
    0
  );

  return {
    success: true,
    data: {
      nodeId,
      originalSize: { width: originalWidth, height: originalHeight },
      breakpointReports,
      totalIssues,
      summary:
        totalIssues === 0
          ? `No responsive issues found across ${breakpoints.length} breakpoints.`
          : `Found ${totalIssues} responsive issues across ${breakpoints.length} breakpoints.`,
    },
  };
}

// ============================================================
// 9. component_coverage
// ============================================================

export async function componentCoverage(
  params: Record<string, unknown>,
  figmaApi: PluginAPI
): Promise<ExecutorResult> {
  const scope = (params.scope as string) ?? "page";
  const nodes = collectNodesInScope(scope, figmaApi);

  if (nodes.length === 0) {
    return {
      success: true,
      data: {
        totalNodes: 0,
        instanceCount: 0,
        rawNodeCount: 0,
        coveragePercent: 100,
        suggestions: [],
        summary: "No nodes found in scope.",
      },
    };
  }

  let instanceCount = 0;
  const rawNodes: SceneNode[] = [];

  for (const node of nodes) {
    if (node.type === "INSTANCE") {
      instanceCount++;
    } else if (
      node.type !== "COMPONENT" &&
      node.type !== "COMPONENT_SET" &&
      node.type !== "PAGE" &&
      node.type !== "DOCUMENT"
    ) {
      rawNodes.push(node);
    }
  }

  const coveragePercent =
    nodes.length > 0
      ? Math.round((instanceCount / nodes.length) * 100)
      : 100;

  // Find repeated patterns (same structure appearing 3+ times)
  const fingerprints = new Map<string, { fingerprint: ReturnType<typeof fingerprintNode>; nodes: SceneNode[] }>();

  for (const node of rawNodes) {
    const fp = fingerprintNode(node);
    const key = `${fp.type}:${fp.width}x${fp.height}:${fp.childCount}:${fp.fillHex ?? "none"}`;

    if (!fingerprints.has(key)) {
      fingerprints.set(key, { fingerprint: fp, nodes: [] });
    }
    fingerprints.get(key)!.nodes.push(node);
  }

  const suggestions: {
    pattern: string;
    count: number;
    nodeIds: string[];
    suggestion: string;
  }[] = [];

  for (const [key, { fingerprint, nodes: matchingNodes }] of fingerprints) {
    if (matchingNodes.length >= 3) {
      suggestions.push({
        pattern: `${fingerprint.type} (${fingerprint.width}x${fingerprint.height})`,
        count: matchingNodes.length,
        nodeIds: matchingNodes.map((n) => n.id),
        suggestion: `${matchingNodes.length} nodes with identical structure found. Consider creating a reusable component.`,
      });
    }
  }

  // Sort suggestions by count descending
  suggestions.sort((a, b) => b.count - a.count);

  return {
    success: true,
    data: {
      totalNodes: nodes.length,
      instanceCount,
      rawNodeCount: rawNodes.length,
      coveragePercent,
      suggestions,
      summary: `${coveragePercent}% component coverage. ${instanceCount} instances, ${rawNodes.length} raw nodes. ${suggestions.length} patterns could be componentized.`,
    },
  };
}

// ============================================================
// 10. duplicate_detector
// ============================================================

export async function duplicateDetector(
  params: Record<string, unknown>,
  figmaApi: PluginAPI
): Promise<ExecutorResult> {
  const scope = (params.scope as string) ?? "page";
  const threshold = (params.threshold as number) ?? 0.8;

  const nodes = collectNodesInScope(scope, figmaApi);

  // Fingerprint all nodes
  const fingerprinted = nodes.map((node) => ({
    node,
    fingerprint: fingerprintNode(node),
  }));

  // Group by similarity
  const groups: { nodeIds: string[]; nodeNames: string[]; similarity: number }[] = [];
  const assigned = new Set<string>();

  for (let i = 0; i < fingerprinted.length; i++) {
    if (assigned.has(fingerprinted[i].node.id)) continue;

    const group: { nodeIds: string[]; nodeNames: string[]; minSimilarity: number } = {
      nodeIds: [fingerprinted[i].node.id],
      nodeNames: [fingerprinted[i].node.name],
      minSimilarity: 1,
    };

    for (let j = i + 1; j < fingerprinted.length; j++) {
      if (assigned.has(fingerprinted[j].node.id)) continue;

      const similarity = fingerprintSimilarity(
        fingerprinted[i].fingerprint,
        fingerprinted[j].fingerprint
      );

      if (similarity >= threshold) {
        group.nodeIds.push(fingerprinted[j].node.id);
        group.nodeNames.push(fingerprinted[j].node.name);
        group.minSimilarity = Math.min(group.minSimilarity, similarity);
        assigned.add(fingerprinted[j].node.id);
      }
    }

    if (group.nodeIds.length >= 2) {
      assigned.add(fingerprinted[i].node.id);
      groups.push({
        nodeIds: group.nodeIds,
        nodeNames: group.nodeNames,
        similarity: Math.round(group.minSimilarity * 100) / 100,
      });
    }
  }

  // Sort by group size descending
  groups.sort((a, b) => b.nodeIds.length - a.nodeIds.length);

  return {
    success: true,
    data: {
      duplicateGroups: groups,
      groupCount: groups.length,
      totalDuplicateNodes: groups.reduce((sum, g) => sum + g.nodeIds.length, 0),
      scannedNodeCount: nodes.length,
      threshold,
      summary:
        groups.length === 0
          ? `No duplicate patterns found among ${nodes.length} nodes.`
          : `Found ${groups.length} groups of duplicates (${groups.reduce((sum, g) => sum + g.nodeIds.length, 0)} nodes total). Consider extracting these as reusable components.`,
    },
  };
}

// ============================================================
// 11. color_palette_extract
// ============================================================

export async function colorPaletteExtract(
  params: Record<string, unknown>,
  figmaApi: PluginAPI
): Promise<ExecutorResult> {
  const scope = (params.scope as string) ?? "page";
  const threshold = (params.threshold as number) ?? 5; // deltaE threshold

  const nodes = collectNodesInScope(scope, figmaApi);

  // Collect all colors
  const allColors: ExtractedColor[] = [];
  for (const node of nodes) {
    const nodeColors = extractColorsFromNode(node);
    allColors.push(...nodeColors);
  }

  if (allColors.length === 0) {
    return {
      success: true,
      data: {
        totalUniqueColors: 0,
        palette: [],
        consolidationSuggestions: [],
        summary: "No colors found in scope.",
      },
    };
  }

  // Count unique colors (exact hex match)
  const colorCounts = new Map<string, { hex: string; rgb: RgbColor; count: number; sources: string[] }>();

  for (const color of allColors) {
    const existing = colorCounts.get(color.hex);
    if (existing) {
      existing.count++;
      if (!existing.sources.includes(color.source)) {
        existing.sources.push(color.source);
      }
    } else {
      colorCounts.set(color.hex, {
        hex: color.hex,
        rgb: color.rgb,
        count: 1,
        sources: [color.source],
      });
    }
  }

  const palette = [...colorCounts.values()].sort((a, b) => b.count - a.count);

  // Find near-duplicate color groups
  const consolidationSuggestions: {
    colors: string[];
    deltaE: number;
    suggestion: string;
  }[] = [];

  const paletteArray = [...palette];
  const grouped = new Set<string>();

  for (let i = 0; i < paletteArray.length; i++) {
    if (grouped.has(paletteArray[i].hex)) continue;

    const nearDuplicates: string[] = [];
    for (let j = i + 1; j < paletteArray.length; j++) {
      if (grouped.has(paletteArray[j].hex)) continue;

      const d = deltaE(paletteArray[i].rgb, paletteArray[j].rgb);
      if (d > 0 && d < threshold) {
        nearDuplicates.push(paletteArray[j].hex);
        grouped.add(paletteArray[j].hex);
      }
    }

    if (nearDuplicates.length > 0) {
      const allInGroup = [paletteArray[i].hex, ...nearDuplicates];
      consolidationSuggestions.push({
        colors: allInGroup,
        deltaE: threshold,
        suggestion: `${allInGroup.length} near-identical colors found (${allInGroup.join(", ")}). Consider consolidating to a single design token.`,
      });
    }
  }

  return {
    success: true,
    data: {
      totalUniqueColors: palette.length,
      totalColorInstances: allColors.length,
      palette: palette.map((c) => ({
        hex: c.hex,
        count: c.count,
        sources: c.sources,
      })),
      consolidationSuggestions,
      summary: `Found ${palette.length} unique colors across ${allColors.length} instances. ${consolidationSuggestions.length} groups of near-duplicate colors could be consolidated.`,
    },
  };
}

// ============================================================
// 12. typography_audit
// ============================================================

export async function typographyAudit(
  params: Record<string, unknown>,
  figmaApi: PluginAPI
): Promise<ExecutorResult> {
  const scope = (params.scope as string) ?? "page";
  const nodes = collectNodesInScope(scope, figmaApi);

  const textNodes = nodes.filter((n) => n.type === "TEXT") as TextNode[];

  if (textNodes.length === 0) {
    return {
      success: true,
      data: {
        totalTextNodes: 0,
        styles: [],
        uniqueFontFamilies: [],
        uniqueFontSizes: [],
        warnings: [],
        summary: "No text nodes found in scope.",
      },
    };
  }

  // Collect unique text style combinations
  const styleMap = new Map<
    string,
    {
      fontFamily: string;
      fontStyle: string;
      fontSize: number;
      lineHeight: unknown;
      letterSpacing: unknown;
      count: number;
      nodeIds: string[];
    }
  >();

  const fontFamilies = new Set<string>();
  const fontSizes = new Set<number>();

  for (const textNode of textNodes) {
    const fontName = textNode.fontName as { family: string; style: string } | typeof figma.mixed;
    const fontSize = textNode.fontSize as number | typeof figma.mixed;
    const lineHeight = textNode.lineHeight;
    const letterSpacing = textNode.letterSpacing;

    // Skip mixed values
    if (typeof fontSize !== "number") continue;
    if (!fontName || typeof fontName !== "object" || !("family" in fontName)) continue;

    const family = fontName.family;
    const style = fontName.style;

    fontFamilies.add(family);
    fontSizes.add(fontSize);

    const key = `${family}|${style}|${fontSize}|${JSON.stringify(lineHeight)}|${JSON.stringify(letterSpacing)}`;

    const existing = styleMap.get(key);
    if (existing) {
      existing.count++;
      existing.nodeIds.push(textNode.id);
    } else {
      styleMap.set(key, {
        fontFamily: family,
        fontStyle: style,
        fontSize,
        lineHeight,
        letterSpacing,
        count: 1,
        nodeIds: [textNode.id],
      });
    }
  }

  const styles = [...styleMap.values()].sort((a, b) => b.count - a.count);

  // Generate warnings
  const warnings: string[] = [];

  if (fontSizes.size > 8) {
    warnings.push(
      `Too many font sizes (${fontSizes.size}): ${[...fontSizes].sort((a, b) => a - b).join(", ")}px. Consider consolidating to a type scale (e.g., 12, 14, 16, 20, 24, 32).`
    );
  }

  if (fontFamilies.size > 3) {
    warnings.push(
      `${fontFamilies.size} font families in use: ${[...fontFamilies].join(", ")}. Most designs use 1-2 families.`
    );
  }

  // Check for non-standard font weights
  const fontStyles = new Set<string>();
  for (const s of styles) {
    fontStyles.add(s.fontStyle);
  }
  if (fontStyles.size > 5) {
    warnings.push(
      `${fontStyles.size} font weight/style variants in use. Consider limiting to Regular, Medium, SemiBold, Bold.`
    );
  }

  return {
    success: true,
    data: {
      totalTextNodes: textNodes.length,
      uniqueStyleCount: styles.length,
      uniqueFontFamilies: [...fontFamilies],
      uniqueFontSizes: [...fontSizes].sort((a, b) => a - b),
      styles: styles.map((s) => ({
        fontFamily: s.fontFamily,
        fontStyle: s.fontStyle,
        fontSize: s.fontSize,
        lineHeight: s.lineHeight,
        letterSpacing: s.letterSpacing,
        count: s.count,
        nodeIds: s.nodeIds,
      })),
      warnings,
      summary: `${textNodes.length} text nodes using ${styles.length} unique styles across ${fontFamilies.size} font families and ${fontSizes.size} sizes.`,
    },
  };
}

// ============================================================
// 13. spacing_audit
// ============================================================

export async function spacingAudit(
  params: Record<string, unknown>,
  figmaApi: PluginAPI
): Promise<ExecutorResult> {
  const scope = (params.scope as string) ?? "page";
  const baseUnit = (params.baseUnit as number) ?? 8;

  const nodes = collectNodesInScope(scope, figmaApi);

  const distribution = new Map<number, number>();
  const violations: {
    value: number;
    nodeId: string;
    nodeName: string;
    property: string;
    nearest: number;
  }[] = [];
  let autoLayoutFrameCount = 0;

  for (const node of nodes) {
    if (!("layoutMode" in node)) continue;

    const frame = node as FrameNode;
    if (!frame.layoutMode || frame.layoutMode === "NONE") continue;

    autoLayoutFrameCount++;

    const spacingProps: { property: string; value: number }[] = [];

    if (typeof frame.itemSpacing === "number" && frame.itemSpacing > 0) {
      spacingProps.push({ property: "itemSpacing", value: frame.itemSpacing });
    }
    if (typeof frame.paddingTop === "number" && frame.paddingTop > 0) {
      spacingProps.push({ property: "paddingTop", value: frame.paddingTop });
    }
    if (typeof frame.paddingRight === "number" && frame.paddingRight > 0) {
      spacingProps.push({ property: "paddingRight", value: frame.paddingRight });
    }
    if (typeof frame.paddingBottom === "number" && frame.paddingBottom > 0) {
      spacingProps.push({ property: "paddingBottom", value: frame.paddingBottom });
    }
    if (typeof frame.paddingLeft === "number" && frame.paddingLeft > 0) {
      spacingProps.push({ property: "paddingLeft", value: frame.paddingLeft });
    }

    for (const { property, value } of spacingProps) {
      // Add to distribution
      const rounded = Math.round(value);
      distribution.set(rounded, (distribution.get(rounded) ?? 0) + 1);

      // Check grid alignment
      if (!isOnGrid(value, baseUnit)) {
        const nearest = Math.round(value / baseUnit) * baseUnit;
        violations.push({
          value: rounded,
          nodeId: node.id,
          nodeName: node.name,
          property,
          nearest,
        });
      }
    }
  }

  // Sort distribution by value
  const sortedDistribution: Record<string, number> = {};
  for (const [value, count] of [...distribution.entries()].sort((a, b) => a[0] - b[0])) {
    sortedDistribution[String(value)] = count;
  }

  return {
    success: true,
    data: {
      baseUnit,
      autoLayoutFrameCount,
      distribution: sortedDistribution,
      violationCount: violations.length,
      violations,
      summary:
        violations.length === 0
          ? `All ${autoLayoutFrameCount} auto-layout frames use ${baseUnit}px-aligned spacing.`
          : `${violations.length} spacing values are not on the ${baseUnit}px grid across ${autoLayoutFrameCount} auto-layout frames.`,
    },
  };
}

// ============================================================
// 14. export_tokens
// ============================================================

export async function exportTokens(
  params: Record<string, unknown>,
  figmaApi: PluginAPI
): Promise<ExecutorResult> {
  const format = params.format as string;
  const filterCollections = params.collections as string[] | undefined;

  const validFormats = ["json", "css", "tailwind"];
  if (!validFormats.includes(format)) {
    return {
      success: false,
      error: `Invalid format '${format}'. Must be one of: ${validFormats.join(", ")}.`,
    };
  }

  // Get all variable collections
  const collections = await figmaApi.variables.getLocalVariableCollectionsAsync();

  const filteredCollections = filterCollections
    ? collections.filter((c) => filterCollections.includes(c.name))
    : collections;

  // Build token data structure
  const tokenData: Record<string, Record<string, unknown>> = {};

  for (const collection of filteredCollections) {
    const collectionTokens: Record<string, unknown> = {};
    const defaultMode = collection.modes[0];

    for (const varId of collection.variableIds) {
      const variable = await figmaApi.variables.getVariableByIdAsync(varId);
      if (!variable) continue;

      const value = variable.valuesByMode[defaultMode.modeId];

      if (variable.resolvedType === "COLOR" && typeof value === "object" && value !== null) {
        const color = value as { r: number; g: number; b: number; a?: number };
        collectionTokens[variable.name] = rgbToHex(color);
      } else if (variable.resolvedType === "FLOAT" && typeof value === "number") {
        collectionTokens[variable.name] = value;
      } else if (variable.resolvedType === "STRING" && typeof value === "string") {
        collectionTokens[variable.name] = value;
      } else if (variable.resolvedType === "BOOLEAN" && typeof value === "boolean") {
        collectionTokens[variable.name] = value;
      }
    }

    tokenData[collection.name] = collectionTokens;
  }

  let output: string;

  switch (format) {
    case "json":
      output = JSON.stringify(tokenData, null, 2);
      break;

    case "css":
      output = formatAsCSS(tokenData);
      break;

    case "tailwind":
      output = formatAsTailwind(tokenData);
      break;

    default:
      output = JSON.stringify(tokenData, null, 2);
  }

  return {
    success: true,
    data: {
      output,
      format,
      collectionCount: filteredCollections.length,
      tokenCount: Object.values(tokenData).reduce(
        (sum, tokens) => sum + Object.keys(tokens).length,
        0
      ),
    },
  };
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function formatAsCSS(
  tokenData: Record<string, Record<string, unknown>>
): string {
  const lines: string[] = [":root {"];

  for (const [collectionName, tokens] of Object.entries(tokenData)) {
    const prefix = slugify(collectionName);
    lines.push(`  /* ${collectionName} */`);

    for (const [name, value] of Object.entries(tokens)) {
      const varName = `--${prefix}-${slugify(name)}`;

      if (typeof value === "string" && value.startsWith("#")) {
        lines.push(`  ${varName}: ${value};`);
      } else if (typeof value === "number") {
        lines.push(`  ${varName}: ${value}px;`);
      } else if (typeof value === "string") {
        lines.push(`  ${varName}: "${value}";`);
      } else if (typeof value === "boolean") {
        lines.push(`  ${varName}: ${value ? 1 : 0};`);
      }
    }
  }

  lines.push("}");
  return lines.join("\n");
}

function formatAsTailwind(
  tokenData: Record<string, Record<string, unknown>>
): string {
  const colors: Record<string, string> = {};
  const spacing: Record<string, string> = {};
  const rest: Record<string, unknown> = {};

  for (const [collectionName, tokens] of Object.entries(tokenData)) {
    for (const [name, value] of Object.entries(tokens)) {
      const key = slugify(name);

      if (typeof value === "string" && value.startsWith("#")) {
        colors[key] = value;
      } else if (typeof value === "number") {
        spacing[key] = `${value}px`;
      } else {
        rest[key] = value;
      }
    }
  }

  const config: Record<string, unknown> = {
    theme: {
      extend: {
        ...(Object.keys(colors).length > 0 ? { colors } : {}),
        ...(Object.keys(spacing).length > 0 ? { spacing } : {}),
      },
    },
  };

  return `module.exports = ${JSON.stringify(config, null, 2)};`;
}

// ============================================================
// 15. import_tokens
// ============================================================

export async function importTokens(
  params: Record<string, unknown>,
  figmaApi: PluginAPI
): Promise<ExecutorResult> {
  const tokensStr = params.tokens as string;
  const format = params.format as string;
  const collectionName = (params.collectionName as string) ?? "Imported Tokens";

  const validFormats = ["json", "css"];
  if (!validFormats.includes(format)) {
    return {
      success: false,
      error: `Unsupported format '${format}'. Must be one of: ${validFormats.join(", ")}.`,
    };
  }

  // Parse tokens
  let tokenEntries: { name: string; value: unknown; type: "COLOR" | "FLOAT" | "STRING" | "BOOLEAN" }[];

  try {
    if (format === "json") {
      tokenEntries = parseJsonTokens(tokensStr);
    } else {
      tokenEntries = parseCssTokens(tokensStr);
    }
  } catch (e) {
    return {
      success: false,
      error: `Failed to parse tokens: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  // Find or create collection
  const existingCollections = await figmaApi.variables.getLocalVariableCollectionsAsync();
  let collection = existingCollections.find((c) => c.name === collectionName);

  if (!collection) {
    collection = await figmaApi.variables.createVariableCollectionAsync(collectionName);
  }

  const defaultModeId = collection.modes[0].modeId;
  let createdCount = 0;

  for (const entry of tokenEntries) {
    const variable = await figmaApi.variables.createVariableAsync(
      entry.name,
      collection.id,
      entry.type
    );

    if (entry.type === "COLOR" && typeof entry.value === "string") {
      const rgb = hexToRgb(entry.value);
      variable.setValueForMode(defaultModeId, {
        r: rgb.r,
        g: rgb.g,
        b: rgb.b,
        a: rgb.a ?? 1,
      });
    } else {
      variable.setValueForMode(defaultModeId, entry.value);
    }

    createdCount++;
  }

  return {
    success: true,
    data: {
      createdCount,
      collectionName: collection.name,
      collectionId: collection.id,
      format,
      summary: `Created ${createdCount} variables in collection "${collection.name}".`,
    },
  };
}

function parseJsonTokens(
  jsonStr: string
): { name: string; value: unknown; type: "COLOR" | "FLOAT" | "STRING" | "BOOLEAN" }[] {
  const parsed = JSON.parse(jsonStr);
  const entries: { name: string; value: unknown; type: "COLOR" | "FLOAT" | "STRING" | "BOOLEAN" }[] = [];

  function walk(obj: Record<string, unknown>, prefix: string) {
    for (const [key, value] of Object.entries(obj)) {
      const name = prefix ? `${prefix}/${key}` : key;

      if (typeof value === "object" && value !== null && !Array.isArray(value)) {
        // Check if it's a nested group
        walk(value as Record<string, unknown>, name);
      } else if (typeof value === "string" && value.startsWith("#")) {
        entries.push({ name, value, type: "COLOR" });
      } else if (typeof value === "number") {
        entries.push({ name, value, type: "FLOAT" });
      } else if (typeof value === "boolean") {
        entries.push({ name, value, type: "BOOLEAN" });
      } else if (typeof value === "string") {
        entries.push({ name, value, type: "STRING" });
      }
    }
  }

  walk(parsed, "");
  return entries;
}

function parseCssTokens(
  cssStr: string
): { name: string; value: unknown; type: "COLOR" | "FLOAT" | "STRING" | "BOOLEAN" }[] {
  const entries: { name: string; value: unknown; type: "COLOR" | "FLOAT" | "STRING" | "BOOLEAN" }[] = [];

  // Match --property-name: value;
  const varPattern = /--([a-zA-Z0-9-]+)\s*:\s*([^;]+);/g;
  let match: RegExpExecArray | null;

  while ((match = varPattern.exec(cssStr)) !== null) {
    const name = match[1].replace(/-/g, "/");
    const rawValue = match[2].trim();

    if (rawValue.startsWith("#")) {
      entries.push({ name: match[1], value: rawValue, type: "COLOR" });
    } else if (rawValue.endsWith("px")) {
      const num = parseFloat(rawValue);
      if (!isNaN(num)) {
        entries.push({ name: match[1], value: num, type: "FLOAT" });
      }
    } else if (rawValue.startsWith('"') && rawValue.endsWith('"')) {
      entries.push({ name: match[1], value: rawValue.slice(1, -1), type: "STRING" });
    } else {
      const num = parseFloat(rawValue);
      if (!isNaN(num)) {
        entries.push({ name: match[1], value: num, type: "FLOAT" });
      } else {
        entries.push({ name: match[1], value: rawValue, type: "STRING" });
      }
    }
  }

  return entries;
}

// ============================================================
// 16. localize_text
// ============================================================

export async function localizeText(
  params: Record<string, unknown>,
  figmaApi: PluginAPI
): Promise<ExecutorResult> {
  const localeMap = params.localeMap as Record<string, string> | undefined;
  const scope = (params.scope as string) ?? "page";
  const detectHardcoded = params.detectHardcoded as boolean ?? false;

  if (!localeMap) {
    return {
      success: false,
      error: "Missing required parameter: localeMap. Provide a Record<string, string> mapping source text to translated text.",
    };
  }

  const nodes = collectNodesInScope(scope, figmaApi);
  const textNodes = nodes.filter((n) => n.type === "TEXT") as TextNode[];

  const translated: { nodeId: string; nodeName: string; from: string; to: string }[] = [];
  const untranslated: { nodeId: string; nodeName: string; text: string }[] = [];

  for (const textNode of textNodes) {
    const currentText = textNode.characters;
    if (!currentText || typeof currentText !== "string") continue;

    if (localeMap[currentText]) {
      // Load font before modifying text
      const fontName = textNode.fontName;
      if (fontName && typeof fontName === "object" && "family" in fontName) {
        try {
          await figmaApi.loadFontAsync(fontName as FontName);
        } catch {
          // Font loading might fail in plugin context — continue anyway
        }
      }

      const newText = localeMap[currentText];
      (textNode as unknown as { characters: string }).characters = newText;
      translated.push({
        nodeId: textNode.id,
        nodeName: textNode.name,
        from: currentText,
        to: newText,
      });
    } else if (detectHardcoded) {
      untranslated.push({
        nodeId: textNode.id,
        nodeName: textNode.name,
        text: currentText,
      });
    }
  }

  return {
    success: true,
    data: {
      translatedCount: translated.length,
      totalTextNodes: textNodes.length,
      translated,
      untranslated: detectHardcoded ? untranslated : undefined,
      untranslatedCount: detectHardcoded ? untranslated.length : undefined,
      summary: detectHardcoded
        ? `Translated ${translated.length}/${textNodes.length} text nodes. ${untranslated.length} untranslated strings detected.`
        : `Translated ${translated.length}/${textNodes.length} text nodes.`,
    },
  };
}

// ============================================================
// 17. annotation_generate
// ============================================================

export async function annotationGenerate(
  params: Record<string, unknown>,
  figmaApi: PluginAPI
): Promise<ExecutorResult> {
  const nodeId = params.nodeId as string | undefined;
  const annotationType = params.type as string | undefined;

  if (!nodeId) {
    return {
      success: false,
      error: "Missing required parameter: nodeId. Provide the ID of the node to annotate.",
    };
  }

  const validTypes = ["specs", "redlines", "measurements"];
  if (!annotationType || !validTypes.includes(annotationType)) {
    return {
      success: false,
      error: `Invalid annotation type '${annotationType}'. Must be one of: ${validTypes.join(", ")}.`,
    };
  }

  const node = figmaApi.getNodeById(nodeId);
  if (!node || node.type === "DOCUMENT" || node.type === "PAGE") {
    return {
      success: false,
      error: `Node '${nodeId}' not found. Ensure the node ID is valid.`,
    };
  }

  const targetNode = node as FrameNode;
  const nodeX = targetNode.x ?? 0;
  const nodeY = targetNode.y ?? 0;
  const nodeW = targetNode.width ?? 0;
  const nodeH = targetNode.height ?? 0;

  // Create annotation group frame
  const annotationGroup = figmaApi.createFrame();
  annotationGroup.name = `[Annotations] ${targetNode.name} — ${annotationType}`;
  annotationGroup.x = nodeX;
  annotationGroup.y = nodeY - 60; // Place above the target
  annotationGroup.resize(Math.max(nodeW + 200, 400), nodeH + 120);
  annotationGroup.fills = [];

  const createdAnnotations: string[] = [];

  try {
    await figmaApi.loadFontAsync({ family: "Inter", style: "Regular" });
  } catch {
    // Continue without font loading in test environments
  }

  switch (annotationType) {
    case "specs": {
      // Dimension annotation
      const dimText = figmaApi.createText();
      dimText.characters = `${Math.round(nodeW)} × ${Math.round(nodeH)}px`;
      dimText.fontSize = 11;
      dimText.fills = [{ type: "SOLID", color: { r: 1, g: 0.3, b: 0.3 }, visible: true } as SolidPaint];
      annotationGroup.appendChild(dimText);
      createdAnnotations.push("dimensions");

      // Fill color annotation
      if ("fills" in targetNode && Array.isArray(targetNode.fills)) {
        const fillColor = getFirstSolidColor(targetNode.fills as Paint[]);
        if (fillColor) {
          const colorText = figmaApi.createText();
          colorText.characters = `Fill: ${rgbToHex(fillColor)}`;
          colorText.fontSize = 11;
          colorText.fills = [{ type: "SOLID", color: { r: 0.4, g: 0.4, b: 0.4 }, visible: true } as SolidPaint];
          annotationGroup.appendChild(colorText);
          createdAnnotations.push("fill-color");
        }
      }

      // Corner radius annotation
      if ("cornerRadius" in targetNode && typeof targetNode.cornerRadius === "number" && targetNode.cornerRadius > 0) {
        const radiusText = figmaApi.createText();
        radiusText.characters = `Radius: ${targetNode.cornerRadius}px`;
        radiusText.fontSize = 11;
        radiusText.fills = [{ type: "SOLID", color: { r: 0.4, g: 0.4, b: 0.4 }, visible: true } as SolidPaint];
        annotationGroup.appendChild(radiusText);
        createdAnnotations.push("corner-radius");
      }

      // Child annotations
      if ("children" in targetNode) {
        for (const child of targetNode.children) {
          const childNode = child as FrameNode;
          const childText = figmaApi.createText();
          const fontSize = "fontSize" in childNode ? ` · ${childNode.fontSize}px` : "";
          childText.characters = `${childNode.name}: ${Math.round(childNode.width ?? 0)}×${Math.round(childNode.height ?? 0)}${fontSize}`;
          childText.fontSize = 10;
          childText.fills = [{ type: "SOLID", color: { r: 0.3, g: 0.3, b: 0.8 }, visible: true } as SolidPaint];
          annotationGroup.appendChild(childText);
          createdAnnotations.push(`child-${childNode.name}`);
        }
      }
      break;
    }

    case "redlines": {
      // Create measurement lines between children
      if ("children" in targetNode && targetNode.children.length > 1) {
        const children = [...targetNode.children] as FrameNode[];
        for (let i = 0; i < children.length - 1; i++) {
          const a = children[i];
          const b = children[i + 1];
          const gap = (b.y ?? 0) - ((a.y ?? 0) + (a.height ?? 0));

          if (gap > 0) {
            const lineText = figmaApi.createText();
            lineText.characters = `↕ ${Math.round(gap)}px`;
            lineText.fontSize = 10;
            lineText.fills = [{ type: "SOLID", color: { r: 1, g: 0, b: 0 }, visible: true } as SolidPaint];
            annotationGroup.appendChild(lineText);
            createdAnnotations.push(`gap-${i}`);
          }
        }
      }

      // Padding annotations
      const paddingText = figmaApi.createText();
      paddingText.characters = `Padding: T${targetNode.paddingTop ?? 0} R${targetNode.paddingRight ?? 0} B${targetNode.paddingBottom ?? 0} L${targetNode.paddingLeft ?? 0}`;
      paddingText.fontSize = 10;
      paddingText.fills = [{ type: "SOLID", color: { r: 1, g: 0, b: 0 }, visible: true } as SolidPaint];
      annotationGroup.appendChild(paddingText);
      createdAnnotations.push("padding");
      break;
    }

    case "measurements": {
      // Width dimension line
      const widthText = figmaApi.createText();
      widthText.characters = `← ${Math.round(nodeW)}px →`;
      widthText.fontSize = 11;
      widthText.fills = [{ type: "SOLID", color: { r: 0, g: 0.5, b: 1 }, visible: true } as SolidPaint];
      annotationGroup.appendChild(widthText);
      createdAnnotations.push("width");

      // Height dimension line
      const heightText = figmaApi.createText();
      heightText.characters = `↑ ${Math.round(nodeH)}px ↓`;
      heightText.fontSize = 11;
      heightText.fills = [{ type: "SOLID", color: { r: 0, g: 0.5, b: 1 }, visible: true } as SolidPaint];
      annotationGroup.appendChild(heightText);
      createdAnnotations.push("height");

      // Position annotation
      const posText = figmaApi.createText();
      posText.characters = `Position: (${Math.round(nodeX)}, ${Math.round(nodeY)})`;
      posText.fontSize = 10;
      posText.fills = [{ type: "SOLID", color: { r: 0.4, g: 0.4, b: 0.4 }, visible: true } as SolidPaint];
      annotationGroup.appendChild(posText);
      createdAnnotations.push("position");
      break;
    }
  }

  // Add to current page
  figmaApi.currentPage.appendChild(annotationGroup);

  return {
    success: true,
    data: {
      annotationType,
      createdGroupId: annotationGroup.id,
      createdGroupName: annotationGroup.name,
      annotations: createdAnnotations,
      annotationCount: createdAnnotations.length,
      summary: `Created ${createdAnnotations.length} ${annotationType} annotations for "${targetNode.name}" in group "${annotationGroup.name}".`,
    },
  };
}

// ============================================================
// 18. generate_layout
// ============================================================

interface LayoutPattern {
  keywords: string[];
  generate: (
    figmaApi: PluginAPI,
    width: number,
    height: number,
    description: string
  ) => Promise<{ rootFrame: FrameNode; nodeIds: string[] }>;
}

const LAYOUT_PATTERNS: LayoutPattern[] = [
  // N-column grid
  {
    keywords: ["column", "grid", "col"],
    generate: async (figmaApi, width, height, description) => {
      const colMatch = description.match(/(\d+)\s*(?:col|column)/i);
      const numCols = colMatch ? parseInt(colMatch[1], 10) : 2;
      const spacing = 16;

      const root = figmaApi.createFrame();
      root.name = `${numCols}-Column Grid`;
      root.resize(width, height);
      root.layoutMode = "HORIZONTAL";
      root.itemSpacing = spacing;
      root.paddingTop = 0;
      root.paddingRight = 0;
      root.paddingBottom = 0;
      root.paddingLeft = 0;
      root.primaryAxisSizingMode = "FIXED";
      root.counterAxisSizingMode = "FIXED";

      const nodeIds: string[] = [root.id];
      const colWidth = Math.floor((width - spacing * (numCols - 1)) / numCols);

      for (let i = 0; i < numCols; i++) {
        const col = figmaApi.createFrame();
        col.name = `Column ${i + 1}`;
        col.resize(colWidth, height);
        col.fills = [
          { type: "SOLID", color: { r: 0.96, g: 0.96, b: 0.96 }, visible: true } as SolidPaint,
        ];
        root.appendChild(col);
        nodeIds.push(col.id);
      }

      return { rootFrame: root as unknown as FrameNode, nodeIds };
    },
  },

  // Header + Content + Footer
  {
    keywords: ["header", "footer"],
    generate: async (figmaApi, width, height, _description) => {
      const root = figmaApi.createFrame();
      root.name = "Page Layout";
      root.resize(width, height);
      root.layoutMode = "VERTICAL";
      root.itemSpacing = 0;
      root.primaryAxisSizingMode = "FIXED";
      root.counterAxisSizingMode = "FIXED";

      const nodeIds: string[] = [root.id];

      const headerHeight = 64;
      const footerHeight = 48;
      const contentHeight = height - headerHeight - footerHeight;

      const header = figmaApi.createFrame();
      header.name = "Header";
      header.resize(width, headerHeight);
      header.fills = [
        { type: "SOLID", color: { r: 0.15, g: 0.15, b: 0.2 }, visible: true } as SolidPaint,
      ];
      root.appendChild(header);
      nodeIds.push(header.id);

      const content = figmaApi.createFrame();
      content.name = "Content";
      content.resize(width, contentHeight);
      content.fills = [
        { type: "SOLID", color: { r: 1, g: 1, b: 1 }, visible: true } as SolidPaint,
      ];
      root.appendChild(content);
      nodeIds.push(content.id);

      const footer = figmaApi.createFrame();
      footer.name = "Footer";
      footer.resize(width, footerHeight);
      footer.fills = [
        { type: "SOLID", color: { r: 0.95, g: 0.95, b: 0.95 }, visible: true } as SolidPaint,
      ];
      root.appendChild(footer);
      nodeIds.push(footer.id);

      return { rootFrame: root as unknown as FrameNode, nodeIds };
    },
  },

  // Sidebar + Main
  {
    keywords: ["sidebar", "side"],
    generate: async (figmaApi, width, height, _description) => {
      const root = figmaApi.createFrame();
      root.name = "Sidebar Layout";
      root.resize(width, height);
      root.layoutMode = "HORIZONTAL";
      root.itemSpacing = 0;
      root.primaryAxisSizingMode = "FIXED";
      root.counterAxisSizingMode = "FIXED";

      const nodeIds: string[] = [root.id];

      const sidebarWidth = Math.min(280, Math.round(width * 0.25));
      const mainWidth = width - sidebarWidth;

      const sidebar = figmaApi.createFrame();
      sidebar.name = "Sidebar";
      sidebar.resize(sidebarWidth, height);
      sidebar.fills = [
        { type: "SOLID", color: { r: 0.12, g: 0.12, b: 0.16 }, visible: true } as SolidPaint,
      ];
      sidebar.layoutMode = "VERTICAL";
      sidebar.paddingTop = 16;
      sidebar.paddingLeft = 16;
      sidebar.paddingRight = 16;
      sidebar.itemSpacing = 8;
      root.appendChild(sidebar);
      nodeIds.push(sidebar.id);

      const main = figmaApi.createFrame();
      main.name = "Main Content";
      main.resize(mainWidth, height);
      main.fills = [
        { type: "SOLID", color: { r: 1, g: 1, b: 1 }, visible: true } as SolidPaint,
      ];
      main.layoutMode = "VERTICAL";
      main.paddingTop = 24;
      main.paddingLeft = 24;
      main.paddingRight = 24;
      main.itemSpacing = 16;
      root.appendChild(main);
      nodeIds.push(main.id);

      return { rootFrame: root as unknown as FrameNode, nodeIds };
    },
  },

  // Card
  {
    keywords: ["card"],
    generate: async (figmaApi, width, height, description) => {
      const hasImage = /image|img|photo|picture|thumbnail/i.test(description);

      const root = figmaApi.createFrame();
      root.name = "Card";
      root.resize(width, height);
      root.layoutMode = "VERTICAL";
      root.itemSpacing = 0;
      root.cornerRadius = 12;
      root.fills = [
        { type: "SOLID", color: { r: 1, g: 1, b: 1 }, visible: true } as SolidPaint,
      ];
      root.primaryAxisSizingMode = "FIXED";
      root.counterAxisSizingMode = "FIXED";

      const nodeIds: string[] = [root.id];

      if (hasImage) {
        const imageHeight = Math.round(height * 0.5);
        const imagePlaceholder = figmaApi.createRectangle();
        imagePlaceholder.name = "Image Placeholder";
        imagePlaceholder.resize(width, imageHeight);
        imagePlaceholder.fills = [
          { type: "SOLID", color: { r: 0.85, g: 0.85, b: 0.9 }, visible: true } as SolidPaint,
        ];
        root.appendChild(imagePlaceholder);
        nodeIds.push(imagePlaceholder.id);
      }

      const textArea = figmaApi.createFrame();
      textArea.name = "Text Content";
      textArea.resize(width, hasImage ? Math.round(height * 0.5) : height);
      textArea.layoutMode = "VERTICAL";
      textArea.paddingTop = 16;
      textArea.paddingLeft = 16;
      textArea.paddingRight = 16;
      textArea.paddingBottom = 16;
      textArea.itemSpacing = 8;
      textArea.fills = [];
      root.appendChild(textArea);
      nodeIds.push(textArea.id);

      return { rootFrame: root as unknown as FrameNode, nodeIds };
    },
  },

  // Form
  {
    keywords: ["form", "field", "input"],
    generate: async (figmaApi, width, height, description) => {
      const fieldMatch = description.match(/(\d+)\s*(?:field|input)/i);
      const numFields = fieldMatch ? parseInt(fieldMatch[1], 10) : 3;
      const hasButton = /button|submit|cta/i.test(description);

      const root = figmaApi.createFrame();
      root.name = "Form";
      root.resize(width, height);
      root.layoutMode = "VERTICAL";
      root.itemSpacing = 16;
      root.paddingTop = 24;
      root.paddingRight = 24;
      root.paddingBottom = 24;
      root.paddingLeft = 24;
      root.fills = [
        { type: "SOLID", color: { r: 1, g: 1, b: 1 }, visible: true } as SolidPaint,
      ];
      root.primaryAxisSizingMode = "FIXED";
      root.counterAxisSizingMode = "FIXED";

      const nodeIds: string[] = [root.id];
      const fieldWidth = width - 48;

      for (let i = 0; i < numFields; i++) {
        const field = figmaApi.createFrame();
        field.name = `Field ${i + 1}`;
        field.resize(fieldWidth, 44);
        field.cornerRadius = 8;
        field.fills = [
          { type: "SOLID", color: { r: 0.96, g: 0.96, b: 0.96 }, visible: true } as SolidPaint,
        ];
        field.strokes = [
          { type: "SOLID", color: { r: 0.8, g: 0.8, b: 0.8 }, visible: true } as SolidPaint,
        ];
        root.appendChild(field);
        nodeIds.push(field.id);
      }

      if (hasButton) {
        const button = figmaApi.createFrame();
        button.name = "Submit Button";
        button.resize(fieldWidth, 48);
        button.cornerRadius = 8;
        button.fills = [
          { type: "SOLID", color: { r: 0.23, g: 0.51, b: 0.97 }, visible: true } as SolidPaint,
        ];
        root.appendChild(button);
        nodeIds.push(button.id);
      }

      return { rootFrame: root as unknown as FrameNode, nodeIds };
    },
  },
];

// Fallback: simple vertical stack
const FALLBACK_PATTERN: LayoutPattern = {
  keywords: [],
  generate: async (figmaApi, width, height, description) => {
    const root = figmaApi.createFrame();
    root.name = "Layout";
    root.resize(width, height);
    root.layoutMode = "VERTICAL";
    root.itemSpacing = 16;
    root.paddingTop = 16;
    root.paddingRight = 16;
    root.paddingBottom = 16;
    root.paddingLeft = 16;
    root.fills = [
      { type: "SOLID", color: { r: 1, g: 1, b: 1 }, visible: true } as SolidPaint,
    ];
    root.primaryAxisSizingMode = "FIXED";
    root.counterAxisSizingMode = "FIXED";

    const nodeIds: string[] = [root.id];

    // Create 3 placeholder sections
    const sectionCount = 3;
    const innerWidth = width - 32;
    const sectionHeight = Math.round((height - 32 - 16 * (sectionCount - 1)) / sectionCount);

    for (let i = 0; i < sectionCount; i++) {
      const section = figmaApi.createFrame();
      section.name = `Section ${i + 1}`;
      section.resize(innerWidth, sectionHeight);
      section.fills = [
        { type: "SOLID", color: { r: 0.96, g: 0.96, b: 0.96 }, visible: true } as SolidPaint,
      ];
      section.cornerRadius = 8;
      root.appendChild(section);
      nodeIds.push(section.id);
    }

    return { rootFrame: root as unknown as FrameNode, nodeIds };
  },
};

export async function generateLayout(
  params: Record<string, unknown>,
  figmaApi: PluginAPI
): Promise<ExecutorResult> {
  const description = params.description as string | undefined;
  const parentId = params.parentId as string | undefined;
  const width = (params.width as number) ?? 1200;
  const height = (params.height as number) ?? 800;

  if (!description) {
    return {
      success: false,
      error: "Missing required parameter: description. Provide a natural language description of the layout (e.g., '3 column grid', 'header + content + footer', 'card with image and text').",
    };
  }

  const lowerDesc = description.toLowerCase();

  // Find matching pattern
  let matchedPattern: LayoutPattern | null = null;
  for (const pattern of LAYOUT_PATTERNS) {
    if (pattern.keywords.some((kw) => lowerDesc.includes(kw))) {
      matchedPattern = pattern;
      break;
    }
  }

  if (!matchedPattern) {
    matchedPattern = FALLBACK_PATTERN;
  }

  // Generate layout
  const { rootFrame, nodeIds } = await matchedPattern.generate(
    figmaApi,
    width,
    height,
    description
  );

  // Attach to parent or current page
  if (parentId) {
    const parent = figmaApi.getNodeById(parentId);
    if (parent && "appendChild" in parent) {
      (parent as FrameNode).appendChild(rootFrame);
    } else {
      figmaApi.currentPage.appendChild(rootFrame);
    }
  } else {
    figmaApi.currentPage.appendChild(rootFrame);
  }

  return {
    success: true,
    data: {
      createdNodeIds: nodeIds,
      rootNodeId: nodeIds[0],
      description,
      matchedPattern: matchedPattern === FALLBACK_PATTERN ? "fallback" : matchedPattern.keywords[0],
      width,
      height,
      summary: `Generated "${description}" layout (${width}x${height}px) with ${nodeIds.length} nodes.`,
    },
  };
}

// ============================================================
// Register all 18 executors
// ============================================================

registerExecutor("bulk_rename", (p) => bulkRename(p, figma as unknown as PluginAPI));
registerExecutor("bulk_style", (p) => bulkStyle(p, figma as unknown as PluginAPI));
registerExecutor("bulk_resize", (p) => bulkResize(p, figma as unknown as PluginAPI));
registerExecutor("smart_align", (p) => smartAlign(p, figma as unknown as PluginAPI));
registerExecutor("design_lint", (p) => designLint(p, figma as unknown as PluginAPI));
registerExecutor("accessibility_check", (p) => accessibilityCheck(p, figma as unknown as PluginAPI));
registerExecutor("design_system_scan", (p) => designSystemScan(p, figma as unknown as PluginAPI));
registerExecutor("responsive_check", (p) => responsiveCheck(p, figma as unknown as PluginAPI));
registerExecutor("component_coverage", (p) => componentCoverage(p, figma as unknown as PluginAPI));
registerExecutor("duplicate_detector", (p) => duplicateDetector(p, figma as unknown as PluginAPI));
registerExecutor("color_palette_extract", (p) => colorPaletteExtract(p, figma as unknown as PluginAPI));
registerExecutor("typography_audit", (p) => typographyAudit(p, figma as unknown as PluginAPI));
registerExecutor("spacing_audit", (p) => spacingAudit(p, figma as unknown as PluginAPI));
registerExecutor("export_tokens", (p) => exportTokens(p, figma as unknown as PluginAPI));
registerExecutor("import_tokens", (p) => importTokens(p, figma as unknown as PluginAPI));
registerExecutor("localize_text", (p) => localizeText(p, figma as unknown as PluginAPI));
registerExecutor("annotation_generate", (p) => annotationGenerate(p, figma as unknown as PluginAPI));
registerExecutor("generate_layout", (p) => generateLayout(p, figma as unknown as PluginAPI));
