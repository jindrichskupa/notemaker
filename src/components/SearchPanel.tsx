/**
 * Global search panel (Cmd+Shift+F)
 */

import { createSignal, createMemo, For, Show, onMount } from "solid-js";
import { Portal } from "solid-js/web";
import { searchEngine, SearchResult, SearchQuery } from "../lib/search";
import { vaultStore } from "../lib/store/vault";
import { debounce } from "../lib/utils";
import { SearchIcon, MarkdownIcon } from "./Icons";
import { formatRelativeDate } from "../lib/frontmatter";

export interface SearchPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (path: string) => void;
}

export function SearchPanel(props: SearchPanelProps) {
  const [query, setQuery] = createSignal("");
  const [selectedIndex, setSelectedIndex] = createSignal(0);
  const [isIndexing, setIsIndexing] = createSignal(false);
  const [showFilters, setShowFilters] = createSignal(false);
  const [labelFilter, setLabelFilter] = createSignal<string[]>([]);
  const [categoryFilter, setCategoryFilter] = createSignal<string | undefined>();

  let inputRef: HTMLInputElement | undefined;
  let listRef: HTMLDivElement | undefined;

  // Build search query
  const searchQuery = createMemo((): SearchQuery => ({
    text: query(),
    labels: labelFilter().length > 0 ? labelFilter() : undefined,
    category: categoryFilter(),
  }));

  // Perform search
  const results = createMemo(() => {
    if (!query().trim()) return [];
    return searchEngine.search(searchQuery());
  });

  // Available labels and categories for filters
  const availableLabels = createMemo(() => searchEngine.getAllLabels());
  const availableCategories = createMemo(() => searchEngine.getAllCategories());

  // Debounced query update
  const debouncedSetQuery = debounce((value: string) => {
    setQuery(value);
    setSelectedIndex(0);
  }, 150);

  // Index notes when panel opens
  const indexNotes = async () => {
    if (!vaultStore.vault()) return;

    setIsIndexing(true);
    try {
      await searchEngine.indexAll(vaultStore.tree());
    } finally {
      setIsIndexing(false);
    }
  };

  // Reset and focus when opened
  const handleOpen = () => {
    setQuery("");
    setSelectedIndex(0);
    setShowFilters(false);
    setTimeout(() => inputRef?.focus(), 10);
    indexNotes();
  };

  // Select result
  const selectResult = (result: SearchResult) => {
    props.onSelect(result.path);
    props.onClose();
  };

  // Keyboard navigation
  const handleKeyDown = (e: KeyboardEvent) => {
    const resultList = results();

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, resultList.length - 1));
        scrollToSelected();
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
        scrollToSelected();
        break;
      case "Enter":
        e.preventDefault();
        const selected = resultList[selectedIndex()];
        if (selected) {
          selectResult(selected);
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

  // Toggle label filter
  const toggleLabel = (label: string) => {
    const current = labelFilter();
    if (current.includes(label)) {
      setLabelFilter(current.filter((l) => l !== label));
    } else {
      setLabelFilter([...current, label]);
    }
    setSelectedIndex(0);
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
          class="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-[10vh]"
          onClick={handleBackdropClick}
        >
          <div
            class="w-[640px] max-h-[70vh] bg-gray-800 rounded-lg shadow-2xl border border-gray-700 overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Search input */}
            <div class="flex items-center gap-3 px-4 py-3 border-b border-gray-700">
              <SearchIcon class="text-gray-500 flex-shrink-0" size={18} />
              <input
                ref={inputRef}
                type="text"
                placeholder="Search in all notes..."
                class="flex-1 bg-transparent text-gray-100 text-base placeholder-gray-500 outline-none"
                onInput={(e) => debouncedSetQuery(e.currentTarget.value)}
                onKeyDown={handleKeyDown}
              />
              <Show when={isIndexing()}>
                <span class="text-xs text-gray-500">Indexing...</span>
              </Show>
              <button
                onClick={() => setShowFilters(!showFilters())}
                class={`p-1.5 rounded transition-colors ${
                  showFilters() || labelFilter().length > 0 || categoryFilter()
                    ? "bg-blue-600/30 text-blue-300"
                    : "text-gray-500 hover:text-gray-300 hover:bg-gray-700"
                }`}
                title="Toggle filters"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M.75 3h14.5a.75.75 0 0 1 0 1.5H.75a.75.75 0 0 1 0-1.5ZM3 7.75A.75.75 0 0 1 3.75 7h8.5a.75.75 0 0 1 0 1.5h-8.5A.75.75 0 0 1 3 7.75Zm3 4a.75.75 0 0 1 .75-.75h2.5a.75.75 0 0 1 0 1.5h-2.5a.75.75 0 0 1-.75-.75Z" />
                </svg>
              </button>
            </div>

            {/* Filters */}
            <Show when={showFilters()}>
              <div class="px-4 py-3 border-b border-gray-700 bg-gray-850 space-y-3">
                {/* Labels */}
                <Show when={availableLabels().length > 0}>
                  <div>
                    <div class="text-xs text-gray-500 mb-2">Labels</div>
                    <div class="flex flex-wrap gap-1">
                      <For each={availableLabels()}>
                        {(label) => (
                          <button
                            onClick={() => toggleLabel(label)}
                            class={`px-2 py-0.5 text-xs rounded-full transition-colors ${
                              labelFilter().includes(label)
                                ? "bg-blue-600 text-white"
                                : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                            }`}
                          >
                            {label}
                          </button>
                        )}
                      </For>
                    </div>
                  </div>
                </Show>

                {/* Category */}
                <Show when={availableCategories().length > 0}>
                  <div>
                    <div class="text-xs text-gray-500 mb-2">Category</div>
                    <select
                      value={categoryFilter() || ""}
                      onChange={(e) =>
                        setCategoryFilter(e.currentTarget.value || undefined)
                      }
                      class="px-2 py-1 text-sm bg-gray-700 border border-gray-600 rounded text-gray-100"
                    >
                      <option value="">All categories</option>
                      <For each={availableCategories()}>
                        {(cat) => <option value={cat}>{cat}</option>}
                      </For>
                    </select>
                  </div>
                </Show>

                {/* Clear filters */}
                <Show when={labelFilter().length > 0 || categoryFilter()}>
                  <button
                    onClick={() => {
                      setLabelFilter([]);
                      setCategoryFilter(undefined);
                    }}
                    class="text-xs text-gray-400 hover:text-gray-200"
                  >
                    Clear filters
                  </button>
                </Show>
              </div>
            </Show>

            {/* Results */}
            <div ref={listRef} class="overflow-y-auto flex-1">
              <Show
                when={query().trim()}
                fallback={
                  <div class="px-4 py-8 text-center text-gray-500">
                    <Show
                      when={vaultStore.vault()}
                      fallback="Open a vault to search notes"
                    >
                      Start typing to search...
                    </Show>
                  </div>
                }
              >
                <Show
                  when={results().length > 0}
                  fallback={
                    <div class="px-4 py-8 text-center text-gray-500">
                      No results found for "{query()}"
                    </div>
                  }
                >
                  <div class="py-1">
                    <For each={results()}>
                      {(result, index) => (
                        <button
                          class={`w-full px-4 py-3 flex items-start gap-3 text-left transition-colors ${
                            index() === selectedIndex()
                              ? "bg-blue-600/30"
                              : "hover:bg-gray-700/50"
                          }`}
                          data-selected={index() === selectedIndex()}
                          onClick={() => selectResult(result)}
                          onMouseEnter={() => setSelectedIndex(index())}
                        >
                          <MarkdownIcon
                            class="text-gray-500 flex-shrink-0 mt-1"
                            size={16}
                          />
                          <div class="flex-1 min-w-0">
                            <div class="font-medium text-gray-200 truncate">
                              {result.title}
                            </div>
                            <div
                              class="text-sm text-gray-400 mt-1 line-clamp-2"
                              innerHTML={result.snippet}
                            />
                            <div class="flex items-center gap-2 mt-2 text-xs text-gray-500">
                              <span class="truncate max-w-[200px]">
                                {result.path.split("/").slice(-2).join("/")}
                              </span>
                              <Show when={result.modified}>
                                <span>·</span>
                                <span>{formatRelativeDate(result.modified)}</span>
                              </Show>
                              <Show when={result.labels && result.labels.length > 0}>
                                <span>·</span>
                                <For each={result.labels!.slice(0, 3)}>
                                  {(label) => (
                                    <span class="px-1.5 py-0.5 bg-gray-700 rounded text-gray-400">
                                      {label}
                                    </span>
                                  )}
                                </For>
                              </Show>
                            </div>
                          </div>
                        </button>
                      )}
                    </For>
                  </div>
                </Show>
              </Show>
            </div>

            {/* Footer */}
            <div class="px-4 py-3 border-t border-gray-700 text-xs text-gray-500 flex items-center justify-between">
              <div class="flex items-center gap-6">
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
              <Show when={results().length > 0}>
                <span>{results().length} results</span>
              </Show>
            </div>

            {/* Search tips */}
            <Show when={query().trim() && results().length === 0}>
              <div class="px-4 py-2 bg-gray-850 border-t border-gray-700 text-xs text-gray-500">
                <strong>Tips:</strong> Use "quotes" for exact phrases, -word to
                exclude, search in title or content
              </div>
            </Show>
          </div>
        </div>
      </Portal>
    </Show>
  );
}

export default SearchPanel;
