# Inline Image Preview Design

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Display images inline in the editor instead of showing raw markdown syntax `![](path)`.

**Architecture:** Extend existing `inline-markdown.ts` with an `ImageWidget` that renders `<img>` elements, converting relative paths to Tauri asset URLs.

**Tech Stack:** CodeMirror 6 WidgetType, Tauri convertFileSrc API

---

## Requirements

- **Preview size:** Max 400x300px
- **Edit behavior:** Show markdown syntax on active line, image on inactive lines
- **Path support:** Relative paths (./note.assets/...), absolute paths, external URLs
- **Error handling:** Placeholder for broken images
- **Performance:** Lazy loading

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  CodeMirror Editor                                          │
│                                                             │
│  syntaxTree.iterate() detects "Image" node                  │
│           ↓                                                 │
│  ![alt](./note.assets/img.png)                              │
│           ↓                                                 │
│  ┌─────────────────────────────────────────┐               │
│  │ ImageWidget (WidgetType)                │               │
│  │ - convertFileSrc() for Tauri URL        │               │
│  │ - <img> element, max-width: 400px       │               │
│  │ - loading="lazy"                        │               │
│  │ - error handling (broken image icon)    │               │
│  └─────────────────────────────────────────┘               │
│           ↓                                                 │
│  Active line: shows `![alt](url)` syntax                    │
│  Inactive line: shows image                                 │
└─────────────────────────────────────────────────────────────┘
```

## Components

### 1. ImageWidget class

```typescript
class ImageWidget extends WidgetType {
  constructor(
    readonly src: string,        // Original path from markdown
    readonly alt: string,        // Alt text
    readonly resolvedSrc: string // Tauri asset:// URL
  ) { super(); }

  toDOM() {
    const img = document.createElement("img");
    img.src = this.resolvedSrc;
    img.alt = this.alt;
    img.className = "cm-inline-image";
    img.loading = "lazy";
    img.onerror = () => { img.className += " cm-inline-image-error"; };
    return img;
  }
}
```

### 2. Extended buildDecorations()

- Add case for `Image` node in syntaxTree
- Parse `![alt](url)` syntax
- Convert relative paths using `convertFileSrc()`
- Create `Decoration.replace()` with ImageWidget
- Skip decoration on active line (show syntax instead)

### 3. CSS Styles

```css
.cm-inline-image {
  max-width: 400px;
  max-height: 300px;
  border-radius: 4px;
  vertical-align: middle;
  display: block;
  margin: 4px 0;
}

.cm-inline-image-error {
  width: 100px;
  height: 60px;
  background: rgba(255, 0, 0, 0.1);
  border: 1px dashed rgba(255, 0, 0, 0.3);
}

/* Hide image on active line - show syntax instead */
.cm-activeLine .cm-inline-image {
  display: none;
}
```

### 4. BasePath handling

- Plugin needs current note path to resolve relative paths
- Add `StateField` or factory function parameter for basePath
- Update Editor.tsx to provide basePath to inline-markdown extension

## Edge Cases

| Situation | Behavior |
|-----------|----------|
| Image not found | Show placeholder icon |
| Very large image | CSS max-width/height limits |
| Image on active line | Show `![](...)` syntax |
| External URL (https://) | Load directly |
| Data URL (base64) | Display directly |
| No basePath provided | Skip relative path resolution |

## Out of Scope (YAGNI)

- Image resize in editor
- Click for full-size preview
- Drag image to move in document
- Context menu on image
- Support in notebook code blocks (markdown only)

## Files to Modify

- `src/lib/editor/inline-markdown.ts` - Add ImageWidget and Image node handling
- `src/lib/editor/extensions.ts` - Pass basePath to inline-markdown
- `src/components/Editor.tsx` - Provide basePath from filePath prop
