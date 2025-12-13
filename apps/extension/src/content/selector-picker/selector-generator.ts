/**
 * CSS Selector Generator
 * Generates stable, unique CSS selectors for DOM elements
 */

/**
 * Patterns that indicate dynamically generated class names (to be excluded)
 */
const DYNAMIC_CLASS_PATTERNS = [
  /^sc-[a-z0-9]+$/i, // styled-components: sc-abc123
  /^_[a-z0-9]+$/i, // CSS Modules: _1a2b3c
  /^css-[a-z0-9]+$/i, // emotion: css-abc123
  /^[a-z]{1,3}[0-9]{4,}$/i, // Short prefix + long number: a12345
  /^[a-z0-9]{6,}$/i, // Long alphanumeric strings without meaning
  /^jsx-[a-z0-9]+$/i, // styled-jsx: jsx-abc123
  /^svelte-[a-z0-9]+$/i, // Svelte: svelte-abc123
  /^tw-[a-z0-9]+$/i, // Some Tailwind variants
];

/**
 * Check if a class name is dynamically generated
 */
function isDynamicClass(className: string): boolean {
  return DYNAMIC_CLASS_PATTERNS.some((pattern) => pattern.test(className));
}

/**
 * Check if an ID is stable (not dynamically generated)
 */
function isStableId(id: string): boolean {
  // Exclude pure numbers
  if (/^\d+$/.test(id)) return false;
  // Exclude patterns that look dynamic
  return !isDynamicClass(id);
}

/**
 * Get stable classes from an element (excluding dynamic ones)
 */
function getStableClasses(element: Element): string[] {
  return Array.from(element.classList).filter((cls) => !isDynamicClass(cls));
}

/**
 * Escape special characters in CSS selector
 */
function escapeCSS(str: string): string {
  return CSS.escape(str);
}

/**
 * Generate a selector segment for a single element
 */
function getElementSegment(element: Element): string {
  const tag = element.tagName.toLowerCase();

  // 1. Check for stable ID
  if (element.id && isStableId(element.id)) {
    return `#${escapeCSS(element.id)}`;
  }

  // 2. Use stable classes (max 2 for readability)
  const stableClasses = getStableClasses(element).slice(0, 2);

  if (stableClasses.length > 0) {
    const classSelector = stableClasses.map((cls) => `.${escapeCSS(cls)}`).join("");
    return `${tag}${classSelector}`;
  }

  // 3. Check for useful attributes
  const usefulAttrs = ["role", "data-testid", "aria-label", "name"];
  for (const attr of usefulAttrs) {
    const value = element.getAttribute(attr);
    if (value) {
      return `${tag}[${attr}="${escapeCSS(value)}"]`;
    }
  }

  // 4. Use nth-of-type if needed
  const parent = element.parentElement;
  if (parent) {
    const siblings = Array.from(parent.children);
    const sameTagSiblings = siblings.filter((s) => s.tagName === element.tagName);

    if (sameTagSiblings.length === 1) {
      return tag;
    }

    const index = sameTagSiblings.indexOf(element) + 1;
    return `${tag}:nth-of-type(${index})`;
  }

  return tag;
}

/**
 * Check if a selector uniquely identifies an element
 */
function isUniqueSelector(selector: string): boolean {
  try {
    return document.querySelectorAll(selector).length === 1;
  } catch {
    return false;
  }
}

/**
 * Generate a unique CSS selector for an element
 * Uses bottom-up approach, building the selector path until it's unique
 */
export function generateSelector(element: Element): string {
  // Skip non-element nodes
  if (!(element instanceof Element)) {
    throw new Error("Invalid element");
  }

  // If element has a stable ID, use it directly
  if (element.id && isStableId(element.id)) {
    const idSelector = `#${escapeCSS(element.id)}`;
    if (isUniqueSelector(idSelector)) {
      return idSelector;
    }
  }

  // Build path bottom-up
  const path: string[] = [];
  let current: Element | null = element;

  while (current && current !== document.body && current !== document.documentElement) {
    const segment = getElementSegment(current);
    path.unshift(segment);

    // If we hit an ID, we can stop (IDs should be unique)
    if (segment.startsWith("#")) {
      break;
    }

    // Check if current path is unique
    const selector = path.join(" > ");
    if (isUniqueSelector(selector)) {
      return selector;
    }

    current = current.parentElement;
  }

  // Return the full path even if not unique (fallback)
  return path.join(" > ");
}

/**
 * Simplify a selector by trying shorter versions
 * Returns the shortest unique selector
 */
export function simplifySelector(selector: string): string {
  const parts = selector.split(" > ");

  // Try progressively shorter selectors (from the end)
  for (let i = 0; i < parts.length; i++) {
    const shortened = parts.slice(i).join(" > ");
    if (isUniqueSelector(shortened)) {
      return shortened;
    }
  }

  return selector;
}

/**
 * Validate that a selector matches the expected element
 */
export function validateSelector(selector: string, expectedElement: Element): boolean {
  try {
    const matched = document.querySelector(selector);
    return matched === expectedElement;
  } catch {
    return false;
  }
}
