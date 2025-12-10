import type { Subscription } from "../lib/subscriptions";

interface SubscriptionListProps {
  subscriptions: Subscription[];
  isLoading: boolean;
  onUnsubscribe: (id: string) => Promise<void>;
}

export function SubscriptionList({
  subscriptions,
  isLoading,
  onUnsubscribe,
}: SubscriptionListProps) {
  if (isLoading) {
    return (
      <div className="mt-4 pt-4 border-t border-gray-200">
        <p className="text-xs text-gray-500 mb-2">My subscriptions:</p>
        <div className="flex justify-center py-4">
          <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (subscriptions.length === 0) {
    return (
      <div className="mt-4 pt-4 border-t border-gray-200">
        <p className="text-xs text-gray-500 mb-2">My subscriptions:</p>
        <p className="text-xs text-gray-400 text-center py-4">
          No subscriptions yet. Subscribe to pages to track changes.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-4 pt-4 border-t border-gray-200">
      <p className="text-xs text-gray-500 mb-2">My subscriptions ({subscriptions.length}):</p>
      <ul className="space-y-2 max-h-[200px] overflow-y-auto">
        {subscriptions.map((subscription) => (
          <SubscriptionItem
            key={subscription.id}
            subscription={subscription}
            onUnsubscribe={onUnsubscribe}
          />
        ))}
      </ul>
    </div>
  );
}

interface SubscriptionItemProps {
  subscription: Subscription;
  onUnsubscribe: (id: string) => Promise<void>;
}

function SubscriptionItem({ subscription, onUnsubscribe }: SubscriptionItemProps) {
  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await onUnsubscribe(subscription.id);
  };

  const handleClick = () => {
    chrome.tabs.create({ url: subscription.url });
  };

  return (
    <li className="flex items-center gap-2 p-2 bg-gray-50 rounded hover:bg-gray-100 transition-colors">
      <button type="button" onClick={handleClick} className="flex-1 min-w-0 text-left">
        <p className="text-xs font-medium text-gray-800 truncate">{subscription.name}</p>
        <p className="text-[10px] text-gray-400 truncate">{subscription.url}</p>
      </button>
      <button
        type="button"
        onClick={handleDelete}
        className="flex-shrink-0 p-1 text-gray-400 hover:text-red-500 transition-colors"
        title="Unsubscribe"
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
