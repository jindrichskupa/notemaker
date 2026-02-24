import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";

// Types

export interface VaultInfo {
  path: string;
  name: string;
  note_count: number;
  has_git: boolean;
  has_config: boolean;
}

export interface FileEntry {
  name: string;
  path: string;
  is_directory: boolean;
  modified: number;
  size: number;
  children?: FileEntry[];
}

export interface NoteContent {
  path: string;
  content: string;
  modified: number;
}

export interface FileChangeEvent {
  path: string;
  kind: "create" | "modify" | "delete" | "rename";
}

// Notebook types

export type BlockType = "markdown" | "code";

export interface NotebookBlock {
  id: string;
  type: BlockType;
  language?: string;
  content: string;
  encrypted?: boolean;
}

export interface Notebook {
  path: string;
  name: string;
  blocks: NotebookBlock[];
}

export type EncryptionMethod = "password" | "identityfile" | "recipients";

export interface Recipient {
  id: string;
  name: string;
  public_key: string;
  identity_file?: string;
  added_at?: string;
}

export interface EncryptionSettings {
  enabled: boolean;
  method: EncryptionMethod;
  identity_file?: string;
  recipients?: Recipient[];
  own_identity?: string;
}

export interface InterpreterSettings {
  shell?: string;
  python?: string;
  ruby?: string;
  node?: string;
}

export interface VaultConfig {
  version: number;
  vault: {
    name: string;
    created: string;
  };
  editor: {
    font_family: string;
    font_size: number;
    line_height: number;
    word_wrap: boolean;
  };
  git: {
    enabled: boolean;
    auto_commit: boolean;
    auto_sync_interval: number;
    remote: string;
    branch: string;
  };
  formatting: {
    auto_format_on_paste: string;
    default_indent: number;
  };
  file_tree: {
    /** "all" | "none" | "remember" */
    default_expanded: string;
  };
  encryption: EncryptionSettings;
  interpreters: InterpreterSettings;
}

export interface LocalState {
  expanded_paths: string[];
  last_opened: string | null;
}

// Vault operations

export async function openVault(path: string): Promise<VaultInfo> {
  return invoke<VaultInfo>("open_vault", { path });
}

export async function getVaultConfig(vaultPath: string): Promise<VaultConfig> {
  return invoke<VaultConfig>("get_vault_config", { vaultPath });
}

export async function saveVaultConfig(
  vaultPath: string,
  config: VaultConfig
): Promise<void> {
  return invoke("save_vault_config", { vaultPath, config });
}

export async function getLocalState(vaultPath: string): Promise<LocalState> {
  return invoke<LocalState>("get_local_state", { vaultPath });
}

export async function saveLocalState(
  vaultPath: string,
  state: LocalState
): Promise<void> {
  return invoke("save_local_state", { vaultPath, state });
}

// Directory operations

export async function listDirectory(path: string): Promise<FileEntry[]> {
  return invoke<FileEntry[]>("list_directory", { path });
}

export async function createDirectory(path: string): Promise<void> {
  return invoke("create_directory", { path });
}

export async function deleteDirectory(path: string): Promise<void> {
  return invoke("delete_directory", { path });
}

// Note operations

export async function readNote(path: string): Promise<NoteContent> {
  return invoke<NoteContent>("read_note", { path });
}

export async function writeNote(path: string, content: string): Promise<void> {
  return invoke("write_note", { path, content });
}

export async function createNote(
  path: string,
  title?: string,
  template?: string
): Promise<void> {
  return invoke("create_note", { path, title, template });
}

export async function deleteNote(path: string): Promise<void> {
  return invoke("delete_note", { path });
}

export async function renameNote(from: string, to: string): Promise<void> {
  return invoke("rename_note", { from, to });
}

export async function moveNote(from: string, toDir: string): Promise<string> {
  return invoke<string>("move_note", { from, toDir });
}

// Notebook operations

export async function createNotebook(
  path: string,
  title?: string
): Promise<Notebook> {
  return invoke<Notebook>("create_notebook", { path, title });
}

export async function readNotebook(path: string): Promise<Notebook> {
  return invoke<Notebook>("read_notebook", { path });
}

export async function addNotebookBlock(
  notebookPath: string,
  blockType: BlockType,
  language?: string,
  afterBlockId?: string
): Promise<NotebookBlock> {
  return invoke<NotebookBlock>("add_notebook_block", {
    notebookPath,
    blockType,
    language,
    afterBlockId,
  });
}

export async function updateNotebookBlock(
  notebookPath: string,
  blockId: string,
  content: string
): Promise<void> {
  return invoke("update_notebook_block", { notebookPath, blockId, content });
}

export async function deleteNotebookBlock(
  notebookPath: string,
  blockId: string
): Promise<void> {
  return invoke("delete_notebook_block", { notebookPath, blockId });
}

export async function moveNotebookBlock(
  notebookPath: string,
  blockId: string,
  newIndex: number
): Promise<void> {
  return invoke("move_notebook_block", { notebookPath, blockId, newIndex });
}

export async function changeBlockType(
  notebookPath: string,
  blockId: string,
  newType: BlockType,
  newLanguage?: string
): Promise<NotebookBlock> {
  return invoke<NotebookBlock>("change_block_type", {
    notebookPath,
    blockId,
    newType,
    newLanguage,
  });
}

export function isNotebook(path: string): boolean {
  // A notebook is a directory ending with .md
  return path.endsWith(".md");
}

// Note conversion

