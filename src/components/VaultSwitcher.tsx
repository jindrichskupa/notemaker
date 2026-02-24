/**
 * VaultSwitcher - dropdown for quick vault switching
 */

import { createSignal, Show, For } from "solid-js";
import { vaultStore } from "../lib/store/vault";
import { recentVaultsStore } from "../lib/store/recentVaults";
import { refreshRecentVaultCommands } from "../lib/commands";
import { ChevronDownIcon, FolderIcon, XIcon } from "./Icons";

export interface VaultSwitcherProps {
  onOpenVault: () => void;
  onOpenVaultSettings?: () => void;
}

export function VaultSwitcher(props: VaultSwitcherProps) {
  const [isOpen, setIsOpen] = createSignal(false);

  const currentVault = () => vaultStore.vault();
  const otherVaults = () => recentVaultsStore.getOtherVaults(currentVault()?.path);

  const handleSwitchVault = async (path: string) => {
    setIsOpen(false);
    // Close current vault first, then open new one
    await vaultStore.closeVault();
    await vaultStore.openVault(path);
    // Refresh vault switch commands
    refreshRecentVaultCommands();
  };

  const handleRemoveFromRecent = (e: MouseEvent, path: string) => {
    e.stopPropagation();
    recentVaultsStore.removeVault(path);
  };

  const handleOpenOtherVault = () => {
    setIsOpen(false);
    props.onOpenVault();
  };

  // Close dropdown when clicking outside
  const handleBackdropClick = () => {
    setIsOpen(false);
  };

  return (
    <div class="relative">
      {/* Current vault button */}
      <button
        onClick={() => setIsOpen(!isOpen())}
        class="flex items-center min-w-0 hover:bg-gray-700 rounded transition-colors"
        style={{ gap: "6px", padding: "4px 8px", "margin-left": "-8px" }}
      >
        <FolderIcon size={14} class="text-blue-400 flex-shrink-0" />
        <span class="text-sm font-medium text-gray-200 truncate max-w-[100px]">
          {currentVault()?.name || "No vault"}
        </span>
        <ChevronDownIcon
          size={12}
          class={`text-gray-400 flex-shrink-0 transition-transform ${isOpen() ? "rotate-180" : ""}`}
        />
      </button>

      {/* Dropdown */}
      <Show when={isOpen()}>
        {/* Backdrop */}
        <div
          class="fixed inset-0 z-40"
          onClick={handleBackdropClick}
        />

        {/* Menu */}
        <div
          class="absolute left-0 top-full z-50 bg-gray-800 border border-gray-700 rounded-lg shadow-xl overflow-hidden"
          style={{ "margin-top": "4px", "min-width": "240px", "max-width": "320px" }}
        >
          {/* Current vault (highlighted) */}
          <Show when={currentVault()}>
            <div
              class="flex items-center bg-gray-700/50 border-b border-gray-700"
              style={{ padding: "10px 12px", gap: "10px" }}
            >
              <FolderIcon size={16} class="text-blue-400 flex-shrink-0" />
              <div class="flex-1 min-w-0">
                <div class="text-sm font-medium text-gray-200 truncate">
                  {currentVault()?.name}
                </div>
                <div class="text-xs text-gray-500 truncate">
                  {currentVault()?.path}
                </div>
              </div>
              <Show when={props.onOpenVaultSettings}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsOpen(false);
                    props.onOpenVaultSettings?.();
                  }}
                  class="p-1 text-gray-500 hover:text-gray-300 hover:bg-gray-600 rounded transition-colors flex-shrink-0"
                  title="Vault Settings"
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M8 4.754a3.246 3.246 0 1 0 0 6.492 3.246 3.246 0 0 0 0-6.492zM5.754 8a2.246 2.246 0 1 1 4.492 0 2.246 2.246 0 0 1-4.492 0z"/>
                    <path d="M9.796 1.343c-.527-1.79-3.065-1.79-3.592 0l-.094.319a.873.873 0 0 1-1.255.52l-.292-.16c-1.64-.892-3.433.902-2.54 2.541l.159.292a.873.873 0 0 1-.52 1.255l-.319.094c-1.79.527-1.79 3.065 0 3.592l.319.094a.873.873 0 0 1 .52 1.255l-.16.292c-.892 1.64.901 3.434 2.541 2.54l.292-.159a.873.873 0 0 1 1.255.52l.094.319c.527 1.79 3.065 1.79 3.592 0l.094-.319a.873.873 0 0 1 1.255-.52l.292.16c1.64.893 3.434-.902 2.54-2.541l-.159-.292a.873.873 0 0 1 .52-1.255l.319-.094c1.79-.527 1.79-3.065 0-3.592l-.319-.094a.873.873 0 0 1-.52-1.255l.16-.292c.893-1.64-.902-3.433-2.541-2.54l-.292.159a.873.873 0 0 1-1.255-.52l-.094-.319zm-2.633.283c.246-.835 1.428-.835 1.674 0l.094.319a1.873 1.873 0 0 0 2.693 1.115l.291-.16c.764-.415 1.6.42 1.184 1.185l-.159.292a1.873 1.873 0 0 0 1.116 2.692l.318.094c.835.246.835 1.428 0 1.674l-.319.094a1.873 1.873 0 0 0-1.115 2.693l.16.291c.415.764-.42 1.6-1.185 1.184l-.291-.159a1.873 1.873 0 0 0-2.693 1.116l-.094.318c-.246.835-1.428.835-1.674 0l-.094-.319a1.873 1.873 0 0 0-2.692-1.115l-.292.16c-.764.415-1.6-.42-1.184-1.185l.159-.291A1.873 1.873 0 0 0 1.945 8.93l-.319-.094c-.835-.246-.835-1.428 0-1.674l.319-.094A1.873 1.873 0 0 0 3.06 4.377l-.16-.292c-.415-.764.42-1.6 1.185-1.184l.292.159a1.873 1.873 0 0 0 2.692-1.115l.094-.319z"/>
                  </svg>
                </button>
              </Show>
            </div>
          </Show>

          {/* Other recent vaults */}
          <Show when={otherVaults().length > 0}>
            <div class="border-b border-gray-700" style={{ "max-height": "200px", "overflow-y": "auto" }}>
              <div class="text-xs text-gray-500 font-medium" style={{ padding: "8px 12px 4px" }}>
                Recent Vaults
              </div>
              <For each={otherVaults()}>
                {(vault) => (
                  <div
                    onClick={() => handleSwitchVault(vault.path)}
                    class="w-full flex items-center text-left hover:bg-gray-700 transition-colors group cursor-pointer"
                    style={{ padding: "8px 12px", gap: "10px" }}
                  >
                    <FolderIcon size={14} class="text-gray-500 flex-shrink-0" />
                    <div class="flex-1 min-w-0">
                      <div class="text-sm text-gray-300 truncate">
                        {vault.name}
                      </div>
                      <div class="text-xs text-gray-600 truncate">
                        {vault.path}
                      </div>
                    </div>
                    <button
                      onClick={(e) => handleRemoveFromRecent(e, vault.path)}
                      class="p-1 text-gray-600 hover:text-gray-400 hover:bg-gray-600 rounded transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0"
                      title="Remove from recent"
                    >
                      <XIcon size={12} />
                    </button>
                  </div>
                )}
              </For>
            </div>
          </Show>

          {/* Open other vault */}
          <button
            onClick={handleOpenOtherVault}
            class="w-full flex items-center text-left hover:bg-gray-700 transition-colors text-blue-400"
            style={{ padding: "10px 12px", gap: "10px" }}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" class="flex-shrink-0">
              <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/>
              <path d="M7.646 1.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1-.708.708L8.5 2.707V11.5a.5.5 0 0 1-1 0V2.707L5.354 4.854a.5.5 0 1 1-.708-.708l3-3z"/>
            </svg>
            <span class="text-sm">Open Another Vault...</span>
          </button>
        </div>
      </Show>
    </div>
  );
}

export default VaultSwitcher;
