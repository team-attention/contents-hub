import { useCallback, useState } from "react";
import type { KeyCombination, ShortcutSettings as ShortcutSettingsType } from "../../lib/settings-storage";
import { formatShortcut, isMac, keyEventToCombo } from "../../lib/shortcut-utils";

interface ShortcutItem {
  type: keyof ShortcutSettingsType;
  label: string;
  description: string;
}

const SHORTCUT_ITEMS: ShortcutItem[] = [
  {
    type: "quickSave",
    label: "Read Later",
    description: "Save current page to read later",
  },
  {
    type: "quickSubscribe",
    label: "Quick Watch",
    description: "Watch current page for changes",
  },
];

interface ShortcutSettingsProps {
  shortcuts: ShortcutSettingsType;
  onSave: (type: keyof ShortcutSettingsType, shortcut: KeyCombination) => Promise<void>;
  onReset: () => Promise<void>;
}

export function ShortcutSettings({ shortcuts, onSave, onReset }: ShortcutSettingsProps) {
  const [recordingType, setRecordingType] = useState<keyof ShortcutSettingsType | null>(null);
  const [pendingShortcuts, setPendingShortcuts] = useState<Partial<ShortcutSettingsType>>({});
  const [isSaving, setIsSaving] = useState(false);

  const handleStartRecording = (type: keyof ShortcutSettingsType) => {
    setRecordingType(type);
  };

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent, type: keyof ShortcutSettingsType) => {
      if (recordingType !== type) return;

      event.preventDefault();
      event.stopPropagation();

      const combo = keyEventToCombo(event.nativeEvent);
      if (combo) {
        setPendingShortcuts((prev) => ({ ...prev, [type]: combo }));
        setRecordingType(null);
      }
    },
    [recordingType],
  );

  const handleSave = async (type: keyof ShortcutSettingsType) => {
    const pending = pendingShortcuts[type];
    if (!pending) return;

    setIsSaving(true);
    try {
      await onSave(type, pending);
      setPendingShortcuts((prev) => {
        const next = { ...prev };
        delete next[type];
        return next;
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = (type: keyof ShortcutSettingsType) => {
    setRecordingType(null);
    setPendingShortcuts((prev) => {
      const next = { ...prev };
      delete next[type];
      return next;
    });
  };

  const handleReset = async () => {
    setIsSaving(true);
    try {
      await onReset();
      setPendingShortcuts({});
    } finally {
      setIsSaving(false);
    }
  };

  const modifierHint = isMac() ? "Cmd" : "Ctrl";

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Keyboard Shortcuts</h2>
        <p className="text-sm text-gray-500">
          Press a key combination with {modifierHint}, Shift, Alt, or combinations
        </p>
      </div>

      {SHORTCUT_ITEMS.map((item) => {
        const isRecording = recordingType === item.type;
        const pending = pendingShortcuts[item.type];
        const displayShortcut = pending || shortcuts[item.type];
        const hasChanges = pending !== undefined;

        return (
          <div
            key={item.type}
            className="flex items-center justify-between py-3 border-b border-gray-100"
          >
            <div>
              <p className="font-medium text-gray-900">{item.label}</p>
              <p className="text-sm text-gray-500">{item.description}</p>
            </div>

            <div className="flex items-center gap-2">
              {isRecording ? (
                <input
                  type="text"
                  readOnly
                  className="px-4 py-2 bg-blue-50 border-2 border-blue-500 rounded-lg min-w-[140px] text-center focus:outline-none text-sm text-blue-600 placeholder:text-blue-600 placeholder:animate-pulse"
                  placeholder="Press keys..."
                  onKeyDown={(e) => handleKeyDown(e, item.type)}
                  onBlur={() => setRecordingType(null)}
                  ref={(input) => input?.focus()}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => handleStartRecording(item.type)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg min-w-[140px] text-center transition-colors"
                >
                  <span className="text-sm font-mono text-gray-700">
                    {formatShortcut(displayShortcut)}
                  </span>
                </button>
              )}

              {hasChanges && (
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => handleCancel(item.type)}
                    disabled={isSaving}
                    className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSave(item.type)}
                    disabled={isSaving}
                    className="px-2 py-1 text-xs font-medium text-white bg-blue-500 hover:bg-blue-600 rounded disabled:opacity-50"
                  >
                    {isSaving ? "..." : "Save"}
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })}

      <div className="flex items-center justify-end pt-2">
        <button
          type="button"
          onClick={handleReset}
          disabled={isSaving}
          className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-50 transition-colors"
        >
          Reset all to defaults
        </button>
      </div>
    </div>
  );
}
