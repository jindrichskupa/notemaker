/**
 * Git Panel - UI for git operations
 */

import { createSignal, createEffect, For, Show } from "solid-js";
import { vaultStore } from "../lib/store/vault";
import {
  gitStatus,
  gitChangedFiles,
  gitStageAll,
  gitStage,
  gitUnstage,
  gitCommit,
  gitDiscard,
  gitLog,
  gitInit,
  formatCommitTime,
  type GitStatus,
  type FileStatus,
  type CommitInfo,
} from "../lib/git";

export interface GitPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

type TabType = "changes" | "history";

export function GitPanel(props: GitPanelProps) {
  const [activeTab, setActiveTab] = createSignal<TabType>("changes");
  const [status, setStatus] = createSignal<GitStatus | null>(null);
  const [changedFiles, setChangedFiles] = createSignal<FileStatus[]>([]);
  const [commits, setCommits] = createSignal<CommitInfo[]>([]);
  const [commitMessage, setCommitMessage] = createSignal("");
  const [isLoading, setIsLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  // Refresh git status when panel opens or vault changes
  createEffect(() => {
    if (props.isOpen && vaultStore.vault()) {
      refreshStatus();
    }
  });

  const refreshStatus = async () => {
    const vault = vaultStore.vault();
    if (!vault) return;

    setIsLoading(true);
    setError(null);

    try {
      const [statusResult, filesResult] = await Promise.all([
        gitStatus(vault.path),
        gitChangedFiles(vault.path).catch(() => []),
      ]);

      setStatus(statusResult);
      setChangedFiles(filesResult);

      if (statusResult.is_repo) {
        const logsResult = await gitLog(vault.path, 20);
        setCommits(logsResult);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to get git status");
    } finally {
      setIsLoading(false);
    }
  };

  const handleInit = async () => {
    const vault = vaultStore.vault();
    if (!vault) return;

    try {
      await gitInit(vault.path);
      await refreshStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to initialize git");
    }
  };

  const handleStageAll = async () => {
    const vault = vaultStore.vault();
    if (!vault) return;

    try {
      await gitStageAll(vault.path);
      await refreshStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to stage files");
    }
  };

  const handleStageFile = async (filePath: string) => {
    const vault = vaultStore.vault();
    if (!vault) return;

    try {
      await gitStage(vault.path, filePath);
      await refreshStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to stage file");
    }
  };

  const handleUnstageFile = async (filePath: string) => {
    const vault = vaultStore.vault();
    if (!vault) return;

    try {
      await gitUnstage(vault.path, filePath);
      await refreshStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to unstage file");
    }
  };

  const handleDiscardFile = async (filePath: string) => {
    const vault = vaultStore.vault();
    if (!vault) return;

    if (!confirm(`Discard changes to "${filePath}"? This cannot be undone.`)) {
      return;
    }

    try {
      await gitDiscard(vault.path, filePath);
      await refreshStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to discard changes");
    }
  };

  const handleCommit = async () => {
    const vault = vaultStore.vault();
    const message = commitMessage().trim();
    if (!vault || !message) return;

    try {
      await gitCommit(vault.path, message);
      setCommitMessage("");
      await refreshStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to commit");
    }
  };

  const stagedFiles = () => changedFiles().filter((f) => f.staged);
  const unstagedFiles = () => changedFiles().filter((f) => !f.staged);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "added":
        return <span class="text-green-400">A</span>;
      case "modified":
        return <span class="text-yellow-400">M</span>;
      case "deleted":
        return <span class="text-red-400">D</span>;
      default:
        return <span class="text-gray-400">?</span>;
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      props.onClose();
    }
  };

  return (
    <Show when={props.isOpen}>
      <div
        class="fixed inset-0 bg-black/60 z-50 flex items-center justify-center"
        onClick={(e) => e.target === e.currentTarget && props.onClose()}
        onKeyDown={handleKeyDown}
      >
        <div class="bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col border border-gray-700">
          {/* Header */}
          <div class="flex items-center justify-between border-b border-gray-700" style={{ padding: "12px 16px" }}>
            <div class="flex items-center" style={{ gap: "12px" }}>
              <h2 class="text-lg font-medium text-gray-100">Git</h2>
              <Show when={status()?.branch}>
                <span class="px-2 py-0.5 bg-gray-700 rounded text-xs text-gray-300">
                  {status()?.branch}
                </span>
              </Show>
            </div>
            <div class="flex items-center" style={{ gap: "8px" }}>
              <button
                onClick={refreshStatus}
                class="p-1.5 text-gray-400 hover:text-gray-200 hover:bg-gray-700 rounded transition-colors"
                title="Refresh"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2v1z" />
                  <path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466z" />
                </svg>
              </button>
              <button
                onClick={props.onClose}
                class="p-1.5 text-gray-400 hover:text-gray-200 hover:bg-gray-700 rounded transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.75.75 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 0 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06z" />
                </svg>
              </button>
            </div>
          </div>

          {/* Not a repo */}
          <Show when={status() && !status()?.is_repo}>
            <div class="flex-1 flex flex-col items-center justify-center" style={{ padding: "32px", gap: "16px" }}>
              <svg width="48" height="48" viewBox="0 0 16 16" fill="currentColor" class="text-gray-600">
                <path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z" />
              </svg>
              <p class="text-gray-400">This vault is not a Git repository</p>
              <button
                onClick={handleInit}
                style={{ padding: "8px 16px" }}
                class="bg-blue-600 hover:bg-blue-700 rounded text-sm font-medium transition-colors"
              >
                Initialize Git Repository
              </button>
            </div>
          </Show>

          {/* Repo content */}
          <Show when={status()?.is_repo}>
            {/* Tabs */}
            <div class="flex border-b border-gray-700">
              <button
                onClick={() => setActiveTab("changes")}
                style={{ padding: "8px 16px" }}
                class={`text-sm font-medium transition-colors ${
                  activeTab() === "changes"
                    ? "text-blue-400 border-b-2 border-blue-400"
                    : "text-gray-400 hover:text-gray-200"
                }`}
              >
                Changes
                <Show when={changedFiles().length > 0}>
                  <span class="ml-2 px-1.5 py-0.5 bg-gray-700 rounded text-xs">
                    {changedFiles().length}
                  </span>
                </Show>
              </button>
              <button
                onClick={() => setActiveTab("history")}
                style={{ padding: "8px 16px" }}
                class={`text-sm font-medium transition-colors ${
                  activeTab() === "history"
                    ? "text-blue-400 border-b-2 border-blue-400"
                    : "text-gray-400 hover:text-gray-200"
                }`}
              >
                History
              </button>
            </div>

            {/* Tab content */}
            <div class="flex-1 overflow-y-auto">
              {/* Changes tab */}
              <Show when={activeTab() === "changes"}>
                <div style={{ padding: "16px", display: "flex", "flex-direction": "column", gap: "16px" }}>
                  {/* Error */}
                  <Show when={error()}>
                    <div class="bg-red-900/30 border border-red-700 rounded text-sm text-red-300" style={{ padding: "12px" }}>
                      {error()}
                    </div>
                  </Show>

                  {/* No changes */}
                  <Show when={!isLoading() && changedFiles().length === 0}>
                    <div class="text-center py-8 text-gray-500">
                      No changes to commit
                    </div>
                  </Show>

                  {/* Staged files */}
                  <Show when={stagedFiles().length > 0}>
                    <div>
                      <div class="flex items-center justify-between" style={{ "margin-bottom": "8px" }}>
                        <h3 class="text-sm font-medium text-gray-300">
                          Staged Changes ({stagedFiles().length})
                        </h3>
                      </div>
                      <div style={{ display: "flex", "flex-direction": "column", gap: "4px" }}>
                        <For each={stagedFiles()}>
                          {(file) => (
                            <div class="flex items-center justify-between bg-gray-700/50 rounded" style={{ padding: "6px 8px" }}>
                              <div class="flex items-center" style={{ gap: "8px" }}>
                                {getStatusIcon(file.status)}
                                <span class="text-sm text-gray-200 font-mono">
                                  {file.path}
                                </span>
                              </div>
                              <button
                                onClick={() => handleUnstageFile(file.path)}
                                class="px-2 py-0.5 text-xs text-gray-400 hover:text-gray-200 hover:bg-gray-600 rounded"
                              >
                                Unstage
                              </button>
                            </div>
                          )}
                        </For>
                      </div>
                    </div>
                  </Show>

                  {/* Unstaged files */}
                  <Show when={unstagedFiles().length > 0}>
                    <div>
                      <div class="flex items-center justify-between" style={{ "margin-bottom": "8px" }}>
                        <h3 class="text-sm font-medium text-gray-300">
                          Changes ({unstagedFiles().length})
                        </h3>
                        <button
                          onClick={handleStageAll}
                          style={{ padding: "4px 8px" }}
                          class="text-xs text-blue-400 hover:text-blue-300 hover:bg-gray-700 rounded transition-colors"
                        >
                          Stage All
                        </button>
                      </div>
                      <div style={{ display: "flex", "flex-direction": "column", gap: "4px" }}>
                        <For each={unstagedFiles()}>
                          {(file) => (
                            <div class="flex items-center justify-between bg-gray-700/30 rounded" style={{ padding: "6px 8px" }}>
                              <div class="flex items-center" style={{ gap: "8px" }}>
                                {getStatusIcon(file.status)}
                                <span class="text-sm text-gray-300 font-mono">
                                  {file.path}
                                </span>
                              </div>
                              <div class="flex items-center" style={{ gap: "4px" }}>
                                <button
                                  onClick={() => handleStageFile(file.path)}
                                  class="px-2 py-0.5 text-xs text-gray-400 hover:text-gray-200 hover:bg-gray-600 rounded"
                                >
                                  Stage
                                </button>
                                <button
                                  onClick={() => handleDiscardFile(file.path)}
                                  class="px-2 py-0.5 text-xs text-red-400 hover:text-red-300 hover:bg-gray-600 rounded"
                                >
                                  Discard
                                </button>
                              </div>
                            </div>
                          )}
                        </For>
                      </div>
                    </div>
                  </Show>

                  {/* Commit form */}
                  <Show when={stagedFiles().length > 0}>
                    <div class="border-t border-gray-700" style={{ "padding-top": "16px" }}>
                      <textarea
                        value={commitMessage()}
                        onInput={(e) => setCommitMessage(e.currentTarget.value)}
                        placeholder="Commit message..."
                        rows={3}
                        style={{ padding: "8px 12px" }}
                        class="w-full bg-gray-700 border border-gray-600 rounded text-sm text-gray-100 placeholder-gray-500 outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && e.metaKey) {
                            handleCommit();
                          }
                        }}
                      />
                      <div class="flex items-center justify-between" style={{ "margin-top": "8px" }}>
                        <span class="text-xs text-gray-500">
                          ⌘↵ to commit
                        </span>
                        <button
                          onClick={handleCommit}
                          disabled={!commitMessage().trim()}
                          style={{ padding: "6px 16px" }}
                          class="text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded transition-colors"
                        >
                          Commit
                        </button>
                      </div>
                    </div>
                  </Show>
                </div>
              </Show>

              {/* History tab */}
              <Show when={activeTab() === "history"}>
                <div style={{ padding: "16px" }}>
                  <Show
                    when={commits().length > 0}
                    fallback={
                      <div class="text-center text-gray-500" style={{ padding: "32px 0" }}>
                        No commits yet
                      </div>
                    }
                  >
                    <div style={{ display: "flex", "flex-direction": "column", gap: "8px" }}>
                      <For each={commits()}>
                        {(commit) => (
                          <div class="bg-gray-700/30 rounded hover:bg-gray-700/50 transition-colors" style={{ padding: "8px 12px" }}>
                            <div class="flex items-start justify-between" style={{ gap: "16px" }}>
                              <div class="flex-1 min-w-0">
                                <p class="text-sm text-gray-200 truncate">
                                  {commit.message.split("\n")[0]}
                                </p>
                                <p class="text-xs text-gray-500 mt-1">
                                  {commit.author} &middot;{" "}
                                  {formatCommitTime(commit.timestamp)}
                                </p>
                              </div>
                              <code class="text-xs text-gray-500 font-mono">
                                {commit.id.slice(0, 7)}
                              </code>
                            </div>
                          </div>
                        )}
                      </For>
                    </div>
                  </Show>
                </div>
              </Show>
            </div>
          </Show>

          {/* Loading overlay */}
          <Show when={isLoading()}>
            <div class="absolute inset-0 bg-gray-800/80 flex items-center justify-center">
              <span class="text-gray-400">Loading...</span>
            </div>
          </Show>
        </div>
      </div>
    </Show>
  );
}

export default GitPanel;
