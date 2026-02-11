/**
 * Template Selection Dialog
 */

import { createSignal, For, Show } from "solid-js";
import { getAllTemplates, type NoteTemplate } from "../lib/templates";

export interface TemplateDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (template: NoteTemplate, name: string) => void;
}

export function TemplateDialog(props: TemplateDialogProps) {
  const [selectedTemplate, setSelectedTemplate] = createSignal<NoteTemplate | null>(null);
  const [noteName, setNoteName] = createSignal("");
  const templates = getAllTemplates();

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

  return (
    <Show when={props.isOpen}>
      <div
        class="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
        onClick={(e) => e.target === e.currentTarget && props.onClose()}
        onKeyDown={handleKeyDown}
      >
        <div class="bg-gray-800 rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col border border-gray-700">
          {/* Header */}
          <div class="flex items-center justify-between border-b border-gray-700" style={{ padding: "16px 24px" }}>
            <h2 class="text-lg font-semibold text-gray-100">New from Template</h2>
            <button
              onClick={props.onClose}
              class="p-2 text-gray-400 hover:text-gray-200 hover:bg-gray-700 rounded-lg transition-colors"
            >
              <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor">
                <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.75.75 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 0 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06z" />
              </svg>
            </button>
          </div>

          {/* Template grid */}
          <div class="flex-1 overflow-y-auto" style={{ padding: "24px" }}>
            <div class="grid grid-cols-3" style={{ gap: "16px" }}>
              <For each={templates}>
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
                    <div class="text-sm font-medium text-gray-200">{template.name}</div>
                    <div class="text-xs text-gray-500 line-clamp-2" style={{ "margin-top": "8px" }}>
                      {template.description}
                    </div>
                  </button>
                )}
              </For>
            </div>
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
                  placeholder="Note name..."
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
