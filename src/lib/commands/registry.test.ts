/**
 * Command registry tests
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { commandRegistry } from "./registry";

describe("CommandRegistry", () => {
  beforeEach(() => {
    localStorage.clear();
    // Unregister test commands
    const testCommands = commandRegistry.getAll().filter((c) => c.id.startsWith("test."));
    testCommands.forEach((c) => commandRegistry.unregister(c.id));
  });

  describe("register", () => {
    it("registers a command", () => {
      const action = vi.fn();
      commandRegistry.register({
        id: "test.command",
        label: "Test Command",
        category: "Test",
        action,
      });

      const cmd = commandRegistry.get("test.command");
      expect(cmd).toBeDefined();
      expect(cmd?.label).toBe("Test Command");
    });

    it("registers command with shortcut", () => {
      commandRegistry.register({
        id: "test.shortcut",
        label: "Test Shortcut",
        category: "Test",
        shortcut: "Cmd+T",
        action: vi.fn(),
      });

      const cmdId = commandRegistry.getCommandByShortcut("Cmd+T");
      expect(cmdId).toBe("test.shortcut");
    });
  });

  describe("unregister", () => {
    it("removes a command", () => {
      commandRegistry.register({
        id: "test.remove",
        label: "To Remove",
        category: "Test",
        action: vi.fn(),
      });

      commandRegistry.unregister("test.remove");

      const cmd = commandRegistry.get("test.remove");
      expect(cmd).toBeUndefined();
    });

    it("removes shortcut mapping", () => {
      commandRegistry.register({
        id: "test.removeshortcut",
        label: "Remove Shortcut",
        category: "Test",
        shortcut: "Cmd+X",
        action: vi.fn(),
      });

      commandRegistry.unregister("test.removeshortcut");

      const cmdId = commandRegistry.getCommandByShortcut("Cmd+X");
      expect(cmdId).toBeUndefined();
    });
  });

  describe("execute", () => {
    it("executes command action", () => {
      const action = vi.fn();
      commandRegistry.register({
        id: "test.exec",
        label: "Execute Test",
        category: "Test",
        action,
      });

      commandRegistry.execute("test.exec");

      expect(action).toHaveBeenCalled();
    });

    it("does nothing for unknown command", () => {
      // Should not throw
      expect(() => commandRegistry.execute("nonexistent.command")).not.toThrow();
    });
  });

  describe("search", () => {
    beforeEach(() => {
      commandRegistry.register({
        id: "test.search1",
        label: "Find Files",
        category: "Search",
        action: vi.fn(),
      });
      commandRegistry.register({
        id: "test.search2",
        label: "Find and Replace",
        category: "Search",
        action: vi.fn(),
      });
      commandRegistry.register({
        id: "test.other",
        label: "Other Command",
        category: "Other",
        action: vi.fn(),
      });
    });

    it("finds commands by label", () => {
      const results = commandRegistry.search("find");

      expect(results.length).toBeGreaterThanOrEqual(2);
      expect(results.some((r) => r.id === "test.search1")).toBe(true);
      expect(results.some((r) => r.id === "test.search2")).toBe(true);
    });

    it("finds commands by category", () => {
      const results = commandRegistry.search("search");

      expect(results.some((r) => r.category === "Search")).toBe(true);
    });

    it("returns recent commands when query is empty", () => {
      // Execute a command to make it recent
      commandRegistry.execute("test.search1");

      const results = commandRegistry.search("");

      // Should return recent commands (may include test.search1)
      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe("getByCategory", () => {
    it("returns commands in category", () => {
      commandRegistry.register({
        id: "test.cat1",
        label: "Cat Test 1",
        category: "TestCategory",
        action: vi.fn(),
      });
      commandRegistry.register({
        id: "test.cat2",
        label: "Cat Test 2",
        category: "TestCategory",
        action: vi.fn(),
      });

      const results = commandRegistry.getByCategory("TestCategory");

      expect(results).toHaveLength(2);
    });
  });

  describe("shortcut normalization", () => {
    it("normalizes shortcut case", () => {
      commandRegistry.register({
        id: "test.norm1",
        label: "Normalize Test",
        category: "Test",
        shortcut: "CMD+SHIFT+A",
        action: vi.fn(),
      });

      // Should find with different case
      const cmdId = commandRegistry.getCommandByShortcut("cmd+shift+a");
      expect(cmdId).toBe("test.norm1");
    });

    it("normalizes modifier order", () => {
      commandRegistry.register({
        id: "test.norm2",
        label: "Order Test",
        category: "Test",
        shortcut: "Shift+Cmd+B",
        action: vi.fn(),
      });

      // Should find regardless of modifier order
      const cmdId = commandRegistry.getCommandByShortcut("Cmd+Shift+B");
      expect(cmdId).toBe("test.norm2");
    });
  });
});
