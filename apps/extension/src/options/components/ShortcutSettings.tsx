import { useCallback, useState } from "react";
import type { KeyCombination } from "../../lib/settings-storage";
import { formatShortcut, isMac, keyEventToCombo } from "../../lib/shortcut-utils";

interface ShortcutSettingsProps {
  shortcut: KeyCombination;
  onSave: (shortcut: KeyCombination) => Promise<void>;
  onReset: () => Promise<void>;
}

export function ShortcutSettings({ shortcut, onSave, onReset }: ShortcutSettingsProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [pendingShortcut, setPendingShortcut] = useState<KeyCombination | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleStartRecording = () => {
    setIsRecording(true);
    setPendingShortcut(null);
  };

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (!isRecording) return;

      event.preventDefault();
      event.stopPropagation();

      const combo = keyEventToCombo(event.nativeEvent);
      if (combo) {
        setPendingShortcut(combo);
        setIsRecording(false);
      }
    },
    [isRecording],
  );

  const handleSave = async () => {
    if (!pendingShortcut) return;

    setIsSaving(true);
    try {
      await onSave(pendingShortcut);
      setPendingShortcut(null);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setIsRecording(false);
    setPendingShortcut(null);
  };

  const handleReset = async () => {
    setIsSaving(true);
    try {
      await onReset();
      setPendingShortcut(null);
    } finally {
      setIsSaving(false);
    }
  };

  const displayShortcut = pendingShortcut || shortcut;
  const hasChanges = pendingShortcut !== null;
  const modifierHint = isMac() ? "Cmd" : "Ctrl";

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Keyboard Shortcuts</h2>
        <p className="text-sm text-gray-500">
          Press a key combination with {modifierHint}, Shift, Alt, or combinations
        </p>
      </div>

      <div className="flex items-center justify-between py-3 border-b border-gray-100">
        <div>
          <p className="font-medium text-gray-900">Quick Subscribe</p>
          <p className="text-sm text-gray-500">Subscribe to the current page</p>
        </div>

        <div className="flex items-center gap-2">
          {isRecording ? (
            <input
              type="text"
              readOnly
              className="px-4 py-2 bg-blue-50 border-2 border-blue-500 rounded-lg min-w-[140px] text-center focus:outline-none text-sm text-blue-600 placeholder:text-blue-600 placeholder:animate-pulse"
              placeholder="Press keys..."
              onKeyDown={handleKeyDown}
              onBlur={() => setIsRecording(false)}
              ref={(input) => input?.focus()}
            />
          ) : (
            <button
              type="button"
              onClick={handleStartRecording}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg min-w-[140px] text-center transition-colors"
            >
              <span className="text-sm font-mono text-gray-700">
                {formatShortcut(displayShortcut)}
              </span>
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={handleReset}
          disabled={isSaving}
          className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-50 transition-colors"
        >
          Reset to defaults
        </button>

        <div className="flex gap-2">
          {hasChanges && (
            <>
              <button
                type="button"
                onClick={handleCancel}
                disabled={isSaving}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 rounded-lg disabled:opacity-50 transition-colors"
              >
                {isSaving ? "Saving..." : "Save"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
