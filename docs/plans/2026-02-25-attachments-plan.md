# Attachments (Image Embed) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable pasting and drag & drop of images into the editor with automatic storage in `.assets` folders.

**Architecture:** CodeMirror extension captures paste/drop events, converts images to base64, sends to Rust backend which saves to `.assets` folder and returns relative path for markdown insertion.

**Tech Stack:** CodeMirror 6 `domEventHandlers`, Tauri invoke, Rust `std::fs`, base64 crate

---

## Task 1: Rust Backend - save_attachment command

**Files:**
- Modify: `src-tauri/src/fs/commands.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/Cargo.toml` (if base64 not present)

**Step 1: Add save_attachment command to commands.rs**

Add at the end of the file (before the closing `}`):

```rust
/// Save an attachment (image) to the .assets folder of a note
#[tauri::command]
pub async fn save_attachment(
    note_path: String,
    filename: String,
    data: String, // base64 encoded
) -> Result<String, FsError> {
    use std::time::{SystemTime, UNIX_EPOCH};

    let note_path = PathBuf::from(&note_path);

    // Validate note exists
    if !note_path.exists() {
        return Err(FsError::NotFound(note_path.display().to_string()));
    }

    // Create .assets folder path (note.md -> note.assets/)
    let assets_dir = if note_path.is_dir() {
        // Notebook: my-notebook.md/ -> my-notebook.assets/
        let parent = note_path.parent().unwrap_or(&note_path);
        let name = note_path.file_name().unwrap().to_string_lossy();
        let name_without_ext = name.trim_end_matches(".md");
        parent.join(format!("{}.assets", name_without_ext))
    } else {
        // Regular note: my-note.md -> my-note.assets/
        let name = note_path.file_stem().unwrap().to_string_lossy();
        let parent = note_path.parent().unwrap();
        parent.join(format!("{}.assets", name))
    };

    // Create .assets directory if it doesn't exist
    if !assets_dir.exists() {
        fs::create_dir_all(&assets_dir)?;
    }

    // Generate unique filename: timestamp-hash.ext
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_millis();

    // Extract extension from original filename
    let ext = PathBuf::from(&filename)
        .extension()
        .map(|e| e.to_string_lossy().to_string())
        .unwrap_or_else(|| "png".to_string());

    // Create short hash from first 8 chars of base64 data
    let hash: String = data.chars().filter(|c| c.is_alphanumeric()).take(4).collect();

    let new_filename = format!("img-{}-{}.{}", timestamp, hash, ext);
    let file_path = assets_dir.join(&new_filename);

    // Decode base64 and write file
    let decoded = base64::Engine::decode(
        &base64::engine::general_purpose::STANDARD,
        &data
    ).map_err(|e| FsError::Io(std::io::Error::new(
        std::io::ErrorKind::InvalidData,
        format!("Invalid base64: {}", e)
    )))?;

    fs::write(&file_path, decoded)?;

    // Return relative path for markdown
    let assets_folder_name = assets_dir.file_name().unwrap().to_string_lossy();
    let relative_path = format!("./{}/{}", assets_folder_name, new_filename);

    Ok(relative_path)
}
```

**Step 2: Add base64 to Cargo.toml dependencies**

Check if `base64` is in dependencies, if not add:

```toml
base64 = "0.22"
```

**Step 3: Register command in lib.rs**

Add `fs::save_attachment` to the invoke_handler list (after `fs::move_note`):

```rust
fs::save_attachment,
```

**Step 4: Build to verify compilation**

Run: `cd src-tauri && cargo build`
Expected: Successful compilation

**Step 5: Commit**

```bash
git add src-tauri/src/fs/commands.rs src-tauri/src/lib.rs src-tauri/Cargo.toml
git commit -m "feat(backend): add save_attachment command for image uploads"
```

---

## Task 2: Frontend - saveAttachment API function

**Files:**
- Modify: `src/lib/fs.ts`

**Step 1: Add saveAttachment function**

Add after the `moveNote` function:

```typescript
// Attachment operations

export async function saveAttachment(
  notePath: string,
  filename: string,
  data: string // base64 encoded
): Promise<string> {
  return invoke<string>("save_attachment", { notePath, filename, data });
}
```

