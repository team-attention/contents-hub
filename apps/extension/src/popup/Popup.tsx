import { useEffect, useState } from "react";
import { SignIn } from "../components/SignIn";
import { UserProfile } from "../components/UserProfile";
import { useAuth } from "../hooks/useAuth";

function Popup() {
  const { user, isLoading, error, signInWithGoogle, signOut } = useAuth();
  const [currentUrl, setCurrentUrl] = useState<string>("");

  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (tab?.url) {
        setCurrentUrl(tab.url);
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

  const handleSubscribe = () => {
    // TODO: Implement subscription logic
    console.log("Subscribing to:", currentUrl);
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

      <button
        type="button"
        onClick={handleSubscribe}
        className="mt-4 w-full py-3 px-4 bg-blue-500 text-white text-sm font-medium rounded-lg hover:bg-blue-600 transition-colors"
      >
        Subscribe to this page
      </button>

      <p className="mt-4 text-xs text-gray-400 text-center">Extension - Coming Soon</p>
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
