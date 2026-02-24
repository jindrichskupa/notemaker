/**
 * Notebook Editor - block-based document editor
 *
 * All blocks are unified - just different "languages".
 * Markdown is the default language with rich text editing.
 */

import { For, Index, Show, createSignal } from "solid-js";
import { notebookStore } from "../lib/store/notebook";
import { BlockType } from "../lib/fs";
import { NotebookBlock } from "./NotebookBlock";

export interface NotebookEditorProps {
  // Props can be extended for customization
}

// Quick add options - all are languages now
const QUICK_ADD_LANGUAGES = [
  { language: "markdown", label: "Markdown", icon: "M" },
  { language: "shell", label: "Shell", icon: "$" },
  { language: "python", label: "Python", icon: "Py" },
  { language: "sql", label: "SQL", icon: "DB" },
];

export function NotebookEditor(_props: NotebookEditorProps) {
  const [showAddMenu, setShowAddMenu] = createSignal<string | null>(null);

  const notebook = () => notebookStore.notebook();
  const blocks = () => notebook()?.blocks || [];

  // Add block with given language
  const handleAddBlock = async (language: string, afterBlockId?: string) => {
    // Map language to type for backward compatibility with data model
    const type: BlockType = language === "markdown" ? "markdown" : "code";
    await notebookStore.addBlock(type, language, afterBlockId);
    setShowAddMenu(null);
  };

  const handleRunCode = (blockId: string) => {
    notebookStore.runCodeBlock(blockId);
  };

  const handleMoveBlock = async (blockId: string, direction: "up" | "down") => {
    const blockList = blocks();
    const currentIdx = blockList.findIndex((b) => b.id === blockId);
    if (currentIdx === -1) return;

    const newIdx = direction === "up" ? currentIdx - 1 : currentIdx + 1;
    if (newIdx < 0 || newIdx >= blockList.length) return;

    await notebookStore.moveBlock(blockId, newIdx);

    // Refocus the block after moving - use setTimeout to let DOM settle
    setTimeout(() => {
      const blockElement = document.querySelector(`[data-block-id="${blockId}"]`);
      if (blockElement) {
        // Find the editor inside the block (CodeMirror or textarea)
        const cmEditor = blockElement.querySelector('.cm-content') as HTMLElement;
        const textarea = blockElement.querySelector('textarea') as HTMLTextAreaElement;
        if (cmEditor) {
          cmEditor.focus();
        } else if (textarea) {
          textarea.focus();
        }
      }
    }, 0);
  };

  const handleDeleteBlock = async (blockId: string) => {
    if (blocks().length <= 1) return;
    await notebookStore.deleteBlock(blockId);
  };

  // Change block language
  const handleChangeLanguage = async (blockId: string, newLanguage: string) => {
    // Map language to type for backward compatibility
    const type: BlockType = newLanguage === "markdown" ? "markdown" : "code";
    await notebookStore.changeType(blockId, type, newLanguage);
  };

  // Get language to inherit for new blocks
  const getInheritedLanguage = (afterBlockId?: string): string => {
    // If afterBlockId is specified, inherit from that block
    if (afterBlockId) {
      const block = blocks().find(b => b.id === afterBlockId);
      if (block) {
        return block.language || "markdown";
      }
    }
    // Default to markdown
    return "markdown";
  };

  // Add block button between blocks
  const AddBlockButton = (props: { afterBlockId?: string }) => {
    const menuId = props.afterBlockId || "start";
    const isOpen = () => showAddMenu() === menuId;

    // Quick add with inherited language
    const handleQuickAdd = () => {
      const language = getInheritedLanguage(props.afterBlockId);
      handleAddBlock(language, props.afterBlockId);
      setShowAddMenu(null);
    };

    return (
      <div class="relative flex items-center justify-center py-2 group">
        <div class="absolute inset-x-0 top-1/2 border-t border-gray-700 opacity-0 group-hover:opacity-100 transition-opacity" />

        <button
          onClick={handleQuickAdd}
          class="relative z-10 flex items-center gap-1 px-2 py-1 text-xs text-gray-500 hover:text-gray-300 bg-gray-900 rounded transition-colors"
          title="Add block (same language as above)"
        >
          <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z" />
          </svg>
          Add
        </button>

        <button
          onClick={() => setShowAddMenu(isOpen() ? null : menuId)}
          class="relative z-10 ml-1 px-1 py-1 text-xs text-gray-500 hover:text-gray-300 bg-gray-900 rounded transition-colors"
          title="Choose language"
        >
          <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 11L3 6h10l-5 5z" />
          </svg>
        </button>

        {/* Language menu */}
        <Show when={isOpen()}>
          <div class="absolute top-full mt-1 z-20 flex gap-1 bg-gray-800 border border-gray-700 rounded-lg p-1 shadow-xl">
            <For each={QUICK_ADD_LANGUAGES}>
              {(item) => (
                <button
                  onClick={() => handleAddBlock(item.language, props.afterBlockId)}
                  class="flex items-center gap-1.5 px-2 py-1.5 text-xs text-gray-300 hover:bg-gray-700 rounded transition-colors whitespace-nowrap"
                  title={item.label}
                >
                  <span class="w-5 h-5 flex items-center justify-center bg-gray-700 rounded text-[10px] font-mono">
                    {item.icon}
                  </span>
                  {item.label}
                </button>
              )}
            </For>
          </div>
        </Show>
      </div>
    );
  };

  return (
    <div class="h-full flex flex-col bg-gray-900">
      {/* Header */}
      <div class="flex items-center justify-between border-b border-gray-700 bg-gray-800" style={{ padding: "12px 20px" }}>
        <div class="flex items-center gap-4">
          <div class="flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" class="text-green-400 flex-shrink-0">
              <path d="M2 2.5A2.5 2.5 0 0 1 4.5 0h8.75a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-.75.75h-2.5a.75.75 0 0 1 0-1.5h1.75v-2h-8a1 1 0 0 0-.714 1.7.75.75 0 1 1-1.072 1.05A2.495 2.495 0 0 1 2 11.5Zm10.5-1h-8a1 1 0 0 0-1 1v6.708A2.486 2.486 0 0 1 4.5 9h8ZM5 12.25a.25.25 0 0 1 .25-.25h3.5a.25.25 0 0 1 .25.25v3.25a.25.25 0 0 1-.4.2l-1.45-1.087a.249.249 0 0 0-.3 0L5.4 15.7a.25.25 0 0 1-.4-.2Z" />
            </svg>
            <h2 class="text-sm font-medium text-gray-200 truncate">
              {notebook()?.name || "Untitled Notebook"}
            </h2>
          </div>
          <span class="text-xs text-gray-500 flex-shrink-0">
            {blocks().length} {blocks().length === 1 ? "block" : "blocks"}
          </span>
        </div>

        <div class="flex items-center gap-1">
          {/* Quick add buttons */}
          <For each={QUICK_ADD_LANGUAGES}>
            {(item) => (
              <button
                onClick={() => handleAddBlock(item.language)}
                class="p-2 text-gray-400 hover:text-gray-200 hover:bg-gray-700 rounded transition-colors"
                title={`Add ${item.label} block`}
              >
                <span class="text-xs font-mono">{item.icon}</span>
              </button>
            )}
          </For>
        </div>
      </div>

      {/* Blocks */}
      <div class="flex-1 overflow-y-auto p-4 space-y-2">
        <Show
          when={blocks().length > 0}
          fallback={
            <div class="flex flex-col items-center justify-center h-64 text-gray-500">
              <p class="mb-4">No blocks yet</p>
              <div class="flex gap-2">
                <For each={QUICK_ADD_LANGUAGES}>
                  {(item) => (
                    <button
                      onClick={() => handleAddBlock(item.language)}
                      class="px-3 py-1.5 text-sm bg-gray-800 hover:bg-gray-700 rounded transition-colors"
                    >
                      Add {item.label}
                    </button>
                  )}
                </For>
              </div>
            </div>
          }
        >
          <Index each={blocks()}>
            {(block, index) => (
              <>
                <Show when={index === 0}>
                  <AddBlockButton />
                </Show>

                <NotebookBlock
                  id={block().id}
                  notebookPath={notebook()?.path || ""}
                  onRunCode={() => handleRunCode(block().id)}
                  onAddBlockBelow={() => {
                    // Inherit language from current block, default to markdown
                    const currentBlock = block();
                    const language = currentBlock.language || "markdown";
                    handleAddBlock(language, currentBlock.id);
                  }}
                  onDelete={() => handleDeleteBlock(block().id)}
                  onMoveUp={() => handleMoveBlock(block().id, "up")}
                  onMoveDown={() => handleMoveBlock(block().id, "down")}
                  onChangeLanguage={(lang) => handleChangeLanguage(block().id, lang)}
                  isFirst={index === 0}
                  isLast={index === blocks().length - 1}
                />

                <AddBlockButton afterBlockId={block().id} />
              </>
            )}
          </Index>
        </Show>
      </div>

      {/* Footer with shortcuts help */}
      <div class="border-t border-gray-700 bg-gray-800 text-xs text-gray-500" style={{ padding: "12px 20px" }}>
        <div style={{ display: "flex", "align-items": "center", gap: "24px" }}>
          <span style={{ display: "flex", "align-items": "center", gap: "8px" }}>
            <kbd class="bg-gray-700 rounded font-mono" style={{ padding: "4px 8px" }}>⌘R</kbd>
            <span>run code</span>
          </span>
          <span style={{ display: "flex", "align-items": "center", gap: "8px" }}>
            <kbd class="bg-gray-700 rounded font-mono" style={{ padding: "4px 8px" }}>⌘D</kbd>
            <span>add block</span>
          </span>
          <span style={{ display: "flex", "align-items": "center", gap: "8px" }}>
            <kbd class="bg-gray-700 rounded font-mono" style={{ padding: "4px 8px" }}>⌥↑↓</kbd>
            <span>move block</span>
          </span>
        </div>
      </div>
    </div>
  );
}

export default NotebookEditor;
