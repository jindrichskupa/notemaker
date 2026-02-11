/**
 * Keyboard Shortcuts Help Dialog
 */

import { For, Show, createMemo } from "solid-js";
import { getShortcutsGrouped, type ShortcutDef } from "../lib/keyboard/shortcuts";

export interface ShortcutsHelpProps {
  isOpen: boolean;
  onClose: () => void;
}

// Order of categories to display
const CATEGORY_ORDER = ["General", "File", "Notebook", "Editor", "Search", "Edit", "Git"];

export function ShortcutsHelp(props: ShortcutsHelpProps) {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      props.onClose();
    }
  };

  // Get shortcuts grouped by category, ordered
  const shortcutGroups = createMemo(() => {
    const grouped = getShortcutsGrouped();
    return CATEGORY_ORDER
      .filter(cat => grouped[cat]?.length > 0)
      .map(cat => ({
        title: cat,
        shortcuts: grouped[cat],
      }));
  });

  return (
    <Show when={props.isOpen}>
      <div
        class="fixed inset-0 bg-black/60 z-50 flex items-center justify-center"
        onClick={(e) => e.target === e.currentTarget && props.onClose()}
        onKeyDown={handleKeyDown}
      >
        <div class="bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col border border-gray-700">
          {/* Header */}
          <div class="flex items-center justify-between px-6 py-4 border-b border-gray-700">
            <h2 class="text-lg font-medium text-gray-100">Keyboard Shortcuts</h2>
            <button
              onClick={props.onClose}
              class="p-1 text-gray-400 hover:text-gray-200 rounded transition-colors"
            >
              <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor">
                <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.75.75 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 0 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06z" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div class="flex-1 overflow-y-auto p-6">
            <div class="grid grid-cols-2 gap-6">
              <For each={shortcutGroups()}>
                {(group) => (
                  <div>
                    <h3 class="text-sm font-medium text-gray-400 mb-3 uppercase tracking-wider">
                      {group.title}
                    </h3>
                    <div class="space-y-2">
                      <For each={group.shortcuts}>
                        {(shortcut: ShortcutDef) => (
                          <div class="flex items-center justify-between">
                            <span class={`text-sm ${shortcut.implemented ? "text-gray-300" : "text-gray-500"}`}>
                              {shortcut.description}
                              {!shortcut.implemented && <span class="ml-1 text-xs">(TBD)</span>}
                            </span>
                            <kbd class={`px-2 py-1 rounded text-xs font-mono ${shortcut.implemented ? "bg-gray-700 text-gray-200" : "bg-gray-800 text-gray-500"}`}>
                              {shortcut.display}
                            </kbd>
                          </div>
                        )}
                      </For>
                    </div>
                  </div>
                )}
              </For>
            </div>

            {/* Vim mode hint */}
            <div class="mt-6 p-4 bg-gray-700/50 rounded-lg">
              <div class="flex items-center gap-2 text-sm text-gray-400">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zM0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8zm6.5-.25A.75.75 0 0 1 7.25 7h1a.75.75 0 0 1 .75.75v2.75h.25a.75.75 0 0 1 0 1.5h-2a.75.75 0 0 1 0-1.5h.25v-2h-.25a.75.75 0 0 1-.75-.75zM8 6a1 1 0 1 1 0-2 1 1 0 0 1 0 2z" />
                </svg>
                <span>
                  Press <kbd class="px-1 py-0.5 bg-gray-600 rounded text-xs">⌘⇧V</kbd> to toggle Vim mode for advanced text editing
                </span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div class="flex justify-end px-6 py-4 border-t border-gray-700">
            <button
              onClick={props.onClose}
              class="px-4 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 rounded transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </Show>
  );
}

export default ShortcutsHelp;
