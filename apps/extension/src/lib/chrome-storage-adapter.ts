const STORAGE_KEY_PREFIX = "supabase.auth.";

export class ChromeStorageAdapter {
  async getItem(key: string): Promise<string | null> {
    const result = await chrome.storage.local.get(STORAGE_KEY_PREFIX + key);
    return result[STORAGE_KEY_PREFIX + key] ?? null;
  }

  async setItem(key: string, value: string): Promise<void> {
    await chrome.storage.local.set({ [STORAGE_KEY_PREFIX + key]: value });
  }

  async removeItem(key: string): Promise<void> {
    await chrome.storage.local.remove(STORAGE_KEY_PREFIX + key);
  }
}
