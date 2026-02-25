/**
 * Individual block component for notebook editor
 */

import { createSignal, Show, createEffect } from "solid-js";
import { notebookStore } from "../lib/store/notebook";
import { encryptionStore } from "../lib/store/encryption";
import { isContentEncrypted, encryptBlock, decryptBlock, updateNotebookBlock } from "../lib/fs";
import { CodeBlockEditor } from "./CodeBlockEditor";
import { MarkdownBlockEditor } from "./MarkdownBlockEditor";

export interface NotebookBlockProps {
  id: string;
  notebookPath: string;
  onRunCode?: () => void;
  onAddBlockBelow: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onChangeLanguage: (language: string) => void;
  isFirst: boolean;
  isLast: boolean;
}

// Languages that can be executed
const EXECUTABLE_LANGUAGES = ["shell", "python", "ruby"];

// All available languages - Markdown is default and first
const LANGUAGES = [
  { value: "markdown", label: "Markdown", executable: false },
  { value: "shell", label: "Shell", executable: true },
  { value: "python", label: "Python", executable: true },
  { value: "ruby", label: "Ruby", executable: true },
  { value: "javascript", label: "JavaScript", executable: false },
  { value: "typescript", label: "TypeScript", executable: false },
  { value: "sql", label: "SQL", executable: false },
  { value: "json", label: "JSON", executable: false },
  { value: "yaml", label: "YAML", executable: false },
  { value: "html", label: "HTML", executable: false },
  { value: "css", label: "CSS", executable: false },
  { value: "rust", label: "Rust", executable: false },
  { value: "go", label: "Go", executable: false },
  { value: "hcl", label: "Terraform/HCL", executable: false },
];

// Check if language is executable
function isExecutable(language: string | undefined): boolean {
  if (!language) return false;
  return EXECUTABLE_LANGUAGES.includes(language.toLowerCase());
}

// Check if language is markdown (uses different editor)
function isMarkdown(language: string | undefined): boolean {
  return !language || language.toLowerCase() === "markdown";
}

