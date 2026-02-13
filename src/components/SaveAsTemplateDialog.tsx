/**
 * Save As Template Dialog
 *
 * Allows saving the current note as a custom template.
 */

import { createSignal, Show } from "solid-js";
import { saveAsTemplate, type TemplateMetadata } from "../lib/templates";

export interface SaveAsTemplateDialogProps {
  isOpen: boolean;
  vaultPath: string;
  noteContent: string;  // The body content (without frontmatter)
  suggestedName?: string;
  onClose: () => void;
  onSaved: (templatePath: string) => void;
}

const CATEGORIES = [
  "Custom",
  "Personal",
  "Work",
  "Development",
  "Documentation",
  "Operations",
  "Basic",
];

export function SaveAsTemplateDialog(props: SaveAsTemplateDialogProps) {
  const [name, setName] = createSignal(props.suggestedName || "");
  const [description, setDescription] = createSignal("");
  const [category, setCategory] = createSignal("Custom");
  const [icon, setIcon] = createSignal("");
  const [isSaving, setIsSaving] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      props.onClose();
    }
  };

  const handleSave = async () => {
    const templateName = name().trim();
    if (!templateName) {
      setError("Template name is required");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const metadata: TemplateMetadata = {
        name: templateName,
        description: description().trim() || undefined,
        category: category(),
        icon: icon().trim() || undefined,
      };

      const templatePath = await saveAsTemplate(
        props.vaultPath,
        templateName,
        props.noteContent,
        metadata
      );

      props.onSaved(templatePath);
      handleClose();
    } catch (err) {
      console.error("Failed to save template:", err);
      setError(err instanceof Error ? err.message : "Failed to save template");
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    setName("");
    setDescription("");
    setCategory("Custom");
    setIcon("");
    setError(null);
    props.onClose();
  };

  return (
    <Show when={props.isOpen}>
      <div
        class="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
        onClick={(e) => e.target === e.currentTarget && handleClose()}
        onKeyDown={handleKeyDown}
      >
        <div class="bg-gray-800 rounded-xl shadow-xl w-full max-w-md border border-gray-700">
          {/* Header */}
          <div class="flex items-center justify-between border-b border-gray-700" style={{ padding: "16px 24px" }}>
            <h2 class="text-lg font-semibold text-gray-100">Save as Template</h2>
            <button
              onClick={handleClose}
              class="p-2 text-gray-400 hover:text-gray-200 hover:bg-gray-700 rounded-lg transition-colors"
            >
              <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor">
                <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.75.75 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 0 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06z" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div style={{ padding: "24px", display: "flex", "flex-direction": "column", gap: "16px" }}>
            {/* Name */}
            <div>
              <label class="block text-sm text-gray-300" style={{ "margin-bottom": "6px" }}>
                Template Name <span class="text-red-400">*</span>
              </label>
              <input
                ref={(el) => setTimeout(() => el?.focus(), 10)}
                type="text"
                value={name()}
                onInput={(e) => setName(e.currentTarget.value)}
                placeholder="My Template"
                class="w-full bg-gray-700 border border-gray-600 rounded-lg text-sm text-gray-100 placeholder-gray-500 outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                style={{ padding: "10px 14px" }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && name().trim()) handleSave();
                }}
              />
            </div>

            {/* Description */}
            <div>
              <label class="block text-sm text-gray-300" style={{ "margin-bottom": "6px" }}>
                Description
              </label>
              <input
                type="text"
                value={description()}
                onInput={(e) => setDescription(e.currentTarget.value)}
                placeholder="Brief description of this template"
                class="w-full bg-gray-700 border border-gray-600 rounded-lg text-sm text-gray-100 placeholder-gray-500 outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                style={{ padding: "10px 14px" }}
              />
            </div>

            {/* Category */}
            <div>
              <label class="block text-sm text-gray-300" style={{ "margin-bottom": "6px" }}>
                Category
              </label>
              <select
                value={category()}
                onChange={(e) => setCategory(e.currentTarget.value)}
                class="w-full bg-gray-700 border border-gray-600 rounded-lg text-sm text-gray-100 outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                style={{ padding: "10px 14px" }}
              >
                {CATEGORIES.map((cat) => (
                  <option value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            {/* Icon (emoji) */}
            <div>
              <label class="block text-sm text-gray-300" style={{ "margin-bottom": "6px" }}>
                Icon (emoji, optional)
              </label>
              <input
                type="text"
                value={icon()}
                onInput={(e) => setIcon(e.currentTarget.value)}
                placeholder="📝"
                maxLength={4}
                class="w-20 bg-gray-700 border border-gray-600 rounded-lg text-sm text-gray-100 placeholder-gray-500 outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center"
                style={{ padding: "10px 14px" }}
              />
            </div>

            {/* Error */}
            <Show when={error()}>
              <div class="text-sm text-red-400 bg-red-900/20 rounded-lg" style={{ padding: "10px 14px" }}>
                {error()}
              </div>
            </Show>

            {/* Info */}
            <div class="text-xs text-gray-500">
              Template will be saved to <code class="text-gray-400">.notemaker/templates/</code>
            </div>
          </div>

          {/* Footer */}
          <div class="flex justify-end border-t border-gray-700" style={{ padding: "16px 24px", gap: "12px" }}>
            <button
              onClick={handleClose}
              class="text-sm text-gray-300 hover:text-gray-100 transition-colors"
              style={{ padding: "10px 20px" }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!name().trim() || isSaving()}
              class="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors"
              style={{ padding: "10px 24px" }}
            >
              {isSaving() ? "Saving..." : "Save Template"}
            </button>
          </div>
        </div>
      </div>
    </Show>
  );
}

export default SaveAsTemplateDialog;
