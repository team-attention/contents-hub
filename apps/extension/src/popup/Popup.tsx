import { useEffect, useState } from "react";

function Popup() {
  const [currentUrl, setCurrentUrl] = useState<string>("");

  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (tab?.url) {
        setCurrentUrl(tab.url);
      }
    });
  }, []);

  const handleSubscribe = () => {
    // TODO: Implement subscription logic
    console.log("Subscribing to:", currentUrl);
  };

  return (
    <div style={{ padding: "20px" }}>
      <h1 style={{ fontSize: "18px", marginBottom: "16px" }}>Contents Hub</h1>

      <div style={{ marginBottom: "16px" }}>
        <p style={{ fontSize: "12px", color: "#666", marginBottom: "8px" }}>Current page:</p>
        <p
          style={{
            fontSize: "14px",
            wordBreak: "break-all",
            background: "#f5f5f5",
            padding: "8px",
            borderRadius: "4px",
          }}
        >
          {currentUrl || "Loading..."}
        </p>
      </div>

      <button
        type="button"
        onClick={handleSubscribe}
        style={{
          width: "100%",
          padding: "12px",
          fontSize: "14px",
          fontWeight: "bold",
          color: "white",
          backgroundColor: "#3b82f6",
          border: "none",
          borderRadius: "8px",
          cursor: "pointer",
        }}
      >
        Subscribe to this page
      </button>

      <p
        style={{
          marginTop: "16px",
          fontSize: "12px",
          color: "#999",
          textAlign: "center",
        }}
      >
        Extension - Coming Soon
      </p>
    </div>
  );
}

export default Popup;
