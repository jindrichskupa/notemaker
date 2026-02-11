/**
 * CodeMirror-based code block editor with syntax highlighting
 */

import { onMount, onCleanup, createEffect } from "solid-js";
import { EditorState, Compartment, Prec } from "@codemirror/state";
import { EditorView, keymap, placeholder } from "@codemirror/view";
import { defaultKeymap } from "@codemirror/commands";
import { syntaxHighlighting, defaultHighlightStyle } from "@codemirror/language";
import { oneDark } from "@codemirror/theme-one-dark";
import { getLanguageByName } from "../lib/editor/languages";

export interface CodeBlockEditorProps {
  content: string;
  language: string;
  onChange: (content: string) => void;
  onFocus: () => void;
  onRun?: () => void;
  onAddBlockBelow?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  readOnly?: boolean;
}

export function CodeBlockEditor(props: CodeBlockEditorProps) {
  let containerRef: HTMLDivElement | undefined;
  let editorView: EditorView | undefined;
  const languageCompartment = new Compartment();
  let isUpdatingFromProps = false;

  // Load language extension
  const loadLanguage = async (langName: string) => {
    const langDesc = getLanguageByName(langName);
    if (langDesc && editorView) {
      try {
        const langSupport = await langDesc.load();
        editorView.dispatch({
          effects: languageCompartment.reconfigure(langSupport),
        });
      } catch (err) {
        console.error("Failed to load language:", langName, err);
      }
    }
  };

  onMount(() => {
    if (!containerRef) return;

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

    // Custom keymap with highest priority
    const customKeymap = Prec.highest(
      keymap.of([
        {
          key: "Mod-r",
          run: () => {
            props.onRun?.();
            return true;
          },
        },
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

    const extensions = [
      customKeymap,
      languageCompartment.of([]),
      keymap.of(defaultKeymap),
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      oneDark,
      updateListener,
      focusListener,
      placeholder("Enter code..."),
      EditorView.lineWrapping,
      EditorView.theme({
        "&": {
          backgroundColor: "transparent",
          fontSize: "13px",
        },
        "&.cm-editor": {
          // Allow editor to expand with content
          height: "auto",
        },
        ".cm-scroller": {
          // Don't scroll, expand instead
          overflow: "visible",
        },
        ".cm-content": {
          padding: "0",
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
          minHeight: "1.4em",
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
        "&.cm-focused .cm-cursor": {
          borderLeftColor: "#60a5fa",
        },
        "&.cm-focused .cm-selectionBackground, ::selection": {
          backgroundColor: "#3b82f633",
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

    // Load language
    loadLanguage(props.language);
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

  // Update language when it changes
  createEffect(() => {
    const lang = props.language;
    if (editorView) {
      loadLanguage(lang);
    }
  });

  onCleanup(() => {
    editorView?.destroy();
  });

  // Focus the editor
  const focus = () => {
    editorView?.focus();
  };

  return (
    <div
      ref={containerRef}
      class="code-block-editor"
      onClick={() => focus()}
    />
  );
}

export default CodeBlockEditor;
