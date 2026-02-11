/**
 * Command definitions and registration
 */

import { commandRegistry } from "./registry";
import { vaultStore } from "../store/vault";
import { recentVaultsStore } from "../store/recentVaults";
import { settingsStore } from "../settings";
import { gitInit } from "../git";
import { convertNoteToNotebook, hasCodeBlocks } from "../convert";
import { getCurrentWindow } from "@tauri-apps/api/window";

// UI state callbacks (will be set by App component)
let openCommandPalette: (() => void) | null = null;
let openQuickOpen: (() => void) | null = null;
let openSearchPanel: (() => void) | null = null;
let openVaultDialog: (() => void) | null = null;
let openNewNoteDialog: (() => void) | null = null;
let toggleSidebar: (() => void) | null = null;
let toggleVimMode: (() => void) | null = null;
let openExportDialog: (() => void) | null = null;
let openShortcutsHelp: (() => void) | null = null;
let openNewNotebookDialog: (() => void) | null = null;
let openGitPanel: (() => void) | null = null;
let openTemplateDialog: (() => void) | null = null;
let openSettingsPanel: (() => void) | null = null;
let openVaultSettingsDialog: (() => void) | null = null;

export function setUICallbacks(callbacks: {
  openCommandPalette?: () => void;
  openQuickOpen?: () => void;
  openSearchPanel?: () => void;
  openVaultDialog?: () => void;
  openNewNoteDialog?: () => void;
  toggleSidebar?: () => void;
  toggleVimMode?: () => void;
  openExportDialog?: () => void;
  openShortcutsHelp?: () => void;
  openNewNotebookDialog?: () => void;
  openGitPanel?: () => void;
  openTemplateDialog?: () => void;
  openSettingsPanel?: () => void;
  openVaultSettingsDialog?: () => void;
}) {
  openCommandPalette = callbacks.openCommandPalette || null;
  openQuickOpen = callbacks.openQuickOpen || null;
  openSearchPanel = callbacks.openSearchPanel || null;
  openVaultDialog = callbacks.openVaultDialog || null;
  openNewNoteDialog = callbacks.openNewNoteDialog || null;
  toggleSidebar = callbacks.toggleSidebar || null;
  toggleVimMode = callbacks.toggleVimMode || null;
  openExportDialog = callbacks.openExportDialog || null;
  openShortcutsHelp = callbacks.openShortcutsHelp || null;
  openNewNotebookDialog = callbacks.openNewNotebookDialog || null;
  openGitPanel = callbacks.openGitPanel || null;
  openTemplateDialog = callbacks.openTemplateDialog || null;
  openSettingsPanel = callbacks.openSettingsPanel || null;
  openVaultSettingsDialog = callbacks.openVaultSettingsDialog || null;
}

// Refresh recent vault commands (call when vaults list changes)
export function refreshRecentVaultCommands(): void {
  // Remove existing recent vault commands
  const allCommands = commandRegistry.getAll();
  for (const cmd of allCommands) {
    if (cmd.id.startsWith("vault.switch.")) {
      commandRegistry.unregister(cmd.id);
    }
  }

  // Add commands for each recent vault (excluding current)
  const currentPath = vaultStore.vault()?.path;
  const recentVaults = recentVaultsStore.getOtherVaults(currentPath);

  for (const vault of recentVaults) {
    commandRegistry.register({
      id: `vault.switch.${vault.path}`,
      label: `Switch to: ${vault.name}`,
      category: "File",
      action: async () => {
        await vaultStore.closeVault();
        await vaultStore.openVault(vault.path);
        // Refresh commands after switch
        refreshRecentVaultCommands();
      },
    });
  }
}

