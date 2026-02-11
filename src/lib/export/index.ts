/**
 * Export System - Export notes to PDF and HTML
 */

import { renderMarkdown } from "../markdown";
import html2pdf from "html2pdf.js";

export type ExportFormat = "html" | "pdf";

export interface ExportOptions {
  format: ExportFormat;
  includeStyles: boolean;
  includeTitle: boolean;
  title?: string;
  author?: string;
}

const DEFAULT_OPTIONS: ExportOptions = {
  format: "html",
  includeStyles: true,
  includeTitle: true,
};

/**
 * CSS styles for exported documents
 */
const EXPORT_STYLES = `
  :root {
    --font-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    --font-mono: 'JetBrains Mono', 'Fira Code', Consolas, monospace;
  }

  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  body {
    font-family: var(--font-sans);
    font-size: 16px;
    line-height: 1.7;
    color: #1a1a1a;
    background: #fff;
    max-width: 800px;
    margin: 0 auto;
    padding: 2rem;
  }

  h1, h2, h3, h4, h5, h6 {
    font-weight: 600;
    line-height: 1.3;
    margin-top: 1.5em;
    margin-bottom: 0.5em;
  }

  h1 { font-size: 2em; border-bottom: 1px solid #e5e5e5; padding-bottom: 0.3em; }
  h2 { font-size: 1.5em; border-bottom: 1px solid #e5e5e5; padding-bottom: 0.3em; }
  h3 { font-size: 1.25em; }
  h4 { font-size: 1em; }

  p { margin-bottom: 1em; }

  a { color: #0066cc; text-decoration: none; }
  a:hover { text-decoration: underline; }

  strong { font-weight: 600; }
  em { font-style: italic; }

  code {
    background: #f5f5f5;
    padding: 0.2em 0.4em;
    border-radius: 3px;
    font-family: var(--font-mono);
    font-size: 0.9em;
  }

  pre {
    background: #f5f5f5;
    border-radius: 6px;
    padding: 1em;
    overflow-x: auto;
    margin: 1em 0;
  }

  pre code {
    background: none;
    padding: 0;
    font-size: 0.875em;
  }

  blockquote {
    border-left: 4px solid #ddd;
    padding-left: 1em;
    margin: 1em 0;
    color: #666;
    font-style: italic;
  }

  ul, ol {
    margin: 1em 0;
    padding-left: 2em;
  }

  li { margin: 0.25em 0; }

  hr {
    border: none;
    border-top: 1px solid #e5e5e5;
    margin: 2em 0;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    margin: 1em 0;
  }

  th, td {
    border: 1px solid #ddd;
    padding: 0.5em 1em;
    text-align: left;
  }

  th { background: #f5f5f5; font-weight: 600; }
  tr:nth-child(even) { background: #fafafa; }

  img { max-width: 100%; border-radius: 6px; margin: 1em 0; }

  .task-list-item { list-style: none; margin-left: -1.5em; }
  .task-list-item input { margin-right: 0.5em; }

  @media print {
    body { padding: 0; max-width: none; }
    pre { white-space: pre-wrap; word-wrap: break-word; }
    a { color: inherit; text-decoration: underline; }
  }
`;

/**
 * Export note to HTML
 */
export async function exportToHtml(
  content: string,
  options: Partial<ExportOptions> = {}
): Promise<string> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const html = await renderMarkdown(content);

  const title = opts.title || "Exported Note";
  const styles = opts.includeStyles ? `<style>${EXPORT_STYLES}</style>` : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  ${styles}
</head>
<body>
  <article class="markdown-body">
    ${html}
  </article>
</body>
</html>`;
}

/**
 * Export note to PDF (returns HTML for print)
 * Note: Actual PDF generation requires browser print dialog or external library
 */
export async function exportToPdf(
  content: string,
  options: Partial<ExportOptions> = {}
): Promise<string> {
  const opts = { ...DEFAULT_OPTIONS, ...options, format: "pdf" as ExportFormat };

  // Generate print-optimized HTML
  const html = await exportToHtml(content, opts);

  // Add print-specific styles
  const printStyles = `
    <style>
      @page {
        margin: 2cm;
        size: A4;
      }
      body {
        font-size: 12pt;
      }
    </style>
  `;

  return html.replace("</head>", `${printStyles}</head>`);
}

/**
 * Generate PDF from HTML content and download it
 * Uses html2pdf.js for direct PDF generation (works in Tauri)
 */
export async function generatePdf(html: string, filename: string): Promise<void> {
  // Create a container for the HTML content
  const container = document.createElement("div");
  container.innerHTML = html;
  container.style.position = "absolute";
  container.style.left = "-9999px";
  container.style.top = "0";
  document.body.appendChild(container);

  try {
    // Configure html2pdf options
    const options = {
      margin: [15, 15, 15, 15] as [number, number, number, number],
      filename: filename,
      image: { type: "jpeg" as const, quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        logging: false,
      },
      jsPDF: {
        unit: "mm" as const,
        format: "a4" as const,
        orientation: "portrait" as const,
      },
    };

    // Generate and download the PDF
    await html2pdf().set(options).from(container).save();
  } finally {
    // Clean up the container
    document.body.removeChild(container);
  }
}

/**
 * Legacy function for backwards compatibility
 * @deprecated Use generatePdf instead
 */
export function printToPdf(html: string): void {
  generatePdf(html, "note.pdf").catch(console.error);
}

/**
 * Download HTML file
 */
export function downloadHtml(html: string, filename: string): void {
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  downloadBlob(blob, filename);
}

/**
 * Download file from blob
 */
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
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

/**
 * Get suggested filename for export
 */
export function getExportFilename(
  notePath: string,
  format: ExportFormat
): string {
  const baseName = notePath
    .split("/")
    .pop()
    ?.replace(/\.md$/i, "") || "note";

  const ext = format === "pdf" ? "pdf" : "html";
  return `${baseName}.${ext}`;
}
