import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock supabase before importing auth
vi.mock("../supabase", () => ({
  supabase: {
    auth: {
      setSession: vi.fn().mockResolvedValue({ error: null }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
    },
  },
}));

vi.mock("../env", () => ({
  env: {
    SUPABASE_URL: "https://test.supabase.co",
    SUPABASE_ANON_KEY: "test-anon-key",
  },
}));

import { signInWithGoogle, signOut } from "../auth";
import { supabase } from "../supabase";

describe("auth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("signInWithGoogle", () => {
    it("should build correct OAuth URL and call launchWebAuthFlow", async () => {
      const mockRedirectUrl =
        "https://test-extension-id.chromiumapp.org/#access_token=test-access&refresh_token=test-refresh";
      vi.mocked(chrome.identity.launchWebAuthFlow).mockResolvedValueOnce(mockRedirectUrl);

      await signInWithGoogle();

      expect(chrome.identity.getRedirectURL).toHaveBeenCalled();
      expect(chrome.identity.launchWebAuthFlow).toHaveBeenCalledWith({
        url: expect.stringContaining("https://test.supabase.co/auth/v1/authorize"),
        interactive: true,
      });
      expect(supabase.auth.setSession).toHaveBeenCalledWith({
        access_token: "test-access",
        refresh_token: "test-refresh",
      });
    });

    it("should throw error when authentication is cancelled", async () => {
      vi.mocked(chrome.identity.launchWebAuthFlow).mockResolvedValueOnce(undefined);

      await expect(signInWithGoogle()).rejects.toThrow("Authentication was cancelled");
    });

    it("should throw error when tokens are missing", async () => {
      const mockRedirectUrl = "https://test-extension-id.chromiumapp.org/#error=access_denied";
      vi.mocked(chrome.identity.launchWebAuthFlow).mockResolvedValueOnce(mockRedirectUrl);

      await expect(signInWithGoogle()).rejects.toThrow();
    });
  });

  describe("signOut", () => {
    it("should call supabase signOut", async () => {
      await signOut();

      expect(supabase.auth.signOut).toHaveBeenCalled();
    });

    it("should throw error when signOut fails", async () => {
      vi.mocked(supabase.auth.signOut).mockResolvedValueOnce({
        error: new Error("Sign out failed") as never,
      });

      await expect(signOut()).rejects.toThrow("Sign out failed");
    });
  });
});
