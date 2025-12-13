import type { RenderType } from "@contents-hub/shared";

export interface ListDiffOptions {
  timeout?: number;
  maxDepth?: number;
  /** Known render type - skip detection if provided */
  renderType?: RenderType;
}

export interface ListDiffResult {
  success: boolean;
  urls: string[];
  selectorHierarchy: string;
  error?: string;
  durationMs: number;
  /** Detected render type (static or dynamic) */
  detectedRenderType?: RenderType;
}

export interface UrlLookupResult {
  found: boolean;
  foundUrls: string[];
  containerSelector?: string;
  /** All URLs extracted from the container (avoids duplicate fetch) */
  containerUrls?: string[];
  /** DOM hierarchy for AI analysis (avoids duplicate fetch) */
  selectorHierarchy?: string;
  /** Detected render type (static or dynamic) */
  detectedRenderType?: RenderType;
}
