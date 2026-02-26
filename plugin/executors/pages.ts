// plugin/executors/pages.ts
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

function errorResponse(error: string): CommandResponse {
  return { success: false, error };
}

function successResponse(data: unknown): CommandResponse {
  return { success: true, data };
}

function isValidHexColor(color: string): boolean {
  return /^#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/.test(color);
}

function parseHexColor(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace("#", "");
  return {
    r: parseInt(h.substring(0, 2), 16) / 255,
    g: parseInt(h.substring(2, 4), 16) / 255,
    b: parseInt(h.substring(4, 6), 16) / 255,
  };
}

// ============================================================
// create_page
// ============================================================

export async function createPage(
  params: Record<string, unknown>
): Promise<CommandResponse> {
  const name = params.name as string | undefined;

  if (!name || typeof name !== "string" || name.trim() === "") {
    return errorResponse(
      "Missing required parameter: name (non-empty string for the new page)"
    );
  }

  const page = figma.createPage();
  page.name = name.trim();

  return successResponse({
    nodeId: page.id,
    name: page.name,
    type: "PAGE",
  });
}

// ============================================================
// switch_page
// ============================================================

export async function switchPage(
  params: Record<string, unknown>
): Promise<CommandResponse> {
  const pageId = params.pageId as string | undefined;
  const pageName = params.pageName as string | undefined;

  if (!pageId && !pageName) {
    return errorResponse(
      "Missing required parameter: provide either pageId or pageName to switch pages"
    );
  }

  let targetPage: PageNode | undefined;

  if (pageId) {
    targetPage = figma.root.children.find(
      (page) => page.id === pageId
    ) as PageNode | undefined;

    if (!targetPage) {
      return errorResponse(
        `Page with ID '${pageId}' not found. ` +
          `Available pages: ${figma.root.children.map((p) => `"${p.name}" (${p.id})`).join(", ")}`
      );
    }
  } else if (pageName) {
    targetPage = figma.root.children.find(
      (page) => page.name === pageName
    ) as PageNode | undefined;

    if (!targetPage) {
      return errorResponse(
        `Page with name '${pageName}' not found. ` +
          `Available pages: ${figma.root.children.map((p) => `"${p.name}"`).join(", ")}`
      );
    }
  }

  figma.currentPage = targetPage!;

  return successResponse({
    nodeId: targetPage!.id,
    name: targetPage!.name,
    type: "PAGE",
  });
}

// ============================================================
// create_section
// ============================================================

export async function createSection(
  params: Record<string, unknown>
): Promise<CommandResponse> {
  const name = params.name as string | undefined;
  const x = params.x as number | undefined;
  const y = params.y as number | undefined;
  const width = params.width as number | undefined;
  const height = params.height as number | undefined;

  if (!name || typeof name !== "string" || name.trim() === "") {
    return errorResponse(
      "Missing required parameter: name (non-empty string for the section)"
    );
  }

  const section = figma.createSection();
  section.name = name.trim();

  if (x !== undefined) section.x = x;
  if (y !== undefined) section.y = y;
  if (width !== undefined && height !== undefined) {
    section.resizeWithoutConstraints(width, height);
  } else if (width !== undefined) {
    section.resizeWithoutConstraints(width, section.height);
  } else if (height !== undefined) {
    section.resizeWithoutConstraints(section.width, height);
  }

  // Add section to current page
  figma.currentPage.appendChild(section);

  return successResponse({
    nodeId: section.id,
    name: section.name,
    type: "SECTION",
    x: section.x,
    y: section.y,
    width: section.width,
    height: section.height,
  });
}

// ============================================================
// set_page_background
// ============================================================

export async function setPageBackground(
  params: Record<string, unknown>
): Promise<CommandResponse> {
  const pageId = params.pageId as string | undefined;
  const color = params.color as string | undefined;

  if (!color) {
    return errorResponse(
      "Missing required parameter: color (hex string like #FFFFFF)"
    );
  }

  if (!isValidHexColor(color)) {
    return errorResponse(
      `Invalid hex color '${color}'. Use format #RRGGBB or #RRGGBBAA (e.g., #FFFFFF, #1E1E1EFF).`
    );
  }

  let page: PageNode;

  if (pageId) {
    const found = figma.root.children.find(
      (p) => p.id === pageId
    ) as PageNode | undefined;

    if (!found) {
      return errorResponse(
        `Page with ID '${pageId}' not found. ` +
          `Available pages: ${figma.root.children.map((p) => `"${p.name}" (${p.id})`).join(", ")}`
      );
    }
    page = found;
  } else {
    page = figma.currentPage;
  }

  const rgb = parseHexColor(color);

  page.backgrounds = [
    {
      type: "SOLID",
      color: rgb,
      visible: true,
    } as Paint,
  ];

  return successResponse({
    nodeId: page.id,
    name: page.name,
    type: "PAGE",
    color,
  });
}

// ============================================================
// Register all page commands in the executor registry
// ============================================================

registerExecutor("create_page", (p) => createPage(p));
registerExecutor("switch_page", (p) => switchPage(p));
registerExecutor("create_section", (p) => createSection(p));
registerExecutor("set_page_background", (p) => setPageBackground(p));