export async function convertNoteToNotebook(
  notePath: string,
  content: string
): Promise<Notebook> {
  return invoke<Notebook>("convert_note_to_notebook", { notePath, content });
}

// Code execution

export interface CodeExecutionResult {
  stdout: string;
  stderr: string;
  exit_code: number;
}

export async function executeCodeBlock(
  language: string,
  code: string,
  workingDir?: string,
  interpreter?: string
): Promise<CodeExecutionResult> {
  return invoke<CodeExecutionResult>("execute_code_block", {
    language,
    code,
    workingDir,
    interpreter,
  });
}

export async function executeCodeBlockAsync(
  blockId: string,
  language: string,
  code: string,
  workingDir?: string,
  interpreter?: string
): Promise<CodeExecutionResult> {
  return invoke<CodeExecutionResult>("execute_code_block_async", {
    blockId,
    language,
    code,
    workingDir,
    interpreter,
  });
}

export async function terminateCodeBlock(blockId: string): Promise<boolean> {
  return invoke<boolean>("terminate_code_block", { blockId });
}

// File watcher

export async function startWatching(path: string): Promise<void> {
  return invoke("start_watching", { path });
}

export async function stopWatching(): Promise<void> {
  return invoke("stop_watching");
}

export function onFileChange(
  callback: (event: FileChangeEvent) => void
): Promise<UnlistenFn> {
  return listen<FileChangeEvent>("file-changed", (event) => {
    callback(event.payload);
  });
}

// Utility functions

export function isMarkdownFile(path: string): boolean {
  return path.toLowerCase().endsWith(".md");
}

export function getFileName(path: string): string {
  const parts = path.split(/[/\\]/);
  return parts[parts.length - 1] || "";
}

export function getFileNameWithoutExtension(path: string): string {
  const name = getFileName(path);
  const lastDot = name.lastIndexOf(".");
  return lastDot > 0 ? name.substring(0, lastDot) : name;
}

export function getParentPath(path: string): string {
  const parts = path.split(/[/\\]/);
  parts.pop();
  return parts.join("/");
}

export function joinPath(...parts: string[]): string {
  return parts.join("/").replace(/\/+/g, "/");
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatRelativeTime(timestamp: number): string {
  const now = Date.now() / 1000;
  const diff = now - timestamp;

  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;

  const date = new Date(timestamp * 1000);
  return date.toLocaleDateString();
}

// Encryption operations

export async function setEncryptionPassword(password: string): Promise<void> {
  return invoke("set_encryption_password", { password });
}

export async function setEncryptionIdentity(path: string): Promise<void> {
  return invoke("set_encryption_identity", { path });
}

export async function lockEncryptionSession(): Promise<void> {
  return invoke("lock_encryption_session");
}

export async function isEncryptionUnlocked(): Promise<boolean> {
  return invoke<boolean>("is_encryption_unlocked");
}

export async function encryptBlock(content: string): Promise<string> {
  return invoke<string>("encrypt_block", { content });
}

export async function decryptBlock(content: string): Promise<string> {
  return invoke<string>("decrypt_block", { content });
}

export async function encryptNote(path: string): Promise<void> {
  return invoke("encrypt_note", { path });
}

export async function decryptNote(path: string): Promise<void> {
  return invoke("decrypt_note", { path });
}

export async function isNoteEncrypted(path: string): Promise<boolean> {
  return invoke<boolean>("is_note_encrypted", { path });
}

export async function isContentEncrypted(content: string): Promise<boolean> {
  return invoke<boolean>("is_content_encrypted", { content });
}

// Keychain operations - persistent credential storage

export async function setEncryptionPasswordWithSave(
  password: string,
  saveToKeychain: boolean
): Promise<void> {
  return invoke("set_encryption_password_with_save", { password, saveToKeychain });
}

export async function setEncryptionIdentityWithSave(
  path: string,
  saveToKeychain: boolean
): Promise<void> {
  return invoke("set_encryption_identity_with_save", { path, saveToKeychain });
}

export async function unlockFromKeychain(): Promise<boolean> {
  return invoke<boolean>("unlock_from_keychain");
}

export async function hasKeychainCredentials(): Promise<boolean> {
  return invoke<boolean>("has_keychain_credentials");
}

export async function clearKeychainCredentials(): Promise<void> {
  return invoke("clear_keychain_credentials");
}

export async function lockEncryptionSessionWithClear(
  clearKeychain: boolean
): Promise<void> {
  return invoke("lock_encryption_session_with_clear", { clearKeychain });
}

// Multi-recipient encryption operations

export async function getPublicKeyFromIdentityFile(path: string): Promise<string> {
  return invoke<string>("get_public_key_from_identity_file", { path });
}

export async function generateIdentityFile(path: string): Promise<string> {
  return invoke<string>("generate_identity_file", { path });
}

export async function setupRecipientsEncryption(
  publicKeys: string[],
  identityPaths: string[]
): Promise<void> {
  return invoke("setup_recipients_encryption", { publicKeys, identityPaths });
}

export async function addRecipientIdentity(path: string): Promise<string> {
  return invoke<string>("add_recipient_identity", { path });
}

export async function addRecipientPublicKey(publicKey: string): Promise<void> {
  return invoke("add_recipient_public_key", { publicKey });
}

export async function getRecipientPublicKeys(): Promise<string[]> {
  return invoke<string[]>("get_recipient_public_keys");
}

export async function clearRecipients(): Promise<void> {
  return invoke("clear_recipients");
}
