/**
 * Background service worker for Contents Hub extension
 */

import { supabase } from "../lib/supabase";

console.log("Contents Hub background service worker started");

// Initialize auth state listener
supabase.auth.onAuthStateChange((event, session) => {
  console.log("Auth state changed:", event, session?.user?.email);

  // Broadcast auth state to all extension pages
  chrome.runtime
    .sendMessage({
      type: "AUTH_STATE_CHANGE",
      event,
      session,
    })
    .catch(() => {
      // Ignore errors when no listeners are available
    });
});

// Proactive token refresh
async function refreshTokenIfNeeded() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (session?.expires_at) {
    const expiresAt = session.expires_at * 1000;
    const now = Date.now();
    const fiveMinutes = 5 * 60 * 1000;

    if (expiresAt - now < fiveMinutes) {
      console.log("Token expiring soon, refreshing...");
      await supabase.auth.refreshSession();
    }
  }
}

// Check token every minute
setInterval(refreshTokenIfNeeded, 60 * 1000);

// Listen for installation
chrome.runtime.onInstalled.addListener(() => {
  console.log("Contents Hub extension installed");
});

// Listen for messages from popup or content scripts
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  console.log("Received message:", message);

  if (message.type === "SUBSCRIBE") {
    // TODO: Send subscription request to server
    sendResponse({ success: true });
  }

  if (message.type === "GET_SESSION") {
    supabase.auth.getSession().then(({ data: { session } }) => {
      sendResponse({ session });
    });
    return true;
  }

  return true;
});
