/**
 * Background service worker for Contents Hub extension
 */

import {
  createContentItem,
  createSubscription,
  findByUrlContentItem,
  findByUrlSubscription,
  updateContentItem,
} from "../lib/api/__generated__/api";
import { previewSelector, watchSubscription } from "../lib/api/manual";
import { handleOAuthCallback } from "../lib/auth";
import type { SubmitSelectorMessage, WatchResultMessage } from "../lib/messages";
import { supabase } from "../lib/supabase";

console.log("Contents Hub background service worker started");

// Listen for OAuth callback redirect
const redirectUrl = chrome.identity.getRedirectURL();
console.log("Listening for redirect URL:", redirectUrl);

// NOTE: Do not use URL filter - it doesn't work reliably with chromiumapp.org virtual URLs
chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
  // Only check main frame navigations
  if (details.frameId !== 0) return;

  const url = details.url;
  if (url?.startsWith(redirectUrl)) {
    console.log("OAuth redirect detected:", url);

    if (url.includes("access_token")) {
      console.log("OAuth callback with token detected");

      try {
        await handleOAuthCallback(url);
        console.log("OAuth callback handled successfully");

        // Close the OAuth tab
        await chrome.tabs.remove(details.tabId);
      } catch (error) {
        console.error("OAuth callback error:", error);
      }
    } else if (url.includes("error")) {
      console.error("OAuth error:", url);
      await chrome.tabs.remove(details.tabId);
    }
  }
});

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
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
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

  if (message.type === "QUICK_SUBSCRIBE") {
    handleQuickSubscribe(sender.tab?.id).then((result) => {
      sendResponse(result);
    });
    return true;
  }

  if (message.type === "QUICK_SAVE") {
    handleQuickSave(sender.tab?.id).then((result) => {
      sendResponse(result);
    });
    return true;
  }

  // Selector Picker: Preview selector to get URL count
  if (message.type === "PREVIEW_SELECTOR") {
    handlePreviewSelector(message).then((result) => {
      sendResponse(result);
    });
    return true;
  }

  // Selector Picker: Submit selector to create subscription
  if (message.type === "SUBMIT_SELECTOR") {
    handleSubmitSelector(message as SubmitSelectorMessage, sender.tab?.id).then((result) => {
      sendResponse(result);
    });
    return true;
  }

  return true;
});

async function handleQuickSubscribe(
  tabId: number | undefined,
): Promise<{ success: boolean; url?: string; error?: string; alreadyExists?: boolean }> {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const currentTab = tabs[0];

    if (!currentTab?.url) {
      return { success: false, error: "No active tab URL" };
    }

    const url = currentTab.url;
    const title = currentTab.title || url;
    console.log("Quick watch:", url);

    // Check if already subscribed
    try {
      const existing = await findByUrlSubscription({ url });
      if (existing.data) {
        sendFeedback(tabId, "WATCH_FEEDBACK", true, url, "Already watching");
        return { success: true, url, alreadyExists: true };
      }
    } catch {
      // Not found, proceed with creation
    }

    // Create subscription
    await createSubscription({ url, name: title, checkInterval: 60 });

    sendFeedback(tabId, "WATCH_FEEDBACK", true, url, "Now watching");
    return { success: true, url };
  } catch (error) {
    console.error("Quick watch error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    sendFeedback(tabId, "WATCH_FEEDBACK", false, undefined, errorMessage);
    return { success: false, error: errorMessage };
  }
}

async function handleQuickSave(tabId: number | undefined): Promise<{
  success: boolean;
  url?: string;
  error?: string;
  alreadyExists?: boolean;
  reactivated?: boolean;
}> {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const currentTab = tabs[0];

    if (!currentTab?.url) {
      return { success: false, error: "No active tab URL" };
    }

    const url = currentTab.url;
    const title = currentTab.title;
    console.log("Quick save:", url);

    // Check if already saved
    try {
      const existing = await findByUrlContentItem({ url });
      if (existing.data) {
        const status = existing.data.status;

        // If done/archived, reactivate by setting status back to pending
        if (status === "done" || status === "archived") {
          await updateContentItem(existing.data.id, { status: "pending" });
          sendFeedback(tabId, "SAVE_FEEDBACK", true, url, "Saved again");
          return { success: true, url, reactivated: true };
        }

        // If pending/ready, already in queue
        sendFeedback(tabId, "SAVE_FEEDBACK", true, url, "Already saved");
        return { success: true, url, alreadyExists: true };
      }
    } catch {
      // Not found, proceed with creation
    }

    // Create content item
    await createContentItem({ url, title });

    sendFeedback(tabId, "SAVE_FEEDBACK", true, url, "Saved");
    return { success: true, url };
  } catch (error) {
    console.error("Quick save error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    sendFeedback(tabId, "SAVE_FEEDBACK", false, undefined, errorMessage);
    return { success: false, error: errorMessage };
  }
}

function sendFeedback(
  tabId: number | undefined,
  type: string,
  success: boolean,
  url?: string,
  message?: string,
): void {
  console.log("sendFeedback called:", { tabId, type, success, url, message });

  if (!tabId) {
    console.warn("sendFeedback: No tabId, cannot send feedback");
    return;
  }

  chrome.tabs
    .sendMessage(tabId, { type, success, url, message })
    .then(() => console.log("Feedback sent successfully to tab:", tabId))
    .catch((error) => {
      console.error("Failed to send feedback to tab:", tabId, error);
    });
}

// ============================================
// Selector Picker Handlers
// ============================================

async function handlePreviewSelector(message: {
  url: string;
  selector: string;
}): Promise<WatchResultMessage> {
  console.log("handlePreviewSelector:", message);

  try {
    const result = await previewSelector({
      url: message.url,
      selector: message.selector,
    });

    return {
      type: "WATCH_RESULT",
      success: result.success,
      urlCount: result.urlCount,
      error: result.error,
    };
  } catch (error) {
    console.error("Preview selector error:", error);
    // Return success with 0 URLs so user can still proceed
    return {
      type: "WATCH_RESULT",
      success: true,
      urlCount: 0,
    };
  }
}

async function handleSubmitSelector(
  message: SubmitSelectorMessage,
  tabId: number | undefined,
): Promise<WatchResultMessage> {
  console.log("handleSubmitSelector:", message);

  try {
    // Check if already subscribed to this URL
    try {
      const existing = await findByUrlSubscription({ url: message.url });
      if (existing.data) {
        return {
          type: "WATCH_RESULT",
          success: false,
          urlCount: 0,
          error: "Already watching this page",
        };
      }
    } catch {
      // Not found, proceed with creation
    }

    // Create subscription with selector
    const result = await watchSubscription({
      url: message.url,
      name: message.name,
      selector: message.selector,
      checkInterval: 60,
    });

    if (result.success) {
      // Send success feedback to tab for toast notification
      sendFeedback(tabId, "WATCH_FEEDBACK", true, message.url, `Watching ${result.urlCount} URLs`);
    }

    return {
      type: "WATCH_RESULT",
      success: result.success,
      subscriptionId: result.subscriptionId,
      urlCount: result.urlCount,
      error: result.error,
    };
  } catch (error) {
    console.error("Submit selector error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    return {
      type: "WATCH_RESULT",
      success: false,
      urlCount: 0,
      error: errorMessage,
    };
  }
}
