/**
 * Highlight Manager
 * Handles hover highlight overlay for element selection
 */

export class HighlightManager {
  private overlay: HTMLDivElement | null = null;
  private shadowRoot: ShadowRoot;
  private currentElement: Element | null = null;

  constructor(shadowRoot: ShadowRoot) {
    this.shadowRoot = shadowRoot;
    this.createOverlay();
  }

  private createOverlay(): void {
    this.overlay = document.createElement("div");
    this.overlay.className = "highlight-overlay";
    this.overlay.style.display = "none";
    this.shadowRoot.appendChild(this.overlay);
  }

  /**
   * Update highlight position to match element bounds
   */
  highlight(element: Element | null): void {
    if (!this.overlay) return;

    if (!element || element === document.body || element === document.documentElement) {
      this.hide();
      return;
    }

    this.currentElement = element;

    const rect = element.getBoundingClientRect();

    // Add small padding for visual clarity
    const padding = 2;

    this.overlay.style.display = "block";
    this.overlay.style.top = `${rect.top - padding}px`;
    this.overlay.style.left = `${rect.left - padding}px`;
    this.overlay.style.width = `${rect.width + padding * 2}px`;
    this.overlay.style.height = `${rect.height + padding * 2}px`;
    this.overlay.classList.remove("selected");
  }

  /**
   * Mark current highlight as selected (solid border)
   */
  markSelected(): void {
    if (this.overlay) {
      this.overlay.classList.add("selected");
    }
  }

  /**
   * Hide the highlight overlay
   */
  hide(): void {
    if (this.overlay) {
      this.overlay.style.display = "none";
      this.overlay.classList.remove("selected");
    }
    this.currentElement = null;
  }

  /**
   * Get currently highlighted element
   */
  getCurrentElement(): Element | null {
    return this.currentElement;
  }

  /**
   * Update position (e.g., on scroll)
   */
  updatePosition(): void {
    if (this.currentElement) {
      this.highlight(this.currentElement);
    }
  }

  /**
   * Cleanup
   */
  destroy(): void {
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
    this.currentElement = null;
  }
}

/**
 * Get the actual target element from mouse event
 * Traverses through shadow roots if needed
 */
export function getElementFromPoint(
  x: number,
  y: number,
  excludeRoot: Element | null,
): Element | null {
  // Get all elements at point
  const elements = document.elementsFromPoint(x, y);

  // Filter out our picker UI and find the first valid element
  for (const el of elements) {
    // Skip our picker root
    if (excludeRoot && (el === excludeRoot || excludeRoot.contains(el))) {
      continue;
    }

    // Skip script, style, and other non-visual elements
    const tagName = el.tagName.toLowerCase();
    if (["script", "style", "link", "meta", "head", "html"].includes(tagName)) {
      continue;
    }

    return el;
  }

  return null;
}

/**
 * Check if an element is suitable for selection
 * (has meaningful content, not too small, etc.)
 */
export function isSelectableElement(element: Element): boolean {
  const rect = element.getBoundingClientRect();

  // Skip very small elements (likely invisible or decorative)
  if (rect.width < 20 || rect.height < 20) {
    return false;
  }

  // Skip elements that are off-screen
  if (
    rect.bottom < 0 ||
    rect.top > window.innerHeight ||
    rect.right < 0 ||
    rect.left > window.innerWidth
  ) {
    return false;
  }

  return true;
}
