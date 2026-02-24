import { createSignal, Show } from "solid-js";
import { save } from "@tauri-apps/plugin-dialog";
import { generateIdentityFile } from "../lib/fs";

export interface GenerateIdentityDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerated: (path: string, publicKey: string) => void;
}

export function GenerateIdentityDialog(props: GenerateIdentityDialogProps) {
  const [path, setPath] = createSignal("");
  const [isGenerating, setIsGenerating] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  const handleBrowse = async () => {
    const file = await save({
      title: "Save Age Identity File",
      defaultPath: "notemaker-identity.txt",
      filters: [{ name: "Text Files", extensions: ["txt"] }],
    });
    if (file) {
      setPath(file);
    }
  };

  const handleGenerate = async () => {
    const savePath = path().trim();
    if (!savePath) {
      setError("Please choose a save location");
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const publicKey = await generateIdentityFile(savePath);
      props.onGenerated(savePath, publicKey);
      props.onClose();
      setPath("");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    } finally {
      setIsGenerating(false);
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
        <div class="bg-gray-800 rounded-lg shadow-xl w-full max-w-md border border-gray-700">
          <div class="flex items-center justify-between border-b border-gray-700" style={{ padding: "16px 20px" }}>
            <h2 class="text-lg font-medium text-gray-100">Generate New Identity</h2>
            <button
              onClick={props.onClose}
              class="text-gray-400 hover:text-gray-200 rounded transition-colors"
              style={{ padding: "4px" }}
            >
              <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor">
                <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.75.75 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 0 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06z" />
              </svg>
            </button>
          </div>

          <div style={{ padding: "20px" }}>
            <p class="text-sm text-gray-400" style={{ "margin-bottom": "16px" }}>
              This will create a new age identity file. Keep this file secure — it contains your private key.
            </p>

            <div style={{ "margin-bottom": "16px" }}>
              <label class="block text-sm text-gray-300" style={{ "margin-bottom": "6px" }}>
                Save location
              </label>
              <div class="flex" style={{ gap: "8px" }}>
                <input
                  type="text"
                  ref={(el) => setTimeout(() => el?.focus(), 10)}
                  value={path()}
                  onInput={(e) => setPath(e.currentTarget.value)}
                  placeholder="Choose a location..."
                  class="flex-1 bg-gray-700 border border-gray-600 rounded text-sm text-gray-200"
                  style={{ padding: "8px 12px" }}
                />
                <button
                  onClick={handleBrowse}
                  class="text-sm bg-gray-700 border border-gray-600 hover:bg-gray-600 rounded transition-colors"
                  style={{ padding: "8px 16px" }}
                >
                  Browse
                </button>
              </div>
            </div>

            <Show when={error()}>
              <div class="text-sm text-red-400" style={{ "margin-bottom": "16px" }}>
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
              onClick={handleGenerate}
              disabled={isGenerating() || !path().trim()}
              class="text-sm bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed rounded font-medium transition-colors"
              style={{ padding: "8px 20px" }}
            >
              {isGenerating() ? "Generating..." : "Generate"}
            </button>
          </div>
        </div>
      </div>
    </Show>
  );
}
