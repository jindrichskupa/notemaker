/**
 * Quick Open dialog (Cmd+P) for fast file navigation
 */

import { createSignal, createMemo, For, Show, onMount } from "solid-js";
import { Portal } from "solid-js/web";
import { vaultStore, TreeNode } from "../lib/store/vault";
import { SearchIcon, MarkdownIcon, FolderIcon } from "./Icons";

export interface QuickOpenProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (path: string) => void;
}

export function QuickOpen(props: QuickOpenProps) {
  const [query, setQuery] = createSignal("");
  const [selectedIndex, setSelectedIndex] = createSignal(0);
  let inputRef: HTMLInputElement | undefined;
  let listRef: HTMLDivElement | undefined;

  // Filter notes based on query
  const results = createMemo(() => {
    const q = query().trim().toLowerCase();
    const allNotes = vaultStore.getAllNotes();

    if (!q) {
      // Show recent/all notes sorted by modification time
      return allNotes.slice(0, 20);
    }

    // Fuzzy search through notes
    return allNotes
      .filter((note) => {
        const name = note.name.toLowerCase();
        const path = note.id.toLowerCase();
        return name.includes(q) || path.includes(q);
      })
      .sort((a, b) => {
        // Prioritize name matches over path matches
        const aNameMatch = a.name.toLowerCase().includes(q);
        const bNameMatch = b.name.toLowerCase().includes(q);
        if (aNameMatch && !bNameMatch) return -1;
        if (bNameMatch && !aNameMatch) return 1;

        // Then by modification time
        return (b.modified || 0) - (a.modified || 0);
      })
      .slice(0, 20);
  });

  // Reset state when opened
  const handleOpen = () => {
    setQuery("");
    setSelectedIndex(0);
    setTimeout(() => inputRef?.focus(), 10);
  };

  // Select a note
  const selectNote = (note: TreeNode) => {
    props.onSelect(note.path);
    props.onClose();
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
          selectNote(selected);
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

  // Get display name (without .md)
  const getDisplayName = (note: TreeNode) => {
    if (note.name.endsWith(".md")) {
      return note.name.slice(0, -3);
    }
    return note.name;
  };

  // Get relative path for display
  const getRelativePath = (note: TreeNode) => {
    const parts = note.id.split("/");
    if (parts.length > 1) {
      return parts.slice(0, -1).join("/");
    }
    return "";
  };

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
                placeholder="Search notes..."
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
                    <Show
                      when={vaultStore.vault()}
                      fallback="Open a vault to search notes"
                    >
                      No notes found
                    </Show>
                  </div>
                }
              >
                <For each={results()}>
                  {(note, index) => (
                    <button
                      class={`w-full px-4 py-2.5 flex items-center gap-3 text-left transition-colors ${
                        index() === selectedIndex()
                          ? "bg-blue-600/30 text-blue-100"
                          : "text-gray-300 hover:bg-gray-700/50"
                      }`}
                      data-selected={index() === selectedIndex()}
                      onClick={() => selectNote(note)}
                      onMouseEnter={() => setSelectedIndex(index())}
                    >
                      <MarkdownIcon class="text-gray-500 flex-shrink-0" size={16} />
                      <div class="flex-1 min-w-0">
                        <div class="truncate font-medium">
                          {getDisplayName(note)}
                        </div>
                        <Show when={getRelativePath(note)}>
                          <div class="text-xs text-gray-500 truncate flex items-center gap-1">
                            <FolderIcon size={10} />
                            {getRelativePath(note)}
                          </div>
                        </Show>
                      </div>
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
                <span>open</span>
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

export default QuickOpen;
