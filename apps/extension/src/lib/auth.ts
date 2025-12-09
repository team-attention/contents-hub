import { supabase } from "./supabase";

export async function signInWithGoogle(): Promise<void> {
  const redirectUrl = chrome.identity.getRedirectURL();

  const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: redirectUrl,
      skipBrowserRedirect: true,
    },
  });

  if (oauthError) throw oauthError;
  if (!data.url) throw new Error("No OAuth URL returned");

  // Open OAuth page in new tab (background script will handle the callback)
  await chrome.tabs.create({ url: data.url });
}

export async function handleOAuthCallback(url: string): Promise<void> {
  const hashParams = new URLSearchParams(new URL(url).hash.slice(1));

  const accessToken = hashParams.get("access_token");
  const refreshToken = hashParams.get("refresh_token");

  if (!accessToken || !refreshToken) {
    const error = hashParams.get("error_description") || hashParams.get("error");
    throw new Error(error || "Failed to get authentication tokens");
  }

  const { error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  if (error) {
    throw error;
  }
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) {
    throw error;
  }
}

export async function getSession() {
  return supabase.auth.getSession();
}

export async function getUser() {
  return supabase.auth.getUser();
}
