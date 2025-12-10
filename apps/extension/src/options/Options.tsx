import { useSettings } from "../hooks/useSettings";
import { ShortcutSettings } from "./components/ShortcutSettings";

function Options() {
  const { settings, isLoading, error, saveShortcut, reset } = useSettings();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto py-8 px-4">
        <header className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Contents Hub Settings</h1>
          <p className="mt-1 text-sm text-gray-500">Configure your keyboard shortcuts</p>
        </header>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">{error.message}</p>
          </div>
        )}

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <ShortcutSettings
            shortcut={settings.shortcuts.quickSubscribe}
            onSave={saveShortcut}
            onReset={reset}
          />
        </div>

        <footer className="mt-8 text-center">
          <p className="text-xs text-gray-400">Contents Hub Extension v0.0.1</p>
        </footer>
      </div>
    </div>
  );
}

export default Options;
