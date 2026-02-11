/**
 * Global keyboard handler for shortcuts
 */

import { commandRegistry } from "../commands/registry";

let isSetup = false;

export function setupGlobalKeyboardHandler(): void {
  if (isSetup) return;
  isSetup = true;

  window.addEventListener("keydown", handleKeyDown);
}

export function teardownGlobalKeyboardHandler(): void {
  window.removeEventListener("keydown", handleKeyDown);
  isSetup = false;
}

function handleKeyDown(e: KeyboardEvent): void {
  // Skip if target is a regular input/textarea (but not CodeMirror)
  const target = e.target as HTMLElement;
  const isFormInput =
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA";

  // Check if we're in CodeMirror editor
  const isInEditor = target.closest(".cm-editor") !== null;

  // Build shortcut string
  const shortcut = getShortcutFromEvent(e);
  if (!shortcut) return;

  // Check if this shortcut is registered
  const commandId = commandRegistry.getCommandByShortcut(shortcut);

  if (commandId) {
    // Shortcuts that should always work (even in editor/inputs)
    const globalShortcuts = [
      "command-palette.open",  // Cmd+K
      "quick-open.open",       // Cmd+P
      "note.save",             // Cmd+S
      "note.close",            // Cmd+W
      "app.quit",              // Cmd+Q
      "vault.open",            // Cmd+Shift+O
      "note.new",              // Cmd+N
      "notebook.new",          // Cmd+Shift+N
      "template.new",          // Cmd+Shift+T
      "sidebar.toggle",        // Cmd+\
      "search.global",         // Cmd+Shift+F
      "git.panel",             // Cmd+Shift+G
      "editor.toggleVim",      // Cmd+Shift+V
      "editor.source",         // Cmd+1
      "editor.split",          // Cmd+2
      "editor.preview",        // Cmd+3
      "editor.cycle",          // Cmd+E
      "help.shortcuts",        // Cmd+/
    ];

    const isGlobalShortcut = globalShortcuts.includes(commandId);

    // In form inputs, only allow global shortcuts
    if (isFormInput && !isGlobalShortcut) {
      return;
    }

    // In CodeMirror, allow global shortcuts
    // (CodeMirror handles its own shortcuts like Cmd+Z, Cmd+F, etc.)
    if (isInEditor && !isGlobalShortcut) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();
    commandRegistry.execute(commandId);
  }
}

function getShortcutFromEvent(e: KeyboardEvent): string {
  const parts: string[] = [];

  // Use Cmd for both Meta (Mac) and Ctrl (Windows/Linux)
  if (e.metaKey || e.ctrlKey) parts.push("cmd");
  if (e.shiftKey) parts.push("shift");
  if (e.altKey) parts.push("alt");

  // Get the key, normalizing special keys
  let key = e.key.toLowerCase();

  // Normalize key names
  const keyMap: Record<string, string> = {
    " ": "space",
    arrowup: "up",
    arrowdown: "down",
    arrowleft: "left",
    arrowright: "right",
    escape: "escape",
    enter: "enter",
    backspace: "backspace",
    delete: "delete",
    tab: "tab",
  };

  key = keyMap[key] || key;

  // Skip if key is just a modifier
  if (["control", "meta", "shift", "alt"].includes(key)) {
    return "";
  }

  parts.push(key);

  return parts.join("+");
}

/**
 * Format a shortcut for display
 */
export function formatShortcut(shortcut: string): string {
  const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;

  return shortcut
    .split("+")
    .map((part) => {
      const lower = part.toLowerCase();
      if (lower === "cmd") return isMac ? "⌘" : "Ctrl";
      if (lower === "shift") return isMac ? "⇧" : "Shift";
      if (lower === "alt") return isMac ? "⌥" : "Alt";
      if (lower === "ctrl") return isMac ? "⌃" : "Ctrl";
      if (lower === "enter") return "↵";
      if (lower === "escape") return "Esc";
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
    .join(isMac ? "" : "+");
}
