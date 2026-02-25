/**
 * Inline Markdown Rendering for CodeMirror
 *
 * Renders markdown elements inline while editing:
 * - Headers with larger font sizes
 * - Bold/italic text with proper styling
 * - Links as styled elements
 * - Inline code with background
 * - Strikethrough text
 */

import {
  Decoration,
  DecorationSet,
  EditorView,
  ViewPlugin,
  ViewUpdate,
  WidgetType,
} from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";
import { Range, StateField, StateEffect } from "@codemirror/state";
import { convertFileSrc } from "@tauri-apps/api/core";

/**
 * Decoration marks for inline markdown elements
 */
const headingMark = (level: number) =>
  Decoration.mark({
    class: `cm-heading cm-heading-${level}`,
    attributes: { "data-heading-level": String(level) },
  });

const boldMark = Decoration.mark({ class: "cm-strong-text" });
const italicMark = Decoration.mark({ class: "cm-emphasis-text" });
const strikeMark = Decoration.mark({ class: "cm-strikethrough-text" });
const codeMark = Decoration.mark({ class: "cm-inline-code-text" });
const linkMark = Decoration.mark({ class: "cm-link-text" });
const linkUrlMark = Decoration.mark({ class: "cm-link-url" });

/**
 * Hide markdown syntax characters
 */
const hiddenMark = Decoration.mark({ class: "cm-hidden-syntax" });

/**
 * StateEffect and StateField for base path (used for resolving relative image paths)
 */
const setBasePath = StateEffect.define<string | undefined>();

const basePathField = StateField.define<string | undefined>({
  create() { return undefined; },
  update(value, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setBasePath)) return effect.value;
    }
    return value;
  },
});

/**
 * Resolve image source path (handles relative paths and local files)
 */
function resolveImageSrc(src: string, basePath: string | undefined): string {
  if (src.startsWith("http://") || src.startsWith("https://") || src.startsWith("data:")) {
    return src;
  }
  if (!basePath) return src;

  let absolutePath: string;
  if (src.startsWith("./")) {
    const dir = basePath.substring(0, basePath.lastIndexOf("/"));
    absolutePath = dir + "/" + src.substring(2);
  } else if (src.startsWith("../")) {
    const dir = basePath.substring(0, basePath.lastIndexOf("/"));
    const parentDir = dir.substring(0, dir.lastIndexOf("/"));
    absolutePath = parentDir + "/" + src.substring(3);
  } else {
    const dir = basePath.substring(0, basePath.lastIndexOf("/"));
    absolutePath = dir + "/" + src;
  }
  return convertFileSrc(absolutePath);
}

/**
 * Widget for rendering inline images
 */
class ImageWidget extends WidgetType {
  constructor(
    readonly src: string,
    readonly alt: string,
    readonly resolvedSrc: string
  ) { super(); }

  eq(other: ImageWidget): boolean {
    return other.src === this.src && other.alt === this.alt;
  }

  toDOM(): HTMLElement {
    const container = document.createElement("span");
    container.className = "cm-inline-image-container";
    const img = document.createElement("img");
    img.src = this.resolvedSrc;
    img.alt = this.alt;
    img.className = "cm-inline-image";
    img.loading = "lazy";
    img.onerror = () => { img.classList.add("cm-inline-image-error"); };
    container.appendChild(img);
    return container;
  }

  ignoreEvent(): boolean { return false; }
}

// Note: LinkWidget is reserved for future use when we implement clickable links
// class LinkWidget extends WidgetType { ... }

/**
 * Build decorations for inline markdown elements
 */
