/**
 * Settings Panel - Application configuration UI
 *
 * This panel contains GLOBAL application settings that apply across all vaults.
 * For vault-specific settings (Git, Encryption config), use VaultSettingsDialog.
 */

import { createSignal, For, Show } from "solid-js";
import { settingsStore, AppSettings } from "../lib/settings";

export interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

type SettingsTab = "editor" | "appearance" | "autosave";

const TABS: { id: SettingsTab; label: string }[] = [
  { id: "editor", label: "Editor" },
  { id: "appearance", label: "Appearance" },
  { id: "autosave", label: "Autosave" },
];

// Deep clone settings to trigger SolidJS reactivity
const cloneSettings = (s: AppSettings): AppSettings => ({
  editor: { ...s.editor },
  appearance: { ...s.appearance },
  autosave: { ...s.autosave },
});

export function SettingsPanel(props: SettingsPanelProps) {
  const [activeTab, setActiveTab] = createSignal<SettingsTab>("editor");
  const [settings, setSettings] = createSignal<AppSettings>(cloneSettings(settingsStore.get()));

  // Update a setting
  const updateSetting = <K extends keyof AppSettings>(
    category: K,
    key: keyof AppSettings[K],
    value: AppSettings[K][typeof key]
  ) => {
    settingsStore.set(category, key, value);
    setSettings(cloneSettings(settingsStore.get()));
  };

  // Reset to defaults
  const handleReset = () => {
    if (confirm("Reset all settings to defaults?")) {
      settingsStore.reset();
      setSettings(cloneSettings(settingsStore.get()));
    }
  };

  // Handle escape key
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      props.onClose();
    }
  };

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
            <h2 class="text-lg font-medium text-gray-100">Settings</h2>
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
              <For each={TABS}>
                {(tab) => (
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
                )}
              </For>
            </nav>

            {/* Settings content */}
            <div class="flex-1 overflow-y-auto" style={{ padding: "24px" }}>
              <Show when={activeTab() === "editor"}>
                <EditorSettings settings={settings()} onUpdate={updateSetting} />
              </Show>
              <Show when={activeTab() === "appearance"}>
                <AppearanceSettings settings={settings()} onUpdate={updateSetting} />
              </Show>
              <Show when={activeTab() === "autosave"}>
                <AutosaveSettings settings={settings()} onUpdate={updateSetting} />
              </Show>
            </div>
          </div>

          {/* Footer */}
          <div class="flex justify-between border-t border-gray-700" style={{ padding: "16px 24px" }}>
            <button
              onClick={handleReset}
              class="text-sm text-gray-400 hover:text-gray-200 transition-colors"
              style={{ padding: "6px 12px" }}
            >
              Reset to Defaults
            </button>
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

// Setting update function type
type UpdateFn = <K extends keyof AppSettings>(
  category: K,
  key: keyof AppSettings[K],
  value: AppSettings[K][typeof key]
) => void;

