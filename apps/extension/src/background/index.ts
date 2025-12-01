/**
 * Background service worker for Contents Hub extension
 */

console.log("Contents Hub background service worker started");

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

  return true; // Keep the message channel open for async response
});
