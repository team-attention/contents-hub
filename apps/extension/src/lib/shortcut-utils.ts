import type { KeyCombination } from "./settings-storage";

export function isMac(): boolean {
  return navigator.platform.toUpperCase().indexOf("MAC") >= 0;
}

export function getModifierLabel(modifier: "ctrl" | "shift" | "alt" | "meta"): string {
  const mac = isMac();
  switch (modifier) {
    case "ctrl":
      return mac ? "^" : "Ctrl";
    case "shift":
      return mac ? "Shift" : "Shift";
    case "alt":
      return mac ? "Option" : "Alt";
    case "meta":
      return mac ? "Cmd" : "Win";
  }
}

export function formatShortcut(combo: KeyCombination): string {
  const parts: string[] = [];
  const mac = isMac();

  if (mac) {
    if (combo.ctrlKey) parts.push("^");
    if (combo.altKey) parts.push("Option");
    if (combo.shiftKey) parts.push("Shift");
    if (combo.metaKey) parts.push("Cmd");
  } else {
    if (combo.ctrlKey) parts.push("Ctrl");
    if (combo.altKey) parts.push("Alt");
    if (combo.shiftKey) parts.push("Shift");
    if (combo.metaKey) parts.push("Win");
  }

  parts.push(combo.key.toUpperCase());
  return parts.join(mac ? "" : "+");
}

export function keyEventToCombo(event: KeyboardEvent): KeyCombination | null {
  const ignoreKeys = ["Control", "Shift", "Alt", "Meta", "CapsLock", "Tab", "Escape"];

  if (ignoreKeys.includes(event.key)) {
    return null;
  }

  const hasModifier = event.ctrlKey || event.shiftKey || event.altKey || event.metaKey;
  if (!hasModifier) {
    return null;
  }

  return {
    key: event.key.toLowerCase(),
    ctrlKey: event.ctrlKey,
    shiftKey: event.shiftKey,
    altKey: event.altKey,
    metaKey: event.metaKey,
  };
}

export function matchesShortcut(event: KeyboardEvent, combo: KeyCombination): boolean {
  return (
    event.key.toLowerCase() === combo.key.toLowerCase() &&
    event.ctrlKey === combo.ctrlKey &&
    event.shiftKey === combo.shiftKey &&
    event.altKey === combo.altKey &&
    event.metaKey === combo.metaKey
  );
}

export function isInputFocused(): boolean {
  const activeElement = document.activeElement;
  if (!activeElement) return false;

  const tagName = activeElement.tagName.toLowerCase();
  if (tagName === "input" || tagName === "textarea" || tagName === "select") {
    return true;
  }

  if (activeElement.hasAttribute("contenteditable")) {
    return true;
  }

  return false;
}
