/**
 * Frontmatter Editor - UI for editing note metadata
 */

import { createSignal, For, Show } from "solid-js";
import { Frontmatter, KANBAN_STATUSES } from "../lib/frontmatter/types";
import { formatDate } from "../lib/frontmatter/parser";

export interface FrontmatterEditorProps {
  frontmatter: Frontmatter | null;
  onChange: (frontmatter: Frontmatter) => void;
  class?: string;
}

export function FrontmatterEditor(props: FrontmatterEditorProps) {
  const [isExpanded, setIsExpanded] = createSignal(true);
  const [tagInput, setTagInput] = createSignal("");
  const [customFieldKey, setCustomFieldKey] = createSignal("");
  const [customFieldValue, setCustomFieldValue] = createSignal("");

  // Get current frontmatter or empty object
  const fm = () => props.frontmatter || {};

  // Standard fields to exclude from custom fields display
  const standardFields = new Set([
    "title", "labels", "created", "modified",
    "kanban", "category", "pinned", "archived"
  ]);

  // Get custom fields (non-standard fields)
  const customFields = () => {
    const result: [string, unknown][] = [];
    for (const [key, value] of Object.entries(fm())) {
      if (!standardFields.has(key)) {
        result.push([key, value]);
      }
    }
    return result;
  };

  // Update a field
  const updateField = <K extends keyof Frontmatter>(key: K, value: Frontmatter[K]) => {
    props.onChange({
      ...fm(),
      [key]: value,
    });
  };

  // Add a tag
  const addTag = () => {
    const tag = tagInput().trim();
    if (!tag) return;

    const labels = fm().labels || [];
    if (!labels.includes(tag)) {
      updateField("labels", [...labels, tag]);
    }
    setTagInput("");
  };

  // Remove a tag
  const removeTag = (tag: string) => {
    const labels = fm().labels || [];
    updateField("labels", labels.filter(l => l !== tag));
  };

  // Add custom field
  const addCustomField = () => {
    const key = customFieldKey().trim();
    const value = customFieldValue().trim();
    if (!key) return;

    props.onChange({
      ...fm(),
      [key]: value || null,
    });

    setCustomFieldKey("");
    setCustomFieldValue("");
  };

  // Remove custom field
  const removeCustomField = (key: string) => {
    const newFm = { ...fm() };
    delete newFm[key];
    props.onChange(newFm);
  };

  // Handle tag input keydown
  const handleTagKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addTag();
    } else if (e.key === "Backspace" && tagInput() === "") {
      const labels = fm().labels || [];
      if (labels.length > 0) {
        removeTag(labels[labels.length - 1]);
      }
    }
  };

  return (
    <div class={`frontmatter-editor bg-gray-800 border-b border-gray-700 ${props.class || ""}`}>
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded())}
        class="w-full flex items-center justify-between px-4 py-2 text-sm text-gray-400 hover:text-gray-200 transition-colors"
      >
        <span class="flex items-center gap-2">
          <svg
            width="12"
            height="12"
            viewBox="0 0 16 16"
            fill="currentColor"
            class={`transform transition-transform ${isExpanded() ? "rotate-90" : ""}`}
          >
            <path d="M6 4l4 4-4 4V4z" />
          </svg>
          <span>Frontmatter</span>
        </span>
        <Show when={fm().labels?.length}>
          <span class="text-xs text-gray-500">
            {fm().labels?.length} tags
          </span>
        </Show>
      </button>

      {/* Content */}
      <Show when={isExpanded()}>
        <div class="px-4 pb-4 space-y-4">
          {/* Title */}
          <div>
            <label class="block text-xs text-gray-500 mb-1">Title</label>
            <input
              type="text"
              value={fm().title || ""}
              onInput={(e) => updateField("title", e.currentTarget.value)}
              placeholder="Note title"
              class="w-full px-2 py-1 text-sm bg-gray-700 border border-gray-600 rounded text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Tags */}
          <div>
            <label class="block text-xs text-gray-500 mb-1">Tags</label>
            <div class="flex flex-wrap gap-1 p-2 bg-gray-700 border border-gray-600 rounded min-h-[32px]">
              <For each={fm().labels || []}>
                {(tag) => (
                  <span class="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-600/30 text-blue-300 text-xs rounded">
                    {tag}
                    <button
                      onClick={() => removeTag(tag)}
                      class="hover:text-red-400"
                    >
                      <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.75.75 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 0 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06z" />
                      </svg>
                    </button>
                  </span>
                )}
              </For>
              <input
                type="text"
                value={tagInput()}
                onInput={(e) => setTagInput(e.currentTarget.value)}
                onKeyDown={handleTagKeyDown}
                placeholder="Add tag..."
                class="flex-1 min-w-[80px] bg-transparent text-sm text-gray-200 placeholder-gray-500 outline-none"
              />
            </div>
          </div>

          {/* Category & Kanban row */}
          <div class="grid grid-cols-2 gap-3">
            {/* Category */}
            <div>
              <label class="block text-xs text-gray-500 mb-1">Category</label>
              <input
                type="text"
                value={fm().category || ""}
                onInput={(e) => updateField("category", e.currentTarget.value)}
                placeholder="Category"
                class="w-full px-2 py-1 text-sm bg-gray-700 border border-gray-600 rounded text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Kanban Status */}
            <div>
              <label class="block text-xs text-gray-500 mb-1">Status</label>
              <select
                value={fm().kanban || ""}
                onChange={(e) => updateField("kanban", e.currentTarget.value || undefined)}
                class="w-full px-2 py-1 text-sm bg-gray-700 border border-gray-600 rounded text-gray-200 focus:outline-none focus:border-blue-500"
              >
                <option value="">No status</option>
                <For each={KANBAN_STATUSES}>
                  {(status) => (
                    <option value={status.value}>{status.label}</option>
                  )}
                </For>
              </select>
            </div>
          </div>

          {/* Toggles */}
          <div class="flex gap-4">
            <label class="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
              <input
                type="checkbox"
                checked={fm().pinned || false}
                onChange={(e) => updateField("pinned", e.currentTarget.checked)}
                class="w-4 h-4 rounded border-gray-600 bg-gray-700 text-blue-500 focus:ring-blue-500"
              />
              Pinned
            </label>
            <label class="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
              <input
                type="checkbox"
                checked={fm().archived || false}
                onChange={(e) => updateField("archived", e.currentTarget.checked)}
                class="w-4 h-4 rounded border-gray-600 bg-gray-700 text-blue-500 focus:ring-blue-500"
              />
              Archived
            </label>
          </div>

          {/* Dates (read-only) */}
          <div class="grid grid-cols-2 gap-3 text-xs text-gray-500">
            <div>
              <span class="block mb-1">Created</span>
              <span class="text-gray-400">{formatDate(fm().created)}</span>
            </div>
            <div>
              <span class="block mb-1">Modified</span>
              <span class="text-gray-400">{formatDate(fm().modified)}</span>
            </div>
          </div>

          {/* Custom Fields */}
          <Show when={customFields().length > 0}>
            <div>
              <label class="block text-xs text-gray-500 mb-2">Custom Fields</label>
              <div class="space-y-1">
                <For each={customFields()}>
                  {([key, value]) => (
                    <div class="flex items-center gap-2 text-sm">
                      <span class="text-gray-400 min-w-[80px]">{key}:</span>
                      <span class="text-gray-200 flex-1 truncate">
                        {typeof value === "object" ? JSON.stringify(value) : String(value)}
                      </span>
                      <button
                        onClick={() => removeCustomField(key)}
                        class="text-gray-500 hover:text-red-400"
                      >
                        <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                          <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.75.75 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 0 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06z" />
                        </svg>
                      </button>
                    </div>
                  )}
                </For>
              </div>
            </div>
          </Show>

          {/* Add Custom Field */}
          <div>
            <label class="block text-xs text-gray-500 mb-1">Add Custom Field</label>
            <div class="flex gap-2">
              <input
                type="text"
                value={customFieldKey()}
                onInput={(e) => setCustomFieldKey(e.currentTarget.value)}
                placeholder="Key"
                class="w-24 px-2 py-1 text-sm bg-gray-700 border border-gray-600 rounded text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500"
              />
              <input
                type="text"
                value={customFieldValue()}
                onInput={(e) => setCustomFieldValue(e.currentTarget.value)}
                placeholder="Value"
                onKeyDown={(e) => e.key === "Enter" && addCustomField()}
                class="flex-1 px-2 py-1 text-sm bg-gray-700 border border-gray-600 rounded text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500"
              />
              <button
                onClick={addCustomField}
                disabled={!customFieldKey().trim()}
                class="px-2 py-1 text-sm bg-gray-700 hover:bg-gray-600 disabled:opacity-50 rounded transition-colors"
              >
                +
              </button>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}

export default FrontmatterEditor;
