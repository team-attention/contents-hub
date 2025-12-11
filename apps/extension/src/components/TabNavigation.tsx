export type TabType = "saved" | "watching";

interface TabNavigationProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  savedCount: number;
  watchingCount: number;
}

export function TabNavigation({
  activeTab,
  onTabChange,
  savedCount,
  watchingCount,
}: TabNavigationProps) {
  return (
    <div className="flex border-b border-gray-200">
      <button
        type="button"
        onClick={() => onTabChange("saved")}
        className={`flex-1 py-2 px-3 text-sm font-medium transition-colors relative ${
          activeTab === "saved"
            ? "text-blue-600"
            : "text-gray-500 hover:text-gray-700"
        }`}
      >
        <span>Read Later</span>
        {savedCount > 0 && (
          <span
            className={`ml-1.5 px-1.5 py-0.5 text-xs rounded-full ${
              activeTab === "saved"
                ? "bg-blue-100 text-blue-600"
                : "bg-gray-100 text-gray-500"
            }`}
          >
            {savedCount}
          </span>
        )}
        {activeTab === "saved" && (
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />
        )}
      </button>
      <button
        type="button"
        onClick={() => onTabChange("watching")}
        className={`flex-1 py-2 px-3 text-sm font-medium transition-colors relative ${
          activeTab === "watching"
            ? "text-blue-600"
            : "text-gray-500 hover:text-gray-700"
        }`}
      >
        <span>Watching</span>
        {watchingCount > 0 && (
          <span
            className={`ml-1.5 px-1.5 py-0.5 text-xs rounded-full ${
              activeTab === "watching"
                ? "bg-blue-100 text-blue-600"
                : "bg-gray-100 text-gray-500"
            }`}
          >
            {watchingCount}
          </span>
        )}
        {activeTab === "watching" && (
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />
        )}
      </button>
    </div>
  );
}
