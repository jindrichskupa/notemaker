/**
 * Centralized keyboard shortcuts definitions
 * Single source of truth for all shortcuts in the app
 */

export interface ShortcutDef {
  id: string;
  keys: string;           // Internal format: "cmd+k", "cmd+shift+g"
  display: string;        // Display format: "⌘K", "⌘⇧G"
  description: string;
  category: string;
  implemented: boolean;   // Whether this shortcut is actually working
}

// Platform detection
const isMac = typeof navigator !== "undefined" && navigator.platform.toUpperCase().indexOf("MAC") >= 0;

/**
 * Convert internal format to display format
 */
export function formatShortcutDisplay(keys: string): string {
  return keys
    .split("+")
    .map((part) => {
      const lower = part.toLowerCase();
      if (lower === "cmd") return isMac ? "⌘" : "Ctrl+";
      if (lower === "shift") return isMac ? "⇧" : "Shift+";
      if (lower === "alt") return isMac ? "⌥" : "Alt+";
      if (lower === "ctrl") return isMac ? "⌃" : "Ctrl+";
      if (lower === "enter") return "↵";
      if (lower === "escape" || lower === "esc") return "Esc";
      if (lower === "backspace") return "⌫";
      if (lower === "delete") return "Del";
      if (lower === "tab") return "Tab";
      if (lower === "space") return "Space";
      if (lower === "up") return "↑";
      if (lower === "down") return "↓";
      if (lower === "left") return "←";
      if (lower === "right") return "→";
      return part.toUpperCase();
    })
    .join(isMac ? "" : "");
}

/**
 * All shortcuts in the application
 */
export const SHORTCUTS: ShortcutDef[] = [
  // General
  { id: "command-palette.open", keys: "cmd+k", display: "⌘K", description: "Open Command Palette", category: "General", implemented: true },
  { id: "quick-open.open", keys: "cmd+p", display: "⌘P", description: "Quick Open", category: "General", implemented: true },
  { id: "help.shortcuts", keys: "cmd+/", display: "⌘/", description: "Keyboard Shortcuts", category: "General", implemented: true },
  { id: "sidebar.toggle", keys: "cmd+\\", display: "⌘\\", description: "Toggle Sidebar", category: "General", implemented: true },

  // File
  { id: "note.new", keys: "cmd+n", display: "⌘N", description: "New Note", category: "File", implemented: true },
  { id: "notebook.new", keys: "cmd+shift+n", display: "⌘⇧N", description: "New Notebook", category: "File", implemented: true },
  { id: "template.new", keys: "cmd+shift+t", display: "⌘⇧T", description: "New from Template", category: "File", implemented: true },
  { id: "vault.open", keys: "cmd+shift+o", display: "⌘⇧O", description: "Open Vault", category: "File", implemented: true },
  { id: "note.save", keys: "cmd+s", display: "⌘S", description: "Save", category: "File", implemented: true },
  { id: "note.close", keys: "cmd+w", display: "⌘W", description: "Close Note", category: "File", implemented: true },
  { id: "app.quit", keys: "cmd+q", display: "⌘Q", description: "Quit", category: "File", implemented: true },

  // Notebook
  { id: "notebook.run", keys: "cmd+r", display: "⌘R", description: "Run Code Block", category: "Notebook", implemented: true },
  { id: "notebook.addBlock", keys: "cmd+d", display: "⌘D", description: "Add Block Below", category: "Notebook", implemented: true },
  { id: "notebook.moveUp", keys: "alt+up", display: "⌥↑", description: "Move Block Up", category: "Notebook", implemented: true },
  { id: "notebook.moveDown", keys: "alt+down", display: "⌥↓", description: "Move Block Down", category: "Notebook", implemented: true },

  // Editor
  { id: "editor.source", keys: "cmd+1", display: "⌘1", description: "Source Mode", category: "Editor", implemented: true },
  { id: "editor.split", keys: "cmd+2", display: "⌘2", description: "Split Mode", category: "Editor", implemented: true },
  { id: "editor.preview", keys: "cmd+3", display: "⌘3", description: "Preview Mode", category: "Editor", implemented: true },
  { id: "editor.cycle", keys: "cmd+e", display: "⌘E", description: "Cycle Editor Modes", category: "Editor", implemented: true },
  { id: "editor.toggleVim", keys: "cmd+shift+v", display: "⌘⇧V", description: "Toggle Vim Mode", category: "Editor", implemented: true },

  // Search
  { id: "search.find", keys: "cmd+f", display: "⌘F", description: "Find in Note", category: "Search", implemented: false },
  { id: "search.global", keys: "cmd+shift+f", display: "⌘⇧F", description: "Search in All Notes", category: "Search", implemented: true },
  { id: "search.replace", keys: "cmd+h", display: "⌘H", description: "Find and Replace", category: "Search", implemented: false },

  // Edit
  { id: "edit.undo", keys: "cmd+z", display: "⌘Z", description: "Undo", category: "Edit", implemented: true },
  { id: "edit.redo", keys: "cmd+shift+z", display: "⌘⇧Z", description: "Redo", category: "Edit", implemented: true },
  { id: "format.bold", keys: "cmd+b", display: "⌘B", description: "Bold", category: "Edit", implemented: false },
  { id: "format.italic", keys: "cmd+i", display: "⌘I", description: "Italic", category: "Edit", implemented: false },
  { id: "format.code", keys: "cmd+`", display: "⌘`", description: "Inline Code", category: "Edit", implemented: false },

  // Git
  { id: "git.panel", keys: "cmd+shift+g", display: "⌘⇧G", description: "Open Git Panel", category: "Git", implemented: true },

  // Appearance
  { id: "theme.toggle", keys: "cmd+shift+l", display: "⌘⇧L", description: "Toggle Light/Dark Theme", category: "Appearance", implemented: true },
];

/**
 * Get shortcut by ID
 */
export function getShortcut(id: string): ShortcutDef | undefined {
  return SHORTCUTS.find(s => s.id === id);
}

/**
 * Get display string for a shortcut ID
 */
export function getShortcutDisplay(id: string): string {
  const shortcut = getShortcut(id);
  return shortcut?.display || "";
}

/**
 * Get shortcuts by category
 */
export function getShortcutsByCategory(category: string): ShortcutDef[] {
  return SHORTCUTS.filter(s => s.category === category);
}

/**
 * Get all implemented shortcuts
 */
export function getImplementedShortcuts(): ShortcutDef[] {
  return SHORTCUTS.filter(s => s.implemented);
}

/**
 * Get shortcuts grouped by category
 */
export function getShortcutsGrouped(): Record<string, ShortcutDef[]> {
  const grouped: Record<string, ShortcutDef[]> = {};
  for (const shortcut of SHORTCUTS) {
    if (!grouped[shortcut.category]) {
      grouped[shortcut.category] = [];
    }
    grouped[shortcut.category].push(shortcut);
  }
  return grouped;
}
