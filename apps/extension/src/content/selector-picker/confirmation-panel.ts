/**
 * Confirmation Panel UI
 * Shadow DOM based UI for confirming selector selection
 */

export type PanelState = "selecting" | "confirming" | "loading" | "success" | "error";

export interface PanelCallbacks {
  onCancel: () => void;
  onReselect: () => void;
  onConfirm: () => void;
}

export class ConfirmationPanel {
  private shadowRoot: ShadowRoot;
  private banner: HTMLDivElement | null = null;
  private panel: HTMLDivElement | null = null;
  private callbacks: PanelCallbacks;

  constructor(shadowRoot: ShadowRoot, callbacks: PanelCallbacks) {
    this.shadowRoot = shadowRoot;
    this.callbacks = callbacks;
  }

  /**
   * Show the top banner (selecting mode)
   */
  showBanner(): void {
    this.hideBanner();
    this.hidePanel();

    this.banner = document.createElement("div");
    this.banner.className = "picker-banner";
    this.banner.innerHTML = `
      <span class="banner-icon">&#127919;</span>
      <span class="banner-text">Click to select a list container</span>
      <button class="banner-cancel">Cancel (ESC)</button>
    `;

    const cancelBtn = this.banner.querySelector(".banner-cancel");
    cancelBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      this.callbacks.onCancel();
    });

    this.shadowRoot.appendChild(this.banner);
  }

  /**
   * Hide the top banner
   */
  hideBanner(): void {
    if (this.banner) {
      this.banner.remove();
      this.banner = null;
    }
  }

  /**
   * Show confirmation panel with selector
   */
  showConfirmation(selector: string): void {
    this.hideBanner();
    this.hidePanel();

    this.panel = document.createElement("div");
    this.panel.className = "confirmation-panel";
    this.panel.innerHTML = `
      <div class="panel-header">
        <span class="panel-title">Confirm Selection</span>
        <button class="panel-close">&times;</button>
      </div>
      <div class="panel-body">
        <div class="selector-preview">
          <label class="selector-label">Selector:</label>
          <code class="selector-text">${this.escapeHtml(selector)}</code>
        </div>
        <div class="result-area">
          <div class="loading">
            <div class="spinner"></div>
            <span class="result-text">Checking for URLs...</span>
          </div>
        </div>
      </div>
      <div class="panel-footer">
        <button class="btn btn-reselect">Re-select</button>
        <button class="btn btn-cancel">Cancel</button>
        <button class="btn btn-confirm" disabled>Watch</button>
      </div>
    `;

    // Event listeners
    const closeBtn = this.panel.querySelector(".panel-close");
    closeBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      this.callbacks.onCancel();
    });

    const reselectBtn = this.panel.querySelector(".btn-reselect");
    reselectBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      this.callbacks.onReselect();
    });

    const cancelBtn = this.panel.querySelector(".btn-cancel");
    cancelBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      this.callbacks.onCancel();
    });

    const confirmBtn = this.panel.querySelector(".btn-confirm");
    confirmBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      this.callbacks.onConfirm();
    });

    this.shadowRoot.appendChild(this.panel);
  }

  /**
   * Update result area with success
   */
  showSuccess(urlCount: number): void {
    const resultArea = this.panel?.querySelector(".result-area");
    if (resultArea) {
      resultArea.innerHTML = `
        <div class="success">
          <span class="result-icon">&#10003;</span>
          <span class="result-text">${urlCount} URL${urlCount !== 1 ? "s" : ""} found</span>
        </div>
      `;
    }

    // Enable confirm button
    const confirmBtn = this.panel?.querySelector(".btn-confirm") as HTMLButtonElement;
    if (confirmBtn) {
      confirmBtn.disabled = false;
    }
  }

  /**
   * Update result area with error
   */
  showError(message: string): void {
    const resultArea = this.panel?.querySelector(".result-area");
    if (resultArea) {
      resultArea.innerHTML = `
        <div class="error">
          <span class="result-icon">&#10007;</span>
          <span class="result-text">${this.escapeHtml(message)}</span>
        </div>
      `;
    }

    // Keep confirm button disabled
    const confirmBtn = this.panel?.querySelector(".btn-confirm") as HTMLButtonElement;
    if (confirmBtn) {
      confirmBtn.disabled = true;
    }
  }

  /**
   * Show loading state in result area
   */
  showLoading(text = "Processing..."): void {
    const resultArea = this.panel?.querySelector(".result-area");
    if (resultArea) {
      resultArea.innerHTML = `
        <div class="loading">
          <div class="spinner"></div>
          <span class="result-text">${this.escapeHtml(text)}</span>
        </div>
      `;
    }

    // Disable confirm button while loading
    const confirmBtn = this.panel?.querySelector(".btn-confirm") as HTMLButtonElement;
    if (confirmBtn) {
      confirmBtn.disabled = true;
    }
  }

  /**
   * Hide confirmation panel
   */
  hidePanel(): void {
    if (this.panel) {
      this.panel.remove();
      this.panel = null;
    }
  }

  /**
   * Show success toast and auto-hide
   */
  showSuccessToast(message: string): void {
    this.hidePanel();
    this.hideBanner();

    const toast = document.createElement("div");
    toast.className = "success-toast";
    toast.innerHTML = `
      <span class="icon">&#10003;</span>
      <span>${this.escapeHtml(message)}</span>
    `;

    this.shadowRoot.appendChild(toast);

    // Auto-remove after 3 seconds
    setTimeout(() => {
      toast.remove();
    }, 3000);
  }

  /**
   * Cleanup all UI elements
   */
  destroy(): void {
    this.hideBanner();
    this.hidePanel();
  }

  /**
   * Escape HTML to prevent XSS
   */
  private escapeHtml(text: string): string {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }
}
