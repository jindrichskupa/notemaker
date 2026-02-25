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
import { convertFileSrc } from "@tauri-apps/api/core";

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

/**
 * Rehype plugin to resolve relative image paths to Tauri asset URLs
 * @param basePath - The directory path of the current note
 */
function rehypeResolveImagePaths(basePath: string | undefined) {
  return (tree: Root) => {
    if (!basePath) return;

    visit(tree, "element", (node: Element) => {
      if (node.tagName === "img" && node.properties?.src) {
        const src = String(node.properties.src);

        // Only process relative paths (starting with ./ or not starting with http/https/data/asset)
        if (
          src.startsWith("./") ||
          src.startsWith("../") ||
          (!src.startsWith("http://") &&
            !src.startsWith("https://") &&
            !src.startsWith("data:") &&
            !src.startsWith("asset:") &&
            !src.startsWith("/"))
        ) {
          // Resolve the relative path to an absolute path
          const absolutePath = resolveRelativePath(basePath, src);
          // Convert to Tauri asset URL
          node.properties.src = convertFileSrc(absolutePath);
        }
      }
    });
  };
}

/**
 * Resolve a relative path against a base directory path
 */
function resolveRelativePath(basePath: string, relativePath: string): string {
  // Remove leading ./ if present
  let cleanRelative = relativePath;
  if (cleanRelative.startsWith("./")) {
    cleanRelative = cleanRelative.substring(2);
  }

  // basePath is a file path, get the directory
  const pathSeparator = basePath.includes("\\") ? "\\" : "/";
  const lastSepIndex = basePath.lastIndexOf(pathSeparator);
  const baseDir = lastSepIndex >= 0 ? basePath.substring(0, lastSepIndex) : basePath;

  // Handle ../ by going up directories
  const parts = cleanRelative.split("/");
  const baseParts = baseDir.split(pathSeparator);

  for (const part of parts) {
    if (part === "..") {
      baseParts.pop();
    } else if (part !== ".") {
      baseParts.push(part);
    }
  }

  return baseParts.join(pathSeparator);
}

/**
 * Create a processor with optional base path for image resolution
 */
function createProcessor(basePath?: string) {
  const proc = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkFrontmatter, ["yaml"])
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeEnableCheckboxes);

  // Add image path resolution if basePath is provided
  if (basePath) {
    proc.use(() => rehypeResolveImagePaths(basePath));
  }

  return proc
    .use(rehypeHighlight, { detect: true, ignoreMissing: true })
    .use(rehypeStringify, { allowDangerousHtml: true });
}

// Create a default processor for cases without base path
const defaultProcessor = createProcessor();

/**
 * Render markdown content to HTML
 * @param content - The markdown content to render
 * @param basePath - Optional path to the current note file (for resolving relative image paths)
 */
export async function renderMarkdown(content: string, basePath?: string): Promise<string> {
  try {
    const processor = basePath ? createProcessor(basePath) : defaultProcessor;
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
 * @param content - The markdown content to render
 * @param basePath - Optional path to the current note file (for resolving relative image paths)
 */
export function renderMarkdownSync(content: string, basePath?: string): string {
  try {
    const processor = basePath ? createProcessor(basePath) : defaultProcessor;
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
