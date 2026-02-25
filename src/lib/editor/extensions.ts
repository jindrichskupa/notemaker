import { Extension, Compartment } from "@codemirror/state";
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightSpecialChars, drawSelection, dropCursor, rectangularSelection, crosshairCursor } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { oneDark } from "@codemirror/theme-one-dark";
import { search, searchKeymap, highlightSelectionMatches } from "@codemirror/search";
import { autocompletion, completionKeymap, closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
import { foldGutter, indentOnInput, syntaxHighlighting, defaultHighlightStyle, bracketMatching, foldKeymap } from "@codemirror/language";
import { languages } from "./languages";
import { inlineMarkdownExtension } from "./inline-markdown";
import { createImageDropExtension } from "./imageDropExtension";

export interface EditorConfig {
  vimMode: boolean;
  theme: "dark" | "light";
  lineNumbers: boolean;
  wordWrap: boolean;
  fontSize: number;
  fontFamily: string;
  lineHeight: number;
  tabSize: number;
  inlineMarkdown: boolean;
}

export const defaultEditorConfig: EditorConfig = {
  vimMode: false,
  theme: "dark",
  lineNumbers: true,
  wordWrap: true,
  fontSize: 14,
  fontFamily: "JetBrains Mono, Menlo, Monaco, monospace",
  lineHeight: 1.6,
  tabSize: 2,
  inlineMarkdown: false,
};

// Compartments for dynamic configuration
export const vimCompartment = new Compartment();
export const themeCompartment = new Compartment();
export const lineNumbersCompartment = new Compartment();
export const wordWrapCompartment = new Compartment();
export const inlineMarkdownCompartment = new Compartment();

/**
 * Create base editor theme with custom styling
 */
function createEditorTheme(config: EditorConfig): Extension {
  return EditorView.theme({
    "&": {
      fontSize: `${config.fontSize}px`,
      fontFamily: config.fontFamily,
    },
    ".cm-content": {
      fontFamily: config.fontFamily,
      lineHeight: `${config.lineHeight}`,
    },
    ".cm-gutters": {
      backgroundColor: "transparent",
      borderRight: "1px solid #333",
    },
    ".cm-activeLineGutter": {
      backgroundColor: "rgba(255, 255, 255, 0.05)",
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
    // Markdown specific styling
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
  });
}

/**
 * Create extensions array based on config
 */
export function createExtensions(
  config: EditorConfig,
  onSave?: () => void,
  onChange?: (content: string) => void,
  getNotePath?: () => string | undefined
): Extension[] {
  const extensions: Extension[] = [
    // Core markdown support with code language highlighting
    markdown({
      base: markdownLanguage,
      codeLanguages: languages,
    }),

    // History (undo/redo)
    history(),

    // UI features
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
    indentOnInput(),

    // Code folding
    foldGutter(),

    // Search
    search({
      top: true,
    }),

    // Autocompletion
    autocompletion({
      activateOnTyping: false,
    }),

    // Custom theme
    createEditorTheme(config),

    // Line numbers (compartmentalized for dynamic toggle)
    lineNumbersCompartment.of(config.lineNumbers ? lineNumbers() : []),

    // Word wrap (compartmentalized for dynamic toggle)
    wordWrapCompartment.of(config.wordWrap ? EditorView.lineWrapping : []),

    // Theme (dark/light)
    themeCompartment.of(config.theme === "dark" ? oneDark : []),

    // Vim mode (compartmentalized for dynamic toggle)
    vimCompartment.of([]),

    // Inline markdown rendering (compartmentalized for dynamic toggle)
    inlineMarkdownCompartment.of(config.inlineMarkdown ? inlineMarkdownExtension : []),

    // Image paste/drop support
    ...(getNotePath ? [createImageDropExtension(getNotePath)] : []),

    // Keymaps
    keymap.of([
      // Save command
      {
        key: "Mod-s",
        run: () => {
          onSave?.();
          return true;
        },
      },
      ...closeBracketsKeymap,
      ...defaultKeymap,
      ...historyKeymap,
      ...searchKeymap,
      ...foldKeymap,
      ...completionKeymap,
      indentWithTab,
    ]),

    // Update listener for content changes
    EditorView.updateListener.of((update) => {
      if (update.docChanged && onChange) {
        onChange(update.state.doc.toString());
      }
    }),
  ];

  return extensions;
}

// Vim mode loading moved to vim-mode.ts
