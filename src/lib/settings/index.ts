/**
 * Settings management
 */

import { createSignal } from "solid-js";

export interface AppSettings {
  // Editor
  editor: {
    fontSize: number;
    fontFamily: string;
    lineHeight: number;
    tabSize: number;
    wordWrap: boolean;
    lineNumbers: boolean;
    vimMode: boolean;
    inlineMarkdown: boolean;
  };

  // Appearance
  appearance: {
    theme: "dark" | "light" | "system";
    sidebarWidth: number;
    showToc: boolean;
    showBacklinks: boolean;
    previewFontSize: number;
    previewLineHeight: number;
    editorMaxWidth: number; // 0 = unlimited
  };

  // Autosave
  autosave: {
    enabled: boolean;
    delay: number; // ms
  };
}

const SETTINGS_KEY = "notemaker:settings";

const DEFAULT_SETTINGS: AppSettings = {
  editor: {
    fontSize: 14,
    fontFamily: "JetBrains Mono, Menlo, Monaco, monospace",
    lineHeight: 1.6,
    tabSize: 2,
    wordWrap: true,
    lineNumbers: true,
    vimMode: false,
    inlineMarkdown: false,
  },
  appearance: {
    theme: "dark",
    sidebarWidth: 256,
    showToc: true,
    showBacklinks: true,
    previewFontSize: 16,
    previewLineHeight: 1.7,
    editorMaxWidth: 0, // 0 = unlimited
  },
  autosave: {
    enabled: true,
    delay: 1000,
  },
};

/**
 * Load settings from localStorage
 */
export function loadSettings(): AppSettings {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Deep merge with defaults to handle new settings
      return deepMerge(DEFAULT_SETTINGS, parsed);
    }
  } catch (e) {
    console.error("Failed to load settings:", e);
  }
  return { ...DEFAULT_SETTINGS };
}

/**
 * Save settings to localStorage
 */
export function saveSettings(settings: AppSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error("Failed to save settings:", e);
  }
}

/**
 * Deep merge objects
 */
function deepMerge(target: AppSettings, source: Partial<AppSettings>): AppSettings {
  return {
    editor: { ...target.editor, ...source.editor },
    appearance: { ...target.appearance, ...source.appearance },
    autosave: { ...target.autosave, ...source.autosave },
  };
}

/**
 * Settings store with reactivity
 */
class SettingsStore {
  private settings: AppSettings;
  private listeners = new Set<() => void>();

  constructor() {
    this.settings = loadSettings();
  }

  get(): AppSettings {
    return this.settings;
  }

  set<K extends keyof AppSettings>(
    category: K,
    key: keyof AppSettings[K],
    value: AppSettings[K][typeof key]
  ): void {
    (this.settings[category] as Record<string, unknown>)[key as string] = value;
    saveSettings(this.settings);
    this.notifyListeners();
  }

  update(updates: Partial<AppSettings>): void {
    this.settings = deepMerge(this.settings, updates);
    saveSettings(this.settings);
    this.notifyListeners();
  }

  reset(): void {
    this.settings = { ...DEFAULT_SETTINGS };
    saveSettings(this.settings);
    this.notifyListeners();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }
}

// Singleton instance
export const settingsStore = new SettingsStore();

/**
 * Reactive hook for settings
 */
export function useSettings() {
  const [settings, setSettings] = createSignal<AppSettings>(settingsStore.get());

  settingsStore.subscribe(() => {
    setSettings(settingsStore.get());
  });

  return {
    settings,
    set: settingsStore.set.bind(settingsStore),
    update: settingsStore.update.bind(settingsStore),
    reset: settingsStore.reset.bind(settingsStore),
  };
}

export { DEFAULT_SETTINGS };

/**
 * Get effective theme based on setting and system preference
 */
function getEffectiveTheme(themeSetting: "dark" | "light" | "system"): "dark" | "light" {
  if (themeSetting === "system") {
    return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  }
  return themeSetting;
}

/**
 * Apply theme to document
 */
function applyTheme(theme: "dark" | "light"): void {
  document.documentElement.setAttribute("data-theme", theme);
}

/**
 * Apply settings to CSS variables
 */
export function applySettingsToCSS(settings: AppSettings): void {
  const root = document.documentElement;

  // Editor settings
  root.style.setProperty("--editor-font-size", `${settings.editor.fontSize}px`);
  root.style.setProperty("--editor-line-height", String(settings.editor.lineHeight));

  // Appearance settings
  root.style.setProperty("--preview-font-size", `${settings.appearance.previewFontSize}px`);
  root.style.setProperty("--preview-line-height", String(settings.appearance.previewLineHeight));

  if (settings.appearance.editorMaxWidth > 0) {
    root.style.setProperty("--editor-max-width", `${settings.appearance.editorMaxWidth}px`);
  } else {
    root.style.setProperty("--editor-max-width", "100%");
  }

  // Apply theme
  const effectiveTheme = getEffectiveTheme(settings.appearance.theme);
  applyTheme(effectiveTheme);
}

/**
 * Initialize settings and apply CSS variables
 */
export function initializeSettings(): void {
  const settings = settingsStore.get();
  applySettingsToCSS(settings);

  // Re-apply when settings change
  settingsStore.subscribe(() => {
    applySettingsToCSS(settingsStore.get());
  });

  // Listen for system theme changes
  const mediaQuery = window.matchMedia("(prefers-color-scheme: light)");
  mediaQuery.addEventListener("change", () => {
    const currentSettings = settingsStore.get();
    if (currentSettings.appearance.theme === "system") {
      applySettingsToCSS(currentSettings);
    }
  });
}
