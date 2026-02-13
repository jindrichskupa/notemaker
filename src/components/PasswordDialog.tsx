/**
 * Password Dialog for encryption unlock
 */

import { createSignal, Show } from "solid-js";

export interface PasswordDialogProps {
  isOpen: boolean;
  title?: string;
  description?: string;
  onConfirm: (password: string, saveToKeychain: boolean) => void;
  onCancel: () => void;
}

export function PasswordDialog(props: PasswordDialogProps) {
  const [password, setPassword] = createSignal("");
  const [saveToKeychain, setSaveToKeychain] = createSignal(false);
  const [showPassword, setShowPassword] = createSignal(false);

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    if (password().trim()) {
      props.onConfirm(password(), saveToKeychain());
      setPassword("");
      setSaveToKeychain(false);
    }
  };

  const handleClose = () => {
    setPassword("");
    setSaveToKeychain(false);
    props.onCancel();
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      handleClose();
    }
  };

  return (
    <Show when={props.isOpen}>
      <div
        class="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
        onClick={(e) => e.target === e.currentTarget && handleClose()}
        onKeyDown={handleKeyDown}
      >
        <div class="bg-gray-800 rounded-xl shadow-xl w-full max-w-md border border-gray-700">
          {/* Header */}
          <div class="flex items-center justify-between border-b border-gray-700" style={{ padding: "16px 24px" }}>
            <h2 class="text-lg font-semibold text-gray-100">
              {props.title || "Enter Password"}
            </h2>
            <button
              onClick={handleClose}
              class="p-2 text-gray-400 hover:text-gray-200 hover:bg-gray-700 rounded-lg transition-colors"
            >
              <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor">
                <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.75.75 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 0 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06z" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <form onSubmit={handleSubmit}>
            <div style={{ padding: "24px", display: "flex", "flex-direction": "column", gap: "16px" }}>
              <Show when={props.description}>
                <p class="text-sm text-gray-400">{props.description}</p>
              </Show>

              {/* Password input */}
              <div>
                <label class="block text-sm text-gray-300" style={{ "margin-bottom": "6px" }}>
                  Password
                </label>
                <div class="relative">
                  <input
                    ref={(el) => setTimeout(() => el?.focus(), 10)}
                    type={showPassword() ? "text" : "password"}
                    value={password()}
                    onInput={(e) => setPassword(e.currentTarget.value)}
                    placeholder="Enter encryption password"
                    class="w-full bg-gray-700 border border-gray-600 rounded-lg text-sm text-gray-100 placeholder-gray-500 outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    style={{ padding: "10px 40px 10px 14px" }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword())}
                    class="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-200"
                  >
                    <Show
                      when={showPassword()}
                      fallback={
                        <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor">
                          <path d="M8 3.5c-2.6 0-4.8 1.5-6 4 1.2 2.5 3.4 4 6 4s4.8-1.5 6-4c-1.2-2.5-3.4-4-6-4zm0 6.5c-1.4 0-2.5-1.1-2.5-2.5S6.6 5 8 5s2.5 1.1 2.5 2.5S9.4 10 8 10z" />
                        </svg>
                      }
                    >
                      <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M2.5 1.5l11 11-1 1-2.1-2.1c-.9.4-1.9.6-2.9.6-2.6 0-4.8-1.5-6-4 .5-1 1.2-1.9 2-2.6L1.5 2.5l1-1zm5.5 8c.3 0 .6-.1.9-.2L6.2 6.6c-.1.3-.2.6-.2.9 0 1.4 1.1 2.5 2.5 2.5zm0-6c2.6 0 4.8 1.5 6 4-.3.6-.7 1.2-1.1 1.7l-1.4-1.4c.1-.3.1-.6.1-.8 0-1.4-1.1-2.5-2.5-2.5-.3 0-.6 0-.8.1L6.9 4.3c.4-.2.8-.3 1.1-.3z" />
                      </svg>
                    </Show>
                  </button>
                </div>
              </div>

              {/* Save to keychain checkbox */}
              <label class="flex items-center cursor-pointer" style={{ gap: "8px" }}>
                <input
                  type="checkbox"
                  checked={saveToKeychain()}
                  onChange={(e) => setSaveToKeychain(e.currentTarget.checked)}
                  class="w-4 h-4 rounded border-gray-600 bg-gray-700 text-blue-500 focus:ring-blue-500"
                />
                <span class="text-sm text-gray-300">Remember in system keychain</span>
              </label>
            </div>

            {/* Footer */}
            <div class="flex justify-end border-t border-gray-700" style={{ padding: "16px 24px", gap: "12px" }}>
              <button
                type="button"
                onClick={handleClose}
                class="text-sm text-gray-300 hover:text-gray-100 transition-colors"
                style={{ padding: "10px 20px" }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!password().trim()}
                class="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors"
                style={{ padding: "10px 24px" }}
              >
                Unlock
              </button>
            </div>
          </form>
        </div>
      </div>
    </Show>
  );
}

export default PasswordDialog;
