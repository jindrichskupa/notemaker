/**
 * Tree view component for file navigation
 */

import { createSignal, For, Show } from "solid-js";
import { TreeNode } from "../lib/store/vault";
import {
  ChevronRightIcon,
  ChevronDownIcon,
  FolderIcon,
  FolderOpenIcon,
  MarkdownIcon,
} from "./Icons";

export interface FileStatusInfo {
  /** "added" | "modified" | "deleted" */
  status: string;
  staged: boolean;
}

export interface TreeViewProps {
  nodes: TreeNode[];
  selectedPath: string | null;
  onSelect: (path: string) => void;
  onToggle: (path: string) => void;
  onContextMenu?: (node: TreeNode, event: MouseEvent) => void;
  onDrop?: (source: string, target: string) => void;
  /** Set of dirty (unsaved) file paths */
  dirtyPaths?: Set<string>;
  /** Map of relative path to git status */
  gitStatus?: Map<string, FileStatusInfo>;
  /** Vault base path for resolving relative paths */
  vaultPath?: string;
}

export function TreeView(props: TreeViewProps) {
  return (
    <div class="tree-view overflow-y-auto flex-1">
      <For each={props.nodes}>
        {(node) => (
          <TreeNodeComponent
            node={node}
            depth={0}
            selectedPath={props.selectedPath}
            onSelect={props.onSelect}
            onToggle={props.onToggle}
            onContextMenu={props.onContextMenu}
            onDrop={props.onDrop}
            dirtyPaths={props.dirtyPaths}
            gitStatus={props.gitStatus}
            vaultPath={props.vaultPath}
          />
        )}
      </For>
    </div>
  );
}

interface TreeNodeComponentProps {
  node: TreeNode;
  depth: number;
  selectedPath: string | null;
  onSelect: (path: string) => void;
  onToggle: (path: string) => void;
  onContextMenu?: (node: TreeNode, event: MouseEvent) => void;
  onDrop?: (source: string, target: string) => void;
  dirtyPaths?: Set<string>;
  gitStatus?: Map<string, FileStatusInfo>;
  vaultPath?: string;
}

