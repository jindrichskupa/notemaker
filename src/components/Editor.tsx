import { createSignal, onMount, onCleanup, createEffect, Show } from "solid-js";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import {
  createExtensions,
  EditorConfig,
  defaultEditorConfig,
  vimCompartment,
  inlineMarkdownCompartment,
  inlineMarkdownExtension,
} from "../lib/editor";
import { updateInlineMarkdownBasePath } from "../lib/editor/inline-markdown";
import { createAutoSave, formatLastSaved, AutoSaveController } from "../lib/editor/autosave";
import { loadVimModePreference, saveVimModePreference, loadVimExtension } from "../lib/editor/vim-mode";
import { settingsStore } from "../lib/settings";

export interface EditorProps {
  content: string;
  onChange?: (content: string) => void;
  onSave?: (content: string) => Promise<void>;
  config?: Partial<EditorConfig>;
  filePath?: string;
  /** Absolute file path for image paste/drop - if not provided, filePath is used */
  absoluteFilePath?: string;
  readOnly?: boolean;
}

export function Editor(props: EditorProps) {
  let containerRef: HTMLDivElement | undefined;
  let editorView: EditorView | undefined;
  let autoSaveController: AutoSaveController | undefined;

  // Flag to skip content sync when change originated from editor
  let skipNextContentSync = false;

  const [isDirty, setIsDirty] = createSignal(false);
  const [isSaving, setIsSaving] = createSignal(false);
  const [lastSaved, setLastSaved] = createSignal<number | null>(null);
  const [saveError, setSaveError] = createSignal<string | null>(null);
  const [vimEnabled, setVimEnabled] = createSignal(loadVimModePreference());
  const [vimMode, setVimMode] = createSignal<string>("normal");
  const [inlineMarkdownEnabled, setInlineMarkdownEnabled] = createSignal(
    settingsStore.get().editor.inlineMarkdown
  );

  const config = (): EditorConfig => ({
    ...defaultEditorConfig,
    ...props.config,
    inlineMarkdown: settingsStore.get().editor.inlineMarkdown,
  });

  // Getter for file path (for image drop extension - needs absolute path)
  const getNotePath = () => props.absoluteFilePath || props.filePath;

  // Handle content change
  const handleChange = (content: string) => {
    // Mark that this change came from the editor, so we don't re-sync it back
    skipNextContentSync = true;
    props.onChange?.(content);
    setIsDirty(true);

    if (autoSaveController) {
      autoSaveController.markDirty();
    }
  };

  // Handle save
  const handleSave = async () => {
    if (!editorView || !props.onSave) return;

    const content = editorView.state.doc.toString();
    setIsSaving(true);
    setSaveError(null);

    try {
      await props.onSave(content);
      setIsDirty(false);
      setLastSaved(Date.now());
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save";
      setSaveError(message);
      console.error("Save failed:", err);
    } finally {
      setIsSaving(false);
    }
  };

  // Initialize editor
  onMount(() => {
    if (!containerRef) return;

    const extensions = createExtensions(config(), handleSave, handleChange, getNotePath);

    const state = EditorState.create({
      doc: props.content,
      extensions,
    });

    editorView = new EditorView({
      state,
      parent: containerRef,
    });

    // Set initial base path for inline image resolution
    if (props.absoluteFilePath) {
      updateInlineMarkdownBasePath(editorView, props.absoluteFilePath);
    }

    // Set up auto-save if onSave is provided
    if (props.onSave) {
      autoSaveController = createAutoSave(handleSave, 1000);
    }

    // Load vim mode if enabled (from preference or config)
    if (vimEnabled() || config().vimMode) {
      loadVimExtension().then((vimExtension) => {
        editorView?.dispatch({
          effects: vimCompartment.reconfigure(vimExtension),
        });
        setVimEnabled(true);
        setVimMode("normal");
      });
    }

    // Focus editor
    editorView.focus();
  });

  // Update content when props change (from external source)
  createEffect(() => {
    const newContent = props.content;

    // Skip if this change originated from within the editor
    if (skipNextContentSync) {
      skipNextContentSync = false;
      return;
    }

    if (editorView && editorView.state.doc.toString() !== newContent) {
      editorView.dispatch({
        changes: {
          from: 0,
          to: editorView.state.doc.length,
          insert: newContent,
        },
      });
      setIsDirty(false);
    }
  });

  // Listen to settings changes for inline markdown
  onMount(() => {
    const unsubscribe = settingsStore.subscribe(() => {
      const newValue = settingsStore.get().editor.inlineMarkdown;
      if (newValue !== inlineMarkdownEnabled() && editorView) {
        setInlineMarkdownEnabled(newValue);
        editorView.dispatch({
          effects: inlineMarkdownCompartment.reconfigure(
            newValue ? inlineMarkdownExtension : []
          ),
        });
      }
    });
    onCleanup(unsubscribe);
  });

  // Update inline markdown base path when file path changes (for image resolution)
  createEffect(() => {
    const path = props.absoluteFilePath;
    if (editorView) {
      updateInlineMarkdownBasePath(editorView, path);
    }
  });

  // Clean up
  onCleanup(() => {
    editorView?.destroy();
    autoSaveController?.destroy();
  });

  // Toggle vim mode
  const toggleVimMode = async () => {
    if (!editorView) return;

    if (vimEnabled()) {
      editorView.dispatch({
        effects: vimCompartment.reconfigure([]),
      });
      setVimEnabled(false);
      setVimMode("disabled");
      saveVimModePreference(false);
    } else {
      const vimExtension = await loadVimExtension();
      editorView.dispatch({
        effects: vimCompartment.reconfigure(vimExtension),
      });
      setVimEnabled(true);
      setVimMode("normal");
      saveVimModePreference(true);
    }
  };

  // Format status text
  const statusText = () => {
    if (isSaving()) return "Saving...";
    if (saveError()) return saveError();
    if (isDirty()) return "Unsaved changes";
    return formatLastSaved(lastSaved());
  };

  const statusClass = () => {
    if (saveError()) return "text-red-400";
    if (isDirty()) return "text-yellow-400";
    return "text-gray-500";
  };

  return (
    <div class="flex flex-col h-full bg-gray-900">
      {/* Editor toolbar */}
      <div class="flex items-center justify-between bg-gray-800 border-b border-gray-700" style={{ padding: "12px 20px" }}>
        <div class="flex items-center gap-4">
          <Show when={props.filePath}>
            <span class="text-sm text-gray-400 font-mono">{props.filePath}</span>
          </Show>
        </div>

        <div class="flex items-center gap-4">
          {/* Vim mode toggle */}
          <button
            onClick={toggleVimMode}
            class={`px-2 py-1 text-xs rounded transition-colors ${
              vimEnabled()
                ? "bg-green-600 text-white"
                : "bg-gray-700 text-gray-400 hover:bg-gray-600"
            }`}
            title={vimEnabled() ? "Disable Vim mode" : "Enable Vim mode"}
          >
            VIM
          </button>

          {/* Save status */}
          <span class={`text-xs ${statusClass()}`}>{statusText()}</span>

          {/* Save button */}
          <Show when={props.onSave}>
            <button
              onClick={handleSave}
              disabled={isSaving() || !isDirty()}
              class="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 rounded transition-colors"
            >
              {isSaving() ? "Saving..." : "Save"}
            </button>
          </Show>
        </div>
      </div>

      {/* Editor container */}
      <div
        ref={containerRef}
        class="flex-1 overflow-auto"
        style={{
          "min-height": "0",
        }}
      />

      {/* Status bar */}
      <div class="flex items-center justify-between bg-gray-800 border-t border-gray-700 text-xs text-gray-500" style={{ padding: "8px 20px" }}>
        <div style={{ display: "flex", "align-items": "center", gap: "24px" }}>
          <span>Markdown</span>
          <Show when={vimEnabled()}>
            <span
              class={`font-mono ${
                vimMode() === "insert" ? "text-blue-400" :
                vimMode() === "visual" ? "text-purple-400" :
                vimMode() === "replace" ? "text-red-400" :
                "text-green-400"
              }`}
            >
              -- {vimMode().toUpperCase()} --
            </span>
          </Show>
        </div>

        <div style={{ display: "flex", "align-items": "center", gap: "24px" }}>
          <span>
            {editorView
              ? `Ln ${editorView.state.selection.main.head}, Col ${
                  editorView.state.selection.main.head -
                  editorView.state.doc.lineAt(editorView.state.selection.main.head).from
                }`
              : "Ln 1, Col 0"}
          </span>
          <span>UTF-8</span>
        </div>
      </div>
    </div>
  );
}

export default Editor;