function buildDecorations(view: EditorView): DecorationSet {
  const decorations: Range<Decoration>[] = [];
  const doc = view.state.doc;

  for (const { from, to } of view.visibleRanges) {
    syntaxTree(view.state).iterate({
      from,
      to,
      enter: (node) => {
        const nodeFrom = node.from;
        const nodeTo = node.to;
        const text = doc.sliceString(nodeFrom, nodeTo);

        switch (node.name) {
          // ATX Headings
          case "ATXHeading1":
          case "SetextHeading1":
            decorations.push(headingMark(1).range(nodeFrom, nodeTo));
            break;
          case "ATXHeading2":
          case "SetextHeading2":
            decorations.push(headingMark(2).range(nodeFrom, nodeTo));
            break;
          case "ATXHeading3":
            decorations.push(headingMark(3).range(nodeFrom, nodeTo));
            break;
          case "ATXHeading4":
            decorations.push(headingMark(4).range(nodeFrom, nodeTo));
            break;
          case "ATXHeading5":
            decorations.push(headingMark(5).range(nodeFrom, nodeTo));
            break;
          case "ATXHeading6":
            decorations.push(headingMark(6).range(nodeFrom, nodeTo));
            break;

          // Header markers (# symbols) - hide them
          case "HeaderMark":
            decorations.push(hiddenMark.range(nodeFrom, nodeTo + 1)); // +1 for space
            break;

          // Strong (bold) **text** or __text__
          case "StrongEmphasis": {
            // Find the markers and content
            const strongMatch = text.match(/^(\*\*|__)(.+)(\*\*|__)$/s);
            if (strongMatch) {
              const markerLen = 2;
              // Hide opening marker
              decorations.push(hiddenMark.range(nodeFrom, nodeFrom + markerLen));
              // Style the content
              decorations.push(boldMark.range(nodeFrom + markerLen, nodeTo - markerLen));
              // Hide closing marker
              decorations.push(hiddenMark.range(nodeTo - markerLen, nodeTo));
            }
            break;
          }

          // Emphasis (italic) *text* or _text_
          case "Emphasis": {
            const emMatch = text.match(/^(\*|_)(.+)(\*|_)$/s);
            if (emMatch) {
              const markerLen = 1;
              decorations.push(hiddenMark.range(nodeFrom, nodeFrom + markerLen));
              decorations.push(italicMark.range(nodeFrom + markerLen, nodeTo - markerLen));
              decorations.push(hiddenMark.range(nodeTo - markerLen, nodeTo));
            }
            break;
          }

          // Strikethrough ~~text~~
          case "Strikethrough": {
            const strikeMatch = text.match(/^~~(.+)~~$/s);
            if (strikeMatch) {
              const markerLen = 2;
              decorations.push(hiddenMark.range(nodeFrom, nodeFrom + markerLen));
              decorations.push(strikeMark.range(nodeFrom + markerLen, nodeTo - markerLen));
              decorations.push(hiddenMark.range(nodeTo - markerLen, nodeTo));
            }
            break;
          }

          // Inline code `code`
          case "InlineCode": {
            const codeMatch = text.match(/^`(.+)`$/s);
            if (codeMatch) {
              decorations.push(hiddenMark.range(nodeFrom, nodeFrom + 1));
              decorations.push(codeMark.range(nodeFrom + 1, nodeTo - 1));
              decorations.push(hiddenMark.range(nodeTo - 1, nodeTo));
            }
            break;
          }

          // Links [text](url)
          case "Link": {
            const linkMatch = text.match(/^\[([^\]]*)\]\(([^)]*)\)$/);
            if (linkMatch) {
              const linkText = linkMatch[1];
              // linkUrl = linkMatch[2] - reserved for future clickable links
              const textStart = nodeFrom + 1; // after [
              const textEnd = textStart + linkText.length;

              // Hide opening [
              decorations.push(hiddenMark.range(nodeFrom, nodeFrom + 1));
              // Style link text
              decorations.push(linkMark.range(textStart, textEnd));
              // Hide ](url)
              decorations.push(hiddenMark.range(textEnd, nodeTo));
            }
            break;
          }

          // Auto links <url>
          case "Autolink": {
            decorations.push(linkMark.range(nodeFrom + 1, nodeTo - 1));
            decorations.push(hiddenMark.range(nodeFrom, nodeFrom + 1));
            decorations.push(hiddenMark.range(nodeTo - 1, nodeTo));
            break;
          }

          // URL in links - dim them
          case "URL":
            decorations.push(linkUrlMark.range(nodeFrom, nodeTo));
            break;

          // Images ![alt](url)
          case "Image": {
            const basePath = view.state.field(basePathField, false);
            const activeLine = view.state.doc.lineAt(view.state.selection.main.head);

            // Skip widget on active line to allow editing
            if (activeLine.from <= nodeFrom && activeLine.to >= nodeTo) {
              break;
            }

            const imageMatch = text.match(/^!\[([^\]]*)\]\(([^)]*)\)$/);
            if (imageMatch) {
              const alt = imageMatch[1];
              const src = imageMatch[2];
              const resolvedSrc = resolveImageSrc(src, basePath);

              decorations.push(
                Decoration.replace({
                  widget: new ImageWidget(src, alt, resolvedSrc),
                }).range(nodeFrom, nodeTo)
              );
            }
            break;
          }
        }
      },
    });
  }

  // Sort decorations by position
  decorations.sort((a, b) => a.from - b.from || a.to - b.to);

  return Decoration.set(decorations, true);
}

