/**
 * Prompt for extracting stable CSS selectors from DOM structure
 * Used as fallback when URL reverse-lookup fails
 */

export const EXTRACT_STABLE_SELECTORS_SYSTEM_PROMPT = `You are a CSS selector extraction assistant. Your task is to identify stable CSS selectors that can reliably locate a list container element.

Guidelines:
- Extract selectors that are unlikely to change with page updates
- Prefer semantic class names (post, article, entry, list, content) over generated ones
- Exclude hash-like class names (e.g., sc-abc123, _1a2b3c, css-xyz789)
- Return multiple selectors in order of reliability (most stable first)
- Output as JSON array of strings`;

export interface ExtractStableSelectorsInput {
  selectorHierarchy: string;
  currentSelector: string;
}

export function buildExtractStableSelectorsPrompt(input: ExtractStableSelectorsInput): string {
  return `Extract stable CSS selectors that can locate this list container.

Current selector being used: ${input.currentSelector}

HTML Structure:
${input.selectorHierarchy}

Return a JSON array of 3-5 stable CSS selectors that can identify this container, ordered from most to least reliable. Example: ["section.posts", "#content article", "main .post-list"]

Exclude any hash-like class names (patterns like sc-*, css-*, _abc123, etc.). Focus on semantic names and IDs.`;
}

export interface StableSelectorsResult {
  selectors: string[];
}

export function parseStableSelectorsResponse(response: string): StableSelectorsResult {
  try {
    // Try to extract JSON array from response
    const match = response.match(/\[[\s\S]*\]/);
    if (match) {
      const selectors = JSON.parse(match[0]) as string[];
      return { selectors: selectors.filter((s) => typeof s === "string" && s.length > 0) };
    }
  } catch {
    // Fall back to line-by-line parsing
    const lines = response.split("\n").filter((line) => line.trim().startsWith('"'));
    const selectors = lines.map((line) => line.replace(/[",]/g, "").trim());
    return { selectors };
  }

  return { selectors: [] };
}
