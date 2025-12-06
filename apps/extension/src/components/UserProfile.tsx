import type { User } from "@supabase/supabase-js";

interface UserProfileProps {
  user: User;
  onSignOut: () => void;
  isLoading: boolean;
}

export function UserProfile({ user, onSignOut, isLoading }: UserProfileProps) {
  const avatarUrl = user.user_metadata?.avatar_url;
  const email = user.email;
  const name = user.user_metadata?.full_name || user.user_metadata?.name;

  return (
    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
      {avatarUrl ? (
        <img src={avatarUrl} alt="Profile" className="w-10 h-10 rounded-full" />
      ) : (
        <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-medium">
          {email?.charAt(0).toUpperCase()}
        </div>
      )}

      <div className="flex-1 min-w-0">
        {name && <p className="text-sm font-medium text-gray-900 truncate">{name}</p>}
        <p className="text-xs text-gray-500 truncate">{email}</p>
      </div>

      <button
        type="button"
        onClick={onSignOut}
        disabled={isLoading}
        className="text-xs text-gray-500 hover:text-gray-700 disabled:opacity-50"
      >
        {isLoading ? "..." : "Sign out"}
      </button>
    </div>
  );
}
