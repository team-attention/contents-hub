import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChromeStorageAdapter } from "../chrome-storage-adapter";

describe("ChromeStorageAdapter", () => {
  let adapter: ChromeStorageAdapter;

  beforeEach(() => {
    adapter = new ChromeStorageAdapter();
    vi.clearAllMocks();
  });

  describe("getItem", () => {
    it("should return value from chrome.storage.local", async () => {
      const mockValue = "test-value";
      vi.mocked(chrome.storage.local.get).mockResolvedValueOnce({
        "supabase.auth.token": mockValue,
      });

      const result = await adapter.getItem("token");

      expect(chrome.storage.local.get).toHaveBeenCalledWith("supabase.auth.token");
      expect(result).toBe(mockValue);
    });

    it("should return null when key does not exist", async () => {
      vi.mocked(chrome.storage.local.get).mockResolvedValueOnce({});

      const result = await adapter.getItem("nonexistent");

      expect(result).toBeNull();
    });
  });

  describe("setItem", () => {
    it("should set value in chrome.storage.local", async () => {
      await adapter.setItem("token", "new-value");

      expect(chrome.storage.local.set).toHaveBeenCalledWith({
        "supabase.auth.token": "new-value",
      });
    });
  });

  describe("removeItem", () => {
    it("should remove value from chrome.storage.local", async () => {
      await adapter.removeItem("token");

      expect(chrome.storage.local.remove).toHaveBeenCalledWith("supabase.auth.token");
    });
  });
});
