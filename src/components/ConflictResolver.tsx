/**
 * ConflictResolver - Dialog for resolving merge/rebase/pull conflicts
 */

import { createSignal, For, Show } from "solid-js";
import { gitResolveOurs, gitResolveTheirs, gitAbortMerge, gitAbortRebase, gitCommit, gitContinueRebase } from "../lib/git/api";
import { vaultStore } from "../lib/store/vault";

interface ConflictResolverProps {
  conflicts: string[];
  operation: "merge" | "rebase" | "pull";
  onComplete: () => void;
  onAbort: () => void;
}

export function ConflictResolver(props: ConflictResolverProps) {
  const [resolved, setResolved] = createSignal<Record<string, "ours" | "theirs" | "manual">>({});
  const [isLoading, setIsLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  const vaultPath = () => vaultStore.vault()?.path;
  const resolvedCount = () => Object.keys(resolved()).length;
  const allResolved = () => resolvedCount() === props.conflicts.length;

  const handleResolve = async (filePath: string, resolution: "ours" | "theirs") => {
    const path = vaultPath();
    if (!path) return;

    setIsLoading(true);
    setError(null);

    try {
      if (resolution === "ours") {
        await gitResolveOurs(path, filePath);
      } else {
        await gitResolveTheirs(path, filePath);
      }
      setResolved({ ...resolved(), [filePath]: resolution });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenInEditor = (filePath: string) => {
    const path = vaultPath();
    if (path) {
      vaultStore.selectNote(path + "/" + filePath);
    }
    setResolved({ ...resolved(), [filePath]: "manual" });
  };

  const handleAbort = async () => {
    const path = vaultPath();
    if (!path) return;

    setIsLoading(true);
    try {
      if (props.operation === "rebase") {
        await gitAbortRebase(path);
      } else {
        await gitAbortMerge(path);
      }
      props.onAbort();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleComplete = async () => {
    const path = vaultPath();
    if (!path || !allResolved()) return;

    setIsLoading(true);
    try {
      if (props.operation === "rebase") {
        await gitContinueRebase(path);
      } else {
        await gitCommit(path, `Resolve ${props.operation} conflicts`);
      }
      props.onComplete();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const capitalizeOperation = () => {
    return props.operation.charAt(0).toUpperCase() + props.operation.slice(1);
  };

  return (
    <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div class="bg-gray-800 rounded-lg shadow-xl w-full max-w-lg border border-gray-700">
        {/* Header */}
        <div class="flex items-center justify-between border-b border-gray-700" style={{ padding: "12px 16px" }}>
          <div class="flex items-center" style={{ gap: "8px" }}>
            <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor" class="text-yellow-500">
              <path d="M8.982 1.566a1.13 1.13 0 0 0-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.713c.889 0 1.438-.99.98-1.767L8.982 1.566zM8 5c.535 0 .954.462.9.995l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 5.995A.905.905 0 0 1 8 5zm.002 6a1 1 0 1 1 0 2 1 1 0 0 1 0-2z"/>
            </svg>
            <h2 class="text-lg font-medium text-gray-200">
              {capitalizeOperation()} Conflicts ({props.conflicts.length} files)
            </h2>
          </div>
          <button
            onClick={handleAbort}
            class="text-gray-400 hover:text-gray-200"
            disabled={isLoading()}
          >
            <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor">
              <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/>
            </svg>
          </button>
        </div>

        {/* Content */}
        <div class="max-h-[60vh] overflow-y-auto" style={{ padding: "16px" }}>
          <div style={{ display: "flex", "flex-direction": "column", gap: "12px" }}>
            <Show when={error()}>
              <div class="bg-red-900/30 border border-red-700 rounded text-sm text-red-300" style={{ padding: "8px 12px" }}>
                {error()}
              </div>
            </Show>

            <For each={props.conflicts}>
              {(filePath) => {
                const status = () => resolved()[filePath];
                return (
                  <div class="bg-gray-900 border border-gray-700 rounded-lg" style={{ padding: "12px" }}>
                    <div class="flex items-center justify-between">
                      <span class="text-sm font-mono text-gray-300 truncate flex-1">
                        {filePath}
                      </span>
                      <Show when={status()}>
                        <span class="text-xs text-green-400" style={{ "margin-left": "8px" }}>
                          {status() === "manual" ? "Manual" : status() === "ours" ? "Ours" : "Theirs"}
                        </span>
                      </Show>
                    </div>
                    <Show when={!status()}>
                      <div class="flex" style={{ gap: "8px", "margin-top": "8px" }}>
                        <button
                          onClick={() => handleResolve(filePath, "ours")}
                          disabled={isLoading()}
                          class="text-xs bg-blue-600 hover:bg-blue-700 text-white rounded disabled:opacity-50"
                          style={{ padding: "4px 8px" }}
                        >
                          Keep Ours
                        </button>
                        <button
                          onClick={() => handleResolve(filePath, "theirs")}
                          disabled={isLoading()}
                          class="text-xs bg-purple-600 hover:bg-purple-700 text-white rounded disabled:opacity-50"
                          style={{ padding: "4px 8px" }}
                        >
                          Keep Theirs
                        </button>
                        <button
                          onClick={() => handleOpenInEditor(filePath)}
                          disabled={isLoading()}
                          class="text-xs bg-gray-600 hover:bg-gray-500 text-white rounded disabled:opacity-50"
                          style={{ padding: "4px 8px" }}
                        >
                          Open in Editor
                        </button>
                      </div>
                    </Show>
                  </div>
                );
              }}
            </For>
          </div>
        </div>

        {/* Footer */}
        <div class="flex items-center justify-between border-t border-gray-700" style={{ padding: "12px 16px" }}>
          <span class="text-sm text-gray-400">
            Resolved: {resolvedCount()}/{props.conflicts.length}
          </span>
          <div class="flex" style={{ gap: "8px" }}>
            <button
              onClick={handleAbort}
              disabled={isLoading()}
              class="text-sm bg-gray-700 hover:bg-gray-600 text-gray-300 rounded disabled:opacity-50"
              style={{ padding: "6px 12px" }}
            >
              Abort {capitalizeOperation()}
            </button>
            <button
              onClick={handleComplete}
              disabled={!allResolved() || isLoading()}
              class="text-sm bg-green-600 hover:bg-green-700 text-white rounded disabled:opacity-50"
              style={{ padding: "6px 12px" }}
            >
              Complete {capitalizeOperation()}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ConflictResolver;
