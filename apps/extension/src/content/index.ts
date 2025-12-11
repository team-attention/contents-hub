/**
 * Content script for Contents Hub extension
 * Runs in the context of web pages
 */

import type { Settings, ShortcutSettings } from "../lib/settings-storage";
import { isInputFocused, matchesShortcut } from "../lib/shortcut-utils";

console.log("[ContentsHub] Content script loaded on:", window.location.href);

const DEBUG = true; // Set to false in production

// ============================================
// Toast Notification System
// ============================================

const TOAST_STYLES = `
  .toast-container {
    position: fixed;
    bottom: 24px;
    right: 24px;
    z-index: 2147483647;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }

  .toast {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 16px;
    background: white;
    border-radius: 10px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
    font-size: 14px;
    color: #333;
    opacity: 0;
    transform: translateY(20px);
    transition: all 0.3s ease;
  }

  .toast.show {
    opacity: 1;
    transform: translateY(0);
  }

  .toast.success {
    border-left: 4px solid #10b981;
  }

  .toast.error {
    border-left: 4px solid #ef4444;
  }

  .toast-icon {
    font-size: 18px;
    flex-shrink: 0;
  }

  .toast-content {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .toast-title {
    font-weight: 600;
    color: #111;
  }

  .toast-message {
    font-size: 12px;
    color: #666;
    max-width: 250px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;

let toastContainer: HTMLDivElement | null = null;
let toastShadow: ShadowRoot | null = null;

function createToastContainer(): ShadowRoot {
  if (toastContainer && toastShadow) return toastShadow;

  const container = document.createElement("div");
  container.id = "contents-hub-toast-container";

  // Use Shadow DOM to isolate styles from the page
  const shadow = container.attachShadow({ mode: "closed" });

  const style = document.createElement("style");
  style.textContent = TOAST_STYLES;
  shadow.appendChild(style);

  const wrapper = document.createElement("div");
  wrapper.className = "toast-container";
  shadow.appendChild(wrapper);

  document.body.appendChild(container);
  toastContainer = container;
  toastShadow = shadow;

  return shadow;
}

function showToast(type: "success" | "error", title: string, message?: string): void {
  const shadow = createToastContainer();

  const wrapper = shadow.querySelector(".toast-container");
  if (!wrapper) return;

  // Remove existing toasts
  wrapper.innerHTML = "";

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;

  const icon = type === "success" ? "✓" : "✕";

  toast.innerHTML = `
    <span class="toast-icon">${icon}</span>
    <div class="toast-content">
      <span class="toast-title">${title}</span>
      ${message ? `<span class="toast-message">${message}</span>` : ""}
    </div>
  `;

  wrapper.appendChild(toast);

  // Trigger animation
  requestAnimationFrame(() => {
    toast.classList.add("show");
  });

  // Auto remove after 3 seconds
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

let contextInvalidated = false;

function debugLog(...args: unknown[]) {
  if (DEBUG && !contextInvalidated) console.log("[ContentsHub:Shortcut]", ...args);
}

// Check if extension context is still valid
function isContextValid(): boolean {
  try {
    chrome.runtime.getURL("");
    return true;
  } catch {
    return false;
  }
}

// Cleanup when context is invalidated
function handleContextInvalidated() {
  if (contextInvalidated) return;
  contextInvalidated = true;
  console.log("[ContentsHub] Extension context invalidated, cleaning up...");
  document.removeEventListener("keydown", handleKeyDown, true);
}

const SETTINGS_KEY = "settings.all";

const DEFAULT_SHORTCUTS: ShortcutSettings = {
  quickSubscribe: {
    key: "s",
    ctrlKey: true,
    shiftKey: true,
    altKey: false,
    metaKey: false,
  },
  quickSave: {
    key: "d",
    ctrlKey: true,
    shiftKey: true,
    altKey: false,
    metaKey: false,
  },
};

let shortcuts: ShortcutSettings = { ...DEFAULT_SHORTCUTS };

async function loadShortcuts(): Promise<void> {
  try {
    const result = await chrome.storage.local.get(SETTINGS_KEY);
    const settings = result[SETTINGS_KEY] as Settings | undefined;

    debugLog("Raw storage result:", result);
    debugLog("Settings loaded:", settings);

    if (settings?.shortcuts) {
      shortcuts = {
        quickSubscribe: settings.shortcuts.quickSubscribe || DEFAULT_SHORTCUTS.quickSubscribe,
        quickSave: settings.shortcuts.quickSave || DEFAULT_SHORTCUTS.quickSave,
      };
      debugLog("Using custom shortcuts:", shortcuts);
    } else {
      debugLog("No custom shortcuts found, using defaults:", DEFAULT_SHORTCUTS);
    }
  } catch (error) {
    console.error("[ContentsHub:Shortcut] Failed to load shortcut settings:", error);
  }
}

function handleKeyDown(event: KeyboardEvent): void {
  // Check if context is still valid
  if (!isContextValid()) {
    handleContextInvalidated();
    return;
  }

  // Only log if modifier key is pressed (to avoid spam)
  const hasModifier = event.ctrlKey || event.shiftKey || event.altKey || event.metaKey;

  if (hasModifier) {
    debugLog("Key pressed:", {
      key: event.key,
      ctrlKey: event.ctrlKey,
      shiftKey: event.shiftKey,
      altKey: event.altKey,
      metaKey: event.metaKey,
    });
    debugLog("Current shortcuts config:", shortcuts);
  }

  if (isInputFocused()) {
    if (hasModifier) debugLog("Ignored: input field is focused");
    return;
  }

  const matchesSave = matchesShortcut(event, shortcuts.quickSave);
  const matchesSubscribe = matchesShortcut(event, shortcuts.quickSubscribe);

  if (hasModifier) {
    debugLog("Match results:", { matchesSave, matchesSubscribe });
  }

  if (matchesSave) {
    debugLog("✅ QUICK_SAVE triggered!");
    event.preventDefault();
    event.stopPropagation();

    chrome.runtime
      .sendMessage({ type: "QUICK_SAVE" })
      .then((response) => debugLog("QUICK_SAVE response:", response))
      .catch((error) => {
        console.error("[ContentsHub:Shortcut] Failed to send QUICK_SAVE message:", error);
      });
    return;
  }

  if (matchesSubscribe) {
    debugLog("✅ QUICK_SUBSCRIBE triggered!");
    event.preventDefault();
    event.stopPropagation();

    chrome.runtime
      .sendMessage({ type: "QUICK_SUBSCRIBE" })
      .then((response) => debugLog("QUICK_SUBSCRIBE response:", response))
      .catch((error) => {
        console.error("[ContentsHub:Shortcut] Failed to send QUICK_SUBSCRIBE message:", error);
      });
  }
}

debugLog("Initializing shortcuts...");
loadShortcuts().then(() => {
  debugLog("Shortcuts initialization complete");
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  debugLog("Storage changed:", { areaName, changes });

  if (areaName === "local" && changes[SETTINGS_KEY]) {
    const newSettings = changes[SETTINGS_KEY].newValue as Settings | undefined;
    debugLog("New settings detected:", newSettings);

    if (newSettings?.shortcuts) {
      shortcuts = {
        quickSubscribe: newSettings.shortcuts.quickSubscribe || DEFAULT_SHORTCUTS.quickSubscribe,
        quickSave: newSettings.shortcuts.quickSave || DEFAULT_SHORTCUTS.quickSave,
      };
      debugLog("Shortcuts updated to:", shortcuts);
    }
  }
});

document.addEventListener("keydown", handleKeyDown, true);

// ============================================
// Listen for feedback from Background
// ============================================

interface FeedbackMessage {
  type: "SAVE_FEEDBACK" | "WATCH_FEEDBACK";
  success: boolean;
  url?: string;
  message?: string;
}

chrome.runtime.onMessage.addListener((message: FeedbackMessage) => {
  debugLog("Received feedback:", message);

  if (message.type === "SAVE_FEEDBACK") {
    if (message.success) {
      showToast("success", message.message || "Saved!", message.url);
    } else {
      showToast("error", "Save failed", message.message);
    }
  }

  if (message.type === "WATCH_FEEDBACK") {
    if (message.success) {
      showToast("success", message.message || "Watching!", message.url);
    } else {
      showToast("error", "Watch failed", message.message);
    }
  }
});
