// plugin/__tests__/superpowers-routing.test.ts
import { describe, it, expect, vi } from "vitest";
import {
  bulkRename,
  bulkStyle,
  bulkResize,
  smartAlign,
  designLint,
  accessibilityCheck,
  designSystemScan,
  responsiveCheck,
  componentCoverage,
  duplicateDetector,
  colorPaletteExtract,
  typographyAudit,
  spacingAudit,
  exportTokens,
  importTokens,
  localizeText,
  annotationGenerate,
  generateLayout,
} from "../executors/superpowers.js";

const SUPERPOWER_EXECUTOR_MAP: Record<string, Function> = {
  bulk_rename: bulkRename,
  bulk_style: bulkStyle,
  bulk_resize: bulkResize,
  smart_align: smartAlign,
  design_lint: designLint,
  accessibility_check: accessibilityCheck,
  design_system_scan: designSystemScan,
  responsive_check: responsiveCheck,
  component_coverage: componentCoverage,
  duplicate_detector: duplicateDetector,
  color_palette_extract: colorPaletteExtract,
  typography_audit: typographyAudit,
  spacing_audit: spacingAudit,
  export_tokens: exportTokens,
  import_tokens: importTokens,
  localize_text: localizeText,
  annotation_generate: annotationGenerate,
  generate_layout: generateLayout,
};

describe("superpowers routing", () => {
  it("maps all 18 commands to executor functions", () => {
    expect(Object.keys(SUPERPOWER_EXECUTOR_MAP)).toHaveLength(18);
  });

  it("every mapped executor is a function", () => {
    for (const [name, executor] of Object.entries(SUPERPOWER_EXECUTOR_MAP)) {
      expect(typeof executor).toBe("function");
    }
  });

  it("executors can be called with params and figmaApi", async () => {
    const mockFigma = {
      getNodeById: () => null,
      currentPage: { children: [] },
      root: { children: [] },
    };

    // Verify each executor handles missing params gracefully
    for (const [name, executor] of Object.entries(SUPERPOWER_EXECUTOR_MAP)) {
      const result = await executor({}, mockFigma as unknown as PluginAPI);
      expect(result).toBeDefined();
      expect(typeof result.success).toBe("boolean");
    }
  });
});
