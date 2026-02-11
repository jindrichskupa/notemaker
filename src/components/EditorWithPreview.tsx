/**
 * Editor with mode toggle and preview support
 */

import { createSignal, createMemo, Show, Switch, Match, onMount, createEffect } from "solid-js";
import { Editor, EditorProps } from "./Editor";
import { Preview } from "./Preview";
import { SplitView } from "./SplitView";
import { EditorModeToggle, EditorMode } from "./EditorModeToggle";
import { FrontmatterEditor } from "./FrontmatterEditor";
import { parseNote, serializeNote } from "../lib/frontmatter/parser";
import { Frontmatter } from "../lib/frontmatter/types";
import { encryptionStore } from "../lib/store/encryption";
import { isContentEncrypted, encryptBlock, decryptBlock } from "../lib/fs";

const STORAGE_KEY = "notemaker:editor-mode";
const FRONTMATTER_KEY = "notemaker:show-frontmatter";

export interface EditorWithPreviewProps extends EditorProps {
  initialMode?: EditorMode;
}

export function EditorWithPreview(props: EditorWithPreviewProps) {
  const [mode, setMode] = createSignal<EditorMode>(
    loadSavedMode() || props.initialMode || "split"
  );
  const [showFrontmatter, setShowFrontmatter] = createSignal(loadFrontmatterPref());

  // Encryption state
  const [isEncrypted, setIsEncrypted] = createSignal(false);
  const [decryptedContent, setDecryptedContent] = createSignal<string | null>(null);
  const [isEncrypting, setIsEncrypting] = createSignal(false);
  const [encryptionError, setEncryptionError] = createSignal<string | null>(null);

  // Check if content is encrypted
  createEffect(async () => {
    const content = props.content;
    if (content) {
      const encrypted = await isContentEncrypted(content);
      setIsEncrypted(encrypted);
      if (!encrypted) {
        setDecryptedContent(null);
      }
    }
  });

  // Display content (decrypted if available, otherwise raw)
  const displayContent = () => decryptedContent() ?? props.content;

  // Handle encrypt
  const handleEncrypt = async () => {
    setEncryptionError(null);

    // Try auto-unlock if not unlocked
    if (!encryptionStore.isUnlocked()) {
      const result = await encryptionStore.tryAutoUnlock();
      if (!result.success) {
        setEncryptionError(result.error || "Failed to unlock encryption");
        return;
      }
    }

    const content = props.content;
    if (!content || isEncrypted()) return;

    setIsEncrypting(true);
    try {
      const encrypted = await encryptBlock(content);
      props.onChange?.(encrypted);
      setIsEncrypted(true);
      setDecryptedContent(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setEncryptionError(`Failed to encrypt: ${msg}`);
      console.error("Failed to encrypt note:", e);
    } finally {
      setIsEncrypting(false);
    }
  };

  // Handle decrypt (show plaintext)
  const handleDecrypt = async () => {
    setEncryptionError(null);

    // Try auto-unlock if not unlocked
    if (!encryptionStore.isUnlocked()) {
      const result = await encryptionStore.tryAutoUnlock();
      if (!result.success) {
        setEncryptionError(result.error || "Failed to unlock encryption");
        return;
      }
    }

    const content = props.content;
    if (!content || !isEncrypted()) return;

    try {
      const decrypted = await decryptBlock(content);
      setDecryptedContent(decrypted);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setEncryptionError(`Failed to decrypt: ${msg}`);
      console.error("Failed to decrypt note:", e);
    }
  };

  // Handle re-encrypt (hide plaintext, save encrypted)
  const handleReEncrypt = async () => {
    const decrypted = decryptedContent();
    if (!decrypted || !encryptionStore.isUnlocked()) return;

    setIsEncrypting(true);
    try {
      const encrypted = await encryptBlock(decrypted);
      props.onChange?.(encrypted);
      setDecryptedContent(null);
    } catch (e) {
      console.error("Failed to re-encrypt note:", e);
    } finally {
      setIsEncrypting(false);
    }
  };

  // Handle save decrypted (remove encryption)
  const handleSaveDecrypted = async () => {
    const decrypted = decryptedContent();
    if (!decrypted) return;

    props.onChange?.(decrypted);
    setIsEncrypted(false);
    setDecryptedContent(null);
  };

  // Handle content change when editing decrypted content
  const handleContentChange = (newContent: string) => {
    if (isEncrypted() && decryptedContent() !== null) {
      setDecryptedContent(newContent);
    } else {
      props.onChange?.(newContent);
    }
  };

  // Parse frontmatter from content
  const parsedNote = createMemo(() => parseNote(displayContent()));
  const frontmatter = () => parsedNote().frontmatter;
  const bodyContent = () => parsedNote().body;

  // Handle frontmatter changes
  const handleFrontmatterChange = (newFrontmatter: Frontmatter) => {
    const newContent = serializeNote(newFrontmatter, bodyContent());
    handleContentChange(newContent);
  };

  // Toggle frontmatter panel
  const toggleFrontmatter = () => {
    const newValue = !showFrontmatter();
    setShowFrontmatter(newValue);
    saveFrontmatterPref(newValue);
  };

  // Save mode preference
  const handleModeChange = (newMode: EditorMode) => {
    setMode(newMode);
    saveMode(newMode);
  };

  // Cycle through modes
  const cycleMode = () => {
    const modes: EditorMode[] = ["source", "split", "preview"];
    const currentIndex = modes.indexOf(mode());
    const nextMode = modes[(currentIndex + 1) % modes.length];
    handleModeChange(nextMode);
  };

  // Listen for editor mode commands from command registry
  onMount(() => {
    const handleModeEvent = (e: CustomEvent<string>) => {
      switch (e.detail) {
        case "source":
          handleModeChange("source");
          break;
        case "split":
          handleModeChange("split");
          break;
        case "preview":
          handleModeChange("preview");
          break;
        case "cycle":
          cycleMode();
          break;
      }
    };

    window.addEventListener("notemaker:editor-mode", handleModeEvent as EventListener);
    return () => window.removeEventListener("notemaker:editor-mode", handleModeEvent as EventListener);
  });

  return (
    <div class="editor-with-preview flex flex-col h-full">
      {/* Toolbar with mode toggle */}
      <div class="flex items-center justify-between bg-gray-800 border-b border-gray-700" style={{ padding: "12px 20px" }}>
        <div class="flex items-center gap-4 min-w-0">
          <Show when={props.filePath}>
            <span class="text-sm text-gray-400 font-mono truncate">
              {props.filePath}
            </span>
          </Show>
        </div>

        <div class="flex items-center gap-2 flex-shrink-0">
          {/* Encryption controls */}
          <Show when={props.content}>
            <div class="flex items-center gap-1">
              {/* Lock toggle: empty = not encrypted, filled yellow = encrypted */}
              <button
                onClick={() => {
                  if (isEncrypted()) {
                    if (decryptedContent()) {
                      handleSaveDecrypted();
                    } else {
                      handleDecrypt();
                    }
                  } else {
                    handleEncrypt();
                  }
                }}
                disabled={isEncrypting()}
                class={`p-1.5 rounded transition-colors disabled:opacity-50 ${
                  isEncrypted()
                    ? "text-yellow-500 hover:text-yellow-400 hover:bg-gray-700"
                    : "text-gray-400 hover:text-yellow-400 hover:bg-gray-700"
                }`}
                title={isEncrypted() ? "Remove encryption" : "Encrypt note"}
              >
                <Show
                  when={isEncrypted()}
                  fallback={
                    /* Empty lock - not encrypted */
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M8 1a2 2 0 0 1 2 2v4H6V3a2 2 0 0 1 2-2zm3 6V3a3 3 0 0 0-6 0v4a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2zM5 8h6a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" />
                    </svg>
                  }
                >
                  {/* Filled lock - encrypted */}
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M8 1a2 2 0 0 1 2 2v4H6V3a2 2 0 0 1 2-2zm3 6V3a3 3 0 0 0-6 0v4a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z" />
                  </svg>
                </Show>
              </button>

              {/* Eye toggle: show/hide plaintext (only when encrypted) */}
              <Show when={isEncrypted()}>
                <button
                  onClick={() => {
                    if (decryptedContent()) {
                      handleReEncrypt();
                    } else {
                      handleDecrypt();
                    }
                  }}
                  disabled={isEncrypting()}
                  class={`p-1.5 rounded transition-colors disabled:opacity-50 ${
                    decryptedContent()
                      ? "text-green-500 hover:text-green-400 hover:bg-gray-700"
                      : "text-gray-400 hover:text-green-400 hover:bg-gray-700"
                  }`}
                  title={decryptedContent() ? "Hide plaintext" : "Show plaintext"}
                >
                  <Show
                    when={decryptedContent()}
                    fallback={
                      /* Eye - show plaintext */
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M16 8s-3-5.5-8-5.5S0 8 0 8s3 5.5 8 5.5S16 8 16 8zM1.173 8a13.133 13.133 0 0 1 1.66-2.043C4.12 4.668 5.88 3.5 8 3.5c2.12 0 3.879 1.168 5.168 2.457A13.133 13.133 0 0 1 14.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755C11.879 11.332 10.119 12.5 8 12.5c-2.12 0-3.879-1.168-5.168-2.457A13.134 13.134 0 0 1 1.172 8z" />
                        <path d="M8 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM4.5 8a3.5 3.5 0 1 1 7 0 3.5 3.5 0 0 1-7 0z" />
                      </svg>
                    }
                  >
                    {/* Eye-slash - hide plaintext */}
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M13.359 11.238C15.06 9.72 16 8 16 8s-3-5.5-8-5.5a7.028 7.028 0 0 0-2.79.588l.77.771A5.944 5.944 0 0 1 8 3.5c2.12 0 3.879 1.168 5.168 2.457A13.134 13.134 0 0 1 14.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755-.165.165-.337.328-.517.486l.708.709z" />
                      <path d="M11.297 9.176a3.5 3.5 0 0 0-4.474-4.474l.823.823a2.5 2.5 0 0 1 2.829 2.829l.822.822zm-2.943 1.299.822.822a3.5 3.5 0 0 1-4.474-4.474l.823.823a2.5 2.5 0 0 0 2.829 2.829z" />
                      <path d="M3.35 5.47c-.18.16-.353.322-.518.487A13.134 13.134 0 0 0 1.172 8l.195.288c.335.48.83 1.12 1.465 1.755C4.121 11.332 5.881 12.5 8 12.5c.716 0 1.39-.133 2.02-.36l.77.772A7.029 7.029 0 0 1 8 13.5C3 13.5 0 8 0 8s.939-1.721 2.641-3.238l.708.709zm10.296 8.884-12-12 .708-.708 12 12-.708.708z" />
                    </svg>
                  </Show>
                </button>
              </Show>
            </div>

            <div class="w-px h-4 bg-gray-600" />
          </Show>

          {/* Frontmatter toggle */}
          <button
            onClick={toggleFrontmatter}
            class={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
              showFrontmatter()
                ? "bg-purple-600 text-white"
                : "bg-gray-700 text-gray-400 hover:bg-gray-600"
            }`}
            title={showFrontmatter() ? "Hide frontmatter" : "Show frontmatter"}
          >
            FM
          </button>
          <EditorModeToggle mode={mode()} onChange={handleModeChange} />
        </div>
      </div>

      {/* Encryption error */}
      <Show when={encryptionError()}>
        <div
          class="flex items-center bg-red-900/30 border-b border-red-700 text-sm text-red-300"
          style={{ padding: "12px 20px" }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="currentColor"
            style={{ "margin-right": "8px", "flex-shrink": "0" }}
          >
            <path d="M8.982 1.566a1.13 1.13 0 0 0-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.713c.889 0 1.438-.99.98-1.767L8.982 1.566zM8 5c.535 0 .954.462.9.995l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 5.995A.905.905 0 0 1 8 5zm.002 6a1 1 0 1 1 0 2 1 1 0 0 1 0-2z"/>
          </svg>
          <span class="flex-1">{encryptionError()}</span>
          <button
            onClick={() => setEncryptionError(null)}
            class="text-red-400 hover:text-red-200 transition-colors"
            style={{ padding: "4px" }}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/>
            </svg>
          </button>
        </div>
      </Show>

      {/* Frontmatter Editor */}
      <Show when={showFrontmatter()}>
        <FrontmatterEditor
          frontmatter={frontmatter()}
          onChange={handleFrontmatterChange}
        />
      </Show>

      {/* Editor area */}
      <div class="flex-1 overflow-hidden">
        {/* Encrypted placeholder when content is encrypted and not decrypted */}
        <Show when={isEncrypted() && !decryptedContent()}>
          <div class="flex items-center justify-center h-full text-gray-500">
            <div class="text-center">
              <svg
                width="48"
                height="48"
                viewBox="0 0 16 16"
                fill="currentColor"
                class="text-yellow-500 mx-auto"
                style={{ "margin-bottom": "16px" }}
              >
                <path d="M8 1a2 2 0 0 1 2 2v4H6V3a2 2 0 0 1 2-2zm3 6V3a3 3 0 0 0-6 0v4a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z" />
              </svg>
              <p class="text-lg" style={{ "margin-bottom": "8px" }}>This note is encrypted</p>
              <p class="text-sm text-gray-600">Click the eye icon above to view content</p>
            </div>
          </div>
        </Show>

        {/* Normal editor/preview when not encrypted or decrypted */}
        <Show when={!isEncrypted() || decryptedContent()}>
          <Switch>
            {/* Source mode - just the editor */}
            <Match when={mode() === "source"}>
              <Editor {...props} content={displayContent()} onChange={handleContentChange} />
            </Match>

            {/* Split mode - editor and preview side by side */}
            <Match when={mode() === "split"}>
              <SplitView
                left={<Editor {...props} content={displayContent()} onChange={handleContentChange} />}
                right={<Preview content={displayContent()} />}
                initialRatio={0.5}
              />
            </Match>

            {/* Preview mode - just the preview */}
            <Match when={mode() === "preview"}>
              <Preview content={displayContent()} class="h-full" />
            </Match>
          </Switch>
        </Show>
      </div>
    </div>
  );
}

/**
 * Load saved editor mode from localStorage
 */
function loadSavedMode(): EditorMode | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "source" || saved === "split" || saved === "preview") {
      return saved;
    }
  } catch {
    // Ignore storage errors
  }
  return null;
}

/**
 * Save editor mode to localStorage
 */
function saveMode(mode: EditorMode): void {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // Ignore storage errors
  }
}

/**
 * Load frontmatter panel preference
 */
function loadFrontmatterPref(): boolean {
  try {
    return localStorage.getItem(FRONTMATTER_KEY) === "true";
  } catch {
    return false;
  }
}

/**
 * Save frontmatter panel preference
 */
function saveFrontmatterPref(show: boolean): void {
  try {
    localStorage.setItem(FRONTMATTER_KEY, String(show));
  } catch {
    // Ignore storage errors
  }
}

export default EditorWithPreview;
