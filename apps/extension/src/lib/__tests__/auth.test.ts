import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock supabase before importing auth
vi.mock("../supabase", () => ({
  supabase: {
    auth: {
      signInWithOAuth: vi.fn().mockResolvedValue({
        data: { url: "https://test.supabase.co/auth/v1/authorize?provider=google" },
        error: null,
      }),
      setSession: vi.fn().mockResolvedValue({ error: null }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
    },
  },
}));

import { handleOAuthCallback, signInWithGoogle, signOut } from "../auth";
import { supabase } from "../supabase";

describe("auth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("signInWithGoogle", () => {
    it("should call signInWithOAuth and open new tab", async () => {
      await signInWithGoogle();

      expect(chrome.identity.getRedirectURL).toHaveBeenCalled();
      expect(supabase.auth.signInWithOAuth).toHaveBeenCalledWith({
        provider: "google",
        options: {
          redirectTo: "https://test-extension-id.chromiumapp.org/",
          skipBrowserRedirect: true,
        },
      });
      expect(chrome.tabs.create).toHaveBeenCalledWith({
        url: "https://test.supabase.co/auth/v1/authorize?provider=google",
      });
    });

    it("should throw error when signInWithOAuth fails", async () => {
      vi.mocked(supabase.auth.signInWithOAuth).mockResolvedValueOnce({
        data: { url: null, provider: "google" },
        error: new Error("OAuth error") as never,
      });

      await expect(signInWithGoogle()).rejects.toThrow("OAuth error");
    });

    it("should throw error when no OAuth URL returned", async () => {
      vi.mocked(supabase.auth.signInWithOAuth).mockResolvedValueOnce({
        data: { url: null, provider: "google" },
        error: null,
      });

      await expect(signInWithGoogle()).rejects.toThrow("No OAuth URL returned");
    });
  });

  describe("handleOAuthCallback", () => {
    it("should extract tokens and set session", async () => {
      const callbackUrl =
        "https://test-extension-id.chromiumapp.org/#access_token=test-access&refresh_token=test-refresh";

      await handleOAuthCallback(callbackUrl);

      expect(supabase.auth.setSession).toHaveBeenCalledWith({
        access_token: "test-access",
        refresh_token: "test-refresh",
      });
    });

    it("should throw error when tokens are missing", async () => {
      const callbackUrl = "https://test-extension-id.chromiumapp.org/#error=access_denied";

      await expect(handleOAuthCallback(callbackUrl)).rejects.toThrow();
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
