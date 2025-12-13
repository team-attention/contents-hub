/**
 * Selector Picker - Main Entry Point
 * State machine for the selector picker UI
 */

import type { WatchResultMessage } from "../../lib/messages";
import { ConfirmationPanel } from "./confirmation-panel";
import { HighlightManager, getElementFromPoint, isSelectableElement } from "./highlight";
import { generateSelector, simplifySelector } from "./selector-generator";
import { PICKER_STYLES } from "./styles";

// ============================================
// Types
// ============================================

type PickerMode = "idle" | "selecting" | "confirming" | "submitting";

interface PickerState {
  mode: PickerMode;
  url: string;
  title: string;
  selector: string;
  selectedElement: Element | null;
}

// ============================================
// Selector Picker Class
// ============================================

class SelectorPicker {
  private state: PickerState = {
    mode: "idle",
    url: "",
    title: "",
    selector: "",
    selectedElement: null,
  };

  private container: HTMLDivElement | null = null;
  private shadowRoot: ShadowRoot | null = null;
  private highlightManager: HighlightManager | null = null;
  private panel: ConfirmationPanel | null = null;

  // Bound event handlers (for removal)
  private boundHandleMouseMove: (e: MouseEvent) => void;
  private boundHandleClick: (e: MouseEvent) => void;
  private boundHandleKeyDown: (e: KeyboardEvent) => void;
  private boundHandleScroll: () => void;

  constructor() {
    this.boundHandleMouseMove = this.handleMouseMove.bind(this);
    this.boundHandleClick = this.handleClick.bind(this);
    this.boundHandleKeyDown = this.handleKeyDown.bind(this);
    this.boundHandleScroll = this.handleScroll.bind(this);
  }

  /**
   * Start the selector picker
   */
  start(url: string, title: string): void {
    if (this.state.mode !== "idle") {
      console.log("[SelectorPicker] Already active, ignoring start");
      return;
    }

    console.log("[SelectorPicker] Starting picker for:", url);

    this.state = {
      mode: "selecting",
      url,
      title,
      selector: "",
      selectedElement: null,
    };

    this.createUI();
    this.attachEventListeners();
    this.panel?.showBanner();
  }

  /**
   * Handle API result from background
   */
  handleResult(result: WatchResultMessage): void {
    console.log("[SelectorPicker] Received result:", result);

    if (this.state.mode === "confirming") {
      // We're waiting for URL count preview
      if (result.success && result.urlCount !== undefined) {
        this.panel?.showSuccess(result.urlCount);
      } else {
        this.panel?.showError(result.error || "No URLs found in selected area");
      }
    } else if (this.state.mode === "submitting") {
      // We submitted and got final result
      if (result.success) {
        this.panel?.showSuccessToast(`Now watching! ${result.urlCount || 0} URLs found.`);
        this.cleanup();
      } else {
        this.panel?.showError(result.error || "Failed to create subscription");
        // Go back to confirming state so user can retry or cancel
        this.state.mode = "confirming";
      }
    }
  }

  /**
   * Cancel and cleanup
   */
  cancel(): void {
    console.log("[SelectorPicker] Cancelling");
    this.cleanup();
  }

  // ============================================
  // Private Methods
  // ============================================

  private createUI(): void {
    // Create container
    this.container = document.createElement("div");
    this.container.id = "contents-hub-picker-root";

    // Create shadow root for style isolation
    this.shadowRoot = this.container.attachShadow({ mode: "closed" });

    // Add styles
    const style = document.createElement("style");
    style.textContent = PICKER_STYLES;
    this.shadowRoot.appendChild(style);

    // Initialize managers
    this.highlightManager = new HighlightManager(this.shadowRoot);
    this.panel = new ConfirmationPanel(this.shadowRoot, {
      onCancel: () => this.cancel(),
      onReselect: () => this.reselect(),
      onConfirm: () => this.confirm(),
    });

    // Add to page
    document.body.appendChild(this.container);
  }

  private attachEventListeners(): void {
    // Use capture phase to intercept events before page handlers
    document.addEventListener("mousemove", this.boundHandleMouseMove, { capture: true });
    document.addEventListener("click", this.boundHandleClick, { capture: true });
    document.addEventListener("keydown", this.boundHandleKeyDown, { capture: true });
    window.addEventListener("scroll", this.boundHandleScroll, { capture: true, passive: true });
  }

