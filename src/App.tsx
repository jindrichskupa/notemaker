import { createSignal, Show, onMount, onCleanup, createEffect } from "solid-js";
import { open } from "@tauri-apps/plugin-dialog";
import { EditorWithPreview, Sidebar, CommandPalette, QuickOpen, SearchPanel, ExportDialog, ShortcutsHelp, NotebookEditor, GitPanel, GitStatusIndicator, TemplateDialog, SettingsPanel, SaveAsTemplateDialog, PasswordDialog, KanbanEditor } from "./components";
import { VaultSettingsDialog } from "./components/VaultSettingsDialog";
import { encryptionStore } from "./lib/store/encryption";
import { createFromTemplate, isNotebookTemplate, processNotebookTemplate, type NoteTemplate } from "./lib/templates";
import { parseNote } from "./lib/frontmatter/parser";
import { vaultStore } from "./lib/store/vault";
import { notebookStore } from "./lib/store/notebook";
import { kanbanStore } from "./lib/store/kanban";
import { isKanban } from "./lib/fs";
import "./lib/store/theme"; // Initialize theme on load
import { initializeSettings } from "./lib/settings";
import { registerCommands, setUICallbacks } from "./lib/commands";
import { setupGlobalKeyboardHandler, teardownGlobalKeyboardHandler } from "./lib/keyboard/handler";
import type { TreeNode } from "./lib/store/vault";

// isNotebook check using tree data
function isNotebook(path: string): boolean {
  const findNode = (nodes: TreeNode[]): boolean => {
    for (const node of nodes) {
      if (node.path === path) {
        return node.type === "folder" && path.endsWith(".md");
      }
      if (node.children) {
        const found = findNode(node.children);
        if (found) return true;
      }
    }
    return false;
  };
  return findNode(vaultStore.tree());
}

// Sample markdown content for demo when no note is selected
const DEMO_CONTENT = `# Welcome to Notemaker

A developer-focused note-taking app with **keyboard-first** design.

## Getting Started

1. Press **⌘⇧O** to open a vault (folder with your notes)
2. Press **⌘K** to open the command palette
3. Press **⌘P** to quickly search and open notes
4. Press **⌘N** to create a new note

## Features

- Markdown editing with syntax highlighting
- Code blocks with 14+ language support
- File tree navigation with drag & drop
- Command palette for all actions
- Vim mode (toggle with VIM button)
- Auto-save with visual indicators

## Code Examples

\`\`\`javascript
// JavaScript with syntax highlighting
function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}
\`\`\`

\`\`\`python
# Python example
def quicksort(arr):
    if len(arr) <= 1:
        return arr
    pivot = arr[len(arr) // 2]
    left = [x for x in arr if x < pivot]
    middle = [x for x in arr if x == pivot]
    right = [x for x in arr if x > pivot]
    return quicksort(left) + middle + quicksort(right)
\`\`\`

\`\`\`rust
// Rust example
fn main() {
    let message = "Hello from Notemaker!";
    println!("{}", message);
}
\`\`\`

## Mermaid Diagrams

\`\`\`mermaid
graph TD
    A[Start] --> B{Is it working?}
    B -->|Yes| C[Great!]
    B -->|No| D[Debug]
    D --> B
    C --> E[End]
\`\`\`

\`\`\`mermaid
sequenceDiagram
    participant User
    participant App
    participant API
    User->>App: Create Note
    App->>API: Save Note
    API-->>App: Confirm
    App-->>User: Success
\`\`\`

---

Open a vault to start taking notes!
`;

