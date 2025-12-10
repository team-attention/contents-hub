import { useEffect, useState } from "react";
import { SignIn } from "../components/SignIn";
import { SubscriptionList } from "../components/SubscriptionList";
import { UserProfile } from "../components/UserProfile";
import { useAuth } from "../hooks/useAuth";
import { useSubscriptions } from "../hooks/useSubscriptions";

function Popup() {
  const { user, isLoading, error, signInWithGoogle, signOut } = useAuth();
  const {
    subscriptions,
    isLoading: subscriptionsLoading,
    isOperating,
    error: subscriptionError,
    subscribe,
    unsubscribe,
    isSubscribed,
    getSubscriptionForUrl,
  } = useSubscriptions();
  const [currentUrl, setCurrentUrl] = useState<string>("");
  const [currentTitle, setCurrentTitle] = useState<string>("");

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
  const isCurrentUrlSubscribed = currentUrl ? isSubscribed(currentUrl) : false;

  const handleSubscribe = async () => {
    if (!currentUrl) return;
    try {
      await subscribe(currentUrl, currentTitle || currentUrl);
    } catch {
      // Error is already handled in the hook
    }
  };

  const handleUnsubscribe = async () => {
    if (!currentSubscription) return;
    try {
      await unsubscribe(currentSubscription.id);
    } catch {
      // Error is already handled in the hook
    }
  };

  return (
    <div className="p-4 w-[320px]">
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
        <p className="text-sm break-all bg-gray-100 p-2 rounded">{currentUrl || "Loading..."}</p>
      </div>

      {subscriptionError && (
        <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-600">
          {subscriptionError.message}
        </div>
      )}

      {isCurrentUrlSubscribed ? (
        <button
          type="button"
          onClick={handleUnsubscribe}
          disabled={isOperating}
          className="mt-4 w-full py-3 px-4 bg-red-500 text-white text-sm font-medium rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isOperating ? "Processing..." : "Unsubscribe from this page"}
        </button>
      ) : (
        <button
          type="button"
          onClick={handleSubscribe}
          disabled={isOperating || !currentUrl}
          className="mt-4 w-full py-3 px-4 bg-blue-500 text-white text-sm font-medium rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isOperating ? "Processing..." : "Subscribe to this page"}
        </button>
      )}

      <SubscriptionList
        subscriptions={subscriptions}
        isLoading={subscriptionsLoading}
        onUnsubscribe={unsubscribe}
      />
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

export default Popup;
