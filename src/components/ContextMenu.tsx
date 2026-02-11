/**
 * Context menu component
 */

import { Show, For, onMount, onCleanup } from "solid-js";
import { Portal } from "solid-js/web";

export interface ContextMenuItem {
  id: string;
  label: string;
  icon?: string;
  shortcut?: string;
  danger?: boolean;
  disabled?: boolean;
  separator?: boolean;
}

export interface ContextMenuProps {
  isOpen: boolean;
  position: { x: number; y: number };
  items: ContextMenuItem[];
  onClose: () => void;
  onSelect: (id: string) => void;
}

export function ContextMenu(props: ContextMenuProps) {
  let menuRef: HTMLDivElement | undefined;

  // Close on click outside
  const handleClickOutside = (e: MouseEvent) => {
    if (menuRef && !menuRef.contains(e.target as Node)) {
      props.onClose();
    }
  };

  // Close on escape
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      props.onClose();
    }
  };

  onMount(() => {
    document.addEventListener("click", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
  });

  onCleanup(() => {
    document.removeEventListener("click", handleClickOutside);
    document.removeEventListener("keydown", handleKeyDown);
  });

  // Calculate position to keep menu in viewport
  const getPosition = () => {
    const menuWidth = 200;
    const menuHeight = props.items.length * 32 + 8;
    const padding = 8;

    let x = props.position.x;
    let y = props.position.y;

    if (x + menuWidth > window.innerWidth - padding) {
      x = window.innerWidth - menuWidth - padding;
    }

    if (y + menuHeight > window.innerHeight - padding) {
      y = window.innerHeight - menuHeight - padding;
    }

    return { x, y };
  };

  return (
    <Show when={props.isOpen}>
      <Portal>
        <div
          ref={menuRef}
          class="fixed z-50 min-w-[180px] bg-gray-800 border border-gray-700 rounded-lg shadow-xl text-sm"
          style={{
            left: `${getPosition().x}px`,
            top: `${getPosition().y}px`,
            padding: "6px 0",
          }}
        >
          <For each={props.items}>
            {(item) => (
              <Show
                when={!item.separator}
                fallback={<div class="h-px bg-gray-700" style={{ margin: "6px 0" }} />}
              >
                <button
                  class={`w-full text-left flex items-center gap-2 transition-colors ${
                    item.disabled
                      ? "text-gray-500 cursor-not-allowed"
                      : item.danger
                      ? "text-red-400 hover:bg-red-500/20"
                      : "text-gray-300 hover:bg-gray-700"
                  }`}
                  style={{ padding: "8px 16px" }}
                  onClick={() => {
                    if (!item.disabled) {
                      props.onSelect(item.id);
                      props.onClose();
                    }
                  }}
                  disabled={item.disabled}
                >
                  <span class="flex-1">{item.label}</span>
                  <Show when={item.shortcut}>
                    <span class="text-xs text-gray-500">{item.shortcut}</span>
                  </Show>
                </button>
              </Show>
            )}
          </For>
        </div>
      </Portal>
    </Show>
  );
}

export default ContextMenu;
