/**
 * Vim mode manager with persistence
 */

import { Extension } from "@codemirror/state";

const VIM_MODE_KEY = "notemaker:vim-mode";

export type VimModeState = "normal" | "insert" | "visual" | "replace" | "disabled";

/**
 * Load vim mode preference from localStorage
 */
export function loadVimModePreference(): boolean {
  try {
    return localStorage.getItem(VIM_MODE_KEY) === "true";
  } catch {
    return false;
  }
}

/**
 * Save vim mode preference to localStorage
 */
export function saveVimModePreference(enabled: boolean): void {
  try {
    localStorage.setItem(VIM_MODE_KEY, String(enabled));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Load vim extension
 */
export async function loadVimExtension(): Promise<Extension> {
  const { vim } = await import("@replit/codemirror-vim");
  return vim();
}
