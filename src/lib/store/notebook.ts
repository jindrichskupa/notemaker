/**
 * Notebook store - manages state for block-based notebook editing
 */

import { createSignal, createRoot } from "solid-js";
import {
  Notebook,
  NotebookBlock,
  BlockType,
  InterpreterSettings,
  createNotebook,
  readNotebook,
  addNotebookBlock,
  updateNotebookBlock,
  deleteNotebookBlock,
  moveNotebookBlock,
  changeBlockType,
  executeCodeBlockAsync,
  terminateCodeBlock,
  getParentPath,
  getVaultConfig,
} from "../fs";
import { vaultStore } from "./vault";
import type { NotebookBlockDef } from "../templates";

export interface BlockOutput {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  running: boolean;
}

function createNotebookStore() {
  // Current notebook state
  const [notebook, setNotebook] = createSignal<Notebook | null>(null);
  const [isLoading, setIsLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [activeBlockId, setActiveBlockId] = createSignal<string | null>(null);
  const [blockOutputs, setBlockOutputs] = createSignal<Record<string, BlockOutput>>({});

  // Dirty state per block
  const [dirtyBlocks, setDirtyBlocks] = createSignal<Set<string>>(new Set());

  // Auto-save timer per block
  const autoSaveTimers: Record<string, ReturnType<typeof setTimeout>> = {};
  const AUTO_SAVE_DELAY = 1500;

  /**
   * Open a notebook
   */
  async function open(path: string): Promise<void> {
    setIsLoading(true);
    setError(null);

    try {
      const nb = await readNotebook(path);
      setNotebook(nb);
      setActiveBlockId(nb.blocks[0]?.id || null);
      setDirtyBlocks(new Set<string>());
      setBlockOutputs({});
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to open notebook";
      setError(message);
      console.error("Failed to open notebook:", err);
    } finally {
      setIsLoading(false);
    }
  }

  /**
   * Create a new notebook
   */
  async function create(path: string, title?: string): Promise<void> {
    setIsLoading(true);
    setError(null);

    try {
      const nb = await createNotebook(path, title);
      setNotebook(nb);
      setActiveBlockId(nb.blocks[0]?.id || null);
      setDirtyBlocks(new Set<string>());
      setBlockOutputs({});
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create notebook";
      setError(message);
      console.error("Failed to create notebook:", err);
    } finally {
      setIsLoading(false);
    }
  }

  /**
   * Create a notebook from template
   */
  async function createFromTemplate(path: string, blocks: NotebookBlockDef[]): Promise<void> {
    setIsLoading(true);
    setError(null);

    try {
      // Create notebook with first block
      const firstBlock = blocks[0];
      const nb = await createNotebook(path);

      // If first block is different from default, change it
      if (firstBlock && nb.blocks[0]) {
        const firstBlockId = nb.blocks[0].id;
        if (firstBlock.type === "code" && firstBlock.language) {
          await changeBlockType(nb.path, firstBlockId, "code", firstBlock.language);
        }
        // Update content
        await updateNotebookBlock(nb.path, firstBlockId, firstBlock.content);
      }

      // Add remaining blocks
      let lastBlockId = nb.blocks[0]?.id;
      for (let i = 1; i < blocks.length; i++) {
        const blockDef = blocks[i];
        const blockType: BlockType = blockDef.type;
        const newBlock = await addNotebookBlock(
          nb.path,
          blockType,
          blockDef.language,
          lastBlockId
        );
        // Update content
        await updateNotebookBlock(nb.path, newBlock.id, blockDef.content);
        lastBlockId = newBlock.id;
      }

      // Reload the notebook to get fresh state
      const finalNotebook = await readNotebook(path);
      setNotebook(finalNotebook);
      setActiveBlockId(finalNotebook.blocks[0]?.id || null);
      setDirtyBlocks(new Set<string>());
      setBlockOutputs({});
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create notebook from template";
      setError(message);
      console.error("Failed to create notebook from template:", err);
    } finally {
      setIsLoading(false);
    }
  }

  /**
   * Close current notebook
   */
  function close(): void {
    // Clear auto-save timers
    Object.values(autoSaveTimers).forEach(clearTimeout);

    setNotebook(null);
    setActiveBlockId(null);
    setDirtyBlocks(new Set<string>());
    setBlockOutputs({});
    setError(null);
  }

  /**
   * Add a new block
   */
  async function addBlock(
    type: BlockType,
    language?: string,
    afterBlockId?: string
  ): Promise<string | null> {
    const nb = notebook();
    if (!nb) return null;

    try {
      const block = await addNotebookBlock(nb.path, type, language, afterBlockId);

      // Update local state
      const blocks = [...nb.blocks];
      if (afterBlockId) {
        const idx = blocks.findIndex((b) => b.id === afterBlockId);
        if (idx !== -1) {
          blocks.splice(idx + 1, 0, block);
        } else {
          blocks.push(block);
        }
      } else {
        blocks.push(block);
      }

      setNotebook({ ...nb, blocks });
      setActiveBlockId(block.id);

      return block.id;
    } catch (err) {
      console.error("Failed to add block:", err);
      return null;
    }
  }

  /**
   * Update block content locally (with debounced save)
   */
  function updateBlockContent(blockId: string, content: string): void {
    const nb = notebook();
    if (!nb) return;

    // Update local state immediately
    const blocks = nb.blocks.map((b) =>
      b.id === blockId ? { ...b, content } : b
    );
    setNotebook({ ...nb, blocks });

    // Mark as dirty
    setDirtyBlocks((prev) => new Set(prev).add(blockId));

    // Schedule auto-save
    if (autoSaveTimers[blockId]) {
      clearTimeout(autoSaveTimers[blockId]);
    }

    autoSaveTimers[blockId] = setTimeout(() => {
      saveBlock(blockId);
    }, AUTO_SAVE_DELAY);
  }

  /**
   * Save a block to disk
   */
  async function saveBlock(blockId: string): Promise<void> {
    const nb = notebook();
    if (!nb) return;

    const block = nb.blocks.find((b) => b.id === blockId);
    if (!block) return;

    try {
      await updateNotebookBlock(nb.path, blockId, block.content);
      setDirtyBlocks((prev) => {
        const next = new Set(prev);
        next.delete(blockId);
        return next;
      });
    } catch (err) {
      console.error("Failed to save block:", err);
    }
  }

  /**
   * Save all dirty blocks
   */
  async function saveAll(): Promise<void> {
    const dirty = dirtyBlocks();
    for (const blockId of dirty) {
      await saveBlock(blockId);
    }
  }

  /**
   * Delete a block
   */
  async function deleteBlock(blockId: string): Promise<void> {
    const nb = notebook();
    if (!nb) return;

    // Don't delete last block
    if (nb.blocks.length <= 1) return;

    try {
      await deleteNotebookBlock(nb.path, blockId);

      const blocks = nb.blocks.filter((b) => b.id !== blockId);
      setNotebook({ ...nb, blocks });

      // Update active block if needed
      if (activeBlockId() === blockId) {
        setActiveBlockId(blocks[0]?.id || null);
      }

      // Clear dirty state
      setDirtyBlocks((prev) => {
        const next = new Set(prev);
        next.delete(blockId);
        return next;
      });

      // Clear auto-save timer
      if (autoSaveTimers[blockId]) {
        clearTimeout(autoSaveTimers[blockId]);
        delete autoSaveTimers[blockId];
      }
    } catch (err) {
      console.error("Failed to delete block:", err);
    }
  }

  /**
   * Move a block to a new position
   */
  async function moveBlock(blockId: string, newIndex: number): Promise<void> {
    const nb = notebook();
    if (!nb) return;

    try {
      await moveNotebookBlock(nb.path, blockId, newIndex);

      // Update local state
      const blocks = [...nb.blocks];
      const currentIdx = blocks.findIndex((b) => b.id === blockId);
      if (currentIdx !== -1) {
        const [block] = blocks.splice(currentIdx, 1);
        blocks.splice(newIndex, 0, block);
        setNotebook({ ...nb, blocks });
      }
    } catch (err) {
      console.error("Failed to move block:", err);
    }
  }

  /**
   * Change block type
   */
  async function changeType(
    blockId: string,
    newType: BlockType,
    newLanguage?: string
  ): Promise<void> {
    const nb = notebook();
    if (!nb) return;

    try {
      const updatedBlock = await changeBlockType(nb.path, blockId, newType, newLanguage);

      const blocks = nb.blocks.map((b) =>
        b.id === blockId ? updatedBlock : b
      );
      setNotebook({ ...nb, blocks });
    } catch (err) {
      console.error("Failed to change block type:", err);
    }
  }

  /**
   * Set block output (from code execution)
   */
  function setBlockOutput(blockId: string, output: Partial<BlockOutput>): void {
    setBlockOutputs((prev) => {
      const existing = prev[blockId] || {
        stdout: "",
        stderr: "",
        exitCode: null,
        running: false,
      };
      return {
        ...prev,
        [blockId]: {
          ...existing,
          ...output,
        },
      };
    });
  }

  /**
   * Clear block output
   */
  function clearBlockOutput(blockId: string): void {
    setBlockOutputs((prev) => {
      const next = { ...prev };
      delete next[blockId];
      return next;
    });
  }

  /**
   * Get block by ID
   */
  function getBlock(blockId: string): NotebookBlock | undefined {
    return notebook()?.blocks.find((b) => b.id === blockId);
  }

  /**
   * Check if block is dirty
   */
  function isBlockDirty(blockId: string): boolean {
    return dirtyBlocks().has(blockId);
  }

  /**
   * Navigate to next/previous block
   */
  function navigateBlock(direction: "up" | "down"): void {
    const nb = notebook();
    const active = activeBlockId();
    if (!nb || !active) return;

    const idx = nb.blocks.findIndex((b) => b.id === active);
    if (idx === -1) return;

    if (direction === "up" && idx > 0) {
      setActiveBlockId(nb.blocks[idx - 1].id);
    } else if (direction === "down" && idx < nb.blocks.length - 1) {
      setActiveBlockId(nb.blocks[idx + 1].id);
    }
  }

  /**
   * Get interpreter for a language from vault config
   */
  function getInterpreterForLanguage(language: string, interpreters: InterpreterSettings): string | undefined {
    const lang = language.toLowerCase();
    switch (lang) {
      case "shell":
      case "bash":
      case "sh":
        return interpreters.shell || undefined;
      case "python":
        return interpreters.python || undefined;
      case "ruby":
        return interpreters.ruby || undefined;
      case "javascript":
      case "node":
        return interpreters.node || undefined;
      default:
        return undefined;
    }
  }

  /**
   * Execute a code block
   */
  async function runCodeBlock(blockId: string): Promise<void> {
    const nb = notebook();
    if (!nb) return;

    const block = nb.blocks.find((b) => b.id === blockId);
    if (!block || block.type !== "code" || !block.language) return;

    // Mark as running
    setBlockOutput(blockId, { running: true, stdout: "", stderr: "", exitCode: null });

    try {
      // Use notebook's parent directory as working directory
      const workingDir = getParentPath(nb.path);

      // Get interpreter from vault config
      let interpreter: string | undefined;
      const vault = vaultStore.vault();
      if (vault) {
        try {
          const config = await getVaultConfig(vault.path);
          interpreter = getInterpreterForLanguage(block.language, config.interpreters);
        } catch {
          // Use default interpreter if config fails
        }
      }

      const result = await executeCodeBlockAsync(blockId, block.language, block.content, workingDir, interpreter);

      setBlockOutput(blockId, {
        running: false,
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exit_code,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Execution failed";
      setBlockOutput(blockId, {
        running: false,
        stdout: "",
        stderr: message,
        exitCode: -1,
      });
    }
  }

  /**
   * Terminate a running code block
   */
  async function terminateBlock(blockId: string): Promise<void> {
    try {
      await terminateCodeBlock(blockId);
      setBlockOutput(blockId, {
        running: false,
        stdout: blockOutputs()[blockId]?.stdout || "",
        stderr: blockOutputs()[blockId]?.stderr + "\n[Terminated]",
        exitCode: -15, // SIGTERM
      });
    } catch (err) {
      console.error("Failed to terminate block:", err);
    }
  }

  return {
    // State
    notebook,
    isLoading,
    error,
    activeBlockId,
    blockOutputs,
    dirtyBlocks,

    // Actions
    open,
    create,
    createFromTemplate,
    close,
    addBlock,
    updateBlockContent,
    saveBlock,
    saveAll,
    deleteBlock,
    moveBlock,
    changeType,
    setActiveBlockId,
    setBlockOutput,
    clearBlockOutput,
    getBlock,
    isBlockDirty,
    navigateBlock,
    runCodeBlock,
    terminateBlock,
  };
}

export const notebookStore = createRoot(createNotebookStore);
