/**
 * Editor mode toggle component
 */

import { For } from "solid-js";

export type EditorMode = "source" | "split" | "preview";

export interface EditorModeToggleProps {
  mode: EditorMode;
  onChange: (mode: EditorMode) => void;
}

const modes: { value: EditorMode; label: string; icon: string; shortcut: string }[] = [
  { value: "source", label: "Source", icon: "code", shortcut: "⌘1" },
  { value: "split", label: "Split", icon: "split", shortcut: "⌘2" },
  { value: "preview", label: "Preview", icon: "eye", shortcut: "⌘3" },
];

export function EditorModeToggle(props: EditorModeToggleProps) {
  return (
    <div class="flex items-center bg-gray-700/50 rounded-lg p-1 gap-0.5">
      <For each={modes}>
        {(mode) => (
          <button
            onClick={() => props.onChange(mode.value)}
            class={`px-3 py-1.5 text-xs rounded-md transition-colors flex items-center gap-2 ${
              props.mode === mode.value
                ? "bg-gray-700 text-gray-100"
                : "text-gray-400 hover:text-gray-200 hover:bg-gray-700/50"
            }`}
            title={`${mode.label} (${mode.shortcut})`}
          >
            <ModeIcon type={mode.icon} />
            <span class="hidden sm:inline">{mode.label}</span>
          </button>
        )}
      </For>
    </div>
  );
}

function ModeIcon(props: { type: string }) {
  switch (props.type) {
    case "code":
      return (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
          <path d="M4.72 3.22a.75.75 0 0 1 1.06 1.06L2.06 8l3.72 3.72a.75.75 0 1 1-1.06 1.06L.47 8.53a.75.75 0 0 1 0-1.06l4.25-4.25zm6.56 0a.75.75 0 1 0-1.06 1.06L13.94 8l-3.72 3.72a.75.75 0 1 0 1.06 1.06l4.25-4.25a.75.75 0 0 0 0-1.06l-4.25-4.25z" />
        </svg>
      );
    case "split":
      return (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
          <path d="M1.5 3.25c0-.966.784-1.75 1.75-1.75h9.5c.966 0 1.75.784 1.75 1.75v9.5a1.75 1.75 0 0 1-1.75 1.75h-9.5a1.75 1.75 0 0 1-1.75-1.75v-9.5zM3.25 3a.25.25 0 0 0-.25.25v9.5c0 .138.112.25.25.25H7V3H3.25zM8.5 3v10h4.25a.25.25 0 0 0 .25-.25v-9.5a.25.25 0 0 0-.25-.25H8.5z" />
        </svg>
      );
    case "eye":
      return (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 2c1.981 0 3.671.992 4.933 2.078 1.27 1.091 2.187 2.345 2.637 3.023a1.62 1.62 0 0 1 0 1.798c-.45.678-1.367 1.932-2.637 3.023C11.67 13.008 9.981 14 8 14c-1.981 0-3.671-.992-4.933-2.078C1.797 10.831.88 9.577.43 8.899a1.62 1.62 0 0 1 0-1.798c.45-.678 1.367-1.932 2.637-3.023C4.33 2.992 6.019 2 8 2zM1.679 7.932a.12.12 0 0 0 0 .136c.411.622 1.241 1.75 2.366 2.717C5.176 11.758 6.527 12.5 8 12.5c1.473 0 2.825-.742 3.955-1.715 1.124-.967 1.954-2.096 2.366-2.717a.12.12 0 0 0 0-.136c-.412-.621-1.242-1.75-2.366-2.717C10.824 4.242 9.473 3.5 8 3.5c-1.473 0-2.825.742-3.955 1.715-1.124.967-1.954 2.096-2.366 2.717zM8 10a2 2 0 1 1-.001-3.999A2 2 0 0 1 8 10z" />
        </svg>
      );
    default:
      return null;
  }
}

export default EditorModeToggle;
