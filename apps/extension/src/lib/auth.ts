import { env } from "./env";
import { supabase } from "./supabase";

export async function signInWithGoogle(): Promise<void> {
  const redirectUrl = chrome.identity.getRedirectURL();

  const authUrl = new URL(`${env.SUPABASE_URL}/auth/v1/authorize`);
  authUrl.searchParams.set("provider", "google");
  authUrl.searchParams.set("redirect_to", redirectUrl);

  const responseUrl = await chrome.identity.launchWebAuthFlow({
    url: authUrl.toString(),
    interactive: true,
  });

  if (!responseUrl) {
    throw new Error("Authentication was cancelled");
  }

  const url = new URL(responseUrl);
  const hashParams = new URLSearchParams(url.hash.slice(1));

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
