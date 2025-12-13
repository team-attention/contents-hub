/**
 * Message types for communication between extension components
 * (Popup <-> Content Script <-> Background Service Worker)
 */

// ============================================
// Selector Picker Messages
// ============================================

/**
 * Popup/Shortcut -> Content: Start Selector Picker mode
 */
export interface StartPickerMessage {
  type: "START_SELECTOR_PICKER";
  url: string;
  title: string;
}

/**
 * Content -> Background: Submit selected selector for watch subscription
 */
export interface SubmitSelectorMessage {
  type: "SUBMIT_SELECTOR";
  url: string;
  name: string;
  selector: string;
}

/**
 * Background -> Content: Watch subscription API result
 */
export interface WatchResultMessage {
  type: "WATCH_RESULT";
  success: boolean;
  urlCount?: number;
  subscriptionId?: string;
  error?: string;
}

// ============================================
// Existing Feedback Messages (for reference)
// ============================================

export interface SaveFeedbackMessage {
  type: "SAVE_FEEDBACK";
  success: boolean;
  url?: string;
  message?: string;
}

export interface WatchFeedbackMessage {
  type: "WATCH_FEEDBACK";
  success: boolean;
  url?: string;
  message?: string;
}

// ============================================
// Union Type
// ============================================

export type PickerMessage = StartPickerMessage | SubmitSelectorMessage | WatchResultMessage;

export type FeedbackMessage = SaveFeedbackMessage | WatchFeedbackMessage;

export type ExtensionMessage = PickerMessage | FeedbackMessage;
