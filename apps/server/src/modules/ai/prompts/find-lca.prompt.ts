/**
 * Prompt for finding the Lowest Common Ancestor (LCA) of URL elements
 * Used when reverse-looking up URLs to find their containing list element
 */

export const FIND_LCA_SYSTEM_PROMPT = `You are a DOM structure analysis assistant. Your task is to find the CSS selector for the container element that holds a list of content items.

Guidelines:
- Analyze the HTML structure to find the container that holds the target URLs
- Return a precise CSS selector that uniquely identifies this container
- Prefer stable selectors (id, semantic class names) over generated ones
- If multiple containers exist, choose the one containing the most target URLs
- Output only the CSS selector, nothing else`;

export interface FindLCAInput {
  selectorHierarchy: string;
  targetUrls: string[];
}

export function buildFindLCAPrompt(input: FindLCAInput): string {
  return `Find the CSS selector for the container element that holds the following URLs.

Target URLs:
${input.targetUrls.map((url, i) => `${i + 1}. ${url}`).join("\n")}

HTML Structure:
${input.selectorHierarchy}

Return only the CSS selector (e.g., "section.posts", "#main-content ul", "article.post-list") that identifies the container holding these URLs. Choose the most specific stable selector possible.`;
}
