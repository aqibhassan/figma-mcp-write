// src/server/tools/superpowers.ts

interface CommandDef {
  name: string;
  description: string;
  params: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export const SUPERPOWER_COMMANDS: CommandDef[] = [
  {
    name: "bulk_rename",
    description:
      "Rename multiple nodes using regex pattern matching. Supports find/replace, prefix/suffix, and sequential numbering. Use scope='page' or provide specific nodeIds.",
    params: {
      type: "object",
      properties: {
        nodeIds: { type: "array", items: { type: "string" }, description: "Array of node IDs to rename" },
        scope: { type: "string", enum: ["file", "page"], description: "Scope to search for nodes (alternative to nodeIds)" },
        pattern: { type: "string", description: "Regex pattern to match against node names" },
        replacement: { type: "string", description: "Replacement string for regex matches" },
        prefix: { type: "string", description: "Prefix to add to matching names" },
        sequential: { type: "boolean", description: "If true, append sequential numbers (1, 2, 3...)" },
      },
      required: ["pattern"],
    },
  },
  {
    name: "bulk_style",
    description:
      "Apply style changes to all nodes matching a selector. Selector can filter by type, name (regex), or existing style. Changes include fill, stroke, opacity, fontSize, cornerRadius.",
    params: {
      type: "object",
      properties: {
        scope: { type: "string", description: "Scope: 'file', 'page', or a node ID" },
        selector: {
          type: "object",
          properties: {
            type: { type: "string", description: "Node type (FRAME, TEXT, RECTANGLE, etc.)" },
            name: { type: "string", description: "Regex pattern for node name" },
            style: { type: "object", description: "Property-value pairs to match" },
          },
          description: "Criteria to match target nodes",
        },
        changes: {
          type: "object",
          description: "Style changes to apply: { fill: '#hex', stroke: '#hex', opacity: 0-1, fontSize: number, cornerRadius: number }",
        },
      },
      required: ["selector", "changes"],
    },
  },
  {
    name: "bulk_resize",
    description:
      "Resize multiple nodes. Provide absolute width/height or scaleX/scaleY to multiply current dimensions.",
    params: {
      type: "object",
      properties: {
        nodeIds: { type: "array", items: { type: "string" }, description: "Array of node IDs to resize" },
        width: { type: "number", description: "Absolute target width" },
        height: { type: "number", description: "Absolute target height" },
        scaleX: { type: "number", description: "Horizontal scale factor (e.g. 2 = double width)" },
        scaleY: { type: "number", description: "Vertical scale factor (e.g. 0.5 = half height)" },
      },
      required: ["nodeIds"],
    },
  },
  {
    name: "smart_align",
    description:
      "Auto-distribute nodes with equal spacing and alignment. Sort by position, calculate optimal spacing. Supports start/center/end/space-between alignment.",
    params: {
      type: "object",
      properties: {
        nodeIds: { type: "array", items: { type: "string" }, description: "Array of node IDs to align" },
        direction: { type: "string", enum: ["HORIZONTAL", "VERTICAL"], description: "Distribution direction" },
        spacing: { type: "number", description: "Fixed spacing between nodes in px" },
        alignment: { type: "string", enum: ["start", "center", "end", "space-between", "space-around"], description: "Alignment mode" },
      },
      required: ["nodeIds"],
    },
  },
  {
    name: "design_lint",
    description:
      "Scan design for quality issues: default naming (Rectangle 1), off-grid corner radius, inconsistent spacing, detached styles. Returns issues with severity and fix suggestions.",
    params: {
      type: "object",
      properties: {
        scope: { type: "string", description: "Scope: 'file', 'page', or a node ID" },
        rules: {
          type: "array",
          items: { type: "string", enum: ["naming", "corner-radius", "spacing", "detached-styles", "orphan-components"] },
          description: "Specific rules to check (default: all)",
        },
      },
    },
  },
  {
    name: "accessibility_check",
    description:
      "WCAG accessibility audit: contrast ratios (text vs background), touch target sizes (44px AA / 48px AAA), minimum font sizes. Returns violations with WCAG criteria and fix suggestions.",
    params: {
      type: "object",
      properties: {
        scope: { type: "string", description: "Scope: 'file', 'page', or a node ID" },
        level: { type: "string", enum: ["A", "AA", "AAA"], description: "WCAG conformance level (default: AA)" },
      },
    },
  },
  {
    name: "design_system_scan",
    description:
      "Analyze design system adoption: component coverage %, detached styles, non-token colors. Returns structured report with violations and improvement suggestions.",
    params: {
      type: "object",
      properties: {
        scope: { type: "string", description: "Scope: 'file', 'page', or a node ID" },
      },
    },
  },
  {
    name: "responsive_check",
    description:
      "Test a frame at multiple breakpoint widths. Reports text overflow, elements outside bounds, and overlapping elements per breakpoint.",
    params: {
      type: "object",
      properties: {
        nodeId: { type: "string", description: "ID of the frame to test" },
        breakpoints: { type: "array", items: { type: "number" }, description: "Array of widths to test (e.g. [320, 768, 1024, 1440])" },
      },
      required: ["nodeId", "breakpoints"],
    },
  },
  {
    name: "component_coverage",
    description:
      "Calculate what percentage of the file uses component instances vs raw nodes. Identifies repeated patterns that could be componentized.",
    params: {
      type: "object",
      properties: {
        scope: { type: "string", description: "Scope: 'file', 'page', or a node ID" },
      },
    },
  },
  {
    name: "duplicate_detector",
    description:
      "Find visually duplicate nodes using structural fingerprinting (type, size, fills, children). Groups duplicates by similarity. Use to find candidates for componentization.",
    params: {
      type: "object",
      properties: {
        scope: { type: "string", description: "Scope: 'file', 'page', or a node ID" },
        threshold: { type: "number", description: "Similarity threshold 0-1 (default: 0.8). Higher = stricter matching." },
      },
    },
  },
  {
    name: "color_palette_extract",
    description:
      "Extract every color used in the file (fills, strokes, text). Group near-duplicate colors using CIE76 deltaE. Suggest consolidation opportunities.",
    params: {
      type: "object",
      properties: {
        scope: { type: "string", description: "Scope: 'file', 'page', or a node ID" },
        threshold: { type: "number", description: "DeltaE threshold for grouping similar colors (default: 5)" },
      },
    },
  },
  {
    name: "typography_audit",
    description:
      "Audit all text nodes: collect unique font family/size/weight/lineHeight combinations with usage counts. Flag too many sizes or font families.",
    params: {
      type: "object",
      properties: {
        scope: { type: "string", description: "Scope: 'file', 'page', or a node ID" },
      },
    },
  },
  {
    name: "spacing_audit",
    description:
      "Analyze all auto-layout spacing and padding values. Flag values not on the base unit grid (default 8px). Show spacing distribution.",
    params: {
      type: "object",
      properties: {
        scope: { type: "string", description: "Scope: 'file', 'page', or a node ID" },
        baseUnit: { type: "number", description: "Base spacing unit in px (default: 8)" },
      },
    },
  },
  {
    name: "export_tokens",
    description:
      "Export all design variables/tokens from the file as JSON, CSS custom properties, or Tailwind config. Optionally filter by collection name.",
    params: {
      type: "object",
      properties: {
        format: { type: "string", enum: ["json", "css", "tailwind"], description: "Output format" },
        collections: { type: "array", items: { type: "string" }, description: "Filter to specific collection names" },
      },
      required: ["format"],
    },
  },
  {
    name: "import_tokens",
    description:
      "Import design tokens from a JSON or CSS string and create Figma variables. Creates a new collection if needed.",
    params: {
      type: "object",
      properties: {
        tokens: { type: "string", description: "Token string (JSON object or CSS :root block)" },
        format: { type: "string", enum: ["json", "css"], description: "Input format" },
        collectionName: { type: "string", description: "Collection name (default: 'Imported Tokens')" },
      },
      required: ["tokens", "format"],
    },
  },
  {
    name: "localize_text",
    description:
      "Replace text nodes with localized strings from a mapping. Optionally detect hardcoded strings not in the map.",
    params: {
      type: "object",
      properties: {
        localeMap: {
          type: "object",
          description: "Mapping of source text → translated text (e.g. { 'Hello': 'Hola', 'Submit': 'Enviar' })",
        },
        scope: { type: "string", description: "Scope: 'file', 'page', or a node ID" },
        detectHardcoded: { type: "boolean", description: "If true, report text nodes not in the locale map" },
      },
      required: ["localeMap"],
    },
  },
  {
    name: "annotation_generate",
    description:
      "Generate dev handoff annotations for a node. 'specs' shows dimensions/colors/radius. 'redlines' shows measurements between elements. 'measurements' shows width/height/position.",
    params: {
      type: "object",
      properties: {
        nodeId: { type: "string", description: "ID of the node to annotate" },
        type: { type: "string", enum: ["specs", "redlines", "measurements"], description: "Annotation type" },
      },
      required: ["nodeId", "type"],
    },
  },
  {
    name: "generate_layout",
    description:
      "Generate auto-layout frames from a natural language description. Supports: 'N column grid', 'header + content + footer', 'sidebar + main', 'card with image and text', 'form with N fields'. Pattern-matching based, not LLM.",
    params: {
      type: "object",
      properties: {
        description: { type: "string", description: "Layout description (e.g. '3 column grid', 'sidebar and main content')" },
        parentId: { type: "string", description: "Parent node ID to attach layout to (default: current page)" },
        width: { type: "number", description: "Layout width in px (default: 1200)" },
        height: { type: "number", description: "Layout height in px (default: 800)" },
      },
      required: ["description"],
    },
  },
];

export function getSuperPowerSchema() {
  const commandNames = SUPERPOWER_COMMANDS.map((c) => c.name);
  const commandDescriptions = SUPERPOWER_COMMANDS.map(
    (c) => `• **${c.name}**: ${c.description}`
  ).join("\n");

  return {
    name: "figma_superpowers",
    description: `AI-only superpower tools for Figma — capabilities no human designer has natively.\n\nAvailable commands:\n${commandDescriptions}`,
    inputSchema: {
      type: "object" as const,
      properties: {
        command: {
          type: "string",
          enum: commandNames,
          description: "The superpower command to execute",
        },
        params: {
          type: "object",
          description: "Parameters for the command (see individual command descriptions)",
        },
      },
      required: ["command"],
    },
  };
}
