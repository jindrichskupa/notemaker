/**
 * Git Status Indicator - Shows git status in header
 */

import { createSignal, createEffect, Show, onCleanup } from "solid-js";
import { vaultStore } from "../lib/store/vault";
import { gitStatus, type GitStatus } from "../lib/git";

export interface GitStatusIndicatorProps {
  onClick?: () => void;
}

export function GitStatusIndicator(props: GitStatusIndicatorProps) {
  const [status, setStatus] = createSignal<GitStatus | null>(null);

  // Refresh status periodically and when vault changes
  createEffect(() => {
    const vault = vaultStore.vault();
    if (!vault) {
      setStatus(null);
      return;
    }

    // Initial fetch
    fetchStatus(vault.path);

    // Refresh every 10 seconds
    const interval = setInterval(() => {
      fetchStatus(vault.path);
    }, 10000);

    onCleanup(() => clearInterval(interval));
  });

  const fetchStatus = async (vaultPath: string) => {
    try {
      const result = await gitStatus(vaultPath);
      setStatus(result);
    } catch {
      setStatus(null);
    }
  };

  const totalChanges = () => {
    const s = status();
    if (!s) return 0;
    return s.staged_count + s.unstaged_count + s.untracked_count;
  };

  return (
    <Show when={status()?.is_repo}>
      <button
        onClick={props.onClick}
        class="flex items-center gap-1.5 px-2 py-1 text-xs text-gray-400 hover:text-gray-200 hover:bg-gray-700 rounded transition-colors"
        title="Git Status (⌘⇧G)"
      >
        {/* Git branch icon */}
        <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
          <path d="M9.5 3.25a2.25 2.25 0 1 1 3 2.122V6A2.5 2.5 0 0 1 10 8.5H6a1 1 0 0 0-1 1v1.128a2.251 2.251 0 1 1-1.5 0V5.372a2.25 2.25 0 1 1 1.5 0v1.836A2.493 2.493 0 0 1 6 7h4a1 1 0 0 0 1-1v-.628A2.25 2.25 0 0 1 9.5 3.25Zm-6 0a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0Zm8.25-.75a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5ZM4.25 12a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Z" />
        </svg>
        <span class="font-mono">{status()?.branch || "main"}</span>
        <Show when={totalChanges() > 0}>
          <span class="flex items-center justify-center w-4 h-4 bg-blue-600 rounded-full text-[10px] text-white font-medium">
            {totalChanges()}
          </span>
        </Show>
      </button>
    </Show>
  );
}

export default GitStatusIndicator;
