import { debounce } from "../utils";

export interface AutoSaveState {
  isDirty: boolean;
  lastSaved: number | null;
  saving: boolean;
  error: string | null;
}

export interface AutoSaveController {
  markDirty: () => void;
  isDirty: () => boolean;
  isSaving: () => boolean;
  forceSave: () => Promise<void>;
  getLastSaved: () => number | null;
  getError: () => string | null;
  destroy: () => void;
}

/**
 * Create an auto-save controller for the editor
 *
 * @param saveNote - Function to save the note
 * @param delay - Debounce delay in milliseconds (default 1000ms)
 */
export function createAutoSave(
  saveNote: () => Promise<void>,
  delay = 1000
): AutoSaveController {
  const state: AutoSaveState = {
    isDirty: false,
    lastSaved: null,
    saving: false,
    error: null,
  };

  const performSave = async () => {
    if (!state.isDirty || state.saving) return;

    state.saving = true;
    state.error = null;

    try {
      await saveNote();
      state.isDirty = false;
      state.lastSaved = Date.now();
    } catch (err) {
      state.error = err instanceof Error ? err.message : "Failed to save";
      console.error("Auto-save failed:", err);
    } finally {
      state.saving = false;
    }
  };

  const debouncedSave = debounce(performSave, delay);

  return {
    markDirty() {
      state.isDirty = true;
      debouncedSave();
    },

    isDirty() {
      return state.isDirty;
    },

    isSaving() {
      return state.saving;
    },

    async forceSave() {
      await performSave();
    },

    getLastSaved() {
      return state.lastSaved;
    },

    getError() {
      return state.error;
    },

    destroy() {
      // Nothing to clean up with the simple debounce implementation
    },
  };
}

/**
 * Format last saved time for display
 */
export function formatLastSaved(timestamp: number | null): string {
  if (!timestamp) return "Never saved";

  const now = Date.now();
  const diff = Math.floor((now - timestamp) / 1000);

  if (diff < 5) return "Just saved";
  if (diff < 60) return `Saved ${diff}s ago`;
  if (diff < 3600) return `Saved ${Math.floor(diff / 60)}m ago`;

  const date = new Date(timestamp);
  return `Saved at ${date.toLocaleTimeString()}`;
}