export function NotebookBlock(props: NotebookBlockProps) {
  const [isHovered, setIsHovered] = createSignal(false);
  const [isEncrypted, setIsEncrypted] = createSignal(false);
  const [decryptedContent, setDecryptedContent] = createSignal<string | null>(null);
  const [isEncrypting, setIsEncrypting] = createSignal(false);
  const [encryptionError, setEncryptionError] = createSignal<string | null>(null);

  // Read block data directly from store
  const block = () => notebookStore.getBlock(props.id);
  // Language is the source of truth - markdown is default
  const blockLanguage = () => block()?.language || "markdown";
  const blockContent = () => block()?.content || "";
  const isActive = () => notebookStore.activeBlockId() === props.id;
  const output = () => notebookStore.blockOutputs()[props.id];

  // Check if content is encrypted
  createEffect(async () => {
    const content = blockContent();
    if (content) {
      const encrypted = await isContentEncrypted(content);
      setIsEncrypted(encrypted);
      if (!encrypted) {
        setDecryptedContent(null);
      }
    }
  });

  // Display content (decrypted if available, otherwise raw)
  const displayContent = () => decryptedContent() ?? blockContent();

  // Perform encryption after unlock
  const doEncrypt = async () => {
    const content = blockContent();
    if (!content || isEncrypted()) return;

    setIsEncrypting(true);
    try {
      const encrypted = await encryptBlock(content);
      await updateNotebookBlock(props.notebookPath, props.id, encrypted);
      notebookStore.updateBlockContent(props.id, encrypted);
      setIsEncrypted(true);
      setDecryptedContent(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setEncryptionError(`Failed to encrypt: ${msg}`);
      console.error("Failed to encrypt block:", e);
    } finally {
      setIsEncrypting(false);
    }
  };

  // Handle encrypt block
  const handleEncrypt = async () => {
    setEncryptionError(null);

    // Try auto-unlock if not unlocked
    if (!encryptionStore.isUnlocked()) {
      const result = await encryptionStore.tryAutoUnlock();
      if (!result.success) {
        if (result.needsPassword) {
          // Request password from user, then encrypt
          encryptionStore.requestPassword(() => doEncrypt());
          return;
        }
        setEncryptionError(result.error || "Failed to unlock encryption");
        return;
      }
    }

    await doEncrypt();
  };

  // Perform decryption after unlock
  const doDecrypt = async () => {
    const content = blockContent();
    if (!content || !isEncrypted()) return;

    try {
      const decrypted = await decryptBlock(content);
      setDecryptedContent(decrypted);
      setIsEncrypted(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setEncryptionError(`Failed to decrypt: ${msg}`);
      console.error("Failed to decrypt block:", e);
    }
  };

  // Handle decrypt block
  const handleDecrypt = async () => {
    setEncryptionError(null);

    // Try auto-unlock if not unlocked
    if (!encryptionStore.isUnlocked()) {
      const result = await encryptionStore.tryAutoUnlock();
      if (!result.success) {
        if (result.needsPassword) {
          // Request password from user, then decrypt
          encryptionStore.requestPassword(() => doDecrypt());
          return;
        }
        setEncryptionError(result.error || "Failed to unlock encryption");
        return;
      }
    }

    await doDecrypt();
  };

  // Save decrypted content permanently (removes encryption)
  const handleSaveDecrypted = async () => {
    const decrypted = decryptedContent();
    if (!decrypted) return;

    try {
      await updateNotebookBlock(props.notebookPath, props.id, decrypted);
      notebookStore.updateBlockContent(props.id, decrypted);
      setIsEncrypted(false);
      setDecryptedContent(null);
    } catch (e) {
      console.error("Failed to save decrypted content:", e);
    }
  };

  // Re-encrypt modified content
  const handleReEncrypt = async () => {
    const decrypted = decryptedContent();
    if (!decrypted || !encryptionStore.isUnlocked()) return;

    setIsEncrypting(true);
    try {
      const encrypted = await encryptBlock(decrypted);
      await updateNotebookBlock(props.notebookPath, props.id, encrypted);
      notebookStore.updateBlockContent(props.id, encrypted);
      setDecryptedContent(null);
    } catch (e) {
      console.error("Failed to re-encrypt block:", e);
    } finally {
      setIsEncrypting(false);
    }
  };

  const handleFocus = () => {
    notebookStore.setActiveBlockId(props.id);
  };

  const handleContentChange = (content: string) => {
    // If we're editing decrypted content, update the decrypted state
    if (isEncrypted() && decryptedContent() !== null) {
      setDecryptedContent(content);
    } else {
      notebookStore.updateBlockContent(props.id, content);
    }
  };

  return (
    <div
      data-block-id={props.id}
      class={`relative group border rounded-lg transition-all ${
        isActive()
          ? "border-blue-500 ring-2 ring-blue-500/20"
          : "border-gray-700 hover:border-gray-600"
      }`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleFocus}
    >
      {/* Block header */}
      <div class="flex items-center justify-between bg-gray-800/50 border-b border-gray-700 rounded-t-lg" style={{ padding: "8px 16px" }}>
        <div class="flex items-center gap-2">
          {/* Language selector - always visible */}
          <select
            value={blockLanguage()}
            onChange={(e) => props.onChangeLanguage(e.currentTarget.value)}
            class="text-xs bg-gray-700 border-none rounded px-2 py-0.5 text-gray-300 focus:ring-1 focus:ring-blue-500"
            onClick={(e) => e.stopPropagation()}
          >
            {LANGUAGES.map((lang) => (
              <option value={lang.value}>{lang.label}</option>
            ))}
          </select>

          {/* Dirty indicator */}
          <Show when={notebookStore.isBlockDirty(props.id)}>
            <span class="w-2 h-2 rounded-full bg-yellow-500" title="Unsaved changes" />
          </Show>
        </div>

        {/* Block actions */}
        <div class={`flex items-center gap-1 ${isHovered() || isActive() ? "opacity-100" : "opacity-0"} transition-opacity`}>
          {/* Lock toggle: empty = not encrypted, filled yellow = encrypted */}
          <Show when={blockContent()}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (isEncrypted()) {
                  // Remove encryption (save decrypted)
                  if (decryptedContent()) {
                    handleSaveDecrypted();
                  } else {
                    // Need to decrypt first, then save
                    handleDecrypt();
                  }
                } else {
                  // Encrypt
                  handleEncrypt();
                }
              }}
              disabled={isEncrypting()}
              class={`p-1 rounded transition-colors disabled:opacity-50 ${
                isEncrypted()
                  ? "text-yellow-500 hover:text-yellow-400 hover:bg-gray-700"
                  : "text-gray-400 hover:text-yellow-400 hover:bg-gray-700"
              }`}
              title={isEncrypted() ? "Remove encryption" : "Encrypt block"}
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
          </Show>

          {/* Eye toggle: show/hide plaintext (only when encrypted) */}
          <Show when={isEncrypted()}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (decryptedContent()) {
                  // Hide plaintext - re-encrypt and clear decrypted view
                  handleReEncrypt();
                } else {
                  // Show plaintext - decrypt
                  handleDecrypt();
                }
              }}
              disabled={isEncrypting()}
              class={`p-1 rounded transition-colors disabled:opacity-50 ${
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

          {/* Run button - only for executable languages */}
          <Show when={isExecutable(blockLanguage()) && !isEncrypted()}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                props.onRunCode?.();
              }}
              class="p-1 text-gray-400 hover:text-green-400 hover:bg-gray-700 rounded transition-colors"
              title="Run (⌘R)"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                <path d="M4 2.5v11a.5.5 0 0 0 .79.407l8-5.5a.5.5 0 0 0 0-.814l-8-5.5A.5.5 0 0 0 4 2.5z" />
              </svg>
            </button>
          </Show>

          {/* Clear output button */}
          <Show when={!isMarkdown(blockLanguage()) && output() && !output()?.running}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                notebookStore.clearBlockOutput(props.id);
              }}
              class="p-1 text-gray-400 hover:text-yellow-400 hover:bg-gray-700 rounded transition-colors"
              title="Clear output"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
                <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/>
              </svg>
            </button>
          </Show>

          <button
            onClick={(e) => {
              e.stopPropagation();
              props.onMoveUp();
            }}
            disabled={props.isFirst}
            class="p-1 text-gray-400 hover:text-gray-200 hover:bg-gray-700 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            title="Move up (Alt+Up)"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 4.5a.5.5 0 0 1 .5.5v5.793l2.146-2.147a.5.5 0 0 1 .708.708l-3 3a.5.5 0 0 1-.708 0l-3-3a.5.5 0 1 1 .708-.708L7.5 10.793V5a.5.5 0 0 1 .5-.5z" transform="rotate(180 8 8)" />
            </svg>
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              props.onMoveDown();
            }}
            disabled={props.isLast}
            class="p-1 text-gray-400 hover:text-gray-200 hover:bg-gray-700 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            title="Move down (Alt+Down)"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 4.5a.5.5 0 0 1 .5.5v5.793l2.146-2.147a.5.5 0 0 1 .708.708l-3 3a.5.5 0 0 1-.708 0l-3-3a.5.5 0 1 1 .708-.708L7.5 10.793V5a.5.5 0 0 1 .5-.5z" />
            </svg>
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              props.onDelete();
            }}
            class="p-1 text-gray-400 hover:text-red-400 hover:bg-gray-700 rounded transition-colors"
            title="Delete block"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z" />
              <path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Block content */}
      <div style={{ padding: "16px" }}>
        {/* Encryption error message */}
        <Show when={encryptionError()}>
          <div
            class="flex items-center bg-red-900/30 border border-red-700 rounded-lg text-sm text-red-300"
            style={{ padding: "12px", "margin-bottom": "12px" }}
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

        {/* Encrypted block - show placeholder */}
        <Show when={isEncrypted() && !decryptedContent()}>
          <div
            class="flex items-center justify-center text-center text-gray-500 text-sm"
            style={{ padding: "16px" }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="currentColor"
              class="text-yellow-500"
              style={{ "margin-right": "8px" }}
            >
              <path d="M8 1a2 2 0 0 1 2 2v4H6V3a2 2 0 0 1 2-2zm3 6V3a3 3 0 0 0-6 0v4a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z" />
            </svg>
            Encrypted content — click eye icon to view
          </div>
        </Show>

        {/* Normal or decrypted content */}
        <Show when={!isEncrypted() || decryptedContent()}>
          <Show
            when={!isMarkdown(blockLanguage())}
            fallback={
              <MarkdownBlockEditor
                content={displayContent()}
                onChange={handleContentChange}
                onFocus={handleFocus}
                onAddBlockBelow={() => props.onAddBlockBelow()}
                onMoveUp={() => !props.isFirst && props.onMoveUp()}
                onMoveDown={() => !props.isLast && props.onMoveDown()}
                notebookPath={props.notebookPath}
              />
            }
          >
            <CodeBlockEditor
              content={displayContent()}
              language={blockLanguage()}
              onChange={handleContentChange}
              onFocus={handleFocus}
              onRun={() => props.onRunCode?.()}
              onAddBlockBelow={() => props.onAddBlockBelow()}
              onMoveUp={() => !props.isFirst && props.onMoveUp()}
              onMoveDown={() => !props.isLast && props.onMoveDown()}
            />
          </Show>
        </Show>
      </div>

      {/* Code output - only for non-markdown blocks */}
      <Show when={!isMarkdown(blockLanguage()) && output()}>
        <div class="border-t border-gray-700 bg-gray-900/50 rounded-b-lg">
          <div class="px-3 py-2 text-xs">
            <Show when={output()?.running}>
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2 text-gray-400">
                  <svg class="animate-spin h-3 w-3" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" />
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Running...
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    notebookStore.terminateBlock(props.id);
                  }}
                  class="flex items-center gap-1 text-red-400 hover:text-red-300 hover:bg-gray-700 rounded transition-colors"
                  style={{ padding: "4px 8px" }}
                  title="Stop execution"
                >
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                    <rect x="3" y="3" width="10" height="10" rx="1" />
                  </svg>
                  Stop
                </button>
              </div>
            </Show>
            <Show when={!output()?.running && output()?.stdout}>
              <pre class="text-gray-300 whitespace-pre-wrap font-mono">{output()?.stdout}</pre>
            </Show>
            <Show when={!output()?.running && output()?.stderr}>
              <pre class="text-red-400 whitespace-pre-wrap font-mono">{output()?.stderr}</pre>
            </Show>
            <Show when={!output()?.running && output()?.exitCode !== null}>
              <div class={`mt-1 ${output()?.exitCode === 0 ? "text-green-500" : "text-red-500"}`}>
                Exit code: {output()?.exitCode}
              </div>
            </Show>
          </div>
        </div>
      </Show>
    </div>
  );
}

export default NotebookBlock;
