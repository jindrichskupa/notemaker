/**
 * Backlinks Panel - Shows notes that link to the current note
 */

import { createSignal, For, Show } from "solid-js";

export interface BacklinkInfo {
  path: string;
  name: string;
  excerpt?: string;
}

export interface BacklinksPanelProps {
  backlinks: BacklinkInfo[];
  onSelectNote: (path: string) => void;
  class?: string;
}

export function BacklinksPanel(props: BacklinksPanelProps) {
  const [isExpanded, setIsExpanded] = createSignal(true);

  return (
    <div class={`backlinks-panel bg-gray-800 border-t border-gray-700 ${props.class || ""}`}>
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded())}
        class="w-full flex items-center justify-between px-4 py-2 text-sm text-gray-400 hover:text-gray-200 transition-colors"
      >
        <span class="flex items-center gap-2">
          <svg
            width="12"
            height="12"
            viewBox="0 0 16 16"
            fill="currentColor"
            class={`transform transition-transform ${isExpanded() ? "rotate-90" : ""}`}
          >
            <path d="M6 4l4 4-4 4V4z" />
          </svg>
          <span>Backlinks</span>
        </span>
        <span class="px-1.5 py-0.5 text-xs bg-gray-700 rounded">
          {props.backlinks.length}
        </span>
      </button>

      {/* Content */}
      <Show when={isExpanded()}>
        <div class="px-4 pb-4">
          <Show
            when={props.backlinks.length > 0}
            fallback={
              <div class="text-sm text-gray-500 py-2">
                No backlinks yet
              </div>
            }
          >
            <div class="space-y-2">
              <For each={props.backlinks}>
                {(backlink) => (
                  <button
                    onClick={() => props.onSelectNote(backlink.path)}
                    class="w-full text-left p-2 bg-gray-700/50 hover:bg-gray-700 rounded transition-colors"
                  >
                    <div class="flex items-center gap-2">
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 16 16"
                        fill="currentColor"
                        class="text-gray-500 flex-shrink-0"
                      >
                        <path d="M1 3.5A1.5 1.5 0 0 1 2.5 2h3.879a1.5 1.5 0 0 1 1.06.44l1.122 1.12A1.5 1.5 0 0 0 9.62 4H13.5A1.5 1.5 0 0 1 15 5.5v7a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 1 12.5v-9z" />
                      </svg>
                      <span class="text-sm text-gray-200 truncate">
                        {backlink.name}
                      </span>
                    </div>
                    <Show when={backlink.excerpt}>
                      <p class="text-xs text-gray-500 mt-1 line-clamp-2">
                        {backlink.excerpt}
                      </p>
                    </Show>
                  </button>
                )}
              </For>
            </div>
          </Show>
        </div>
      </Show>
    </div>
  );
}

/**
 * Outgoing Links Panel - Shows notes that the current note links to
 */
export interface OutgoingLinkInfo {
  target: string;
  alias?: string;
  exists: boolean;
  resolvedPath?: string;
}

export interface OutgoingLinksPanelProps {
  links: OutgoingLinkInfo[];
  onSelectNote: (path: string) => void;
  onCreateNote?: (name: string) => void;
  class?: string;
}

export function OutgoingLinksPanel(props: OutgoingLinksPanelProps) {
  const [isExpanded, setIsExpanded] = createSignal(false);

  return (
    <div class={`outgoing-links-panel bg-gray-800 border-t border-gray-700 ${props.class || ""}`}>
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded())}
        class="w-full flex items-center justify-between px-4 py-2 text-sm text-gray-400 hover:text-gray-200 transition-colors"
      >
        <span class="flex items-center gap-2">
          <svg
            width="12"
            height="12"
            viewBox="0 0 16 16"
            fill="currentColor"
            class={`transform transition-transform ${isExpanded() ? "rotate-90" : ""}`}
          >
            <path d="M6 4l4 4-4 4V4z" />
          </svg>
          <span>Outgoing Links</span>
        </span>
        <span class="px-1.5 py-0.5 text-xs bg-gray-700 rounded">
          {props.links.length}
        </span>
      </button>

      {/* Content */}
      <Show when={isExpanded()}>
        <div class="px-4 pb-4">
          <Show
            when={props.links.length > 0}
            fallback={
              <div class="text-sm text-gray-500 py-2">
                No links in this note
              </div>
            }
          >
            <div class="space-y-1">
              <For each={props.links}>
                {(link) => (
                  <div
                    class={`flex items-center justify-between p-2 rounded transition-colors ${
                      link.exists
                        ? "bg-gray-700/50 hover:bg-gray-700 cursor-pointer"
                        : "bg-red-900/20 border border-red-900/30"
                    }`}
                    onClick={() => {
                      if (link.exists && link.resolvedPath) {
                        props.onSelectNote(link.resolvedPath);
                      }
                    }}
                  >
                    <div class="flex items-center gap-2">
                      <Show
                        when={link.exists}
                        fallback={
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 16 16"
                            fill="currentColor"
                            class="text-red-400 flex-shrink-0"
                          >
                            <path d="M8 4a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 8 4zm0 8a1 1 0 1 0 0-2 1 1 0 0 0 0 2z" />
                            <path fill-rule="evenodd" d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zM0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8z" />
                          </svg>
                        }
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 16 16"
                          fill="currentColor"
                          class="text-blue-400 flex-shrink-0"
                        >
                          <path d="M7.775 3.275a.75.75 0 0 0 1.06 1.06l1.25-1.25a2 2 0 1 1 2.83 2.83l-2.5 2.5a2 2 0 0 1-2.83 0 .75.75 0 0 0-1.06 1.06 3.5 3.5 0 0 0 4.95 0l2.5-2.5a3.5 3.5 0 0 0-4.95-4.95l-1.25 1.25z" />
                          <path d="M8.225 12.725a.75.75 0 0 0-1.06-1.06l-1.25 1.25a2 2 0 1 1-2.83-2.83l2.5-2.5a2 2 0 0 1 2.83 0 .75.75 0 0 0 1.06-1.06 3.5 3.5 0 0 0-4.95 0l-2.5 2.5a3.5 3.5 0 0 0 4.95 4.95l1.25-1.25z" />
                        </svg>
                      </Show>
                      <span
                        class={`text-sm truncate ${
                          link.exists ? "text-gray-200" : "text-red-300"
                        }`}
                      >
                        {link.alias || link.target}
                      </span>
                    </div>
                    <Show when={!link.exists && props.onCreateNote}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          props.onCreateNote?.(link.target);
                        }}
                        class="text-xs text-blue-400 hover:text-blue-300"
                      >
                        Create
                      </button>
                    </Show>
                  </div>
                )}
              </For>
            </div>
          </Show>
        </div>
      </Show>
    </div>
  );
}

export default BacklinksPanel;
