/**
 * Command Palette component (Cmd+K)
 */

import { createSignal, createMemo, For, Show, onMount } from "solid-js";
import { Portal } from "solid-js/web";
import { commandRegistry, Command } from "../lib/commands/registry";
import { formatShortcut } from "../lib/keyboard/handler";
import { SearchIcon } from "./Icons";

export interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CommandPalette(props: CommandPaletteProps) {
  const [query, setQuery] = createSignal("");
  const [selectedIndex, setSelectedIndex] = createSignal(0);
  let inputRef: HTMLInputElement | undefined;
  let listRef: HTMLDivElement | undefined;

  // Filter and sort commands
  const results = createMemo(() => {
    const q = query().trim();
    if (!q) {
      // Show recent commands, or all if no recent
      const recent = commandRegistry.getRecentCommands();
      if (recent.length > 0) {
        return recent.slice(0, 15);
      }
      return commandRegistry.getAll().slice(0, 15);
    }
    return commandRegistry.search(q).slice(0, 15);
  });

  // Reset state when opened
  const handleOpen = () => {
    setQuery("");
    setSelectedIndex(0);
    setTimeout(() => inputRef?.focus(), 10);
  };

  // Execute selected command
  const executeCommand = (command: Command) => {
    props.onClose();
    commandRegistry.execute(command.id);
  };

  // Keyboard navigation
  const handleKeyDown = (e: KeyboardEvent) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, results().length - 1));
        scrollToSelected();
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
        scrollToSelected();
        break;
      case "Enter":
        e.preventDefault();
        const selected = results()[selectedIndex()];
        if (selected) {
          executeCommand(selected);
        }
        break;
      case "Escape":
        e.preventDefault();
        props.onClose();
        break;
    }
  };

  const scrollToSelected = () => {
    if (listRef) {
      const selected = listRef.querySelector('[data-selected="true"]');
      selected?.scrollIntoView({ block: "nearest" });
    }
  };

  // Handle backdrop click
  const handleBackdropClick = (e: MouseEvent) => {
    if (e.target === e.currentTarget) {
      props.onClose();
    }
  };

  // Setup when opened
  onMount(() => {
    if (props.isOpen) {
      handleOpen();
    }
  });

  // Watch for isOpen changes
  createMemo(() => {
    if (props.isOpen) {
      handleOpen();
    }
  });

  return (
    <Show when={props.isOpen}>
      <Portal>
        <div
          class="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-[15vh]"
          onClick={handleBackdropClick}
        >
          <div
            class="w-[560px] max-h-[60vh] bg-gray-800 rounded-lg shadow-2xl border border-gray-700 overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Search input */}
            <div class="flex items-center gap-3 px-4 py-3 border-b border-gray-700">
              <SearchIcon class="text-gray-500" size={18} />
              <input
                ref={inputRef}
                type="text"
                placeholder="Type a command..."
                class="flex-1 bg-transparent text-gray-100 text-base placeholder-gray-500 outline-none"
                autocomplete="off"
                autocapitalize="off"
                autocorrect="off"
                spellcheck={false}
                value={query()}
                onInput={(e) => {
                  setQuery(e.currentTarget.value);
                  setSelectedIndex(0);
                }}
                onKeyDown={handleKeyDown}
              />
            </div>

            {/* Results list */}
            <div ref={listRef} class="overflow-y-auto flex-1">
              <Show
                when={results().length > 0}
                fallback={
                  <div class="px-4 py-8 text-center text-gray-500">
                    No commands found
                  </div>
                }
              >
                <For each={results()}>
                  {(command, index) => (
                    <button
                      class={`w-full px-4 py-2.5 flex items-center gap-3 text-left transition-colors ${
                        index() === selectedIndex()
                          ? "bg-blue-600/30 text-blue-100"
                          : "text-gray-300 hover:bg-gray-700/50"
                      }`}
                      data-selected={index() === selectedIndex()}
                      onClick={() => executeCommand(command)}
                      onMouseEnter={() => setSelectedIndex(index())}
                    >
                      <span class="flex-1 truncate">{command.label}</span>
                      <span class="text-xs text-gray-500">{command.category}</span>
                      <Show when={command.shortcut}>
                        <kbd class="px-1.5 py-0.5 text-xs bg-gray-700 rounded font-mono text-gray-400">
                          {formatShortcut(command.shortcut!)}
                        </kbd>
                      </Show>
                    </button>
                  )}
                </For>
              </Show>
            </div>

            {/* Footer hint */}
            <div class="px-4 py-3 border-t border-gray-700 text-xs text-gray-500 flex items-center gap-6">
              <span class="flex items-center gap-2">
                <kbd class="px-1.5 py-0.5 bg-gray-700 rounded font-mono">↑↓</kbd>
                <span>navigate</span>
              </span>
              <span class="flex items-center gap-2">
                <kbd class="px-1.5 py-0.5 bg-gray-700 rounded font-mono">↵</kbd>
                <span>select</span>
              </span>
              <span class="flex items-center gap-2">
                <kbd class="px-1.5 py-0.5 bg-gray-700 rounded font-mono">esc</kbd>
                <span>close</span>
              </span>
            </div>
          </div>
        </div>
      </Portal>
    </Show>
  );
}

export default CommandPalette;
