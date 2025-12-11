import { useCallback, useEffect, useState } from "react";
import {
  DEFAULT_SETTINGS,
  type KeyCombination,
  type Settings,
  type ShortcutSettings,
  getSettings,
  resetToDefaults,
  updateShortcut,
} from "../lib/settings-storage";

interface UseSettingsResult {
  settings: Settings;
  isLoading: boolean;
  error: Error | null;
  saveShortcut: (type: keyof ShortcutSettings, shortcut: KeyCombination) => Promise<void>;
  reset: () => Promise<void>;
}

export function useSettings(): UseSettingsResult {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    getSettings()
      .then((loadedSettings) => {
        setSettings(loadedSettings);
        setIsLoading(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err : new Error("Failed to load settings"));
        setIsLoading(false);
      });

    const handleStorageChange = (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string,
    ) => {
      if (areaName === "local" && changes["settings.all"]) {
        const newSettings = changes["settings.all"].newValue;
        if (newSettings) {
          setSettings(newSettings);
        }
      }
    };

    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => chrome.storage.onChanged.removeListener(handleStorageChange);
  }, []);

  const saveShortcut = useCallback(
    async (type: keyof ShortcutSettings, shortcut: KeyCombination) => {
      try {
        await updateShortcut(type, shortcut);
      } catch (err) {
        setError(err instanceof Error ? err : new Error("Failed to save shortcut"));
        throw err;
      }
    },
    [],
  );

  const reset = useCallback(async () => {
    try {
      await resetToDefaults();
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to reset settings"));
      throw err;
    }
  }, []);

  return {
    settings,
    isLoading,
    error,
    saveShortcut,
    reset,
  };
}
