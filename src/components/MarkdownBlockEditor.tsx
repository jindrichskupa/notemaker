/**
 * CodeMirror-based markdown block editor
 * Uses the same configuration as the main Editor for consistent behavior
 */

import { onMount, onCleanup, createEffect } from "solid-js";
import { EditorState, Compartment, Prec } from "@codemirror/state";
import { EditorView, keymap, highlightActiveLine, highlightSpecialChars, drawSelection, dropCursor, rectangularSelection, crosshairCursor, placeholder } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { syntaxHighlighting, defaultHighlightStyle, bracketMatching } from "@codemirror/language";
import { closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
import { highlightSelectionMatches } from "@codemirror/search";
import { oneDark } from "@codemirror/theme-one-dark";
import { languages } from "../lib/editor/languages";
import { inlineMarkdownExtension, updateInlineMarkdownBasePath } from "../lib/editor/inline-markdown";
import { createImageDropExtension } from "../lib/editor/imageDropExtension";
import { settingsStore } from "../lib/settings";

export interface MarkdownBlockEditorProps {
  content: string;
  onChange: (content: string) => void;
  onFocus: () => void;
  onAddBlockBelow?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  readOnly?: boolean;
  notebookPath?: string;
}

export function MarkdownBlockEditor(props: MarkdownBlockEditorProps) {
  let containerRef: HTMLDivElement | undefined;
  let editorView: EditorView | undefined;
  const inlineMarkdownCompartment = new Compartment();
  let isUpdatingFromProps = false;

  // Getter for notebook path (for image drop extension)
  const getNotebookPath = () => props.notebookPath;

  onMount(() => {
    if (!containerRef) return;

    const settings = settingsStore.get();
    const config = settings.editor;

    // Custom keymap for block-specific actions
    const blockKeymap = Prec.highest(
      keymap.of([
        {
          key: "Mod-d",
          run: () => {
            props.onAddBlockBelow?.();
            return true;
          },
        },
        {
          key: "Alt-ArrowUp",
          run: () => {
            props.onMoveUp?.();
            return true;
          },
        },
        {
          key: "Alt-ArrowDown",
          run: () => {
            props.onMoveDown?.();
            return true;
          },
        },
      ])
    );

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged && !isUpdatingFromProps) {
        props.onChange(update.state.doc.toString());
      }
    });

    const focusListener = EditorView.domEventHandlers({
      focus: () => {
        props.onFocus();
        return false;
      },
    });

    // Use the same extensions as the main Editor
    const extensions = [
      blockKeymap,

      // Core markdown support with code language highlighting (same as main editor)
      markdown({
        base: markdownLanguage,
        codeLanguages: languages,
      }),

      // History (undo/redo)
      history(),

      // UI features (same as main editor)
      highlightActiveLine(),
      highlightSpecialChars(),
      highlightSelectionMatches(),
      drawSelection(),
      dropCursor(),
      rectangularSelection(),
      crosshairCursor(),

      // Syntax highlighting
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),

      // Editing features
      closeBrackets(),
      bracketMatching(),

      // Theme
      oneDark,

      // Line wrapping
      EditorView.lineWrapping,

      // Inline markdown rendering (same compartment pattern as main editor)
      inlineMarkdownCompartment.of(config.inlineMarkdown ? inlineMarkdownExtension : []),

      // Keymaps
      keymap.of([
        ...closeBracketsKeymap,
        ...defaultKeymap,
        ...historyKeymap,
      ]),

      updateListener,
      focusListener,
      placeholder("Enter markdown..."),

      // Image paste/drop support (requires notebook path)
      ...(props.notebookPath ? [createImageDropExtension(getNotebookPath)] : []),

      // Theme styling - same as main editor but adapted for blocks (no line numbers, auto-expand)
      EditorView.theme({
        "&": {
          fontSize: `${config.fontSize}px`,
          fontFamily: config.fontFamily,
        },
        "&.cm-editor": {
          height: "auto",
        },
        ".cm-scroller": {
          overflow: "visible",
        },
        ".cm-content": {
          fontFamily: config.fontFamily,
          lineHeight: `${config.lineHeight}`,
          minHeight: "1.6em",
          padding: "0",
        },
        ".cm-gutters": {
          display: "none",
        },
        ".cm-activeLine": {
          backgroundColor: "transparent",
        },
        ".cm-activeLineGutter": {
          backgroundColor: "transparent",
        },
        ".cm-line": {
          padding: "0 4px",
        },
        "&.cm-focused .cm-cursor": {
          borderLeftColor: "#528bff",
        },
        ".cm-selectionMatch": {
          backgroundColor: "rgba(82, 139, 255, 0.2)",
        },
        // Markdown specific styling (same as main editor)
        ".cm-header-1": {
          fontSize: "1.6em",
          fontWeight: "bold",
        },
        ".cm-header-2": {
          fontSize: "1.4em",
          fontWeight: "bold",
        },
        ".cm-header-3": {
          fontSize: "1.2em",
          fontWeight: "bold",
        },
        ".cm-link": {
          color: "#528bff",
          textDecoration: "none",
        },
        ".cm-url": {
          color: "#6b7280",
        },
        ".cm-code": {
          backgroundColor: "rgba(255, 255, 255, 0.05)",
          borderRadius: "3px",
          padding: "2px 4px",
        },
        // Frontmatter styling - smaller and muted
        ".cm-meta": {
          color: "#6b7280",
          fontSize: "0.85em",
        },
        ".cm-atom": {
          color: "#9ca3af",
        },
        ".cm-def": {
          color: "#60a5fa",
          fontSize: "0.85em",
        },
        ".cm-string.cm-meta, .cm-propertyName": {
          fontSize: "0.85em",
        },
      }),
    ];

    if (props.readOnly) {
      extensions.push(EditorState.readOnly.of(true));
    }

    const state = EditorState.create({
      doc: props.content,
      extensions,
    });

    editorView = new EditorView({
      state,
      parent: containerRef,
    });

    // Set initial base path for inline image resolution
    if (props.notebookPath) {
      updateInlineMarkdownBasePath(editorView, props.notebookPath);
    }

    // Listen to settings changes for inline markdown (same as main Editor)
    const unsubscribe = settingsStore.subscribe(() => {
      const newValue = settingsStore.get().editor.inlineMarkdown;
      if (editorView) {
        editorView.dispatch({
          effects: inlineMarkdownCompartment.reconfigure(
            newValue ? inlineMarkdownExtension : []
          ),
        });
      }
    });

    onCleanup(() => {
      unsubscribe();
    });
  });

  // Update content when props change (from external source)
  createEffect(() => {
    const newContent = props.content;
    if (editorView && editorView.state.doc.toString() !== newContent) {
      isUpdatingFromProps = true;
      editorView.dispatch({
        changes: {
          from: 0,
          to: editorView.state.doc.length,
          insert: newContent,
        },
      });
      isUpdatingFromProps = false;
    }
  });

  // Update inline markdown base path for image resolution
  createEffect(() => {
    const path = props.notebookPath;
    if (editorView) {
      updateInlineMarkdownBasePath(editorView, path);
    }
  });

  onCleanup(() => {
    editorView?.destroy();
  });

  const focus = () => {
    editorView?.focus();
  };

  return (
    <div
      ref={containerRef}
      class="markdown-block-editor"
      onClick={() => focus()}
    />
  );
}

export default MarkdownBlockEditor;