function TreeNodeComponent(props: TreeNodeComponentProps) {
  const [isDragOver, setIsDragOver] = createSignal(false);

  const isSelected = () => props.selectedPath === props.node.path;
  const isExpanded = () => props.node.isExpanded;
  const isFolder = () => props.node.type === "folder";
  // Notebooks are folders that end with .md
  const isNotebook = () => isFolder() && props.node.name.endsWith(".md");
  // Kanbans are folders that end with .kanban
  const isKanban = () => isFolder() && props.node.name.endsWith(".kanban");

  const handleClick = () => {
    if (isNotebook() || isKanban()) {
      // Notebooks and Kanbans should be opened, not just expanded
      props.onSelect(props.node.path);
    } else if (isFolder()) {
      props.onToggle(props.node.path);
    } else {
      props.onSelect(props.node.path);
    }
  };

  const handleContextMenu = (e: MouseEvent) => {
    e.preventDefault();
    props.onContextMenu?.(props.node, e);
  };

  const handleDragStart = (e: DragEvent) => {
    e.stopPropagation();
    e.dataTransfer!.setData("text/plain", props.node.path);
    e.dataTransfer!.effectAllowed = "copyMove";
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    if (isFolder() && !isNotebook() && !isKanban()) {
      e.dataTransfer!.dropEffect = "move";
      setIsDragOver(true);
    } else {
      e.dataTransfer!.dropEffect = "none";
    }
  };

  const handleDragEnter = (e: DragEvent) => {
    e.preventDefault();
    if (isFolder() && !isNotebook() && !isKanban()) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e: DragEvent) => {
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (!isFolder() || isNotebook() || isKanban()) return;
    const sourcePath = e.dataTransfer!.getData("text/plain");
    if (sourcePath && sourcePath !== props.node.path) {
      if (props.node.path.startsWith(sourcePath + "/")) {
        return;
      }
      props.onDrop?.(sourcePath, props.node.path);
    }
  };

  // Get display name (show full name with extension)
  const displayName = () => props.node.name;

  // Check if file is dirty (unsaved)
  const isDirty = () => props.dirtyPaths?.has(props.node.path) ?? false;

  // Get git status for this file
  const getGitStatus = (): FileStatusInfo | undefined => {
    if (!props.gitStatus || !props.vaultPath) return undefined;
    // Convert absolute path to relative
    const relativePath = props.node.path.replace(props.vaultPath + "/", "");
    return props.gitStatus.get(relativePath);
  };

  // Get status indicator color
  // Priority: dirty (yellow) > untracked/added (green) > modified (blue)
  const getStatusIndicator = (): { color: string; title: string } | null => {
    if (isDirty()) {
      return { color: "bg-yellow-500", title: "Unsaved changes" };
    }
    const git = getGitStatus();
    if (!git) return null;
    if (git.status === "added") {
      return { color: "bg-green-500", title: "Untracked (new file)" };
    }
    if (git.status === "modified") {
      return { color: "bg-blue-500", title: "Modified (uncommitted)" };
    }
    if (git.status === "deleted") {
      return { color: "bg-red-500", title: "Deleted" };
    }
    return null;
  };

  return (
    <div class="tree-node">
      <div
        class={`flex items-center cursor-pointer hover:bg-gray-700/50 transition-colors ${
          isSelected() ? "bg-blue-600/30 text-blue-300" : "text-gray-300"
        } ${isDragOver() ? "bg-blue-500/20 ring-1 ring-blue-500" : ""}`}
        style={{
          "padding-left": `${props.depth * 12 + 20}px`,
          "padding-right": "16px",
          "padding-top": "8px",
          "padding-bottom": "8px",
          gap: "8px"
        }}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        draggable={true}
        onDragStart={handleDragStart}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Expand/collapse chevron for folders (not for notebooks or kanbans) */}
        <Show
          when={isFolder() && !isNotebook() && !isKanban()}
          fallback={<span class="w-4" />}
        >
          <span class="w-4 h-4 flex items-center justify-center text-gray-500">
            {isExpanded() ? (
              <ChevronDownIcon size={12} />
            ) : (
              <ChevronRightIcon size={12} />
            )}
          </span>
        </Show>

        {/* Icon */}
        <span class="w-4 h-4 flex items-center justify-center text-gray-400">
          <Show
            when={isKanban()}
            fallback={
              <Show
                when={isNotebook()}
                fallback={
                  <Show
                    when={isFolder()}
                    fallback={<MarkdownIcon size={14} />}
                  >
                    {isExpanded() ? (
                      <FolderOpenIcon size={14} />
                    ) : (
                      <FolderIcon size={14} />
                    )}
                  </Show>
                }
              >
                {/* Notebook icon - code/document hybrid */}
                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" class="text-green-400">
                  <path d="M2 2.5A2.5 2.5 0 0 1 4.5 0h8.75a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-.75.75h-2.5a.75.75 0 0 1 0-1.5h1.75v-2h-8a1 1 0 0 0-.714 1.7.75.75 0 1 1-1.072 1.05A2.495 2.495 0 0 1 2 11.5Zm10.5-1h-8a1 1 0 0 0-1 1v6.708A2.486 2.486 0 0 1 4.5 9h8ZM5 12.25a.25.25 0 0 1 .25-.25h3.5a.25.25 0 0 1 .25.25v3.25a.25.25 0 0 1-.4.2l-1.45-1.087a.249.249 0 0 0-.3 0L5.4 15.7a.25.25 0 0 1-.4-.2Z" />
                </svg>
              </Show>
            }
          >
            {/* Kanban icon - columns/board */}
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" class="text-purple-400">
              <path d="M0 1.75C0 .784.784 0 1.75 0h12.5C15.216 0 16 .784 16 1.75v12.5A1.75 1.75 0 0 1 14.25 16H1.75A1.75 1.75 0 0 1 0 14.25ZM6.5 6.5v8h3v-8Zm4.5 8h3.25a.25.25 0 0 0 .25-.25v-8.5h-3.5Zm0-10v-3h-9v3Zm-4.5-3v3h3v-3Zm-4.5 3h3v-3H1.75a.25.25 0 0 0-.25.25Zm0 1v8.5c0 .138.112.25.25.25H5v-8.75Z" />
            </svg>
          </Show>
        </span>

        {/* Name */}
        <span class="truncate text-sm flex-1">{displayName()}</span>

        {/* Status indicator */}
        <Show when={getStatusIndicator()}>
          {(indicator) => (
            <span
              class={`w-2 h-2 rounded-full ${indicator().color} flex-shrink-0`}
              title={indicator().title}
            />
          )}
        </Show>
      </div>

      {/* Children - only for regular folders, not notebooks or kanbans */}
      <Show when={isFolder() && !isNotebook() && !isKanban() && isExpanded() && props.node.children}>
        <div class="tree-node-children">
          <For each={props.node.children}>
            {(child) => (
              <TreeNodeComponent
                node={child}
                depth={props.depth + 1}
                selectedPath={props.selectedPath}
                onSelect={props.onSelect}
                onToggle={props.onToggle}
                onContextMenu={props.onContextMenu}
                onDrop={props.onDrop}
                dirtyPaths={props.dirtyPaths}
                gitStatus={props.gitStatus}
                vaultPath={props.vaultPath}
              />
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}

export default TreeView;