// Editor Settings
function EditorSettings(props: { settings: AppSettings; onUpdate: UpdateFn }) {
  return (
    <div style={{ display: "flex", "flex-direction": "column", gap: "24px" }}>
      <SettingGroup title="Font">
        <SettingRow label="Font Size" description="Editor font size in pixels">
          <input
            type="number"
            value={props.settings.editor.fontSize}
            onInput={(e) => props.onUpdate("editor", "fontSize", parseInt(e.currentTarget.value) || 14)}
            min={10}
            max={32}
            class="w-20 bg-gray-700 border border-gray-600 rounded text-sm text-gray-200"
            style={{ padding: "4px 8px" }}
          />
        </SettingRow>
        <SettingRow label="Line Height" description="Line height multiplier">
          <input
            type="number"
            value={props.settings.editor.lineHeight}
            onInput={(e) => props.onUpdate("editor", "lineHeight", parseFloat(e.currentTarget.value) || 1.6)}
            min={1}
            max={3}
            step={0.1}
            class="w-20 bg-gray-700 border border-gray-600 rounded text-sm text-gray-200"
            style={{ padding: "4px 8px" }}
          />
        </SettingRow>
        <SettingRow label="Tab Size" description="Number of spaces per tab">
          <select
            value={props.settings.editor.tabSize}
            onChange={(e) => props.onUpdate("editor", "tabSize", parseInt(e.currentTarget.value))}
            class="bg-gray-700 border border-gray-600 rounded text-sm text-gray-200"
            style={{ padding: "4px 8px" }}
          >
            <option value={2}>2 spaces</option>
            <option value={4}>4 spaces</option>
            <option value={8}>8 spaces</option>
          </select>
        </SettingRow>
      </SettingGroup>

      <SettingGroup title="Display">
        <SettingRow label="Word Wrap" description="Wrap long lines">
          <Toggle
            checked={props.settings.editor.wordWrap}
            onChange={(v) => props.onUpdate("editor", "wordWrap", v)}
          />
        </SettingRow>
        <SettingRow label="Line Numbers" description="Show line numbers">
          <Toggle
            checked={props.settings.editor.lineNumbers}
            onChange={(v) => props.onUpdate("editor", "lineNumbers", v)}
          />
        </SettingRow>
        <SettingRow label="Vim Mode" description="Enable Vim keybindings">
          <Toggle
            checked={props.settings.editor.vimMode}
            onChange={(v) => props.onUpdate("editor", "vimMode", v)}
          />
        </SettingRow>
        <SettingRow label="Inline Markdown" description="Render headers, bold, italic, links inline while editing">
          <Toggle
            checked={props.settings.editor.inlineMarkdown}
            onChange={(v) => props.onUpdate("editor", "inlineMarkdown", v)}
          />
        </SettingRow>
      </SettingGroup>
    </div>
  );
}

// Appearance Settings
function AppearanceSettings(props: { settings: AppSettings; onUpdate: UpdateFn }) {
  return (
    <div style={{ display: "flex", "flex-direction": "column", gap: "24px" }}>
      <SettingGroup title="Theme">
        <SettingRow label="Color Theme" description="Application color scheme">
          <select
            value={props.settings.appearance.theme}
            onChange={(e) => props.onUpdate("appearance", "theme", e.currentTarget.value as "dark" | "light" | "system")}
            class="bg-gray-700 border border-gray-600 rounded text-sm text-gray-200"
            style={{ padding: "4px 8px" }}
          >
            <option value="dark">Dark</option>
            <option value="light">Light</option>
            <option value="system">System</option>
          </select>
        </SettingRow>
      </SettingGroup>

      <SettingGroup title="Panels">
        <SettingRow label="Show Table of Contents" description="Display TOC in sidebar">
          <Toggle
            checked={props.settings.appearance.showToc}
            onChange={(v) => props.onUpdate("appearance", "showToc", v)}
          />
        </SettingRow>
        <SettingRow label="Show Backlinks" description="Display backlinks panel">
          <Toggle
            checked={props.settings.appearance.showBacklinks}
            onChange={(v) => props.onUpdate("appearance", "showBacklinks", v)}
          />
        </SettingRow>
      </SettingGroup>
    </div>
  );
}

// Autosave Settings
function AutosaveSettings(props: { settings: AppSettings; onUpdate: UpdateFn }) {
  return (
    <div style={{ display: "flex", "flex-direction": "column", gap: "24px" }}>
      <SettingGroup title="Autosave">
        <SettingRow label="Enable Autosave" description="Automatically save changes">
          <Toggle
            checked={props.settings.autosave.enabled}
            onChange={(v) => props.onUpdate("autosave", "enabled", v)}
          />
        </SettingRow>
        <SettingRow label="Delay" description="Milliseconds to wait before saving">
          <select
            value={props.settings.autosave.delay}
            onChange={(e) => props.onUpdate("autosave", "delay", parseInt(e.currentTarget.value))}
            class="bg-gray-700 border border-gray-600 rounded text-sm text-gray-200"
            style={{ padding: "4px 8px" }}
          >
            <option value={500}>500ms</option>
            <option value={1000}>1 second</option>
            <option value={2000}>2 seconds</option>
            <option value={5000}>5 seconds</option>
          </select>
        </SettingRow>
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

export default SettingsPanel;
