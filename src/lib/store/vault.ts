/**
 * Vault store - manages application state for the current vault
 */

import { createSignal, createRoot } from "solid-js";
import { VaultInfo, FileEntry, NoteContent } from "../fs";
import * as fs from "../fs";
import { recentVaultsStore } from "./recentVaults";

export interface TreeNode {
  id: string; // Relative path from vault root
  name: string;
  type: "file" | "folder";
  path: string; // Absolute path
  children?: TreeNode[];
  isExpanded?: boolean;
  isLoading?: boolean;
  modified?: number;
}

export interface VaultState {
  // Vault info
  vault: VaultInfo | null;
  isLoading: boolean;
  error: string | null;

  // File tree
  tree: TreeNode[];
  expandedPaths: Set<string>;

  // Current note
  selectedPath: string | null;
  currentNote: NoteContent | null;
  isDirty: boolean;
}

function createVaultStore() {
  // State signals
  const [vault, setVault] = createSignal<VaultInfo | null>(null);
  const [isLoading, setIsLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [tree, setTree] = createSignal<TreeNode[]>([]);
  const [expandedPaths, setExpandedPaths] = createSignal<Set<string>>(
    new Set()
  );
  const [selectedPath, setSelectedPath] = createSignal<string | null>(null);
  const [currentNote, setCurrentNote] = createSignal<NoteContent | null>(null);
  const [isDirty, setIsDirty] = createSignal(false);
  const [isSaving, setIsSaving] = createSignal(false);

  // Auto-save timer
  let autoSaveTimer: ReturnType<typeof setTimeout> | null = null;
  const AUTO_SAVE_DELAY = 2000; // 2 seconds

  function scheduleAutoSave() {
    if (autoSaveTimer) {
      clearTimeout(autoSaveTimer);
    }
    autoSaveTimer = setTimeout(async () => {
      if (isDirty() && currentNote() && selectedPath()) {
        try {
          setIsSaving(true);
          await saveCurrentNote();
        } catch (err) {
          console.error("Auto-save failed:", err);
        } finally {
          setIsSaving(false);
        }
      }
    }, AUTO_SAVE_DELAY);
  }

  // Filter entries to only show valid items
  function filterEntries(entries: FileEntry[]): FileEntry[] {
    return entries.filter((entry) => {
      // Skip all hidden files and folders (including .notemaker)
      if (entry.name.startsWith(".")) {
        return false;
      }
      // Only show markdown files or directories
      return entry.is_directory || entry.name.endsWith(".md");
    });
  }

  // Convert FileEntry to TreeNode
  function fileEntryToTreeNode(
    entry: FileEntry,
    vaultPath: string
  ): TreeNode {
    const relativePath = entry.path.replace(vaultPath, "").replace(/^\//, "");

    // Filter and sort children recursively
    let children: TreeNode[] | undefined;
    if (entry.children) {
      const filteredChildren = filterEntries(entry.children);
      const childNodes = filteredChildren.map((child) =>
        fileEntryToTreeNode(child, vaultPath)
      );
      children = sortTreeNodes(childNodes);
    }

    return {
      id: relativePath,
      name: entry.name,
      type: entry.is_directory ? "folder" : "file",
      path: entry.path,
      modified: entry.modified,
      children,
      isExpanded: expandedPaths().has(entry.path),
    };
  }

  // Sort tree nodes: regular folders first, then notebooks (.md folders) and files together alphabetically
  function sortTreeNodes(nodes: TreeNode[]): TreeNode[] {
    return [...nodes].sort((a, b) => {
      // Check if items are regular folders (not notebooks)
      const aIsRegularFolder = a.type === "folder" && !a.name.endsWith(".md");
      const bIsRegularFolder = b.type === "folder" && !b.name.endsWith(".md");

      // Regular folders come first
      if (aIsRegularFolder && !bIsRegularFolder) return -1;
      if (!aIsRegularFolder && bIsRegularFolder) return 1;

      // Within regular folders, sort alphabetically
      // Within notebooks/files, sort alphabetically
      return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    });
  }

  // Build tree from file entries
  function buildTree(entries: FileEntry[], vaultPath: string): TreeNode[] {
    const filteredEntries = filterEntries(entries);
    const nodes = filteredEntries.map((entry) => fileEntryToTreeNode(entry, vaultPath));
    return sortTreeNodes(nodes);
  }

  // Actions
  async function openVault(path: string): Promise<void> {
    setIsLoading(true);
    setError(null);

    try {
      const vaultInfo = await fs.openVault(path);
      setVault(vaultInfo);

      // Load config and local state
      const [config, localState] = await Promise.all([
        fs.getVaultConfig(path),
        fs.getLocalState(path),
      ]);

      // Set expanded paths based on config
      const defaultExpanded = config.file_tree?.default_expanded || "remember";
      if (defaultExpanded === "remember" && localState.expanded_paths.length > 0) {
        setExpandedPaths(new Set(localState.expanded_paths));
      } else if (defaultExpanded === "all") {
        // Will be set after tree loads
      } else {
        // "none" or empty remember - start collapsed
        setExpandedPaths(new Set<string>());
      }

      // Load initial file tree
      await refreshTree();

      // If default is "all", expand all folders after tree is loaded
      if (defaultExpanded === "all") {
        expandAll();
      }

      // Start file watcher
      await fs.startWatching(path);

      // Remember this vault for next launch
      localStorage.setItem("notemaker:last-vault", path);

      // Add to recent vaults
      recentVaultsStore.addVault(path, vaultInfo.name);

      // Auto-open last note - prefer local state, fallback to localStorage
      const lastNote = localState.last_opened || localStorage.getItem("notemaker:last-note");
      if (lastNote && lastNote.startsWith(path)) {
        try {
          await selectNote(lastNote);
        } catch {
          // Note might have been deleted
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to open vault";
      setError(message);
      console.error("Failed to open vault:", err);
    } finally {
      setIsLoading(false);
    }
  }

  async function closeVault(): Promise<void> {
    await fs.stopWatching();
    setVault(null);
    setTree([]);
    setSelectedPath(null);
    setCurrentNote(null);
    setIsDirty(false);
    setExpandedPaths(new Set<string>());
  }

  async function refreshTree(): Promise<void> {
    const currentVault = vault();
    if (!currentVault) return;

    try {
      const entries = await fs.listDirectory(currentVault.path);
      const newTree = buildTree(entries, currentVault.path);
      setTree(newTree);
    } catch (err) {
      console.error("Failed to refresh tree:", err);
    }
  }

  // Check if a path is a notebook (directory in the tree)
  function isPathNotebook(path: string): boolean {
    const findNode = (nodes: TreeNode[]): TreeNode | undefined => {
      for (const node of nodes) {
        if (node.path === path) return node;
        if (node.children) {
          const found = findNode(node.children);
          if (found) return found;
        }
      }
      return undefined;
    };

    const node = findNode(tree());
    return node?.type === "folder" && path.endsWith(".md");
  }

  async function selectNote(path: string): Promise<void> {
    // Check for unsaved changes
    if (isDirty()) {
      // Auto-save current note before switching
      await saveCurrentNote();
    }

    setSelectedPath(path);

    // Remember last opened note/notebook
    localStorage.setItem("notemaker:last-note", path);
    scheduleSaveLocalState();

    // Check if it's a notebook (folder ending with .md)
    if (isPathNotebook(path)) {
      // Notebooks are handled by notebookStore, not here
      setCurrentNote(null);
      return;
    }

    try {
      const note = await fs.readNote(path);
      setCurrentNote(note);
      setIsDirty(false);
    } catch (err) {
      console.error("Failed to read note:", err);
      setCurrentNote(null);
    }
  }

  async function saveCurrentNote(): Promise<void> {
    const note = currentNote();
    const path = selectedPath();

    if (!note || !path) return;

    try {
      await fs.writeNote(path, note.content);
      setIsDirty(false);
    } catch (err) {
      console.error("Failed to save note:", err);
      throw err;
    }
  }

  function updateNoteContent(content: string): void {
    const note = currentNote();
    if (note) {
      setCurrentNote({ ...note, content });
      setIsDirty(true);
      scheduleAutoSave();
    }
  }

  async function createNote(
    directory: string,
    name: string,
    content?: string
  ): Promise<string> {
    const path = `${directory}/${name}.md`;
    await fs.createNote(path, name, content);
    await refreshTree();
    return path;
  }

  async function createFolder(
    directory: string,
    name: string
  ): Promise<void> {
    const path = `${directory}/${name}`;
    await fs.createDirectory(path);
    await refreshTree();
  }

  async function deleteItem(path: string): Promise<void> {
    const node = findNode(tree(), path);
    if (!node) return;

    if (node.type === "folder") {
      await fs.deleteDirectory(path);
    } else {
      await fs.deleteNote(path);
    }

    // If deleted note was selected, clear selection
    if (selectedPath() === path) {
      setSelectedPath(null);
      setCurrentNote(null);
    }

    await refreshTree();
  }

  async function renameItem(oldPath: string, newName: string): Promise<void> {
    const node = findNode(tree(), oldPath);
    if (!node) return;

    const directory = fs.getParentPath(oldPath);
    const newPath = `${directory}/${newName}${node.type === "file" ? ".md" : ""}`;

    await fs.renameNote(oldPath, newPath);

    // Update selection if renamed note was selected
    if (selectedPath() === oldPath) {
      setSelectedPath(newPath);
    }

    await refreshTree();
  }

  async function moveItem(sourcePath: string, targetDir: string): Promise<void> {
    try {
      const newPath = await fs.moveNote(sourcePath, targetDir);

      // Update selection if moved item was selected
      if (selectedPath() === sourcePath) {
        setSelectedPath(newPath);
      }
      // Also handle if a child of the moved item was selected
      const currentSelected = selectedPath();
      if (currentSelected && currentSelected.startsWith(sourcePath + "/")) {
        const relativePath = currentSelected.substring(sourcePath.length);
        setSelectedPath(newPath + relativePath);
      }

      await refreshTree();
    } catch (err) {
      console.error("Failed to move item:", err);
      throw err;
    }
  }

  // Debounced save for local state
  let saveStateTimer: ReturnType<typeof setTimeout> | null = null;
  function scheduleSaveLocalState(): void {
    if (saveStateTimer) clearTimeout(saveStateTimer);
    saveStateTimer = setTimeout(async () => {
      const v = vault();
      if (!v) return;
      try {
        await fs.saveLocalState(v.path, {
          expanded_paths: Array.from(expandedPaths()),
          last_opened: selectedPath(),
        });
      } catch (err) {
        console.error("Failed to save local state:", err);
      }
    }, 500);
  }

  function toggleExpanded(path: string): void {
    const expanded = new Set(expandedPaths());
    if (expanded.has(path)) {
      expanded.delete(path);
    } else {
      expanded.add(path);
    }
    setExpandedPaths(expanded);

    // Update tree nodes with new expanded state
    setTree((currentTree) => updateExpandedState(currentTree, expanded));

    // Save state
    scheduleSaveLocalState();
  }

  // Collect all folder paths from tree
  function collectFolderPaths(nodes: TreeNode[]): string[] {
    const paths: string[] = [];
    for (const node of nodes) {
      // Only collect regular folders (not notebooks)
      if (node.type === "folder" && !node.name.endsWith(".md")) {
        paths.push(node.path);
        if (node.children) {
          paths.push(...collectFolderPaths(node.children));
        }
      }
    }
    return paths;
  }

  function expandAll(): void {
    const allFolders = collectFolderPaths(tree());
    const expanded = new Set(allFolders);
    setExpandedPaths(expanded);
    setTree((currentTree) => updateExpandedState(currentTree, expanded));
    scheduleSaveLocalState();
  }

  function collapseAll(): void {
    const expanded = new Set<string>();
    setExpandedPaths(expanded);
    setTree((currentTree) => updateExpandedState(currentTree, expanded));
    scheduleSaveLocalState();
  }

  function updateExpandedState(
    nodes: TreeNode[],
    expanded: Set<string>
  ): TreeNode[] {
    return nodes.map((node) => ({
      ...node,
      isExpanded: expanded.has(node.path),
      children: node.children
        ? updateExpandedState(node.children, expanded)
        : undefined,
    }));
  }

  function findNode(nodes: TreeNode[], path: string): TreeNode | undefined {
    for (const node of nodes) {
      if (node.path === path) return node;
      if (node.children) {
        const found = findNode(node.children, path);
        if (found) return found;
      }
    }
    return undefined;
  }

  // Get all notes for quick search (includes both files and notebooks)
  function getAllNotes(): TreeNode[] {
    const notes: TreeNode[] = [];

    function collect(nodes: TreeNode[]): void {
      for (const node of nodes) {
        // Include markdown files
        if (node.type === "file") {
          notes.push(node);
        }
        // Include notebooks (folders ending with .md)
        if (node.type === "folder" && node.name.endsWith(".md")) {
          notes.push(node);
        }
        // Recurse into regular folders (not notebooks)
        if (node.children && !(node.type === "folder" && node.name.endsWith(".md"))) {
          collect(node.children);
        }
      }
    }

    collect(tree());
    return notes.sort((a, b) => (b.modified || 0) - (a.modified || 0));
  }

  function searchNotes(query: string): TreeNode[] {
    const lowerQuery = query.toLowerCase();
    return getAllNotes().filter(
      (note) =>
        note.name.toLowerCase().includes(lowerQuery) ||
        note.id.toLowerCase().includes(lowerQuery)
    );
  }

  return {
    // State
    vault,
    isLoading,
    isSaving,
    error,
    tree,
    expandedPaths,
    selectedPath,
    currentNote,
    isDirty,

    // Actions
    openVault,
    closeVault,
    refreshTree,
    selectNote,
    saveCurrentNote,
    updateNoteContent,
    createNote,
    createFolder,
    deleteItem,
    renameItem,
    moveItem,
    toggleExpanded,
    expandAll,
    collapseAll,
    getAllNotes,
    searchNotes,
    clearSelection,
  };

  /**
   * Clear current note selection
   */
  function clearSelection(): void {
    setSelectedPath(null);
    setCurrentNote(null);
    setIsDirty(false);
  }
}

// Create singleton store
export const vaultStore = createRoot(createVaultStore);
