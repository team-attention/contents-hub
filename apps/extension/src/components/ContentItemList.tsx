import type { ContentItemResponseDto as ContentItem } from "../lib/api/__generated__/models";

interface ContentItemListProps {
  contentItems: ContentItem[];
  isLoading: boolean;
  onRemove: (id: string) => Promise<void>;
}

export function ContentItemList({ contentItems, isLoading, onRemove }: ContentItemListProps) {
  if (isLoading) {
    return (
      <div className="py-4">
        <div className="flex justify-center">
          <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (contentItems.length === 0) {
    return (
      <div className="py-6 text-center">
        <p className="text-xs text-gray-400">No pages saved yet.</p>
        <p className="text-xs text-gray-400 mt-1">Click "Read Later" to save pages.</p>
      </div>
    );
  }

  return (
    <ul className="space-y-2 max-h-[200px] overflow-y-auto py-2">
      {contentItems.map((item) => (
        <ContentItemRow key={item.id} item={item} onRemove={onRemove} />
      ))}
    </ul>
  );
}

interface ContentItemRowProps {
  item: ContentItem;
  onRemove: (id: string) => Promise<void>;
}

function ContentItemRow({ item, onRemove }: ContentItemRowProps) {
  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await onRemove(item.id);
  };

  const handleClick = () => {
    chrome.tabs.create({ url: item.url });
  };

  const statusBadge = item.status === "done" && (
    <span className="flex-shrink-0 px-1.5 py-0.5 text-[10px] bg-green-100 text-green-600 rounded">
      Summarized
    </span>
  );

  return (
    <li className="flex items-center gap-2 p-2 bg-gray-50 rounded hover:bg-gray-100 transition-colors">
      <button type="button" onClick={handleClick} className="flex-1 min-w-0 text-left">
        <p className="text-xs font-medium text-gray-800 truncate">
          {typeof item.title === "string" ? item.title : "Untitled"}
        </p>
        <p className="text-[10px] text-gray-400 truncate">{item.url}</p>
      </button>
      {statusBadge}
      <button
        type="button"
        onClick={handleDelete}
        className="flex-shrink-0 p-1 text-gray-400 hover:text-red-500 transition-colors"
        title="Remove"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <title>Delete</title>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
          />
        </svg>
      </button>
    </li>
  );
}