  private removeEventListeners(): void {
    document.removeEventListener("mousemove", this.boundHandleMouseMove, { capture: true });
    document.removeEventListener("click", this.boundHandleClick, { capture: true });
    document.removeEventListener("keydown", this.boundHandleKeyDown, { capture: true });
    window.removeEventListener("scroll", this.boundHandleScroll, { capture: true });
  }

  private handleMouseMove(e: MouseEvent): void {
    if (this.state.mode !== "selecting") return;

    const element = getElementFromPoint(e.clientX, e.clientY, this.container);

    if (element && isSelectableElement(element)) {
      this.highlightManager?.highlight(element);
    }
  }

  private handleClick(e: MouseEvent): void {
    if (this.state.mode !== "selecting") return;

    // Stop the click from propagating to the page
    e.preventDefault();
    e.stopPropagation();

    const element = getElementFromPoint(e.clientX, e.clientY, this.container);

    if (!element || !isSelectableElement(element)) {
      console.log("[SelectorPicker] Invalid element clicked");
      return;
    }

    this.selectElement(element);
  }

  private handleKeyDown(e: KeyboardEvent): void {
    if (this.state.mode === "idle") return;

    // ESC to cancel
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      this.cancel();
    }
  }

  private handleScroll(): void {
    // Update highlight position on scroll
    this.highlightManager?.updatePosition();
  }

  private selectElement(element: Element): void {
    console.log("[SelectorPicker] Element selected:", element);

    // Generate selector
    let selector = generateSelector(element);
    selector = simplifySelector(selector);

    console.log("[SelectorPicker] Generated selector:", selector);

    this.state.mode = "confirming";
    this.state.selector = selector;
    this.state.selectedElement = element;

    // Update UI
    this.highlightManager?.highlight(element);
    this.highlightManager?.markSelected();
    this.panel?.showConfirmation(selector);

    // Request URL count preview from background
    this.requestUrlPreview(selector);
  }

  private requestUrlPreview(selector: string): void {
    // Send message to background to check URL count
    chrome.runtime
      .sendMessage({
        type: "PREVIEW_SELECTOR",
        url: this.state.url,
        selector: selector,
      })
      .then((response) => {
        if (response) {
          this.handleResult(response as WatchResultMessage);
        }
      })
      .catch((error) => {
        console.error("[SelectorPicker] Preview request failed:", error);
        // Show a generic message - user can still proceed
        this.panel?.showSuccess(0);
      });
  }

  private reselect(): void {
    console.log("[SelectorPicker] Re-selecting");

    this.state.mode = "selecting";
    this.state.selector = "";
    this.state.selectedElement = null;

    this.highlightManager?.hide();
    this.panel?.showBanner();
  }

  private confirm(): void {
    console.log("[SelectorPicker] Confirming selection");

    this.state.mode = "submitting";
    this.panel?.showLoading("Creating subscription...");

    // Send to background for API call
    chrome.runtime
      .sendMessage({
        type: "SUBMIT_SELECTOR",
        url: this.state.url,
        name: this.state.title,
        selector: this.state.selector,
      })
      .then((response) => {
        if (response) {
          this.handleResult(response as WatchResultMessage);
        }
      })
      .catch((error) => {
        console.error("[SelectorPicker] Submit failed:", error);
        this.panel?.showError("Failed to create subscription");
        this.state.mode = "confirming";
      });
  }

  private cleanup(): void {
    console.log("[SelectorPicker] Cleaning up");

    this.removeEventListeners();

    this.highlightManager?.destroy();
    this.highlightManager = null;

    this.panel?.destroy();
    this.panel = null;

    if (this.container) {
      this.container.remove();
      this.container = null;
    }

    this.shadowRoot = null;

    this.state = {
      mode: "idle",
      url: "",
      title: "",
      selector: "",
      selectedElement: null,
    };
  }

  /**
   * Check if picker is currently active
   */
  isActive(): boolean {
    return this.state.mode !== "idle";
  }
}

// ============================================
// Export singleton instance
// ============================================

export const selectorPicker = new SelectorPicker();