**Step 2: Commit**

```bash
git add src/lib/fs.ts
git commit -m "feat(api): add saveAttachment function"
```

---

## Task 3: CodeMirror imageDropExtension

**Files:**
- Create: `src/lib/editor/imageDropExtension.ts`

**Step 1: Create the extension file**

```typescript
/**
 * CodeMirror extension for handling image paste and drag-drop
 */

import { EditorView } from "@codemirror/view";
import { saveAttachment } from "../fs";

const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB

const ALLOWED_TYPES = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/svg+xml",
];

/**
 * Convert File/Blob to base64 string
 */
async function fileToBase64(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove data:image/xxx;base64, prefix
      const base64 = result.split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Get file extension from MIME type
 */
function getExtension(mimeType: string): string {
  const map: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/gif": "gif",
    "image/webp": "webp",
    "image/svg+xml": "svg",
  };
  return map[mimeType] || "png";
}

/**
 * Insert markdown image syntax at cursor position
 */
function insertImageMarkdown(view: EditorView, relativePath: string): void {
  const cursor = view.state.selection.main.head;
  const markdown = `![](${relativePath})`;

  view.dispatch({
    changes: { from: cursor, insert: markdown },
    selection: { anchor: cursor + markdown.length },
  });
}

/**
 * Show toast notification (uses existing toast system if available)
 */
function showToast(message: string, type: "error" | "success" = "error"): void {
  // For now, just console.error - can integrate with toast system later
  if (type === "error") {
    console.error("[ImageDrop]", message);
  }
}

/**
 * Handle image file upload
 */
async function handleImageFile(
  view: EditorView,
  file: File | Blob,
  notePath: string | undefined,
  filename?: string
): Promise<boolean> {
  // Validate note path
  if (!notePath) {
    showToast("Save note first to add images");
    return false;
  }

  // Validate file type
  if (!ALLOWED_TYPES.includes(file.type)) {
    return false; // Not an image, let default behavior handle it
  }

  // Validate file size
  if (file.size > MAX_IMAGE_SIZE) {
    showToast("Image too large (max 10MB)");
    return false;
  }

  try {
    // Convert to base64
    const base64 = await fileToBase64(file);

    // Generate filename if not provided
    const ext = getExtension(file.type);
    const finalFilename = filename || `image.${ext}`;

    // Save attachment via backend
    const relativePath = await saveAttachment(notePath, finalFilename, base64);

    // Insert markdown
    insertImageMarkdown(view, relativePath);

    return true;
  } catch (err) {
    console.error("Failed to save image:", err);
    showToast("Failed to save image");
    return false;
  }
}

/**
 * Create image drop extension with note path provider
 */
export function createImageDropExtension(
  getNotePathFn: () => string | undefined
) {
  return EditorView.domEventHandlers({
    paste(event: ClipboardEvent, view: EditorView) {
      const items = event.clipboardData?.items;
      if (!items) return false;

      for (const item of items) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) {
            event.preventDefault();
            handleImageFile(view, file, getNotePathFn());
            return true;
          }
        }
      }

      return false; // Let other paste handlers run
    },

    drop(event: DragEvent, view: EditorView) {
      const files = event.dataTransfer?.files;
      if (!files || files.length === 0) return false;

      const imageFiles = Array.from(files).filter((f) =>
        ALLOWED_TYPES.includes(f.type)
      );

      if (imageFiles.length === 0) return false;

      event.preventDefault();

      // Process each image file
      for (const file of imageFiles) {
        handleImageFile(view, file, getNotePathFn(), file.name);
      }

      return true;
    },
  });
}
```

**Step 2: Commit**

```bash
git add src/lib/editor/imageDropExtension.ts
git commit -m "feat(editor): add imageDropExtension for paste/drop images"
```

---

## Task 4: Integrate extension into Editor component

**Files:**
- Modify: `src/lib/editor/extensions.ts`
- Modify: `src/lib/editor/index.ts` (export)
- Modify: `src/components/Editor.tsx`

**Step 1: Update extensions.ts to accept notePath**

Modify `createExtensions` signature and add import:

