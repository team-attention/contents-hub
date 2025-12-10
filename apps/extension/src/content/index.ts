/**
 * Content script for Contents Hub extension
 * Runs in the context of web pages
 */

import type { KeyCombination, Settings } from "../lib/settings-storage";
import { isInputFocused, matchesShortcut } from "../lib/shortcut-utils";

console.log("Contents Hub content script loaded on:", window.location.href);

const SETTINGS_KEY = "settings.all";

let currentShortcut: KeyCombination | null = null;

async function loadShortcut(): Promise<void> {
  try {
    const result = await chrome.storage.local.get(SETTINGS_KEY);
    const settings = result[SETTINGS_KEY] as Settings | undefined;

    if (settings?.shortcuts?.quickSubscribe) {
      currentShortcut = settings.shortcuts.quickSubscribe;
    } else {
      currentShortcut = {
        key: "s",
        ctrlKey: true,
        shiftKey: true,
        altKey: false,
        metaKey: false,
      };
    }
  } catch (error) {
    console.error("Failed to load shortcut settings:", error);
  }
}

function handleKeyDown(event: KeyboardEvent): void {
  if (!currentShortcut) return;

  if (isInputFocused()) return;

  if (matchesShortcut(event, currentShortcut)) {
    event.preventDefault();
    event.stopPropagation();

    chrome.runtime.sendMessage({ type: "QUICK_SUBSCRIBE" }).catch((error) => {
      console.error("Failed to send QUICK_SUBSCRIBE message:", error);
    });
  }
}

loadShortcut();

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local" && changes[SETTINGS_KEY]) {
    const newSettings = changes[SETTINGS_KEY].newValue as Settings | undefined;
    if (newSettings?.shortcuts?.quickSubscribe) {
      currentShortcut = newSettings.shortcuts.quickSubscribe;
    }
  }
});

document.addEventListener("keydown", handleKeyDown, true);
