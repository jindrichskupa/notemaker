/**
 * Markdown preview component
 */

import { createSignal, createEffect, Show } from "solid-js";
import { renderMarkdown } from "../lib/markdown";
import { renderMermaidDiagrams, hasMermaidDiagrams } from "../lib/markdown/mermaid";
import { debounce } from "../lib/utils";

export interface PreviewProps {
  content: string;
  class?: string;
  /** Path to the current note file (for resolving relative image paths) */
  basePath?: string;
}

export function Preview(props: PreviewProps) {
  const [html, setHtml] = createSignal("");
  const [isRendering, setIsRendering] = createSignal(false);
  let containerRef: HTMLDivElement | undefined;
  let contentRef: HTMLDivElement | undefined;

  // Debounced render to avoid excessive re-renders while typing
  const debouncedRender = debounce(async (content: string, basePath?: string) => {
    setIsRendering(true);
    try {
      const rendered = await renderMarkdown(content, basePath);
      setHtml(rendered);

      // Render mermaid diagrams after HTML is set
      if (contentRef && hasMermaidDiagrams(rendered)) {
        // Use requestAnimationFrame to ensure DOM is updated
        requestAnimationFrame(async () => {
          if (contentRef) {
            await renderMermaidDiagrams(contentRef);
          }
        });
      }
    } catch (err) {
      console.error("Preview render error:", err);
    } finally {
      setIsRendering(false);
    }
  }, 150);

  // Re-render when content or basePath changes
  createEffect(() => {
    const content = props.content;
    const basePath = props.basePath;
    debouncedRender(content, basePath);
  });

  // Handle checkbox clicks in preview
  const handleClick = (e: MouseEvent) => {
    const target = e.target as HTMLElement;

    // Handle checkbox clicks
    if (target.tagName === "INPUT" && target.getAttribute("type") === "checkbox") {
      // Checkboxes are read-only in preview for now
      e.preventDefault();
    }

    // Handle link clicks - open external links
    if (target.tagName === "A") {
      const href = target.getAttribute("href");
      if (href?.startsWith("http://") || href?.startsWith("https://")) {
        e.preventDefault();
        // Open external links in default browser
        window.open(href, "_blank");
      }
    }
  };

  return (
    <div
      ref={containerRef}
      class={`preview-container h-full overflow-auto bg-gray-900 ${props.class || ""}`}
      onClick={handleClick}
    >
      <Show when={isRendering() && !html()}>
        <div class="flex items-center justify-center h-full text-gray-500">
          Rendering...
        </div>
      </Show>

      <div
        ref={contentRef}
        class="prose prose-invert prose-sm max-w-none"
        style={{ padding: "24px" }}
        innerHTML={html()}
      />
    </div>
  );
}

export default Preview;
