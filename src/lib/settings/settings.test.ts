/**
 * Settings store tests
 */

import { describe, it, expect, beforeEach } from "vitest";
import { loadSettings, saveSettings, settingsStore, DEFAULT_SETTINGS } from "./index";

describe("Settings", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe("loadSettings", () => {
    it("returns default settings when localStorage is empty", () => {
      const settings = loadSettings();
      expect(settings).toEqual(DEFAULT_SETTINGS);
    });

    it("loads saved settings from localStorage", () => {
      const customSettings = {
        ...DEFAULT_SETTINGS,
        editor: { ...DEFAULT_SETTINGS.editor, fontSize: 18 },
      };
      localStorage.setItem("notemaker:settings", JSON.stringify(customSettings));

      const settings = loadSettings();
      expect(settings.editor.fontSize).toBe(18);
    });

    it("merges with defaults for missing properties", () => {
      // Save partial settings (missing some properties)
      const partialSettings = {
        editor: { fontSize: 16 },
      };
      localStorage.setItem("notemaker:settings", JSON.stringify(partialSettings));

      const settings = loadSettings();
      // Should have custom fontSize
      expect(settings.editor.fontSize).toBe(16);
      // Should have default for missing properties
      expect(settings.editor.lineHeight).toBe(DEFAULT_SETTINGS.editor.lineHeight);
      expect(settings.appearance.theme).toBe(DEFAULT_SETTINGS.appearance.theme);
    });
  });

  describe("saveSettings", () => {
    it("saves settings to localStorage", () => {
      const settings = { ...DEFAULT_SETTINGS };
      settings.editor.fontSize = 20;

      saveSettings(settings);

      const stored = JSON.parse(localStorage.getItem("notemaker:settings") || "{}");
      expect(stored.editor.fontSize).toBe(20);
    });
  });

  describe("settingsStore", () => {
    it("gets current settings", () => {
      const settings = settingsStore.get();
      expect(settings).toBeDefined();
      expect(settings.editor).toBeDefined();
      expect(settings.appearance).toBeDefined();
      expect(settings.autosave).toBeDefined();
    });

    it("updates individual setting", () => {
      settingsStore.set("editor", "fontSize", 22);

      const settings = settingsStore.get();
      expect(settings.editor.fontSize).toBe(22);
    });

    it("persists changes to localStorage", () => {
      settingsStore.set("appearance", "theme", "light");

      const stored = JSON.parse(localStorage.getItem("notemaker:settings") || "{}");
      expect(stored.appearance.theme).toBe("light");
    });

    it("resets to default settings", () => {
      settingsStore.set("editor", "fontSize", 30);
      settingsStore.reset();

      const settings = settingsStore.get();
      expect(settings.editor.fontSize).toBe(DEFAULT_SETTINGS.editor.fontSize);
    });

    it("notifies subscribers on change", () => {
      let notified = false;
      const unsubscribe = settingsStore.subscribe(() => {
        notified = true;
      });

      settingsStore.set("editor", "vimMode", true);

      expect(notified).toBe(true);
      unsubscribe();
    });
  });

  describe("theme settings", () => {
    it("supports dark theme", () => {
      settingsStore.set("appearance", "theme", "dark");
      expect(settingsStore.get().appearance.theme).toBe("dark");
    });

    it("supports light theme", () => {
      settingsStore.set("appearance", "theme", "light");
      expect(settingsStore.get().appearance.theme).toBe("light");
    });

    it("supports system theme", () => {
      settingsStore.set("appearance", "theme", "system");
      expect(settingsStore.get().appearance.theme).toBe("system");
    });
  });
});
