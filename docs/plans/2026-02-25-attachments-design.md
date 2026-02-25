# Attachments (Image Embed) Design

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable pasting and drag & drop of images into notes with automatic storage in `.assets` folders.

**Architecture:** CodeMirror extension captures paste/drop events, sends image data to Rust backend via Tauri command, which saves to `.assets` folder and returns relative path for markdown insertion.

**Tech Stack:** CodeMirror 6 extensions, Tauri commands, Rust fs operations

---

## Requirements

- **File types:** Images only (PNG, JPG, GIF, WebP, SVG)
- **Input methods:** Paste (Cmd+V) + Drag & Drop
- **Storage:** `.assets` folder adjacent to note (e.g., `note.md` → `note.assets/`)
- **Size limit:** 10MB per image

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  CodeMirror Editor                                      │
│  ┌─────────────────────────────────────────────────┐   │
│  │  imageDropExtension (paste/drop handler)         │   │
│  │  - onPaste: capture clipboard image              │   │
│  │  - onDrop: capture dropped files                 │   │
│  └──────────────────┬──────────────────────────────┘   │
└─────────────────────┼───────────────────────────────────┘
                      │ binary data (base64)
                      ▼
┌─────────────────────────────────────────────────────────┐
│  Tauri Command: save_attachment                         │
│  - Input: note_path, filename, data (base64)           │
│  - Creates .assets folder if needed                    │
│  - Generates unique name (timestamp + hash)            │
│  - Saves file, returns relative path                   │
└──────────────────────┬──────────────────────────────────┘
                       │ "./note.assets/img-1234abc.png"
                       ▼
┌─────────────────────────────────────────────────────────┐
│  CodeMirror                                             │
│  - Inserts: ![](./note.assets/img-1234abc.png)         │
└─────────────────────────────────────────────────────────┘
```

## File Structure

```
vault/
├── my-note.md
├── my-note.assets/
│   ├── img-1708123456-a1b2.png
│   └── img-1708123789-c3d4.jpg
├── folder/
│   ├── another.md
│   └── another.assets/
│       └── screenshot.png
```

## Components

### Frontend (TypeScript/SolidJS)

**1. `src/lib/editor/imageDropExtension.ts`** (new file)
- CodeMirror `EditorView.domEventHandlers` extension
- Handlers for `paste` and `drop` events
- MIME type validation (image/png, image/jpeg, image/gif, image/webp, image/svg+xml)
- File/Blob → base64 conversion for Rust transfer
- Markdown syntax insertion at cursor position

**2. `src/lib/editor/extensions.ts`** (modify)
- Import and add `imageDropExtension` to editor extensions

**3. `src/lib/fs.ts`** (modify)
- New function `saveAttachment(notePath, filename, data): Promise<string>`

### Backend (Rust)

**4. `src-tauri/src/fs/commands.rs`** (modify)
- New command `save_attachment(note_path, filename, data) -> Result<String>`
- Create `.assets` folder
- Generate unique filename: `{timestamp}-{4-char-hash}.{ext}`
- Write file, return relative path

**5. `src-tauri/src/lib.rs`** (modify)
- Register new command

## Data Flow

### Paste from clipboard
1. User presses Cmd+V in editor
2. `paste` event → `clipboardData.items` → find `type.startsWith("image/")`
3. `item.getAsFile()` → `FileReader.readAsArrayBuffer()` → base64
4. Call `saveAttachment(currentNotePath, originalFilename, base64Data)`
5. Rust returns `"./note.assets/img-1708123456-a1b2.png"`
6. CodeMirror inserts `![](./note.assets/img-1708123456-a1b2.png)` at cursor

### Drag & Drop
1. User drags file into editor
2. `drop` event → `dataTransfer.files` → filter images
3. Same flow as paste (base64 → Rust → markdown)

## Error Handling

| Error | Solution |
|-------|----------|
| Not an image (wrong MIME) | Ignore, allow default behavior |
| File too large (>10MB) | Toast: "Image too large (max 10MB)" |
| Write failed (permissions) | Toast: "Failed to save image" |
| Note not saved yet | Toast: "Save note first to add images" |

## Out of Scope (YAGNI)

- Gallery/attachment management UI
- Cleanup of unused images
- Image compression/resize
- PDF and other documents
- Image preview before insertion

## Testing

**Unit tests (Vitest):**
- `imageDropExtension` - mock paste/drop events
- MIME type validation
- Markdown syntax generation

**Rust tests:**
- `save_attachment` - folder creation, file write, unique names

**Manual tests:**
- Paste screenshot from Cmd+Shift+4
- Drag & drop PNG/JPG from Finder
- Paste image copied from web
- Insert into notebook markdown block

## Existing Infrastructure

The backend already handles `.assets` folders for delete and rename operations:
- `delete_note()` - removes associated `.assets` folder
- `rename_note()` - renames associated `.assets` folder

This design leverages that existing pattern.
