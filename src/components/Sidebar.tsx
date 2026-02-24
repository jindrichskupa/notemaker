/**
 * Sidebar component with file tree navigation
 */

import { createSignal, createMemo, Show, onMount, onCleanup } from "solid-js";
import { vaultStore, TreeNode } from "../lib/store/vault";
import { TreeView, FileStatusInfo } from "./TreeView";
import { ContextMenu, ContextMenuItem } from "./ContextMenu";
import { TagsPanel } from "./TagsPanel";
import { FolderIcon, FolderPlusIcon, FilePlusIcon, NotebookIcon, KanbanIcon, ChevronDownIcon, ChevronRightIcon } from "./Icons";
import { VaultSwitcher } from "./VaultSwitcher";
import { tagsStore } from "../lib/tags";
import { gitChangedFiles } from "../lib/git/api";

export interface SidebarProps {
  onOpenVault: () => void;
  onOpenVaultSettings?: () => void;
}

export function Sidebar(props: SidebarProps) {
  const [contextMenu, setContextMenu] = createSignal<{
    node: TreeNode;
    position: { x: number; y: number };
  } | null>(null);

  const [isCreatingNote, setIsCreatingNote] = createSignal(false);
  const [isCreatingFolder, setIsCreatingFolder] = createSignal(false);
  const [isCreatingNotebook, setIsCreatingNotebook] = createSignal(false);
  const [isCreatingKanban, setIsCreatingKanban] = createSignal(false);
  const [isRenaming, setIsRenaming] = createSignal(false);
  const [renamingNode, setRenamingNode] = createSignal<TreeNode | null>(null);
  const [newItemName, setNewItemName] = createSignal("");
  const [newItemParent, setNewItemParent] = createSignal<string>("");
  const [selectedTag, setSelectedTag] = createSignal<string | null>(null);

  // Get all tags
  const tags = createMemo(() => tagsStore.getAllTags());

  // Git status for file indicators
  const [gitStatus, setGitStatus] = createSignal<Map<string, FileStatusInfo>>(new Map());

  // Fetch git status
  const refreshGitStatus = async () => {
    const vault = vaultStore.vault();
    if (!vault) return;

    try {
      const files = await gitChangedFiles(vault.path);
      const statusMap = new Map<string, FileStatusInfo>();
      for (const file of files) {
        statusMap.set(file.path, { status: file.status, staged: file.staged });
      }
      setGitStatus(statusMap);
    } catch {
      // Not a git repo or error - clear status
      setGitStatus(new Map());
    }
  };

  // Refresh git status periodically and on mount
  let gitStatusInterval: ReturnType<typeof setInterval> | undefined;

  onMount(() => {
    refreshGitStatus();
    // Refresh every 5 seconds
    gitStatusInterval = setInterval(refreshGitStatus, 5000);
  });

  onCleanup(() => {
    if (gitStatusInterval) clearInterval(gitStatusInterval);
  });

  // Dirty paths (unsaved files) - currently only the active note
  const dirtyPaths = createMemo(() => {
    const paths = new Set<string>();
    if (vaultStore.isDirty() && vaultStore.selectedPath()) {
      paths.add(vaultStore.selectedPath()!);
    }
    return paths;
  });

  // Handle tree node selection
  const handleSelect = async (path: string) => {
    await vaultStore.selectNote(path);
  };

  // Handle tree node toggle (expand/collapse)
  const handleToggle = (path: string) => {
    vaultStore.toggleExpanded(path);
  };

  // Handle context menu
  const handleContextMenu = (node: TreeNode, event: MouseEvent) => {
    setContextMenu({
      node,
      position: { x: event.clientX, y: event.clientY },
    });
  };

  // Handle drag and drop
  const handleDrop = async (sourcePath: string, targetPath: string) => {
    if (targetPath.startsWith(sourcePath + "/") || targetPath === sourcePath) {
      return;
    }

    try {
      await vaultStore.moveItem(sourcePath, targetPath);
    } catch (err) {
      console.error("Failed to move item:", err);
    }
  };

  // Get context menu items based on node type
  const getContextMenuItems = (): ContextMenuItem[] => {
    const node = contextMenu()?.node;
    if (!node) return [];

    const items: ContextMenuItem[] = [];

    // Check if this is a regular folder (not a notebook)
    const isRegularFolder = node.type === "folder" && !node.name.endsWith(".md");

    if (isRegularFolder) {
      items.push(
        { id: "new-note", label: "New Note", shortcut: "⌘N" },
        { id: "new-folder", label: "New Folder" },
        { id: "new-notebook", label: "New Notebook", shortcut: "⌘⇧N" },
        { id: "new-kanban", label: "New Kanban Board" },
        { id: "separator-1", label: "", separator: true }
      );
    }

    items.push(
      { id: "rename", label: "Rename", shortcut: "F2" },
      { id: "separator-2", label: "", separator: true },
      { id: "delete", label: "Delete", danger: true, shortcut: "⌫" }
    );

    return items;
  };

  // Handle context menu action
  const handleContextAction = async (actionId: string) => {
    const node = contextMenu()?.node;
    if (!node) return;

    switch (actionId) {
      case "new-note":
        const noteParent = node.type === "folder" ? node.path : vaultStore.vault()?.path || "";
        setNewItemParent(noteParent);
        setNewItemName("");
        setIsCreatingNote(true);
        break;

      case "new-folder":
        const folderParent = node.type === "folder" ? node.path : vaultStore.vault()?.path || "";
        setNewItemParent(folderParent);
        setNewItemName("");
        setIsCreatingFolder(true);
        break;

      case "new-notebook":
        const notebookParent = node.type === "folder" ? node.path : vaultStore.vault()?.path || "";
        setNewItemParent(notebookParent);
        setNewItemName("");
        setIsCreatingNotebook(true);
        break;

      case "new-kanban":
        const kanbanParent = node.type === "folder" ? node.path : vaultStore.vault()?.path || "";
        setNewItemParent(kanbanParent);
        setNewItemName("");
        setIsCreatingKanban(true);
        break;

      case "rename":
        setRenamingNode(node);
        // Remove .md extension for display
        const baseName = node.name.endsWith(".md") ? node.name.slice(0, -3) : node.name;
        setNewItemName(baseName);
        setIsRenaming(true);
        break;

      case "delete":
        if (confirm(`Delete "${node.name}"?`)) {
          await vaultStore.deleteItem(node.path);
        }
        break;
    }
  };

  // Create new note
  const handleCreateNote = async () => {
    const name = newItemName().trim();
    if (!name) return;

    try {
      const path = await vaultStore.createNote(newItemParent(), name);
      setIsCreatingNote(false);
      setNewItemName("");
      // Select the new note
      await vaultStore.selectNote(path);
    } catch (err) {
      console.error("Failed to create note:", err);
    }
  };

  // Create new folder
  const handleCreateFolder = async () => {
    const name = newItemName().trim();
    if (!name) return;

    try {
      await vaultStore.createFolder(newItemParent(), name);
      setIsCreatingFolder(false);
      setNewItemName("");
    } catch (err) {
      console.error("Failed to create folder:", err);
    }
  };

  // New note in vault root
  const handleNewNote = () => {
    const vault = vaultStore.vault();
    if (!vault) return;
    setNewItemParent(vault.path);
    setNewItemName("");
    setIsCreatingNote(true);
  };

  // New folder in vault root
  const handleNewFolder = () => {
    const vault = vaultStore.vault();
    if (!vault) return;
    setNewItemParent(vault.path);
    setNewItemName("");
    setIsCreatingFolder(true);
  };

  // New notebook in vault root
  const handleNewNotebook = () => {
    const vault = vaultStore.vault();
    if (!vault) return;
    setNewItemParent(vault.path);
    setNewItemName("");
    setIsCreatingNotebook(true);
  };

  // New kanban in vault root
  const handleNewKanban = () => {
    const vault = vaultStore.vault();
    if (!vault) return;
    setNewItemParent(vault.path);
    setNewItemName("");
    setIsCreatingKanban(true);
  };

  // Create new notebook
  const handleCreateNotebook = async () => {
    const name = newItemName().trim();
    if (!name) return;

    try {
      // Ensure name ends with .md
      const notebookName = name.endsWith(".md") ? name : `${name}.md`;
      const path = `${newItemParent()}/${notebookName}`;

      // Import and use notebookStore
      const { notebookStore } = await import("../lib/store/notebook");
      await notebookStore.create(path, name.replace(/\.md$/, ""));

      setIsCreatingNotebook(false);
      setNewItemName("");
      await vaultStore.refreshTree();
      await vaultStore.selectNote(path);
    } catch (err) {
      console.error("Failed to create notebook:", err);
    }
  };

  // Create new kanban board
  const handleCreateKanban = async () => {
    const name = newItemName().trim();
    if (!name) return;

    try {
      // Ensure name ends with .kanban
      const kanbanName = name.endsWith(".kanban") ? name : `${name}.kanban`;
      const path = `${newItemParent()}/${kanbanName}`;

      // Import and use kanbanStore
      const { kanbanStore } = await import("../lib/store/kanban");
      await kanbanStore.create(path, name.replace(/\.kanban$/, ""));

      setIsCreatingKanban(false);
      setNewItemName("");
      await vaultStore.refreshTree();
      await vaultStore.selectNote(path);
    } catch (err) {
      console.error("Failed to create kanban:", err);
    }
  };

  // Rename item
  const handleRename = async () => {
    const node = renamingNode();
    const name = newItemName().trim();
    if (!node || !name) return;

    try {
      await vaultStore.renameItem(node.path, name);
      setIsRenaming(false);
      setRenamingNode(null);
      setNewItemName("");
    } catch (err) {
      console.error("Failed to rename:", err);
    }
  };

  return (
    <aside class="w-64 bg-gray-850 border-r border-gray-700 flex flex-col h-full">
      {/* Header */}
      <div class="flex items-center justify-between border-b border-gray-700" style={{ padding: "12px 16px" }}>
        <VaultSwitcher
          onOpenVault={props.onOpenVault}
          onOpenVaultSettings={props.onOpenVaultSettings}
        />

        <div class="flex items-center gap-1">
          <button
            onClick={() => vaultStore.expandAll()}
            disabled={!vaultStore.vault()}
            class="p-2 text-gray-400 hover:text-gray-200 hover:bg-gray-700 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Expand All"
          >
            <ChevronDownIcon size={14} />
          </button>
          <button
            onClick={() => vaultStore.collapseAll()}
            disabled={!vaultStore.vault()}
            class="p-2 text-gray-400 hover:text-gray-200 hover:bg-gray-700 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Collapse All"
          >
            <ChevronRightIcon size={14} />
          </button>
          <div class="w-px h-4 bg-gray-700" />
          <button
            onClick={handleNewFolder}
            disabled={!vaultStore.vault()}
            class="p-2 text-gray-400 hover:text-gray-200 hover:bg-gray-700 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="New Folder"
          >
            <FolderPlusIcon size={14} />
          </button>
          <button
            onClick={handleNewNote}
            disabled={!vaultStore.vault()}
            class="p-2 text-gray-400 hover:text-gray-200 hover:bg-gray-700 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="New Note (⌘N)"
          >
            <FilePlusIcon size={14} />
          </button>
          <button
            onClick={handleNewNotebook}
            disabled={!vaultStore.vault()}
            class="p-2 text-green-500 hover:text-green-400 hover:bg-gray-700 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="New Notebook (⌘⇧N)"
          >
            <NotebookIcon size={14} />
          </button>
          <button
            onClick={handleNewKanban}
            disabled={!vaultStore.vault()}
            class="p-2 text-purple-500 hover:text-purple-400 hover:bg-gray-700 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="New Kanban"
          >
            <KanbanIcon size={14} />
          </button>
        </div>
      </div>

      {/* Content */}
      <Show
        when={vaultStore.vault()}
        fallback={
          <div class="flex-1 flex flex-col items-center justify-center p-4 gap-4">
            <FolderIcon class="text-gray-600" size={48} />
            <p class="text-sm text-gray-500 text-center">
              Open a vault to start
            </p>
            <button
              onClick={props.onOpenVault}
              class="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm font-medium transition-colors"
            >
              Open Vault
            </button>
          </div>
        }
      >
        {/* Loading state */}
        <Show when={vaultStore.isLoading()}>
          <div class="flex-1 flex items-center justify-center">
            <span class="text-sm text-gray-500">Loading...</span>
          </div>
        </Show>

        {/* Error state */}
        <Show when={vaultStore.error()}>
          <div class="p-4 text-sm text-red-400">
            Error: {vaultStore.error()}
          </div>
        </Show>

        {/* Tree view */}
        <Show when={!vaultStore.isLoading() && !vaultStore.error()}>
          <div class="flex-1 overflow-auto">
            <TreeView
              nodes={vaultStore.tree()}
              selectedPath={vaultStore.selectedPath()}
              onSelect={handleSelect}
              onToggle={handleToggle}
              onContextMenu={handleContextMenu}
              onDrop={handleDrop}
              dirtyPaths={dirtyPaths()}
              gitStatus={gitStatus()}
              vaultPath={vaultStore.vault()?.path}
            />
          </div>

          {/* Tags panel */}
          <Show when={tags().length > 0}>
            <div class="border-t border-gray-700">
              <TagsPanel
                tags={tags()}
                selectedTag={selectedTag()}
                onSelectTag={setSelectedTag}
              />
            </div>
          </Show>
        </Show>
      </Show>

      {/* Context menu */}
      <ContextMenu
        isOpen={!!contextMenu()}
        position={contextMenu()?.position || { x: 0, y: 0 }}
        items={getContextMenuItems()}
        onClose={() => setContextMenu(null)}
        onSelect={handleContextAction}
      />

      {/* Create note dialog */}
      <Show when={isCreatingNote()}>
        <div class="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div class="bg-gray-800 rounded-2xl w-[420px] border border-gray-700 shadow-xl flex flex-col" style={{ padding: "28px 32px", gap: "20px" }}>
            <h3 class="text-lg font-semibold text-gray-100">New Note</h3>
            <input
              ref={(el) => setTimeout(() => el?.focus(), 10)}
              type="text"
              placeholder="Note name..."
              value={newItemName()}
              onInput={(e) => setNewItemName(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateNote();
                if (e.key === "Escape") setIsCreatingNote(false);
              }}
              class="w-full bg-gray-700 border border-gray-600 rounded-lg text-sm text-gray-100 placeholder-gray-500 outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              style={{ padding: "14px 16px" }}
            />
            <div class="flex justify-end" style={{ gap: "16px" }}>
              <button
                onClick={() => setIsCreatingNote(false)}
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

      {/* Create folder dialog */}
      <Show when={isCreatingFolder()}>
        <div class="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div class="bg-gray-800 rounded-2xl w-[420px] border border-gray-700 shadow-xl flex flex-col" style={{ padding: "28px 32px", gap: "20px" }}>
            <h3 class="text-lg font-semibold text-gray-100">New Folder</h3>
            <input
              ref={(el) => setTimeout(() => el?.focus(), 10)}
              type="text"
              placeholder="Folder name..."
              value={newItemName()}
              onInput={(e) => setNewItemName(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateFolder();
                if (e.key === "Escape") setIsCreatingFolder(false);
              }}
              class="w-full bg-gray-700 border border-gray-600 rounded-lg text-sm text-gray-100 placeholder-gray-500 outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              style={{ padding: "14px 16px" }}
            />
            <div class="flex justify-end" style={{ gap: "16px" }}>
              <button
                onClick={() => setIsCreatingFolder(false)}
                class="text-sm font-medium text-gray-400 hover:text-gray-200 hover:bg-gray-700 rounded-lg transition-colors"
                style={{ padding: "12px 24px" }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateFolder}
                class="text-sm font-medium bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors"
                style={{ padding: "12px 24px" }}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      </Show>

      {/* Create notebook dialog */}
      <Show when={isCreatingNotebook()}>
        <div class="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div class="bg-gray-800 rounded-2xl w-[420px] border border-gray-700 shadow-xl flex flex-col" style={{ padding: "28px 32px", gap: "16px" }}>
            <div>
              <h3 class="text-lg font-semibold text-gray-100" style={{ "margin-bottom": "8px" }}>New Notebook</h3>
              <p class="text-sm text-gray-400">
                A notebook can contain executable code blocks.
              </p>
            </div>
            <input
              ref={(el) => setTimeout(() => el?.focus(), 10)}
              type="text"
              placeholder="Notebook name..."
              value={newItemName()}
              onInput={(e) => setNewItemName(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateNotebook();
                if (e.key === "Escape") setIsCreatingNotebook(false);
              }}
              class="w-full bg-gray-700 border border-gray-600 rounded-lg text-sm text-gray-100 placeholder-gray-500 outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              style={{ padding: "14px 16px" }}
            />
            <div class="flex justify-end" style={{ gap: "16px" }}>
              <button
                onClick={() => setIsCreatingNotebook(false)}
                class="text-sm font-medium text-gray-400 hover:text-gray-200 hover:bg-gray-700 rounded-lg transition-colors"
                style={{ padding: "12px 24px" }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateNotebook}
                class="text-sm font-medium bg-green-600 hover:bg-green-500 rounded-lg transition-colors"
                style={{ padding: "12px 24px" }}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      </Show>

      {/* Create kanban dialog */}
      <Show when={isCreatingKanban()}>
        <div class="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div class="bg-gray-800 rounded-2xl w-[420px] border border-gray-700 shadow-xl flex flex-col" style={{ padding: "28px 32px", gap: "16px" }}>
            <div>
              <h3 class="text-lg font-semibold text-gray-100" style={{ "margin-bottom": "8px" }}>New Kanban Board</h3>
              <p class="text-sm text-gray-400">
                A kanban board for organizing tasks in columns.
              </p>
            </div>
            <input
              ref={(el) => setTimeout(() => el?.focus(), 10)}
              type="text"
              placeholder="Kanban board name..."
              value={newItemName()}
              onInput={(e) => setNewItemName(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateKanban();
                if (e.key === "Escape") setIsCreatingKanban(false);
              }}
              class="w-full bg-gray-700 border border-gray-600 rounded-lg text-sm text-gray-100 placeholder-gray-500 outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              style={{ padding: "14px 16px" }}
            />
            <div class="flex justify-end" style={{ gap: "16px" }}>
              <button
                onClick={() => setIsCreatingKanban(false)}
                class="text-sm font-medium text-gray-400 hover:text-gray-200 hover:bg-gray-700 rounded-lg transition-colors"
                style={{ padding: "12px 24px" }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateKanban}
                class="text-sm font-medium bg-purple-600 hover:bg-purple-500 rounded-lg transition-colors"
                style={{ padding: "12px 24px" }}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      </Show>

      {/* Rename dialog */}
      <Show when={isRenaming()}>
        <div class="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div class="bg-gray-800 rounded-2xl w-[420px] border border-gray-700 shadow-xl flex flex-col" style={{ padding: "28px 32px", gap: "20px" }}>
            <h3 class="text-lg font-semibold text-gray-100">Rename</h3>
            <input
              ref={(el) => setTimeout(() => el?.focus(), 10)}
              type="text"
              placeholder="New name..."
              value={newItemName()}
              onInput={(e) => setNewItemName(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleRename();
                if (e.key === "Escape") {
                  setIsRenaming(false);
                  setRenamingNode(null);
                  setNewItemName("");
                }
              }}
              class="w-full bg-gray-700 border border-gray-600 rounded-lg text-sm text-gray-100 placeholder-gray-500 outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              style={{ padding: "14px 16px" }}
            />
            <div class="flex justify-end" style={{ gap: "16px" }}>
              <button
                onClick={() => {
                  setIsRenaming(false);
                  setRenamingNode(null);
                  setNewItemName("");
                }}
                class="text-sm font-medium text-gray-400 hover:text-gray-200 hover:bg-gray-700 rounded-lg transition-colors"
                style={{ padding: "12px 24px" }}
              >
                Cancel
              </button>
              <button
                onClick={handleRename}
                class="text-sm font-medium bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors"
                style={{ padding: "12px 24px" }}
              >
                Rename
              </button>
            </div>
          </div>
        </div>
      </Show>

      {/* Keyboard shortcuts help */}
      <div class="border-t border-gray-700 text-xs text-gray-500" style={{ padding: "16px 20px" }}>
        <div style={{ display: "flex", "flex-direction": "column", gap: "12px" }}>
          <div style={{ display: "flex", "align-items": "center", "justify-content": "space-between" }}>
            <span>Quick Open</span>
            <kbd class="bg-gray-700 rounded text-gray-400 font-mono" style={{ padding: "4px 10px", "font-size": "11px" }}>⌘P</kbd>
          </div>
          <div style={{ display: "flex", "align-items": "center", "justify-content": "space-between" }}>
            <span>Commands</span>
            <kbd class="bg-gray-700 rounded text-gray-400 font-mono" style={{ padding: "4px 10px", "font-size": "11px" }}>⌘K</kbd>
          </div>
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;
