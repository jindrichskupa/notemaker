/**
 * Command registry for keyboard shortcuts and command palette
 */

export interface Command {
  id: string;
  label: string;
  category: string;
  shortcut?: string;
  icon?: string;
  when?: string; // Conditional context (e.g., "editorFocus", "sidebarFocus")
  action: () => void | Promise<void>;
}

const RECENT_COMMANDS_KEY = "notemaker:recent-commands";
const MAX_RECENT_COMMANDS = 10;

class CommandRegistry {
  private commands = new Map<string, Command>();
  private shortcuts = new Map<string, string>(); // shortcut → command id
  private recentCommands: string[] = [];

  constructor() {
    this.loadRecentCommands();
  }

  register(command: Command): void {
    this.commands.set(command.id, command);
    if (command.shortcut) {
      this.shortcuts.set(this.normalizeShortcut(command.shortcut), command.id);
    }
  }

  unregister(commandId: string): void {
    const command = this.commands.get(commandId);
    if (command?.shortcut) {
      this.shortcuts.delete(this.normalizeShortcut(command.shortcut));
    }
    this.commands.delete(commandId);
  }

  execute(commandId: string): void {
    const command = this.commands.get(commandId);
    if (command) {
      this.addToRecent(commandId);
      command.action();
    } else {
      console.warn(`Command not found: ${commandId}`);
    }
  }

  get(commandId: string): Command | undefined {
    return this.commands.get(commandId);
  }

  getAll(): Command[] {
    return Array.from(this.commands.values());
  }

  getByCategory(category: string): Command[] {
    return this.getAll().filter((c) => c.category === category);
  }

  getCommandByShortcut(shortcut: string): string | undefined {
    return this.shortcuts.get(this.normalizeShortcut(shortcut));
  }

  search(query: string): Command[] {
    if (!query.trim()) {
      return this.getRecentCommands();
    }

    const lowerQuery = query.toLowerCase();
    const results = this.getAll()
      .filter(
        (c) =>
          c.label.toLowerCase().includes(lowerQuery) ||
          c.id.toLowerCase().includes(lowerQuery) ||
          c.category.toLowerCase().includes(lowerQuery)
      )
      .sort((a, b) => {
        // Exact matches first
        const aExact =
          a.label.toLowerCase().startsWith(lowerQuery) ||
          a.id.toLowerCase().startsWith(lowerQuery);
        const bExact =
          b.label.toLowerCase().startsWith(lowerQuery) ||
          b.id.toLowerCase().startsWith(lowerQuery);
        if (aExact && !bExact) return -1;
        if (bExact && !aExact) return 1;

        // Then by recency
        const aRecent = this.recentCommands.indexOf(a.id);
        const bRecent = this.recentCommands.indexOf(b.id);
        if (aRecent !== -1 && bRecent === -1) return -1;
        if (bRecent !== -1 && aRecent === -1) return 1;
        if (aRecent !== -1 && bRecent !== -1) return aRecent - bRecent;

        // Finally alphabetically
        return a.label.localeCompare(b.label);
      });

    return results;
  }

  getRecentCommands(): Command[] {
    return this.recentCommands
      .map((id) => this.commands.get(id))
      .filter((c): c is Command => c !== undefined);
  }

  private addToRecent(commandId: string): void {
    this.recentCommands = [
      commandId,
      ...this.recentCommands.filter((id) => id !== commandId),
    ].slice(0, MAX_RECENT_COMMANDS);
    this.saveRecentCommands();
  }

  private loadRecentCommands(): void {
    try {
      const stored = localStorage.getItem(RECENT_COMMANDS_KEY);
      if (stored) {
        this.recentCommands = JSON.parse(stored);
      }
    } catch {
      this.recentCommands = [];
    }
  }

  private saveRecentCommands(): void {
    try {
      localStorage.setItem(
        RECENT_COMMANDS_KEY,
        JSON.stringify(this.recentCommands)
      );
    } catch {
      // Ignore storage errors
    }
  }

  private normalizeShortcut(shortcut: string): string {
    return shortcut
      .split("+")
      .map((part) => part.trim().toLowerCase())
      .sort((a, b) => {
        // Modifiers first in order: cmd, ctrl, alt, shift
        const order = ["cmd", "ctrl", "alt", "shift"];
        const aIndex = order.indexOf(a);
        const bIndex = order.indexOf(b);
        if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
        if (aIndex !== -1) return -1;
        if (bIndex !== -1) return 1;
        return 0;
      })
      .join("+");
  }
}

export const commandRegistry = new CommandRegistry();
