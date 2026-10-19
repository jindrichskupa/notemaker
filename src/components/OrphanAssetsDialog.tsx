import { createSignal, createEffect, Show, For } from "solid-js";
import { findOrphanAssets, trashAssets } from "../lib/fs";

export interface OrphanAssetsDialogProps {
  isOpen: boolean;
  vaultPath: string;
  onClose: () => void;
}

export function OrphanAssetsDialog(props: OrphanAssetsDialogProps) {
  const [orphans, setOrphans] = createSignal<string[] | null>(null);
  const [isWorking, setIsWorking] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  createEffect(() => {
    if (!props.isOpen) return;
    setOrphans(null);
    setError(null);
    findOrphanAssets(props.vaultPath)
      .then(setOrphans)
      .catch((e) => setError(String(e)));
  });

  const relative = (path: string) =>
    path.startsWith(props.vaultPath) ? path.slice(props.vaultPath.length + 1) : path;

  const handleTrash = async () => {
    setIsWorking(true);
    setError(null);
    try {
      await trashAssets(props.vaultPath, orphans() ?? []);
      props.onClose();
    } catch (e) {
      setError(String(e));
    } finally {
      setIsWorking(false);
    }
  };

  return (
    <Show when={props.isOpen}>
      <div
        class="fixed inset-0 bg-black/60 z-50 flex items-center justify-center"
        onClick={(e) => e.target === e.currentTarget && props.onClose()}
        onKeyDown={(e) => e.key === "Escape" && props.onClose()}
      >
        <div class="bg-gray-800 rounded-lg shadow-xl w-full max-w-lg border border-gray-700">
          <div class="border-b border-gray-700" style={{ padding: "16px 20px" }}>
            <h2 class="text-lg font-medium text-gray-100">Clean Orphan Assets</h2>
          </div>

          <div style={{ padding: "20px" }}>
            <Show when={orphans()} fallback={<Show when={!error()}><p class="text-sm text-gray-400">Scanning vault...</p></Show>}>
              {(list) => (
                <Show when={list().length > 0} fallback={<p class="text-sm text-gray-400">No orphan assets found.</p>}>
                  <p class="text-sm text-gray-400" style={{ "margin-bottom": "12px" }}>
                    {list().length} file(s) not referenced by any note will be moved to trash.
                    Assets of encrypted notes are always kept.
                  </p>
                  <ul class="text-xs text-gray-300 font-mono bg-gray-900 rounded overflow-y-auto" style={{ padding: "8px 12px", "max-height": "240px" }}>
                    <For each={list()}>{(path) => <li>{relative(path)}</li>}</For>
                  </ul>
                </Show>
              )}
            </Show>

            <Show when={error()}>
              <div class="text-sm text-red-400" style={{ "margin-top": "12px" }}>
                {error()}
              </div>
            </Show>
          </div>

          <div class="flex justify-end border-t border-gray-700" style={{ padding: "16px 20px", gap: "12px" }}>
            <button
              onClick={props.onClose}
              class="text-sm text-gray-400 hover:text-gray-200 rounded transition-colors"
              style={{ padding: "8px 16px" }}
            >
              Cancel
            </button>
            <button
              onClick={handleTrash}
              disabled={isWorking() || !orphans()?.length}
              class="text-sm bg-red-600 hover:bg-red-500 disabled:bg-gray-600 disabled:cursor-not-allowed rounded font-medium transition-colors"
              style={{ padding: "8px 20px" }}
            >
              {isWorking() ? "Moving..." : "Move to Trash"}
            </button>
          </div>
        </div>
      </div>
    </Show>
  );
}
