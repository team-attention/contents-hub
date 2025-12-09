const SETTINGS_KEY_PREFIX = "settings.";

export interface KeyCombination {
  key: string;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  metaKey: boolean;
}

export interface ShortcutSettings {
  quickSubscribe: KeyCombination;
}

export interface Settings {
  shortcuts: ShortcutSettings;
}

export const DEFAULT_SHORTCUT: KeyCombination = {
  key: "s",
  ctrlKey: true,
  shiftKey: true,
  altKey: false,
  metaKey: false,
};

export const DEFAULT_SETTINGS: Settings = {
  shortcuts: {
    quickSubscribe: DEFAULT_SHORTCUT,
  },
};

export async function getSettings(): Promise<Settings> {
  const result = await chrome.storage.local.get(`${SETTINGS_KEY_PREFIX}all`);
  const stored = result[`${SETTINGS_KEY_PREFIX}all`];

  if (!stored) {
    return DEFAULT_SETTINGS;
  }

  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    shortcuts: {
      ...DEFAULT_SETTINGS.shortcuts,
      ...stored.shortcuts,
    },
  };
}

export async function setSettings(settings: Settings): Promise<void> {
  await chrome.storage.local.set({ [`${SETTINGS_KEY_PREFIX}all`]: settings });
}

export async function resetToDefaults(): Promise<void> {
  await setSettings(DEFAULT_SETTINGS);
}

export async function updateShortcut(shortcut: KeyCombination): Promise<void> {
  const settings = await getSettings();
  settings.shortcuts.quickSubscribe = shortcut;
  await setSettings(settings);
}
