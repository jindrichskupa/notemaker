/**
 * Recent Vaults Store - manages list of recently opened vaults
 * Stored in localStorage for persistence across sessions
 */

import { createSignal, createRoot } from "solid-js";

export interface RecentVault {
  path: string;
  name: string;
  lastOpened: number;
}

const STORAGE_KEY = "notemaker:recent-vaults";
const MAX_RECENT_VAULTS = 10;

function createRecentVaultsStore() {
  // Load from localStorage
  const loadFromStorage = (): RecentVault[] => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.error("Failed to load recent vaults:", e);
    }
    return [];
  };

  // Save to localStorage
  const saveToStorage = (vaults: RecentVault[]): void => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(vaults));
    } catch (e) {
      console.error("Failed to save recent vaults:", e);
    }
  };

  const [recentVaults, setRecentVaults] = createSignal<RecentVault[]>(loadFromStorage());

  // Add or update a vault in the recent list
  function addVault(path: string, name: string): void {
    setRecentVaults((current) => {
      // Remove if already exists
      const filtered = current.filter((v) => v.path !== path);

      // Add at the beginning with current timestamp
      const updated = [
        { path, name, lastOpened: Date.now() },
        ...filtered,
      ].slice(0, MAX_RECENT_VAULTS);

      saveToStorage(updated);
      return updated;
    });
  }

  // Remove a vault from the recent list
  function removeVault(path: string): void {
    setRecentVaults((current) => {
      const filtered = current.filter((v) => v.path !== path);
      saveToStorage(filtered);
      return filtered;
    });
  }

  // Get recent vaults (excluding current if provided)
  function getOtherVaults(currentPath?: string): RecentVault[] {
    return recentVaults().filter((v) => v.path !== currentPath);
  }

  // Clear all recent vaults
  function clear(): void {
    setRecentVaults([]);
    localStorage.removeItem(STORAGE_KEY);
  }

  return {
    recentVaults,
    addVault,
    removeVault,
    getOtherVaults,
    clear,
  };
}

// Create singleton store
export const recentVaultsStore = createRoot(createRecentVaultsStore);
