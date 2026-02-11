/**
 * Recent Vaults store tests
 */

import { describe, it, expect, beforeEach } from "vitest";
import { recentVaultsStore } from "./recentVaults";

describe("RecentVaultsStore", () => {
  beforeEach(() => {
    localStorage.clear();
    // Clear internal state by removing all vaults
    const vaults = recentVaultsStore.recentVaults();
    vaults.forEach((v) => recentVaultsStore.removeVault(v.path));
  });

  describe("addVault", () => {
    it("adds a new vault to the list", () => {
      recentVaultsStore.addVault("/path/to/vault", "My Vault");

      const vaults = recentVaultsStore.recentVaults();
      expect(vaults).toHaveLength(1);
      expect(vaults[0].path).toBe("/path/to/vault");
      expect(vaults[0].name).toBe("My Vault");
    });

    it("moves existing vault to the top", () => {
      recentVaultsStore.addVault("/path/one", "Vault One");
      recentVaultsStore.addVault("/path/two", "Vault Two");
      recentVaultsStore.addVault("/path/one", "Vault One Updated");

      const vaults = recentVaultsStore.recentVaults();
      expect(vaults).toHaveLength(2);
      expect(vaults[0].path).toBe("/path/one");
      expect(vaults[0].name).toBe("Vault One Updated");
    });

    it("limits to max 10 vaults", () => {
      for (let i = 0; i < 15; i++) {
        recentVaultsStore.addVault(`/path/${i}`, `Vault ${i}`);
      }

      const vaults = recentVaultsStore.recentVaults();
      expect(vaults.length).toBeLessThanOrEqual(10);
    });

    it("persists to localStorage", () => {
      recentVaultsStore.addVault("/test/path", "Test Vault");

      const stored = localStorage.getItem("notemaker:recent-vaults");
      expect(stored).not.toBeNull();

      const parsed = JSON.parse(stored!);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].path).toBe("/test/path");
    });
  });

  describe("removeVault", () => {
    it("removes vault from the list", () => {
      recentVaultsStore.addVault("/path/one", "Vault One");
      recentVaultsStore.addVault("/path/two", "Vault Two");

      recentVaultsStore.removeVault("/path/one");

      const vaults = recentVaultsStore.recentVaults();
      expect(vaults).toHaveLength(1);
      expect(vaults[0].path).toBe("/path/two");
    });

    it("does nothing if vault not found", () => {
      recentVaultsStore.addVault("/path/one", "Vault One");

      recentVaultsStore.removeVault("/nonexistent");

      const vaults = recentVaultsStore.recentVaults();
      expect(vaults).toHaveLength(1);
    });
  });

  describe("getOtherVaults", () => {
    it("returns all vaults except current", () => {
      recentVaultsStore.addVault("/path/one", "Vault One");
      recentVaultsStore.addVault("/path/two", "Vault Two");
      recentVaultsStore.addVault("/path/three", "Vault Three");

      const others = recentVaultsStore.getOtherVaults("/path/two");

      expect(others).toHaveLength(2);
      expect(others.find((v) => v.path === "/path/two")).toBeUndefined();
    });

    it("returns all vaults when no current path", () => {
      recentVaultsStore.addVault("/path/one", "Vault One");
      recentVaultsStore.addVault("/path/two", "Vault Two");

      const others = recentVaultsStore.getOtherVaults(undefined);

      expect(others).toHaveLength(2);
    });
  });

  describe("clear", () => {
    it("removes all vaults", () => {
      recentVaultsStore.addVault("/path/one", "Vault One");
      recentVaultsStore.addVault("/path/two", "Vault Two");

      recentVaultsStore.clear();

      const vaults = recentVaultsStore.recentVaults();
      expect(vaults).toHaveLength(0);
    });

    it("clears localStorage", () => {
      recentVaultsStore.addVault("/path/one", "Vault One");
      recentVaultsStore.clear();

      const stored = localStorage.getItem("notemaker:recent-vaults");
      expect(stored).toBeNull();
    });
  });
});