// Register all commands
export function registerCommands() {
  // Command Palette
  commandRegistry.register({
    id: "command-palette.open",
    label: "Open Command Palette",
    category: "View",
    shortcut: "Cmd+K",
    action: () => openCommandPalette?.(),
  });

  // Quick Open
  commandRegistry.register({
    id: "quick-open.open",
    label: "Quick Open",
    category: "View",
    shortcut: "Cmd+P",
    action: () => openQuickOpen?.(),
  });

  // File commands
  commandRegistry.register({
    id: "note.new",
    label: "New Note",
    category: "File",
    shortcut: "Cmd+N",
    action: () => openNewNoteDialog?.(),
  });

  commandRegistry.register({
    id: "notebook.new",
    label: "New Notebook",
    category: "File",
    shortcut: "Cmd+Shift+N",
    action: () => openNewNotebookDialog?.(),
  });

  commandRegistry.register({
    id: "template.new",
    label: "New from Template",
    category: "File",
    shortcut: "Cmd+Shift+T",
    action: () => openTemplateDialog?.(),
  });

  commandRegistry.register({
    id: "note.convertToNotebook",
    label: "Convert to Notebook",
    category: "File",
    action: async () => {
      const note = vaultStore.currentNote();
      const path = vaultStore.selectedPath();
      if (!note || !path) {
        console.log("No note selected");
        return;
      }

      // Check if note has code blocks
      if (!hasCodeBlocks(note.content)) {
        console.log("Note has no code blocks to convert");
        return;
      }

      try {
        // Save any pending changes first
        await vaultStore.saveCurrentNote();

        // Convert the note to notebook
        await convertNoteToNotebook(path, note.content);

        // Refresh the tree to show the new notebook
        await vaultStore.refreshTree();

        // Select the newly created notebook
        await vaultStore.selectNote(path);
      } catch (err) {
        console.error("Failed to convert note to notebook:", err);
      }
    },
  });

  commandRegistry.register({
    id: "note.save",
    label: "Save Note",
    category: "File",
    shortcut: "Cmd+S",
    action: async () => {
      await vaultStore.saveCurrentNote();
    },
  });

  commandRegistry.register({
    id: "note.close",
    label: "Close Note",
    category: "File",
    shortcut: "Cmd+W",
    action: async () => {
      // Save before closing
      await vaultStore.saveCurrentNote();
      // Clear selection
      vaultStore.clearSelection();
    },
  });

  commandRegistry.register({
    id: "app.quit",
    label: "Quit Notemaker",
    category: "File",
    shortcut: "Cmd+Q",
    action: async () => {
      // Save before quitting
      await vaultStore.saveCurrentNote();
      // Close the main window (quits the app)
      await getCurrentWindow().close();
    },
  });

  commandRegistry.register({
    id: "vault.open",
    label: "Open Vault",
    category: "File",
    shortcut: "Cmd+Shift+O",
    action: () => openVaultDialog?.(),
  });

  commandRegistry.register({
    id: "vault.close",
    label: "Close Vault",
    category: "File",
    action: async () => {
      await vaultStore.closeVault();
    },
  });

  // Register initial recent vault commands
  refreshRecentVaultCommands();

  commandRegistry.register({
    id: "note.export",
    label: "Export Note",
    category: "File",
    action: () => openExportDialog?.(),
  });

  commandRegistry.register({
    id: "vault.refresh",
    label: "Refresh File Tree",
    category: "File",
    action: async () => {
      await vaultStore.refreshTree();
    },
  });

  // View commands
  commandRegistry.register({
    id: "sidebar.toggle",
    label: "Toggle Sidebar",
    category: "View",
    shortcut: "Cmd+\\",
    action: () => toggleSidebar?.(),
  });

  commandRegistry.register({
    id: "sidebar.focus",
    label: "Focus Sidebar",
    category: "View",
    shortcut: "Cmd+Shift+E",
    action: () => {
      const sidebar = document.querySelector('[data-focus-zone="sidebar"]');
      if (sidebar instanceof HTMLElement) {
        sidebar.focus();
      }
    },
  });

  // Editor commands
  commandRegistry.register({
    id: "edit.undo",
    label: "Undo",
    category: "Edit",
    shortcut: "Cmd+Z",
    action: () => {
      // Handled by CodeMirror
      document.execCommand("undo");
    },
  });

  commandRegistry.register({
    id: "edit.redo",
    label: "Redo",
    category: "Edit",
    shortcut: "Cmd+Shift+Z",
    action: () => {
      // Handled by CodeMirror
      document.execCommand("redo");
    },
  });

  // Search commands
  commandRegistry.register({
    id: "search.global",
    label: "Search in All Notes",
    category: "Search",
    shortcut: "Cmd+Shift+F",
    action: () => openSearchPanel?.(),
  });

  commandRegistry.register({
    id: "search.find",
    label: "Find in Note",
    category: "Search",
    shortcut: "Cmd+F",
    action: () => {
      // Handled by CodeMirror
    },
  });

  commandRegistry.register({
    id: "search.replace",
    label: "Find and Replace",
    category: "Search",
    shortcut: "Cmd+H",
    action: () => {
      // Handled by CodeMirror
    },
  });

  // Format commands
  commandRegistry.register({
    id: "format.bold",
    label: "Bold",
    category: "Format",
    shortcut: "Cmd+B",
    action: () => {
      // TODO: Implement markdown formatting
    },
  });

  commandRegistry.register({
    id: "format.italic",
    label: "Italic",
    category: "Format",
    shortcut: "Cmd+I",
    action: () => {
      // TODO: Implement markdown formatting
    },
  });

  commandRegistry.register({
    id: "format.code",
    label: "Inline Code",
    category: "Format",
    shortcut: "Cmd+`",
    action: () => {
      // TODO: Implement markdown formatting
    },
  });

  commandRegistry.register({
    id: "format.link",
    label: "Insert Link",
    category: "Format",
    // No shortcut - Cmd+K is used for command palette
    action: () => {
      // TODO: Implement markdown formatting
    },
  });

  // Editor mode commands
  commandRegistry.register({
    id: "editor.toggleVim",
    label: "Toggle Vim Mode",
    category: "Editor",
    shortcut: "Cmd+Shift+V",
    action: () => toggleVimMode?.(),
  });

  // Editor mode commands (these dispatch custom events that EditorWithPreview listens to)
  commandRegistry.register({
    id: "editor.source",
    label: "Source Mode",
    category: "Editor",
    shortcut: "Cmd+1",
    action: () => {
      window.dispatchEvent(new CustomEvent("notemaker:editor-mode", { detail: "source" }));
    },
  });

  commandRegistry.register({
    id: "editor.split",
    label: "Split Mode",
    category: "Editor",
    shortcut: "Cmd+2",
    action: () => {
      window.dispatchEvent(new CustomEvent("notemaker:editor-mode", { detail: "split" }));
    },
  });

  commandRegistry.register({
    id: "editor.preview",
    label: "Preview Mode",
    category: "Editor",
    shortcut: "Cmd+3",
    action: () => {
      window.dispatchEvent(new CustomEvent("notemaker:editor-mode", { detail: "preview" }));
    },
  });

  commandRegistry.register({
    id: "editor.cycle",
    label: "Cycle Editor Modes",
    category: "Editor",
    shortcut: "Cmd+E",
    action: () => {
      window.dispatchEvent(new CustomEvent("notemaker:editor-mode", { detail: "cycle" }));
    },
  });

  // Settings
  commandRegistry.register({
    id: "settings.open",
    label: "Open Settings",
    category: "Preferences",
    shortcut: "Cmd+,",
    action: () => {
      openSettingsPanel?.();
    },
  });

  commandRegistry.register({
    id: "vault.settings",
    label: "Vault Settings",
    category: "Preferences",
    action: () => {
      if (vaultStore.vault()) {
        openVaultSettingsDialog?.();
      }
    },
  });

  commandRegistry.register({
    id: "theme.toggle",
    label: "Toggle Light/Dark Theme",
    category: "Preferences",
    shortcut: "Cmd+Shift+L",
    action: () => {
      const current = settingsStore.get().appearance.theme;
      // Toggle between light and dark (skip system for quick toggle)
      const newTheme = current === "dark" ? "light" : "dark";
      settingsStore.set("appearance", "theme", newTheme);
    },
  });

  // Git commands
  commandRegistry.register({
    id: "git.panel",
    label: "Open Git Panel",
    category: "Git",
    shortcut: "Cmd+Shift+G",
    action: () => openGitPanel?.(),
  });

  commandRegistry.register({
    id: "git.init",
    label: "Initialize Git Repository",
    category: "Git",
    action: async () => {
      const vault = vaultStore.vault();
      if (vault) {
        try {
          await gitInit(vault.path);
          openGitPanel?.();
        } catch (err) {
          console.error("Failed to initialize git:", err);
        }
      }
    },
  });

  commandRegistry.register({
    id: "git.status",
    label: "Show Git Status",
    category: "Git",
    action: () => openGitPanel?.(),
  });

  commandRegistry.register({
    id: "git.commit",
    label: "Commit Changes",
    category: "Git",
    action: () => openGitPanel?.(),
  });

  // Help
  commandRegistry.register({
    id: "help.shortcuts",
    label: "Keyboard Shortcuts",
    category: "Help",
    shortcut: "Cmd+/",
    action: () => openShortcutsHelp?.(),
  });

  commandRegistry.register({
    id: "help.about",
    label: "About Notemaker",
    category: "Help",
    action: () => {
      // TODO: Show about dialog
    },
  });
}

export { commandRegistry };
