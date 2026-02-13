/**
 * Template Selection Dialog
 *
 * Supports:
 * - Built-in templates
 * - Custom vault templates from .notemaker/templates/
 */

import { createSignal, createEffect, For, Show } from "solid-js";
import {
  getAllTemplatesAsync,
  getTemplateCategories,
  isNotebookTemplate,
  type NoteTemplate,
} from "../lib/templates";

export interface TemplateDialogProps {
  isOpen: boolean;
  vaultPath: string | null;
  onClose: () => void;
  onSelect: (template: NoteTemplate, name: string) => void;
}

export function TemplateDialog(props: TemplateDialogProps) {
  const [selectedTemplate, setSelectedTemplate] = createSignal<NoteTemplate | null>(null);
  const [noteName, setNoteName] = createSignal("");
  const [templates, setTemplates] = createSignal<NoteTemplate[]>([]);
  const [isLoading, setIsLoading] = createSignal(false);
  const [selectedCategory, setSelectedCategory] = createSignal<string | null>(null);

  // Load templates when dialog opens
  createEffect(() => {
    if (props.isOpen) {
      loadTemplates();
    }
  });

  const loadTemplates = async () => {
    setIsLoading(true);
    try {
      const allTemplates = await getAllTemplatesAsync(props.vaultPath);
      setTemplates(allTemplates);
    } catch (err) {
      console.error("Failed to load templates:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const categories = () => getTemplateCategories(templates());

  const filteredTemplates = () => {
    const cat = selectedCategory();
    if (!cat) return templates();
    return templates().filter((t) => t.category === cat);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      props.onClose();
    }
  };

  const handleCreate = () => {
    const template = selectedTemplate();
    const name = noteName().trim();
    if (template && name) {
      props.onSelect(template, name);
      setSelectedTemplate(null);
      setNoteName("");
      setSelectedCategory(null);
    }
  };

  const handleTemplateClick = (template: NoteTemplate) => {
    setSelectedTemplate(template);
    if (!noteName()) {
      // Suggest a name based on template
      const now = new Date();
      const dateStr = now.toISOString().split("T")[0];
      if (template.id === "daily") {
        setNoteName(dateStr);
      } else if (template.id === "retrospective") {
        setNoteName(`Retro ${dateStr}`);
      }
    }
  };

  const handleClose = () => {
    setSelectedTemplate(null);
    setNoteName("");
    setSelectedCategory(null);
    props.onClose();
  };

  return (
    <Show when={props.isOpen}>
      <div
        class="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
        onClick={(e) => e.target === e.currentTarget && handleClose()}
        onKeyDown={handleKeyDown}
      >
        <div class="bg-gray-800 rounded-xl shadow-xl w-full max-w-3xl max-h-[85vh] flex flex-col border border-gray-700">
          {/* Header */}
          <div class="flex items-center justify-between border-b border-gray-700" style={{ padding: "16px 24px" }}>
            <h2 class="text-lg font-semibold text-gray-100">New from Template</h2>
            <button
              onClick={handleClose}
              class="p-2 text-gray-400 hover:text-gray-200 hover:bg-gray-700 rounded-lg transition-colors"
            >
              <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor">
                <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.75.75 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 0 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06z" />
              </svg>
            </button>
          </div>

          {/* Category filter */}
          <div class="flex items-center border-b border-gray-700 overflow-x-auto" style={{ padding: "12px 24px", gap: "8px" }}>
            <button
              onClick={() => setSelectedCategory(null)}
              class={`px-3 py-1.5 text-xs rounded-full whitespace-nowrap transition-colors ${
                selectedCategory() === null
                  ? "bg-blue-600 text-white"
                  : "bg-gray-700 text-gray-300 hover:bg-gray-600"
              }`}
            >
              All
            </button>
            <For each={categories()}>
              {(category) => (
                <button
                  onClick={() => setSelectedCategory(category)}
                  class={`px-3 py-1.5 text-xs rounded-full whitespace-nowrap transition-colors ${
                    selectedCategory() === category
                      ? "bg-blue-600 text-white"
                      : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                  }`}
                >
                  {category}
                </button>
              )}
            </For>
          </div>

          {/* Template grid */}
          <div class="flex-1 overflow-y-auto" style={{ padding: "24px" }}>
            <Show when={isLoading()}>
              <div class="flex items-center justify-center py-8">
                <div class="text-gray-400">Loading templates...</div>
              </div>
            </Show>

            <Show when={!isLoading()}>
              <div class="grid grid-cols-3" style={{ gap: "16px" }}>
                <For each={filteredTemplates()}>
                  {(template) => (
                    <button
                      onClick={() => handleTemplateClick(template)}
                      style={{ padding: "16px" }}
                      class={`rounded-lg border text-left transition-all ${
                        selectedTemplate()?.id === template.id
                          ? "border-blue-500 bg-blue-500/10"
                          : "border-gray-700 hover:border-gray-600 hover:bg-gray-700/50"
                      }`}
                    >
                      <div class="flex items-center justify-between">
                        <div class="text-sm font-medium text-gray-200">
                          {template.icon && <span style={{ "margin-right": "6px" }}>{template.icon}</span>}
                          {template.name}
                        </div>
                        <div class="flex items-center" style={{ gap: "4px" }}>
                          <Show when={isNotebookTemplate(template)}>
                            <span class="px-1.5 py-0.5 text-[10px] bg-green-600/30 text-green-300 rounded">
                              Notebook
                            </span>
                          </Show>
                          <Show when={template.isCustom}>
                            <span class="px-1.5 py-0.5 text-[10px] bg-purple-600/30 text-purple-300 rounded">
                              Custom
                            </span>
                          </Show>
                        </div>
                      </div>
                      <div class="text-xs text-gray-500 line-clamp-2" style={{ "margin-top": "8px" }}>
                        {template.description}
                      </div>
                      <Show when={template.category}>
                        <div class="text-[10px] text-gray-600" style={{ "margin-top": "8px" }}>
                          {template.category}
                        </div>
                      </Show>
                    </button>
                  )}
                </For>
              </div>

              <Show when={filteredTemplates().length === 0}>
                <div class="text-center py-8 text-gray-500">
                  No templates in this category
                </div>
              </Show>
            </Show>
          </div>

          {/* Footer with name input */}
          <div class="border-t border-gray-700" style={{ padding: "20px 24px" }}>
            <Show when={selectedTemplate()}>
              <div class="flex items-center" style={{ gap: "16px" }}>
                <input
                  ref={(el) => setTimeout(() => el?.focus(), 10)}
                  type="text"
                  value={noteName()}
                  onInput={(e) => setNoteName(e.currentTarget.value)}
                  placeholder={isNotebookTemplate(selectedTemplate()!) ? "Notebook name..." : "Note name..."}
                  class="flex-1 bg-gray-700 border border-gray-600 rounded-lg text-sm text-gray-100 placeholder-gray-500 outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  style={{ padding: "12px 16px" }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreate();
                  }}
                />
                <button
                  onClick={handleCreate}
                  disabled={!noteName().trim()}
                  class="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors"
                  style={{ padding: "12px 24px" }}
                >
                  Create
                </button>
              </div>
            </Show>
            <Show when={!selectedTemplate()}>
              <p class="text-sm text-gray-500 text-center py-2">
                Select a template to get started
              </p>
            </Show>
          </div>
        </div>
      </div>
    </Show>
  );
}

export default TemplateDialog;
