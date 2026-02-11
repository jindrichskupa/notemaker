/**
 * Table of Contents Panel
 */

import { createSignal, createMemo, For, Show } from "solid-js";
import { extractHeadings, buildTocTree, TocItem } from "../lib/toc";

export interface TableOfContentsProps {
  content: string;
  activeHeadingId?: string;
  onHeadingClick?: (id: string, lineNumber: number) => void;
  minHeadings?: number;
  class?: string;
}

export function TableOfContents(props: TableOfContentsProps) {
  const [isExpanded, setIsExpanded] = createSignal(true);

  // Extract and build TOC
  const headings = createMemo(() => extractHeadings(props.content));
  const tocTree = createMemo(() => buildTocTree(headings()));

  // Find line number for heading
  const findLineNumber = (id: string): number => {
    const lines = props.content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(/^(#{1,6})\s+(.+)$/);
      if (match) {
        const slug = match[2].trim()
          .toLowerCase()
          .replace(/[^\w\s-]/g, "")
          .replace(/\s+/g, "-")
          .replace(/-+/g, "-")
          .replace(/^-|-$/g, "");
        if (slug === id) return i;
      }
    }
    return 0;
  };

  const handleClick = (id: string) => {
    const lineNumber = findLineNumber(id);
    props.onHeadingClick?.(id, lineNumber);
  };

  // Don't render if not enough headings
  const shouldShow = () => headings().length >= (props.minHeadings ?? 2);

  return (
    <Show when={shouldShow()}>
      <div class={`table-of-contents bg-gray-800 border-t border-gray-700 ${props.class || ""}`}>
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
            <span>Contents</span>
          </span>
          <span class="text-xs text-gray-500">{headings().length}</span>
        </button>

        {/* TOC Tree */}
        <Show when={isExpanded()}>
          <nav class="px-2 pb-3 max-h-64 overflow-y-auto">
            <TocList
              items={tocTree()}
              activeId={props.activeHeadingId}
              onItemClick={handleClick}
            />
          </nav>
        </Show>
      </div>
    </Show>
  );
}

/**
 * Recursive TOC list component
 */
function TocList(props: {
  items: TocItem[];
  activeId?: string;
  onItemClick: (id: string) => void;
  depth?: number;
}) {
  const depth = props.depth ?? 0;

  return (
    <ul class={`space-y-0.5 ${depth > 0 ? "ml-3 mt-0.5" : ""}`}>
      <For each={props.items}>
        {(item) => (
          <li>
            <button
              onClick={() => props.onItemClick(item.id)}
              class={`w-full text-left px-2 py-1 text-xs rounded transition-colors truncate ${
                props.activeId === item.id
                  ? "bg-blue-600/30 text-blue-300"
                  : "text-gray-400 hover:text-gray-200 hover:bg-gray-700/50"
              }`}
              title={item.text}
            >
              {item.text}
            </button>
            <Show when={item.children.length > 0}>
              <TocList
                items={item.children}
                activeId={props.activeId}
                onItemClick={props.onItemClick}
                depth={depth + 1}
              />
            </Show>
          </li>
        )}
      </For>
    </ul>
  );
}

/**
 * Inline TOC component for inserting in content
 */
export function InlineToc(props: { content: string; class?: string }) {
  const headings = createMemo(() => extractHeadings(props.content));
  const tocTree = createMemo(() => buildTocTree(headings()));

  return (
    <Show when={headings().length >= 2}>
      <div class={`inline-toc p-4 bg-gray-800/50 rounded-lg border border-gray-700 ${props.class || ""}`}>
        <h4 class="text-sm font-medium text-gray-300 mb-2">Contents</h4>
        <InlineTocList items={tocTree()} />
      </div>
    </Show>
  );
}

function InlineTocList(props: { items: TocItem[]; depth?: number }) {
  const depth = props.depth ?? 0;

  return (
    <ul class={`space-y-1 ${depth > 0 ? "ml-4" : ""}`}>
      <For each={props.items}>
        {(item) => (
          <li>
            <a
              href={`#${item.id}`}
              class="text-sm text-blue-400 hover:text-blue-300 hover:underline"
            >
              {item.text}
            </a>
            <Show when={item.children.length > 0}>
              <InlineTocList items={item.children} depth={depth + 1} />
            </Show>
          </li>
        )}
      </For>
    </ul>
  );
}

export default TableOfContents;
