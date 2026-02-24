/**
 * Vault Settings Dialog - Configuration specific to the current vault
 * Stored in .notemaker/config.yaml
 */

import { createSignal, Show, createEffect, For } from "solid-js";
import { open } from "@tauri-apps/plugin-dialog";
import { vaultStore } from "../lib/store/vault";
import { getVaultConfig, saveVaultConfig, VaultConfig, Recipient, getPublicKeyFromIdentityFile, EncryptionMethod } from "../lib/fs";

export interface VaultSettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

type SettingsTab = "general" | "git" | "encryption" | "interpreters";

const TABS: { id: SettingsTab; label: string }[] = [
  { id: "general", label: "General" },
  { id: "git", label: "Git" },
  { id: "encryption", label: "Encryption" },
  { id: "interpreters", label: "Interpreters" },
];

export function VaultSettingsDialog(props: VaultSettingsDialogProps) {
  const [activeTab, setActiveTab] = createSignal<SettingsTab>("general");
  const [vaultConfig, setVaultConfig] = createSignal<VaultConfig | null>(null);
  const [isLoading, setIsLoading] = createSignal(true);
  const [isSaving, setIsSaving] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  // Load vault config when dialog opens
  createEffect(() => {
    if (props.isOpen) {
      loadConfig();
    }
  });

  const loadConfig = async () => {
    const vault = vaultStore.vault();
    if (!vault) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const config = await getVaultConfig(vault.path);
      setVaultConfig(config);
      setError(null);
    } catch (e) {
      console.error("Failed to load vault config:", e);
      setError("Failed to load settings");
    } finally {
      setIsLoading(false);
    }
  };

  const updateConfig = async <K extends keyof VaultConfig>(
    section: K,
    key: keyof VaultConfig[K],
    value: VaultConfig[K][typeof key]
  ) => {
    const vault = vaultStore.vault();
    const config = vaultConfig();
    if (!vault || !config) return;

    const updatedConfig = {
      ...config,
      [section]: {
        ...(config[section] as object),
        [key]: value,
      },
    };
    setVaultConfig(updatedConfig);

    try {
      setIsSaving(true);
      await saveVaultConfig(vault.path, updatedConfig);
      setError(null);
    } catch (e) {
      console.error("Failed to save vault config:", e);
      setError("Failed to save settings");
      setVaultConfig(config); // Revert on error
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      props.onClose();
    }
  };

  const vault = () => vaultStore.vault();

  return (
    <Show when={props.isOpen}>
      <div
        class="fixed inset-0 bg-black/60 z-50 flex items-center justify-center"
        onClick={(e) => e.target === e.currentTarget && props.onClose()}
        onKeyDown={handleKeyDown}
      >
        <div class="bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col border border-gray-700">
          {/* Header */}
          <div class="flex items-center justify-between border-b border-gray-700" style={{ padding: "16px 24px" }}>
            <div>
              <h2 class="text-lg font-medium text-gray-100">Vault Settings</h2>
              <Show when={vault()}>
                <p class="text-sm text-gray-500">{vault()?.name}</p>
              </Show>
            </div>
            <button
              onClick={props.onClose}
              class="text-gray-400 hover:text-gray-200 rounded transition-colors"
              style={{ padding: "4px" }}
            >
              <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor">
                <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.75.75 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 0 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06z" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div class="flex flex-1 overflow-hidden">
            {/* Sidebar */}
            <nav class="w-48 border-r border-gray-700" style={{ padding: "8px" }}>
              {TABS.map((tab) => (
                <button
                  onClick={() => setActiveTab(tab.id)}
                  style={{ padding: "8px 12px" }}
                  class={`w-full text-left rounded text-sm transition-colors ${
                    activeTab() === tab.id
                      ? "bg-blue-600 text-white"
                      : "text-gray-400 hover:text-gray-200 hover:bg-gray-700"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>

            {/* Settings content */}
            <div class="flex-1 overflow-y-auto" style={{ padding: "24px" }}>
              <Show when={!vault()}>
                <div class="text-center text-gray-400" style={{ padding: "24px" }}>
                  <p>No vault open.</p>
                </div>
              </Show>

              <Show when={vault() && isLoading()}>
                <div class="text-center text-gray-400" style={{ padding: "24px" }}>
                  Loading settings...
                </div>
              </Show>

              <Show when={error()}>
                <div class="bg-red-900/30 border border-red-700 rounded text-sm text-red-300" style={{ padding: "12px", "margin-bottom": "16px" }}>
                  {error()}
                </div>
              </Show>

              <Show when={vault() && !isLoading() && vaultConfig()}>
                <Show when={activeTab() === "general"}>
                  <GeneralSettings config={vaultConfig()!} onUpdate={updateConfig} />
                </Show>
                <Show when={activeTab() === "git"}>
                  <GitSettings config={vaultConfig()!} onUpdate={updateConfig} />
                </Show>
                <Show when={activeTab() === "encryption"}>
                  <EncryptionSettings config={vaultConfig()!} onUpdate={updateConfig} />
                </Show>
                <Show when={activeTab() === "interpreters"}>
                  <InterpreterSettingsTab config={vaultConfig()!} onUpdate={updateConfig} />
                </Show>
              </Show>
            </div>
          </div>

          {/* Footer */}
          <div class="flex justify-between items-center border-t border-gray-700" style={{ padding: "16px 24px" }}>
            <div class="text-xs text-gray-500">
              <Show when={isSaving()}>Saving...</Show>
              <Show when={!isSaving()}>
                Saved to <code class="bg-gray-700 rounded" style={{ padding: "0 4px" }}>.notemaker/config.yaml</code>
              </Show>
            </div>
            <button
              onClick={props.onClose}
              class="text-sm bg-blue-600 hover:bg-blue-700 rounded transition-colors"
              style={{ padding: "6px 16px" }}
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </Show>
  );
}

// Update function type
type UpdateFn = <K extends keyof VaultConfig>(
  section: K,
  key: keyof VaultConfig[K],
  value: VaultConfig[K][typeof key]
) => void;

// General Settings
function GeneralSettings(props: { config: VaultConfig; onUpdate: UpdateFn }) {
  return (
    <div style={{ display: "flex", "flex-direction": "column", gap: "24px" }}>
      <SettingGroup title="Vault Information">
        <SettingRow label="Vault Name" description="Display name for this vault">
          <input
            type="text"
            value={props.config.vault.name}
            onInput={(e) => props.onUpdate("vault", "name", e.currentTarget.value)}
            class="w-48 bg-gray-700 border border-gray-600 rounded text-sm text-gray-200"
            style={{ padding: "4px 8px" }}
          />
        </SettingRow>
        <SettingRow label="Created" description="When this vault was created">
          <span class="text-sm text-gray-400">
            {new Date(props.config.vault.created).toLocaleDateString()}
          </span>
        </SettingRow>
      </SettingGroup>

      <SettingGroup title="File Tree">
        <SettingRow label="Default Expanded" description="How to expand folders on load">
          <select
            value={props.config.file_tree?.default_expanded || "remember"}
            onChange={(e) => props.onUpdate("file_tree", "default_expanded", e.currentTarget.value)}
            class="bg-gray-700 border border-gray-600 rounded text-sm text-gray-200"
            style={{ padding: "4px 8px" }}
          >
            <option value="remember">Remember state</option>
            <option value="all">Expand all</option>
            <option value="none">Collapse all</option>
          </select>
        </SettingRow>
      </SettingGroup>
    </div>
  );
}

// Git Settings
function GitSettings(props: { config: VaultConfig; onUpdate: UpdateFn }) {
  return (
    <div style={{ display: "flex", "flex-direction": "column", gap: "24px" }}>
      <SettingGroup title="Git Integration">
        <SettingRow label="Enable Git" description="Enable Git version control for this vault">
          <Toggle
            checked={props.config.git.enabled}
            onChange={(v) => props.onUpdate("git", "enabled", v)}
          />
        </SettingRow>
      </SettingGroup>

      <SettingGroup title="Auto Commit">
        <SettingRow label="Enable Auto Commit" description="Automatically commit changes">
          <Toggle
            checked={props.config.git.auto_commit}
            onChange={(v) => props.onUpdate("git", "auto_commit", v)}
          />
        </SettingRow>
        <SettingRow label="Sync Interval" description="Minutes between auto commits">
          <select
            value={props.config.git.auto_sync_interval}
            onChange={(e) => props.onUpdate("git", "auto_sync_interval", parseInt(e.currentTarget.value))}
            class="bg-gray-700 border border-gray-600 rounded text-sm text-gray-200"
            style={{ padding: "4px 8px" }}
          >
            <option value={5}>5 minutes</option>
            <option value={15}>15 minutes</option>
            <option value={30}>30 minutes</option>
            <option value={60}>1 hour</option>
          </select>
        </SettingRow>
      </SettingGroup>

      <SettingGroup title="Repository">
        <SettingRow label="Remote Name" description="Git remote name (e.g. origin)">
          <input
            type="text"
            value={props.config.git.remote}
            onInput={(e) => props.onUpdate("git", "remote", e.currentTarget.value)}
            class="w-32 bg-gray-700 border border-gray-600 rounded text-sm text-gray-200"
            style={{ padding: "4px 8px" }}
            placeholder="origin"
          />
        </SettingRow>
        <SettingRow label="Branch" description="Default branch name">
          <input
            type="text"
            value={props.config.git.branch}
            onInput={(e) => props.onUpdate("git", "branch", e.currentTarget.value)}
            class="w-32 bg-gray-700 border border-gray-600 rounded text-sm text-gray-200"
            style={{ padding: "4px 8px" }}
            placeholder="main"
          />
        </SettingRow>
      </SettingGroup>
    </div>
  );
}

// Encryption Settings
function EncryptionSettings(props: { config: VaultConfig; onUpdate: UpdateFn }) {
  const [identityPath, setIdentityPath] = createSignal(props.config.encryption?.identity_file || "");
  const [recipients, setRecipients] = createSignal<Recipient[]>(props.config.encryption?.recipients || []);
  const [newRecipientName, setNewRecipientName] = createSignal("");
  const [newRecipientPath, setNewRecipientPath] = createSignal("");
  const [addingRecipient, setAddingRecipient] = createSignal(false);
  const [recipientError, setRecipientError] = createSignal<string | null>(null);
  const [ownIdentityPath, setOwnIdentityPath] = createSignal(props.config.encryption?.own_identity || "");
  const [ownPublicKey, setOwnPublicKey] = createSignal<string | null>(null);
  const [loadingOwnKey, setLoadingOwnKey] = createSignal(false);
  const [copyFeedback, setCopyFeedback] = createSignal(false);

  // Load own public key when identity path is set
  createEffect(async () => {
    const path = ownIdentityPath();
    if (path) {
      setLoadingOwnKey(true);
      try {
        const publicKey = await getPublicKeyFromIdentityFile(path);
        setOwnPublicKey(publicKey);
      } catch {
        setOwnPublicKey(null);
      } finally {
        setLoadingOwnKey(false);
      }
    } else {
      setOwnPublicKey(null);
    }
  });

  const handleBrowseIdentity = async () => {
    const file = await open({
      multiple: false,
      title: "Select Age Identity File",
    });
    if (file) {
      setIdentityPath(file);
      props.onUpdate("encryption", "identity_file", file);
    }
  };

  const handleBrowseOwnIdentity = async () => {
    const file = await open({
      multiple: false,
      title: "Select Your Age Identity File",
    });
    if (file) {
      setOwnIdentityPath(file);
      props.onUpdate("encryption", "own_identity", file);
    }
  };

  const handleCopyPublicKey = async () => {
    const key = ownPublicKey();
    if (key) {
      await navigator.clipboard.writeText(key);
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2000);
    }
  };

  const handleBrowseRecipientIdentity = async () => {
    const file = await open({
      multiple: false,
      title: "Select Age Identity File for Recipient",
    });
    if (file) {
      setNewRecipientPath(file);
    }
  };

  const handleAddRecipient = async () => {
    const name = newRecipientName().trim();
    const path = newRecipientPath().trim();

    if (!name) {
      setRecipientError("Name is required");
      return;
    }
    if (!path) {
      setRecipientError("Identity file path is required");
      return;
    }

    setAddingRecipient(true);
    setRecipientError(null);

    try {
      const publicKey = await getPublicKeyFromIdentityFile(path);

      const newRecipient: Recipient = {
        id: `recipient-${Date.now()}`,
        name,
        public_key: publicKey,
        identity_file: path,
        added_at: new Date().toISOString(),
      };

      const updatedRecipients = [...recipients(), newRecipient];
      setRecipients(updatedRecipients);
      props.onUpdate("encryption", "recipients", updatedRecipients);

      // Clear form
      setNewRecipientName("");
      setNewRecipientPath("");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setRecipientError(`Failed to add recipient: ${msg}`);
    } finally {
      setAddingRecipient(false);
    }
  };

  const handleRemoveRecipient = (id: string) => {
    const updatedRecipients = recipients().filter(r => r.id !== id);
    setRecipients(updatedRecipients);
    props.onUpdate("encryption", "recipients", updatedRecipients);
  };

  return (
    <div style={{ display: "flex", "flex-direction": "column", gap: "24px" }}>
      <SettingGroup title="Encryption">
        <SettingRow label="Enable Encryption" description="Allow encrypting notes and blocks in this vault">
          <Toggle
            checked={props.config.encryption?.enabled ?? false}
            onChange={(v) => props.onUpdate("encryption", "enabled", v)}
          />
        </SettingRow>
      </SettingGroup>

      <Show when={props.config.encryption?.enabled}>
        <SettingGroup title="Authentication Method">
          <SettingRow label="Method" description="How to authenticate for encryption">
            <select
              value={props.config.encryption?.method || "password"}
              onChange={(e) => props.onUpdate("encryption", "method", e.currentTarget.value as EncryptionMethod)}
              class="bg-gray-700 border border-gray-600 rounded text-sm text-gray-200"
              style={{ padding: "4px 8px" }}
            >
              <option value="password">Password</option>
              <option value="identityfile">Identity File</option>
              <option value="recipients">Multiple Recipients</option>
            </select>
          </SettingRow>

          <Show when={props.config.encryption?.method === "identityfile"}>
            <SettingRow label="Identity File" description="Path to your age identity file">
              <div class="flex" style={{ gap: "8px" }}>
                <input
                  type="text"
                  value={identityPath()}
                  onInput={(e) => {
                    setIdentityPath(e.currentTarget.value);
                    props.onUpdate("encryption", "identity_file", e.currentTarget.value);
                  }}
                  placeholder="~/.age/key.txt"
                  class="w-48 bg-gray-700 border border-gray-600 rounded text-sm text-gray-200"
                  style={{ padding: "4px 8px" }}
                />
                <button
                  onClick={handleBrowseIdentity}
                  class="text-sm bg-gray-700 border border-gray-600 hover:bg-gray-600 rounded transition-colors"
                  style={{ padding: "4px 12px" }}
                >
                  Browse
                </button>
              </div>
            </SettingRow>
          </Show>

          <Show when={props.config.encryption?.method === "recipients"}>
            {/* Your Identity section */}
            <SettingGroup title="Your Identity">
              <SettingRow label="Identity File" description="Your age identity file for decryption">
                <div class="flex" style={{ gap: "8px" }}>
                  <input
                    type="text"
                    value={ownIdentityPath()}
                    onInput={(e) => {
                      setOwnIdentityPath(e.currentTarget.value);
                      props.onUpdate("encryption", "own_identity", e.currentTarget.value);
                    }}
                    placeholder="~/.age/notemaker.txt"
                    class="w-48 bg-gray-700 border border-gray-600 rounded text-sm text-gray-200"
                    style={{ padding: "4px 8px" }}
                  />
                  <button
                    onClick={handleBrowseOwnIdentity}
                    class="text-sm bg-gray-700 border border-gray-600 hover:bg-gray-600 rounded transition-colors"
                    style={{ padding: "4px 12px" }}
                  >
                    Browse
                  </button>
                </div>
              </SettingRow>

              <Show when={ownPublicKey()}>
                <div style={{ "margin-top": "12px" }}>
                  <div class="text-xs text-gray-400" style={{ "margin-bottom": "4px" }}>Your Public Key</div>
                  <div class="flex items-center" style={{ gap: "8px" }}>
                    <code
                      class="flex-1 bg-gray-700 border border-gray-600 rounded text-xs text-gray-300 font-mono overflow-hidden text-ellipsis whitespace-nowrap"
                      style={{ padding: "8px 12px" }}
                    >
                      {ownPublicKey()}
                    </code>
                    <button
                      onClick={handleCopyPublicKey}
                      class="text-sm bg-gray-700 border border-gray-600 hover:bg-gray-600 rounded transition-colors flex items-center"
                      style={{ padding: "6px 12px", gap: "4px" }}
                      title="Copy to clipboard"
                    >
                      <Show when={copyFeedback()} fallback={
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                          <path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25Z" />
                          <path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z" />
                        </svg>
                      }>
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" class="text-green-400">
                          <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z" />
                        </svg>
                      </Show>
                      <span>{copyFeedback() ? "Copied!" : "Copy"}</span>
                    </button>
                  </div>
                  <div class="text-xs text-gray-500" style={{ "margin-top": "8px" }}>
                    Share this key with collaborators so they can encrypt notes for you.
                  </div>
                </div>
              </Show>

              <Show when={loadingOwnKey()}>
                <div class="text-xs text-gray-500">Loading public key...</div>
              </Show>
            </SettingGroup>

            <div style={{ "margin-top": "16px" }}>
              <div class="text-sm text-gray-300 font-medium" style={{ "margin-bottom": "12px" }}>
                Recipients ({recipients().length})
              </div>

              {/* Existing recipients */}
              <div style={{ display: "flex", "flex-direction": "column", gap: "8px", "margin-bottom": "16px" }}>
                <For each={recipients()}>
                  {(recipient) => (
                    <div class="bg-gray-700/50 border border-gray-600 rounded-lg" style={{ padding: "12px" }}>
                      <div class="flex items-center justify-between">
                        <div>
                          <div class="text-sm font-medium text-gray-200">{recipient.name}</div>
                          <div class="text-xs text-gray-500 font-mono" style={{ "margin-top": "4px" }}>
                            {recipient.public_key.substring(0, 20)}...
                          </div>
                          <Show when={recipient.identity_file}>
                            <div class="text-xs text-gray-500" style={{ "margin-top": "2px" }}>
                              {recipient.identity_file}
                            </div>
                          </Show>
                        </div>
                        <button
                          onClick={() => handleRemoveRecipient(recipient.id)}
                          class="p-1.5 text-gray-400 hover:text-red-400 hover:bg-gray-600 rounded transition-colors"
                          title="Remove recipient"
                        >
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                            <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.75.75 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 0 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06z" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  )}
                </For>

                <Show when={recipients().length === 0}>
                  <div class="text-sm text-gray-500 text-center" style={{ padding: "16px" }}>
                    No recipients added yet
                  </div>
                </Show>
              </div>

              {/* Add recipient form */}
              <div class="bg-gray-700/30 border border-gray-600 rounded-lg" style={{ padding: "16px" }}>
                <div class="text-sm text-gray-300 font-medium" style={{ "margin-bottom": "12px" }}>
                  Add Recipient
                </div>

                <div style={{ display: "flex", "flex-direction": "column", gap: "12px" }}>
                  <div>
                    <label class="block text-xs text-gray-400" style={{ "margin-bottom": "4px" }}>Name</label>
                    <input
                      type="text"
                      value={newRecipientName()}
                      onInput={(e) => setNewRecipientName(e.currentTarget.value)}
                      placeholder="e.g., Work Laptop"
                      class="w-full bg-gray-700 border border-gray-600 rounded text-sm text-gray-200"
                      style={{ padding: "6px 10px" }}
                    />
                  </div>

                  <div>
                    <label class="block text-xs text-gray-400" style={{ "margin-bottom": "4px" }}>Identity File</label>
                    <div class="flex" style={{ gap: "8px" }}>
                      <input
                        type="text"
                        value={newRecipientPath()}
                        onInput={(e) => setNewRecipientPath(e.currentTarget.value)}
                        placeholder="~/.age/key.txt"
                        class="flex-1 bg-gray-700 border border-gray-600 rounded text-sm text-gray-200"
                        style={{ padding: "6px 10px" }}
                      />
                      <button
                        onClick={handleBrowseRecipientIdentity}
                        class="text-sm bg-gray-700 border border-gray-600 hover:bg-gray-600 rounded transition-colors"
                        style={{ padding: "6px 12px" }}
                      >
                        Browse
                      </button>
                    </div>
                  </div>

                  <Show when={recipientError()}>
                    <div class="text-sm text-red-400">{recipientError()}</div>
                  </Show>

                  <button
                    onClick={handleAddRecipient}
                    disabled={addingRecipient() || !newRecipientName().trim() || !newRecipientPath().trim()}
                    class="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed rounded text-sm font-medium transition-colors"
                    style={{ padding: "8px 16px" }}
                  >
                    {addingRecipient() ? "Adding..." : "Add Recipient"}
                  </button>
                </div>

                <div class="text-xs text-gray-500" style={{ "margin-top": "12px" }}>
                  Generate a new key with: <code class="bg-gray-700 rounded" style={{ padding: "0 4px" }}>age-keygen -o key.txt</code>
                </div>
              </div>
            </div>
          </Show>
        </SettingGroup>

        <SettingGroup title="About Encryption">
          <div class="text-sm text-gray-400" style={{ display: "flex", "flex-direction": "column", gap: "8px" }}>
            <p>
              This vault uses the <span class="text-gray-200">age</span> encryption format.
            </p>
            <p>
              <strong class="text-gray-300">Password:</strong> Uses scrypt key derivation. Simple but requires sharing password.
            </p>
            <p>
              <strong class="text-gray-300">Identity File:</strong> Uses age X25519 keys. More secure, single user.
            </p>
            <p>
              <strong class="text-gray-300">Multiple Recipients:</strong> Encrypt for multiple keys. Each recipient can decrypt with their own key.
            </p>
            <p class="text-xs text-gray-500">
              Generate keys with: <code class="bg-gray-700 rounded" style={{ padding: "0 4px" }}>age-keygen -o key.txt</code>
            </p>
          </div>
        </SettingGroup>
      </Show>
    </div>
  );
}

// Interpreter Settings
function InterpreterSettingsTab(props: { config: VaultConfig; onUpdate: UpdateFn }) {
  return (
    <div style={{ display: "flex", "flex-direction": "column", gap: "24px" }}>
      <SettingGroup title="Code Block Interpreters">
        <div class="text-sm text-gray-400" style={{ "margin-bottom": "8px" }}>
          Configure paths to interpreters for executing code blocks in notebooks.
          Leave empty to use system default.
        </div>

        <SettingRow label="Shell" description="Default: bash">
          <input
            type="text"
            value={props.config.interpreters?.shell || ""}
            onInput={(e) => props.onUpdate("interpreters", "shell", e.currentTarget.value || undefined)}
            placeholder="/bin/bash"
            class="w-48 bg-gray-700 border border-gray-600 rounded text-sm text-gray-200 font-mono"
            style={{ padding: "4px 8px" }}
          />
        </SettingRow>

        <SettingRow label="Python" description="Default: python3">
          <input
            type="text"
            value={props.config.interpreters?.python || ""}
            onInput={(e) => props.onUpdate("interpreters", "python", e.currentTarget.value || undefined)}
            placeholder="/usr/bin/python3"
            class="w-48 bg-gray-700 border border-gray-600 rounded text-sm text-gray-200 font-mono"
            style={{ padding: "4px 8px" }}
          />
        </SettingRow>

        <SettingRow label="Ruby" description="Default: ruby">
          <input
            type="text"
            value={props.config.interpreters?.ruby || ""}
            onInput={(e) => props.onUpdate("interpreters", "ruby", e.currentTarget.value || undefined)}
            placeholder="/usr/bin/ruby"
            class="w-48 bg-gray-700 border border-gray-600 rounded text-sm text-gray-200 font-mono"
            style={{ padding: "4px 8px" }}
          />
        </SettingRow>

        <SettingRow label="Node.js" description="Default: node">
          <input
            type="text"
            value={props.config.interpreters?.node || ""}
            onInput={(e) => props.onUpdate("interpreters", "node", e.currentTarget.value || undefined)}
            placeholder="/usr/bin/node"
            class="w-48 bg-gray-700 border border-gray-600 rounded text-sm text-gray-200 font-mono"
            style={{ padding: "4px 8px" }}
          />
        </SettingRow>
      </SettingGroup>

      <SettingGroup title="Environment">
        <div class="text-sm text-gray-400" style={{ display: "flex", "flex-direction": "column", gap: "8px" }}>
          <p>
            Code blocks run in the notebook's directory with these interpreters.
          </p>
          <p>
            <strong class="text-gray-300">Tips:</strong>
          </p>
          <ul class="list-disc list-inside text-xs" style={{ "margin-left": "8px" }}>
            <li>Use absolute paths for virtual environments</li>
            <li>Python: <code class="bg-gray-700 rounded" style={{ padding: "0 4px" }}>/path/to/venv/bin/python</code></li>
            <li>nvm Node.js: <code class="bg-gray-700 rounded" style={{ padding: "0 4px" }}>~/.nvm/versions/node/v20.0.0/bin/node</code></li>
          </ul>
        </div>
      </SettingGroup>
    </div>
  );
}

// Reusable components
function SettingGroup(props: { title: string; children: any }) {
  return (
    <div>
      <h3 class="text-sm font-medium text-gray-300" style={{ "margin-bottom": "12px" }}>{props.title}</h3>
      <div style={{ display: "flex", "flex-direction": "column", gap: "16px" }}>{props.children}</div>
    </div>
  );
}

function SettingRow(props: { label: string; description: string; children: any }) {
  return (
    <div class="flex items-center justify-between">
      <div>
        <div class="text-sm text-gray-200">{props.label}</div>
        <div class="text-xs text-gray-500">{props.description}</div>
      </div>
      {props.children}
    </div>
  );
}

function Toggle(props: { checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <button
      onClick={() => props.onChange(!props.checked)}
      class={`relative w-10 h-5 rounded-full transition-colors ${
        props.checked ? "bg-blue-600" : "bg-gray-600"
      }`}
    >
      <div
        class={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
          props.checked ? "translate-x-5" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

export default VaultSettingsDialog;
