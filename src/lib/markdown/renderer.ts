/**
 * Markdown to HTML renderer using unified/remark/rehype
 */

import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkFrontmatter from "remark-frontmatter";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";
import rehypeHighlight from "rehype-highlight";
import { visit } from "unist-util-visit";
import type { Root, Element } from "hast";

/**
 * Rehype plugin to enable checkboxes (remove disabled attribute)
 * This allows checkboxes to be clicked and toggled via JavaScript
 */
function rehypeEnableCheckboxes() {
  return (tree: Root) => {
    visit(tree, "element", (node: Element) => {
      if (
        node.tagName === "input" &&
        node.properties?.type === "checkbox"
      ) {
        // Remove disabled attribute to make checkbox clickable
        delete node.properties.disabled;
      }
    });
  };
}

// Create the processor once for reuse
const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkFrontmatter, ["yaml"])
  .use(remarkRehype, { allowDangerousHtml: true })
  .use(rehypeEnableCheckboxes)
  .use(rehypeHighlight, { detect: true, ignoreMissing: true })
  .use(rehypeStringify, { allowDangerousHtml: true });

/**
 * Render markdown content to HTML
 */
export async function renderMarkdown(content: string): Promise<string> {
  try {
    const result = await processor.process(content);
    return String(result);
  } catch (error) {
    console.error("Markdown rendering error:", error);
    // Return escaped content on error
    return `<pre>${escapeHtml(content)}</pre>`;
  }
}

/**
 * Synchronous render (for simple cases)
 */
export function renderMarkdownSync(content: string): string {
  try {
    const result = processor.processSync(content);
    return String(result);
  } catch (error) {
    console.error("Markdown rendering error:", error);
    return `<pre>${escapeHtml(content)}</pre>`;
  }
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return text.replace(/[&<>"']/g, (char) => map[char]);
}