/**
 * ViewPlugin for inline markdown rendering
 */
const inlineMarkdownPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildDecorations(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged || update.selectionSet) {
        this.decorations = buildDecorations(update.view);
      }
    }
  },
  {
    decorations: (v) => v.decorations,
  }
);

/**
 * Theme styles for inline markdown rendering
 */
const inlineMarkdownTheme = EditorView.theme({
  // Hidden syntax (markdown markers)
  ".cm-hidden-syntax": {
    fontSize: "0",
    width: "0",
    display: "inline-block",
    overflow: "hidden",
    opacity: "0",
    position: "absolute",
  },

  // Show hidden syntax on line focus
  ".cm-activeLine .cm-hidden-syntax": {
    fontSize: "inherit",
    width: "auto",
    display: "inline",
    overflow: "visible",
    opacity: "0.4",
    position: "relative",
  },

  // Headings
  ".cm-heading": {
    fontWeight: "bold",
  },
  ".cm-heading-1": {
    fontSize: "1.75em",
    lineHeight: "1.3",
  },
  ".cm-heading-2": {
    fontSize: "1.5em",
    lineHeight: "1.35",
  },
  ".cm-heading-3": {
    fontSize: "1.25em",
    lineHeight: "1.4",
  },
  ".cm-heading-4": {
    fontSize: "1.1em",
    lineHeight: "1.45",
  },
  ".cm-heading-5": {
    fontSize: "1.05em",
    lineHeight: "1.5",
  },
  ".cm-heading-6": {
    fontSize: "1em",
    lineHeight: "1.5",
  },

  // Bold
  ".cm-strong-text": {
    fontWeight: "bold",
  },

  // Italic
  ".cm-emphasis-text": {
    fontStyle: "italic",
  },

  // Strikethrough
  ".cm-strikethrough-text": {
    textDecoration: "line-through",
    opacity: "0.7",
  },

  // Inline code
  ".cm-inline-code-text": {
    fontFamily: "JetBrains Mono, Menlo, Monaco, monospace",
    fontSize: "0.9em",
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: "3px",
    padding: "0.1em 0.3em",
  },

  // Links
  ".cm-link-text": {
    color: "#528bff",
    textDecoration: "underline",
    cursor: "pointer",
  },
  ".cm-link-text:hover": {
    textDecoration: "underline",
  },

  // URL (dimmed)
  ".cm-link-url": {
    opacity: "0.5",
    fontSize: "0.9em",
  },

  // Link widget
  ".cm-link-widget": {
    color: "#528bff",
    textDecoration: "underline",
    cursor: "pointer",
  },

  // Inline images
  ".cm-inline-image-container": {
    display: "block",
    margin: "8px 0",
  },
  ".cm-inline-image": {
    maxWidth: "400px",
    maxHeight: "300px",
    borderRadius: "4px",
    display: "block",
  },
  ".cm-inline-image-error": {
    width: "100px",
    height: "60px",
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    border: "1px dashed rgba(239, 68, 68, 0.4)",
    borderRadius: "4px",
  },
});

/**
 * Extension array for inline markdown rendering
 */
export const inlineMarkdownExtension = [basePathField, inlineMarkdownPlugin, inlineMarkdownTheme];

/**
 * Update the base path for resolving relative image paths
 */
export function updateInlineMarkdownBasePath(view: EditorView, basePath: string | undefined): void {
  view.dispatch({ effects: setBasePath.of(basePath) });
}

/**
 * Check if inline markdown is enabled (from localStorage)
 */
export function isInlineMarkdownEnabled(): boolean {
  try {
    return localStorage.getItem("notemaker:inline-markdown") === "true";
  } catch {
    return false;
  }
}

/**
 * Save inline markdown preference
 */
export function setInlineMarkdownEnabled(enabled: boolean): void {
  try {
    localStorage.setItem("notemaker:inline-markdown", String(enabled));
  } catch {
    // Ignore storage errors
  }
}