function App() {
  // UI state
  const [showCommandPalette, setShowCommandPalette] = createSignal(false);
  const [showQuickOpen, setShowQuickOpen] = createSignal(false);
  const [showSearchPanel, setShowSearchPanel] = createSignal(false);
  const [showExportDialog, setShowExportDialog] = createSignal(false);
  const [showNewNoteDialog, setShowNewNoteDialog] = createSignal(false);
  const [newNoteName, setNewNoteName] = createSignal("");
  const [showNewNotebookDialog, setShowNewNotebookDialog] = createSignal(false);
  const [newNotebookName, setNewNotebookName] = createSignal("");
  const [showNewKanbanDialog, setShowNewKanbanDialog] = createSignal(false);
  const [newKanbanName, setNewKanbanName] = createSignal("");
  const [showShortcutsHelp, setShowShortcutsHelp] = createSignal(false);
  const [showGitPanel, setShowGitPanel] = createSignal(false);
  const [showTemplateDialog, setShowTemplateDialog] = createSignal(false);
  const [showSaveAsTemplateDialog, setShowSaveAsTemplateDialog] = createSignal(false);
  const [showSettingsPanel, setShowSettingsPanel] = createSignal(false);
  const [showVaultSettingsDialog, setShowVaultSettingsDialog] = createSignal(false);
  const [showSidebar, setShowSidebar] = createSignal(true);
  const [demoContent, setDemoContent] = createSignal(DEMO_CONTENT);
  const [viewingNotebook, setViewingNotebook] = createSignal(false);
  const [viewingKanban, setViewingKanban] = createSignal(false);

  // Watch for notebook and kanban selection
  createEffect(() => {
    const selectedPath = vaultStore.selectedPath();
    if (selectedPath && isNotebook(selectedPath)) {
      setViewingNotebook(true);
      setViewingKanban(false);
      notebookStore.open(selectedPath);
      kanbanStore.close();
    } else if (selectedPath && isKanban(selectedPath)) {
      setViewingKanban(true);
      setViewingNotebook(false);
      kanbanStore.open(selectedPath);
      notebookStore.close();
    } else {
      setViewingNotebook(false);
      setViewingKanban(false);
      notebookStore.close();
      kanbanStore.close();
    }
  });

  // Open vault dialog
  const handleOpenVault = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Select Vault Folder",
      });

      if (selected && typeof selected === "string") {
        await vaultStore.openVault(selected);
      }
    } catch (err) {
      console.error("Failed to open vault:", err);
    }
  };

  // Handle save
  const handleSave = async (content: string) => {
    if (vaultStore.currentNote()) {
      vaultStore.updateNoteContent(content);
      await vaultStore.saveCurrentNote();
    } else {
      // Demo mode - just update local state
      setDemoContent(content);
      console.log("Demo mode - content not persisted");
    }
  };

  // Handle content change
  const handleChange = (content: string) => {
    if (vaultStore.currentNote()) {
      vaultStore.updateNoteContent(content);
    } else {
      setDemoContent(content);
    }
  };

  // Handle note selection from quick open
  const handleSelectNote = async (path: string) => {
    await vaultStore.selectNote(path);
  };

  // Handle creating a new note
  const handleCreateNote = async () => {
    const name = newNoteName().trim();
    const vault = vaultStore.vault();
    if (!name || !vault) return;

    try {
      const path = await vaultStore.createNote(vault.path, name);
      setShowNewNoteDialog(false);
      setNewNoteName("");
      await vaultStore.selectNote(path);
    } catch (err) {
      console.error("Failed to create note:", err);
    }
  };

  // Handle creating a new notebook
  const handleCreateNotebook = async () => {
    const name = newNotebookName().trim();
    const vault = vaultStore.vault();
    if (!name || !vault) return;

    try {
      // Ensure name ends with .md
      const notebookName = name.endsWith(".md") ? name : `${name}.md`;
      const path = `${vault.path}/${notebookName}`;
      await notebookStore.create(path, name.replace(/\.md$/, ""));
      setShowNewNotebookDialog(false);
      setNewNotebookName("");
      await vaultStore.refreshTree();
      await vaultStore.selectNote(path);
    } catch (err) {
      console.error("Failed to create notebook:", err);
    }
  };

  // Handle creating a new kanban board
  const handleCreateKanban = async () => {
    const name = newKanbanName().trim();
    const vault = vaultStore.vault();
    if (!name || !vault) return;

    try {
      // Kanban boards are stored as directories with .kanban extension
      const kanbanName = name.endsWith(".kanban") ? name : `${name}.kanban`;
      const path = `${vault.path}/${kanbanName}`;
      await kanbanStore.create(path, name.replace(/\.kanban$/, ""));
      setShowNewKanbanDialog(false);
      setNewKanbanName("");
      await vaultStore.refreshTree();
      await vaultStore.selectNote(path);
    } catch (err) {
      console.error("Failed to create kanban:", err);
    }
  };

  // Handle creating note or notebook from template
  const handleCreateFromTemplate = async (template: NoteTemplate, name: string) => {
    const vault = vaultStore.vault();
    if (!vault) return;

    try {
      // Check if it's a notebook template
      if (isNotebookTemplate(template)) {
        // Create notebook from template
        const blocks = processNotebookTemplate(template, { title: name });
        const notebookName = name.endsWith(".md") ? name : `${name}.md`;
        const path = `${vault.path}/${notebookName}`;

        await notebookStore.createFromTemplate(path, blocks);
        setShowTemplateDialog(false);
        await vaultStore.refreshTree();
        await vaultStore.selectNote(path);
      } else {
        // Create note from template
        const { content, frontmatter } = createFromTemplate(template, name);

        // Create frontmatter YAML
        const frontmatterYaml = Object.entries(frontmatter)
          .map(([key, value]) => {
            if (Array.isArray(value)) {
              return `${key}:\n${value.map(v => `  - ${v}`).join("\n")}`;
            }
            return `${key}: ${value}`;
          })
          .join("\n");

        const fullContent = `---\n${frontmatterYaml}\n---\n\n${content}`;

        const path = await vaultStore.createNote(vault.path, name, fullContent);
        setShowTemplateDialog(false);
        await vaultStore.selectNote(path);
      }
    } catch (err) {
      console.error("Failed to create from template:", err);
    }
  };

  // Setup commands and keyboard handler
  onMount(() => {
    // Initialize settings and apply CSS variables
    initializeSettings();

    // Register UI callbacks for commands
    setUICallbacks({
      openCommandPalette: () => setShowCommandPalette(true),
      openQuickOpen: () => setShowQuickOpen(true),
      openSearchPanel: () => setShowSearchPanel(true),
      openVaultDialog: handleOpenVault,
      openNewNoteDialog: () => {
        if (vaultStore.vault()) {
          setNewNoteName("");
          setShowNewNoteDialog(true);
        }
      },
      openNewNotebookDialog: () => {
        if (vaultStore.vault()) {
          setNewNotebookName("");
          setShowNewNotebookDialog(true);
        }
      },
      openNewKanbanDialog: () => {
        if (vaultStore.vault()) {
          setNewKanbanName("");
          setShowNewKanbanDialog(true);
        }
      },
      toggleSidebar: () => setShowSidebar(!showSidebar()),
      openExportDialog: () => setShowExportDialog(true),
      openShortcutsHelp: () => setShowShortcutsHelp(true),
      openGitPanel: () => setShowGitPanel(true),
      openTemplateDialog: () => {
        if (vaultStore.vault()) {
          setShowTemplateDialog(true);
        }
      },
      openSettingsPanel: () => setShowSettingsPanel(true),
      openVaultSettingsDialog: () => setShowVaultSettingsDialog(true),
      openSaveAsTemplateDialog: () => {
        if (vaultStore.vault() && vaultStore.currentNote()) {
          setShowSaveAsTemplateDialog(true);
        }
      },
    });

    // Register all commands
    registerCommands();

    // Setup global keyboard handler
    setupGlobalKeyboardHandler();

    // Auto-open last vault
    const lastVault = localStorage.getItem("notemaker:last-vault");
    if (lastVault) {
      vaultStore.openVault(lastVault).catch((err) => {
        console.error("Failed to open last vault:", err);
        // Clear invalid vault path
        localStorage.removeItem("notemaker:last-vault");
      });
    }
  });

  onCleanup(() => {
    teardownGlobalKeyboardHandler();
  });

  // Get current content
  const currentContent = () => {
    const note = vaultStore.currentNote();
    return note ? note.content : demoContent();
  };

  // Get current file path (relative, for display)
  const currentFilePath = () => {
    const path = vaultStore.selectedPath();
    if (!path) return "demo.md";

    const vault = vaultStore.vault();
    if (vault) {
      return path.replace(vault.path + "/", "");
    }
    return path;
  };

  // Get absolute file path (for image paste/drop)
  const currentAbsoluteFilePath = () => {
    return vaultStore.selectedPath() || undefined;
  };

  return (
    <div class="h-screen flex flex-col bg-gray-900 text-gray-100">
      {/* Header */}
      <header class="flex items-center justify-between bg-gray-800 border-b border-gray-700" style={{ padding: "12px 20px" }}>
        <div class="flex items-center gap-4">
          <button
            onClick={() => setShowSidebar(!showSidebar())}
            class="icon-btn text-gray-400 hover:text-gray-200"
            data-tooltip="Toggle Sidebar (⌘\)"
            data-tooltip-pos="bottom"
          >
            <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor">
              <path d="M1.5 3.25c0-.966.784-1.75 1.75-1.75h9.5c.966 0 1.75.784 1.75 1.75v9.5a1.75 1.75 0 0 1-1.75 1.75h-9.5a1.75 1.75 0 0 1-1.75-1.75Zm1.75-.25a.25.25 0 0 0-.25.25v9.5c0 .138.112.25.25.25H5v-10Zm3.5 0v10h6a.25.25 0 0 0 .25-.25v-9.5a.25.25 0 0 0-.25-.25Z" />
            </svg>
          </button>
          <h1 class="text-sm font-semibold text-blue-400">Notemaker</h1>
          <Show when={vaultStore.vault()}>
            <span class="text-xs text-gray-500">
              {vaultStore.vault()?.name}
            </span>
          </Show>
        </div>

        <div class="flex items-center gap-2">
          <GitStatusIndicator onClick={() => setShowGitPanel(true)} />
          <button
            onClick={() => setShowQuickOpen(true)}
            class="toolbar-btn text-gray-400 hover:text-gray-200"
            data-tooltip="Quick Open"
            data-tooltip-pos="bottom"
          >
            <span class="font-mono text-xs">⌘P</span>
          </button>
          <button
            onClick={() => setShowCommandPalette(true)}
            class="toolbar-btn text-gray-400 hover:text-gray-200"
            data-tooltip="Command Palette"
            data-tooltip-pos="bottom"
          >
            <span class="font-mono text-xs">⌘K</span>
          </button>
        </div>
      </header>

      {/* Main content */}
      <main class="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <Show when={showSidebar()}>
          <Sidebar
            onOpenVault={handleOpenVault}
            onOpenVaultSettings={() => setShowVaultSettingsDialog(true)}
          />
        </Show>

        {/* Editor area */}
        <div class="flex-1 flex flex-col overflow-hidden">
          <Show
            when={vaultStore.currentNote() || viewingNotebook() || viewingKanban() || !vaultStore.vault()}
            fallback={
              <div class="flex-1 flex items-center justify-center text-gray-500">
                <div class="text-center space-y-4">
                  <p class="text-xl">Select a note</p>
                  <p class="text-sm">
                    Choose a note from the sidebar or press{" "}
                    <kbd class="px-1.5 py-0.5 bg-gray-700 rounded text-xs">
                      ⌘P
                    </kbd>{" "}
                    to search
                  </p>
                </div>
              </div>
            }
          >
            <Show
              when={viewingKanban()}
              fallback={
                <Show
                  when={viewingNotebook()}
                  fallback={
                    <EditorWithPreview
                      content={currentContent()}
                      onChange={handleChange}
                      onSave={handleSave}
                      filePath={currentFilePath()}
                      absoluteFilePath={currentAbsoluteFilePath()}
                      initialMode="split"
                      config={{
                        vimMode: false,
                        theme: "dark",
                        lineNumbers: true,
                        wordWrap: true,
                      }}
                    />
                  }
                >
                  <NotebookEditor />
                </Show>
              }
            >
              <KanbanEditor />
            </Show>
          </Show>
        </div>
      </main>

      {/* Command Palette */}
      <CommandPalette
        isOpen={showCommandPalette()}
        onClose={() => setShowCommandPalette(false)}
      />

      {/* Quick Open */}
      <QuickOpen
        isOpen={showQuickOpen()}
        onClose={() => setShowQuickOpen(false)}
        onSelect={handleSelectNote}
      />

      {/* Search Panel */}
      <SearchPanel
        isOpen={showSearchPanel()}
        onClose={() => setShowSearchPanel(false)}
        onSelect={handleSelectNote}
      />

      {/* Export Dialog */}
      <ExportDialog
        isOpen={showExportDialog()}
        onClose={() => setShowExportDialog(false)}
        content={currentContent()}
        notePath={vaultStore.selectedPath() || "demo.md"}
      />

      {/* Shortcuts Help */}
      <ShortcutsHelp
        isOpen={showShortcutsHelp()}
        onClose={() => setShowShortcutsHelp(false)}
      />

      {/* Git Panel */}
      <GitPanel
        isOpen={showGitPanel()}
        onClose={() => setShowGitPanel(false)}
      />

      {/* Settings Panel */}
      <SettingsPanel
        isOpen={showSettingsPanel()}
        onClose={() => setShowSettingsPanel(false)}
      />

      {/* Vault Settings Dialog */}
      <VaultSettingsDialog
        isOpen={showVaultSettingsDialog()}
        onClose={() => setShowVaultSettingsDialog(false)}
      />

      {/* Template Dialog */}
      <TemplateDialog
        isOpen={showTemplateDialog()}
        vaultPath={vaultStore.vault()?.path || null}
        onClose={() => setShowTemplateDialog(false)}
        onSelect={handleCreateFromTemplate}
      />

      {/* Save As Template Dialog */}
      <SaveAsTemplateDialog
        isOpen={showSaveAsTemplateDialog()}
        vaultPath={vaultStore.vault()?.path || ""}
        noteContent={parseNote(vaultStore.currentNote()?.content || "").body}
        suggestedName={vaultStore.currentNote()?.path?.split("/").pop()?.replace(".md", "") || ""}
        onClose={() => setShowSaveAsTemplateDialog(false)}
        onSaved={(path) => {
          console.log("Template saved to:", path);
          setShowSaveAsTemplateDialog(false);
        }}
      />

      {/* Password Dialog for encryption */}
      <PasswordDialog
        isOpen={encryptionStore.showPasswordDialog()}
        title="Unlock Encryption"
        description="Enter your encryption password to decrypt content."
        onConfirm={async (password, saveToKeychain) => {
          await encryptionStore.handlePasswordConfirm(password, saveToKeychain);
        }}
        onCancel={() => encryptionStore.cancelPasswordDialog()}
      />

      {/* New Note Dialog */}
      <Show when={showNewNoteDialog()}>
        <div
          class="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          onClick={(e) => e.target === e.currentTarget && setShowNewNoteDialog(false)}
        >
          <div class="bg-gray-800 rounded-2xl w-[420px] border border-gray-700 shadow-xl flex flex-col" style={{ padding: "28px 32px", gap: "20px" }}>
            <h3 class="text-lg font-semibold text-gray-100">New Note</h3>
            <input
              ref={(el) => setTimeout(() => el?.focus(), 10)}
              type="text"
              placeholder="Note name..."
              value={newNoteName()}
              onInput={(e) => setNewNoteName(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateNote();
                if (e.key === "Escape") setShowNewNoteDialog(false);
              }}
              class="w-full bg-gray-700 border border-gray-600 rounded-lg text-sm text-gray-100 placeholder-gray-500 outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              style={{ padding: "14px 16px" }}
            />
            <div class="flex justify-end" style={{ gap: "16px" }}>
              <button
                onClick={() => setShowNewNoteDialog(false)}
                class="text-sm font-medium text-gray-400 hover:text-gray-200 hover:bg-gray-700 rounded-lg transition-colors"
                style={{ padding: "12px 24px" }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateNote}
                class="text-sm font-medium bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors"
                style={{ padding: "12px 24px" }}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      </Show>

      {/* New Notebook Dialog */}
      <Show when={showNewNotebookDialog()}>
        <div
          class="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          onClick={(e) => e.target === e.currentTarget && setShowNewNotebookDialog(false)}
        >
          <div class="bg-gray-800 rounded-2xl w-[420px] border border-gray-700 shadow-xl flex flex-col" style={{ padding: "28px 32px", gap: "16px" }}>
            <div>
              <h3 class="text-lg font-semibold text-gray-100" style={{ "margin-bottom": "8px" }}>New Notebook</h3>
              <p class="text-sm text-gray-400">
                A notebook is a block-based document that can contain executable code.
              </p>
            </div>
            <input
              ref={(el) => setTimeout(() => el?.focus(), 10)}
              type="text"
              placeholder="Notebook name..."
              value={newNotebookName()}
              onInput={(e) => setNewNotebookName(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateNotebook();
                if (e.key === "Escape") setShowNewNotebookDialog(false);
              }}
              class="w-full bg-gray-700 border border-gray-600 rounded-lg text-sm text-gray-100 placeholder-gray-500 outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              style={{ padding: "14px 16px" }}
            />
            <div class="flex justify-end" style={{ gap: "16px" }}>
              <button
                onClick={() => setShowNewNotebookDialog(false)}
                class="text-sm font-medium text-gray-400 hover:text-gray-200 hover:bg-gray-700 rounded-lg transition-colors"
                style={{ padding: "12px 24px" }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateNotebook}
                class="text-sm font-medium bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors"
                style={{ padding: "12px 24px" }}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      </Show>

      {/* New Kanban Dialog */}
      <Show when={showNewKanbanDialog()}>
        <div
          class="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          onClick={(e) => e.target === e.currentTarget && setShowNewKanbanDialog(false)}
        >
          <div class="bg-gray-800 rounded-2xl w-[420px] border border-gray-700 shadow-xl flex flex-col" style={{ padding: "28px 32px", gap: "16px" }}>
            <div>
              <h3 class="text-lg font-semibold text-gray-100" style={{ "margin-bottom": "8px" }}>New Kanban Board</h3>
              <p class="text-sm text-gray-400">
                A kanban board for organizing tasks with drag-and-drop columns.
              </p>
            </div>
            <input
              ref={(el) => setTimeout(() => el?.focus(), 10)}
              type="text"
              placeholder="Board name..."
              value={newKanbanName()}
              onInput={(e) => setNewKanbanName(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateKanban();
                if (e.key === "Escape") setShowNewKanbanDialog(false);
              }}
              class="w-full bg-gray-700 border border-gray-600 rounded-lg text-sm text-gray-100 placeholder-gray-500 outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              style={{ padding: "14px 16px" }}
            />
            <div class="flex justify-end" style={{ gap: "16px" }}>
              <button
                onClick={() => setShowNewKanbanDialog(false)}
                class="text-sm font-medium text-gray-400 hover:text-gray-200 hover:bg-gray-700 rounded-lg transition-colors"
                style={{ padding: "12px 24px" }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateKanban}
                class="text-sm font-medium bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors"
                style={{ padding: "12px 24px" }}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      </Show>

    </div>
  );
}

export default App;
