export interface ListDiffOptions {
  timeout?: number;
  maxDepth?: number;
}

export interface ListDiffResult {
  success: boolean;
  urls: string[];
  selectorHierarchy: string;
  error?: string;
  durationMs: number;
}

export interface UrlLookupResult {
  found: boolean;
  foundUrls: string[];
  containerSelector?: string;
  /** All URLs extracted from the container (avoids duplicate fetch) */
  containerUrls?: string[];
  /** DOM hierarchy for AI analysis (avoids duplicate fetch) */
  selectorHierarchy?: string;
}
