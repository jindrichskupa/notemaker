# Inline Image Preview Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Display images inline in the editor instead of showing raw markdown `![](path)` syntax.

**Architecture:** Extend `inline-markdown.ts` with an `ImageWidget` class that renders `<img>` elements. Use `convertFileSrc()` from Tauri to convert relative paths. Hide widget on active line to allow editing.

**Tech Stack:** CodeMirror 6 WidgetType, Tauri convertFileSrc API, StateField for basePath

---

## Task 1: Add ImageWidget class

**Files:**
- Modify: `src/lib/editor/inline-markdown.ts`

**Step 1: Add imports**

At the top of the file, add `WidgetType` to the imports:

```typescript
import {
  Decoration,
  DecorationSet,
  EditorView,
  ViewPlugin,
  ViewUpdate,
  WidgetType,  // Add this
} from "@codemirror/view";
```

Also add convertFileSrc import:

```typescript
import { convertFileSrc } from "@tauri-apps/api/core";
```

**Step 2: Add ImageWidget class**

After the `hiddenMark` declaration (around line 41), add:

```typescript
/**
 * Widget for rendering inline images
 */
class ImageWidget extends WidgetType {
  constructor(
    readonly src: string,
    readonly alt: string,
    readonly resolvedSrc: string
  ) {
    super();
  }

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
    img.onerror = () => {
      img.classList.add("cm-inline-image-error");
    };

    container.appendChild(img);
    return container;
  }

  ignoreEvent(): boolean {
    return false;
  }
}
```

**Step 3: Commit**

```bash
git add src/lib/editor/inline-markdown.ts
git commit -m "feat(editor): add ImageWidget class for inline image preview"
```

---

## Task 2: Add basePath StateField

**Files:**
- Modify: `src/lib/editor/inline-markdown.ts`

**Step 1: Add StateField import**

Update the imports from `@codemirror/state`:

```typescript
import { Range, StateField, StateEffect } from "@codemirror/state";
```

**Step 2: Add StateField for basePath**

After the imports, add:

```typescript
/**
 * StateEffect to update the base path for resolving relative image URLs
 */
const setBasePath = StateEffect.define<string | undefined>();

/**
 * StateField to store the current note's base path
 */
const basePathField = StateField.define<string | undefined>({
  create() {
    return undefined;
  },
  update(value, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setBasePath)) {
        return effect.value;
      }
    }
    return value;
  },
});
```

**Step 3: Export helper function**

At the end of the file, add:

```typescript
/**
 * Update the base path for inline image resolution
 */
export function updateInlineMarkdownBasePath(
  view: EditorView,
  basePath: string | undefined
): void {
  view.dispatch({
    effects: setBasePath.of(basePath),
  });
}
```

**Step 4: Commit**

```bash
git add src/lib/editor/inline-markdown.ts
git commit -m "feat(editor): add StateField for basePath in inline-markdown"
```

---

## Task 3: Add Image node handling in buildDecorations

**Files:**
- Modify: `src/lib/editor/inline-markdown.ts`

**Step 1: Update buildDecorations signature**

Change the function signature to accept basePath:

```typescript
function buildDecorations(view: EditorView): DecorationSet {
  const decorations: Range<Decoration>[] = [];
  const doc = view.state.doc;
  const basePath = view.state.field(basePathField, false);

  // Get active line range to skip image widgets on it
  const activeLine = view.state.doc.lineAt(view.state.selection.main.head);
```

**Step 2: Add helper function for path resolution**

Before `buildDecorations`, add:

```typescript
/**
 * Resolve image src to a displayable URL
 */
function resolveImageSrc(src: string, basePath: string | undefined): string {
  // External URLs - use directly
  if (src.startsWith("http://") || src.startsWith("https://") || src.startsWith("data:")) {
    return src;
  }

  // Relative paths need basePath
  if (!basePath) {
    return src;
  }

  // Resolve relative path
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

  // Convert to Tauri asset URL
  return convertFileSrc(absolutePath);
}
```

**Step 3: Add Image case in switch statement**

Inside the `enter` callback, add this case after the `Autolink` case (around line 165):

```typescript
          // Images ![alt](url)
          case "Image": {
            // Skip on active line - show syntax for editing
            if (nodeFrom >= activeLine.from && nodeTo <= activeLine.to) {
              break;
            }

            const imageMatch = text.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
            if (imageMatch) {
              const alt = imageMatch[1];
              const src = imageMatch[2];
              const resolvedSrc = resolveImageSrc(src, basePath);

              const widget = Decoration.replace({
                widget: new ImageWidget(src, alt, resolvedSrc),
              });
              decorations.push(widget.range(nodeFrom, nodeTo));
            }
            break;
          }
```

**Step 4: Commit**

```bash
git add src/lib/editor/inline-markdown.ts
git commit -m "feat(editor): add Image node handling for inline preview"
```

---

## Task 4: Add CSS styles for inline images

**Files:**
- Modify: `src/lib/editor/inline-markdown.ts`

**Step 1: Add image styles to theme**

In `inlineMarkdownTheme`, add these styles:

```typescript
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
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  ".cm-inline-image-error::before": {
    content: "'⚠'",
    fontSize: "24px",
    opacity: "0.5",
  },
```

**Step 2: Commit**

```bash
git add src/lib/editor/inline-markdown.ts
git commit -m "feat(editor): add CSS styles for inline images"
```

---

## Task 5: Update extension export to include StateField

**Files:**
- Modify: `src/lib/editor/inline-markdown.ts`

**Step 1: Update extension array**

Change the export at the bottom:

```typescript
/**
 * Extension array for inline markdown rendering
 */
export const inlineMarkdownExtension = [
  basePathField,
  inlineMarkdownPlugin,
  inlineMarkdownTheme,
];
```

**Step 2: Commit**

```bash
git add src/lib/editor/inline-markdown.ts
git commit -m "feat(editor): include basePathField in extension export"
```

---

## Task 6: Update Editor.tsx to set basePath

**Files:**
- Modify: `src/components/Editor.tsx`

**Step 1: Import updateInlineMarkdownBasePath**

Add to imports:

```typescript
import { updateInlineMarkdownBasePath } from "../lib/editor/inline-markdown";
```

**Step 2: Add effect to update basePath when filePath changes**

After the existing effects (around line 130), add:

```typescript
  // Update inline markdown base path when file path changes
  createEffect(() => {
    const path = props.absoluteFilePath;
    if (editorView) {
      updateInlineMarkdownBasePath(editorView, path);
    }
  });
```

**Step 3: Commit**

```bash
git add src/components/Editor.tsx
git commit -m "feat(editor): update basePath for inline image resolution"
```

---

## Task 7: Test and release

**Step 1: Run dev server**

```bash
pnpm tauri dev
```

**Step 2: Test checklist**

- [ ] Open a note with existing image `![](./note.assets/img.png)`
- [ ] Image displays inline when cursor is NOT on that line
- [ ] Click on line with image - syntax appears, image hides
- [ ] Move cursor away - image reappears
- [ ] Test external URL image `![](https://example.com/img.png)`
- [ ] Test broken image path - shows error placeholder
- [ ] Test in notebook markdown block

**Step 3: Bump version and release**

```bash
# Update version to 0.4.1 in:
# - package.json
# - src-tauri/Cargo.toml
# - src-tauri/tauri.conf.json

git add -A
git commit -m "chore: Release 0.4.1 - Inline image preview"
git tag v0.4.1
git push && git push --tags
pnpm tauri build
```
