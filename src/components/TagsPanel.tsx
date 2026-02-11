/**
 * Tags Panel - Display and filter notes by tags
 */

import { createSignal, For, Show } from "solid-js";
import { TagInfo, getTagColor } from "../lib/tags";

export interface TagsPanelProps {
  tags: TagInfo[];
  selectedTag: string | null;
  onSelectTag: (tag: string | null) => void;
  onTagClick?: (tag: string) => void;
  class?: string;
}

export function TagsPanel(props: TagsPanelProps) {
  const [searchQuery, setSearchQuery] = createSignal("");
  const [isExpanded, setIsExpanded] = createSignal(true);

  // Filter tags by search query
  const filteredTags = () => {
    const query = searchQuery().toLowerCase();
    if (!query) return props.tags;
    return props.tags.filter((t) => t.name.includes(query));
  };

  const handleTagClick = (tag: string) => {
    if (props.selectedTag === tag) {
      props.onSelectTag(null); // Deselect
    } else {
      props.onSelectTag(tag);
    }
    props.onTagClick?.(tag);
  };

  return (
    <div class={`tags-panel ${props.class || ""}`}>
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded())}
        class="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-gray-400 hover:text-gray-200 uppercase tracking-wider"
      >
        <span class="flex items-center gap-2">
          <svg
            width="10"
            height="10"
            viewBox="0 0 16 16"
            fill="currentColor"
            class={`transform transition-transform ${isExpanded() ? "rotate-90" : ""}`}
          >
            <path d="M6 4l4 4-4 4V4z" />
          </svg>
          Tags
        </span>
        <span class="text-gray-500">{props.tags.length}</span>
      </button>

      <Show when={isExpanded()}>
        <div class="px-2 pb-2">
          {/* Search */}
          <Show when={props.tags.length > 5}>
            <input
              type="text"
              value={searchQuery()}
              onInput={(e) => setSearchQuery(e.currentTarget.value)}
              placeholder="Filter tags..."
              class="w-full px-2 py-1 mb-2 text-xs bg-gray-800 border border-gray-700 rounded text-gray-200 placeholder-gray-500 focus:outline-none focus:border-gray-600"
            />
          </Show>

          {/* Tags list */}
          <div class="flex flex-wrap gap-1">
            <For each={filteredTags()}>
              {(tag) => (
                <button
                  onClick={() => handleTagClick(tag.name)}
                  class={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full transition-colors ${
                    props.selectedTag === tag.name
                      ? "bg-blue-600 text-white"
                      : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                  }`}
                >
                  <span
                    class={`w-2 h-2 rounded-full ${getTagColor(tag.name)}`}
                  />
                  <span>{tag.name}</span>
                  <span class="text-gray-400 text-[10px]">{tag.count}</span>
                </button>
              )}
            </For>
          </div>

          {/* Empty state */}
          <Show when={filteredTags().length === 0}>
            <div class="text-xs text-gray-500 text-center py-2">
              {searchQuery() ? "No matching tags" : "No tags yet"}
            </div>
          </Show>

          {/* Clear filter */}
          <Show when={props.selectedTag}>
            <button
              onClick={() => props.onSelectTag(null)}
              class="w-full mt-2 px-2 py-1 text-xs text-gray-400 hover:text-gray-200 hover:bg-gray-700 rounded transition-colors"
            >
              Clear filter
            </button>
          </Show>
        </div>
      </Show>
    </div>
  );
}

/**
 * Inline tag component for use in content
 */
export function Tag(props: { name: string; onClick?: () => void }) {
  return (
    <span
      onClick={props.onClick}
      class={`inline-flex items-center gap-1 px-1.5 py-0.5 text-xs rounded cursor-pointer ${getTagColor(
        props.name
      )} bg-opacity-20 text-gray-200 hover:bg-opacity-30`}
    >
      <span class={`w-1.5 h-1.5 rounded-full ${getTagColor(props.name)}`} />
      #{props.name}
    </span>
  );
}

export default TagsPanel;