```typescript
// Add import at top
import { createImageDropExtension } from "./imageDropExtension";

// Modify function signature
export function createExtensions(
  config: EditorConfig,
  onSave?: () => void,
  onChange?: (content: string) => void,
  getNotePath?: () => string | undefined  // Add this parameter
): Extension[] {
```

Add the extension before the keymaps (around line 180):

```typescript
    // Image paste/drop support
    ...(getNotePath ? [createImageDropExtension(getNotePath)] : []),

    // Keymaps
    keymap.of([
```

**Step 2: Update index.ts export**

Add to exports:

```typescript
export { createImageDropExtension } from "./imageDropExtension";
```

**Step 3: Update Editor.tsx**

Modify the `onMount` to pass `getNotePath`:

```typescript
  // Add getter for file path
  const getNotePath = () => props.filePath;

  // Initialize editor
  onMount(() => {
    if (!containerRef) return;

    const extensions = createExtensions(config(), handleSave, handleChange, getNotePath);
    // ... rest unchanged
```

**Step 4: Run dev server to test**

Run: `pnpm tauri dev`
Test: Open a note, paste a screenshot (Cmd+Shift+4, then Cmd+V)
Expected: Image saved to `.assets` folder, markdown inserted

**Step 5: Commit**

```bash
git add src/lib/editor/extensions.ts src/lib/editor/index.ts src/components/Editor.tsx
git commit -m "feat(editor): integrate imageDropExtension into Editor"
```

---

## Task 5: Support notebooks (markdown blocks)

**Files:**
- Modify: `src/components/MarkdownBlockEditor.tsx`

**Step 1: Check MarkdownBlockEditor uses same pattern**

Look at how MarkdownBlockEditor creates its editor. It needs to receive notebook path and pass it to the extension.

**Step 2: Add notePath prop if needed**

If MarkdownBlockEditor doesn't have access to notebook path, add it:

```typescript
export interface MarkdownBlockEditorProps {
  // ... existing props
  notebookPath?: string;  // Add this
}
```

Pass to the extension:

```typescript
const getNotePath = () => props.notebookPath;
```

**Step 3: Update NotebookBlock to pass notebookPath**

In `NotebookBlock.tsx`, pass the notebook path to `MarkdownBlockEditor`.

**Step 4: Test with notebook**

Run: `pnpm tauri dev`
Test: Open a notebook, paste image in markdown block
Expected: Image saved to notebook's `.assets` folder

**Step 5: Commit**

```bash
git add src/components/MarkdownBlockEditor.tsx src/components/NotebookBlock.tsx
git commit -m "feat(notebook): support image paste in markdown blocks"
```

---

## Task 6: Update PLAN.md

**Files:**
- Modify: `PLAN.md`

**Step 1: Mark I-017 as completed**

Change the line:

```markdown
| I-017 | **Attachment support** | Střední | Embed obrázků, souborů a dokumentů do poznámek. Drag & drop, clipboard paste, správa příloh. |
```

To:

```markdown
| I-017 | **Attachment support** | ✅ Hotovo | Paste (Cmd+V) a drag & drop obrázků do editoru. Ukládání do `.assets` složky. Podporované formáty: PNG, JPG, GIF, WebP, SVG (max 10MB). |
```

**Step 2: Commit**

```bash
git add PLAN.md
git commit -m "docs: mark I-017 Attachments as complete"
```

---

## Task 7: Final testing & release

**Step 1: Full test checklist**

- [ ] Paste screenshot from Cmd+Shift+4 into regular note
- [ ] Paste image copied from web browser
- [ ] Drag PNG from Finder into note
- [ ] Drag JPG from Finder into note
- [ ] Paste into notebook markdown block
- [ ] Verify `.assets` folder created with correct name
- [ ] Verify image displays in preview mode
- [ ] Verify delete note removes `.assets` folder
- [ ] Verify rename note renames `.assets` folder
- [ ] Test with file > 10MB (should show error)
- [ ] Test paste non-image (should be ignored)

**Step 2: Bump version and release**

```bash
# Update version in all files
# package.json, src-tauri/Cargo.toml, src-tauri/tauri.conf.json

git add -A
git commit -m "chore: Release 0.4.0 - Image attachments"
git tag v0.4.0
git push && git push --tags
pnpm tauri build
```
