import { createSignal, createEffect, For, Show } from "solid-js";
import { gitBranches, gitCheckoutBranch, type BranchInfo } from "../lib/git/api";
import { vaultStore } from "../lib/store/vault";

interface BranchSwitcherProps {
  onSwitch?: () => void;
}

export function BranchSwitcher(props: BranchSwitcherProps) {
  const [branches, setBranches] = createSignal<BranchInfo[]>([]);
  const [isOpen, setIsOpen] = createSignal(false);
  const [isLoading, setIsLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  const currentBranch = () => branches().find(b => b.is_current);
  const vaultPath = () => vaultStore.vault()?.path;

  const loadBranches = async () => {
    const path = vaultPath();
    if (!path) return;

    try {
      const result = await gitBranches(path);
      setBranches(result);
    } catch (e) {
      console.error("Failed to load branches:", e);
    }
  };

  createEffect(() => {
    if (vaultPath()) {
      loadBranches();
    }
  });

  const handleSwitch = async (branchName: string) => {
    const path = vaultPath();
    if (!path) return;

    setIsLoading(true);
    setError(null);

    try {
      await gitCheckoutBranch(path, branchName);
      await loadBranches();
      setIsOpen(false);
      props.onSwitch?.();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div class="relative">
      <button
        onClick={() => setIsOpen(!isOpen())}
        class="flex items-center gap-1 px-2 py-1 text-sm bg-gray-700 hover:bg-gray-600 rounded transition-colors"
        disabled={isLoading()}
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" class="text-gray-400">
          <path d="M11.75 2.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5zm-2.25.75a2.25 2.25 0 1 1 3 2.122V6A2.5 2.5 0 0 1 10 8.5H6a1 1 0 0 0-1 1v1.128a2.251 2.251 0 1 1-1.5 0V5.372a2.25 2.25 0 1 1 1.5 0v1.836A2.493 2.493 0 0 1 6 7h4a1 1 0 0 0 1-1v-.628A2.25 2.25 0 0 1 9.5 3.25zM4.25 12a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5zM3.5 3.25a.75.75 0 1 1 1.5 0 .75.75 0 0 1-1.5 0z"/>
        </svg>
        <span class="text-gray-200">{currentBranch()?.name || "master"}</span>
        <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor" class="text-gray-400">
          <path d="M8 11L3 6h10l-5 5z"/>
        </svg>
      </button>

      <Show when={isOpen()}>
        <div class="absolute top-full left-0 mt-1 z-50 bg-gray-800 border border-gray-700 rounded-lg shadow-xl min-w-[160px]">
          <Show when={error()}>
            <div class="px-3 py-2 text-xs text-red-400">{error()}</div>
          </Show>
          <For each={branches()}>
            {(branch) => (
              <button
                onClick={() => !branch.is_current && handleSwitch(branch.name)}
                class={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 ${
                  branch.is_current
                    ? "text-blue-400 bg-blue-900/20"
                    : "text-gray-300 hover:bg-gray-700"
                }`}
                disabled={branch.is_current || isLoading()}
              >
                <Show when={branch.is_current}>
                  <span class="text-blue-400">●</span>
                </Show>
                <Show when={!branch.is_current}>
                  <span class="w-3"></span>
                </Show>
                {branch.name}
              </button>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}

export default BranchSwitcher;
