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
