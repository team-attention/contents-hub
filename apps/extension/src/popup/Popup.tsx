import { useCallback, useEffect, useState } from "react";
import { ContentItemList } from "../components/ContentItemList";
import { SignIn } from "../components/SignIn";
import { SubscriptionList } from "../components/SubscriptionList";
import { TabNavigation, type TabType } from "../components/TabNavigation";
import { Toast, type ToastType } from "../components/Toast";
import { UserProfile } from "../components/UserProfile";
import { useAuth } from "../hooks/useAuth";
import { useContentItems } from "../hooks/useContentItems";
import { useSubscriptions } from "../hooks/useSubscriptions";

interface ToastState {
  id: string;
  message: string;
  type: ToastType;
}

function Popup() {
  const { user, isLoading, error, signInWithGoogle, signOut } = useAuth();
  const {
    subscriptions,
    isLoading: subscriptionsLoading,
    isOperating: isWatchOperating,
    error: subscriptionError,
    subscribe,
    unsubscribe,
    isSubscribed,
    getSubscriptionForUrl,
  } = useSubscriptions();
  const {
    contentItems,
    isLoading: contentItemsLoading,
    isOperating: isSaveOperating,
    error: contentItemError,
    save,
    remove,
    isSaved,
  } = useContentItems();

  const [currentUrl, setCurrentUrl] = useState<string>("");
  const [currentTitle, setCurrentTitle] = useState<string>("");
  const [activeTab, setActiveTab] = useState<TabType>("saved");
  const [toast, setToast] = useState<ToastState | null>(null);

  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (tab?.url) {
        setCurrentUrl(tab.url);
      }
      if (tab?.title) {
        setCurrentTitle(tab.title);
      }
    });
  }, []);

  const showToast = useCallback((message: string, type: ToastType = "info") => {
    setToast({ id: Date.now().toString(), message, type });
  }, []);

  const openSettings = () => {
    chrome.runtime.openOptionsPage();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-6 min-h-[300px]">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <SignIn onSignIn={signInWithGoogle} isLoading={isLoading} error={error} />;
  }

  const currentSubscription = currentUrl ? getSubscriptionForUrl(currentUrl) : null;
  const isCurrentUrlWatched = currentUrl ? isSubscribed(currentUrl) : false;
  const isCurrentUrlSaved = currentUrl ? isSaved(currentUrl) : false;

  const handleSave = async () => {
    if (!currentUrl) return;
    if (isCurrentUrlSaved) {
      showToast("Already saved", "info");
      return;
    }
    try {
      await save(currentUrl, currentTitle || undefined);
      showToast("Saved successfully", "success");
    } catch {
      showToast("Failed to save", "error");
    }
  };

  const handleWatch = async () => {
    if (!currentUrl) return;
    try {
      await subscribe(currentUrl, currentTitle || currentUrl);
      showToast("Now watching", "success");
    } catch {
      showToast("Failed to watch", "error");
    }
  };

  const handleUnwatch = async () => {
    if (!currentSubscription) return;
    try {
      await unsubscribe(currentSubscription.id);
      showToast("Stopped watching", "success");
    } catch {
      showToast("Failed to unwatch", "error");
    }
  };

  const displayError = subscriptionError || contentItemError;
  const isOperating = isSaveOperating || isWatchOperating;

  return (
    <div className="w-[320px]">
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-lg font-bold text-gray-900">Contents Hub</h1>
          <button
            type="button"
            onClick={openSettings}
            className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            title="Settings"
          >
            <SettingsIcon />
          </button>
        </div>

        <UserProfile user={user} onSignOut={signOut} isLoading={isLoading} />

        <div className="mt-4">
          <p className="text-xs text-gray-500 mb-2">Current page:</p>
          <p className="text-sm break-all bg-gray-100 p-2 rounded truncate">
            {currentUrl || "Loading..."}
          </p>
        </div>

        {displayError && (
          <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-600">
            {displayError.message}
          </div>
        )}

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={isOperating || !currentUrl || isCurrentUrlSaved}
            className={`flex-1 py-2.5 px-4 text-sm font-medium rounded-lg transition-colors disabled:cursor-not-allowed ${
              isCurrentUrlSaved
                ? "bg-gray-100 text-gray-500 border border-gray-200"
                : "bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50"
            }`}
          >
            {isSaveOperating ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Saving...
              </span>
            ) : isCurrentUrlSaved ? (
              <span className="flex items-center justify-center gap-1">
                <CheckIcon />
                Saved
              </span>
            ) : (
              "Read Later"
            )}
          </button>
          <button
            type="button"
            onClick={isCurrentUrlWatched ? handleUnwatch : handleWatch}
            disabled={isOperating || !currentUrl}
            className={`flex-1 py-2.5 px-4 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              isCurrentUrlWatched
                ? "bg-red-50 border border-red-200 text-red-600 hover:bg-red-100"
                : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
            }`}
          >
            {isWatchOperating ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ...
              </span>
            ) : isCurrentUrlWatched ? (
              <span className="flex items-center justify-center gap-1">
                <CheckIcon />
                Watching
              </span>
            ) : (
              "Watch"
            )}
          </button>
        </div>
      </div>

      <div className="mt-2">
        <TabNavigation
          activeTab={activeTab}
          onTabChange={setActiveTab}
          savedCount={contentItems.length}
          watchingCount={subscriptions.length}
        />
        <div className="px-4">
          {activeTab === "saved" ? (
            <ContentItemList
              contentItems={contentItems}
              isLoading={contentItemsLoading}
              onRemove={remove}
            />
          ) : (
            <SubscriptionList
              subscriptions={subscriptions}
              isLoading={subscriptionsLoading}
              onUnwatch={unsubscribe}
            />
          )}
        </div>
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}

function SettingsIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-label="Settings"
    >
      <title>Settings</title>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <title>Check</title>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export default Popup;
