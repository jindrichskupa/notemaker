/**
 * Mermaid diagram rendering utilities
 */

import mermaid from "mermaid";

// Track initialization
let initialized = false;

/**
 * Initialize mermaid with dark theme
 */
export function initMermaid(): void {
  if (initialized) return;

  mermaid.initialize({
    startOnLoad: false,
    theme: "dark",
    themeVariables: {
      darkMode: true,
      background: "#1f2937",
      primaryColor: "#3b82f6",
      primaryTextColor: "#f3f4f6",
      primaryBorderColor: "#4b5563",
      lineColor: "#6b7280",
      secondaryColor: "#374151",
      tertiaryColor: "#1f2937",
    },
    flowchart: {
      htmlLabels: true,
      curve: "basis",
    },
    sequence: {
      diagramMarginX: 50,
      diagramMarginY: 10,
      actorMargin: 50,
      width: 150,
      height: 65,
      boxMargin: 10,
      boxTextMargin: 5,
      noteMargin: 10,
      messageMargin: 35,
    },
    gantt: {
      titleTopMargin: 25,
      barHeight: 20,
      barGap: 4,
      topPadding: 50,
      leftPadding: 75,
      gridLineStartPadding: 35,
      fontSize: 11,
    },
  });

  initialized = true;
}

/**
 * Render all mermaid diagrams in a container
 * Returns the container element with rendered diagrams
 */
export async function renderMermaidDiagrams(container: HTMLElement): Promise<void> {
  initMermaid();

  // Find all mermaid code blocks
  const mermaidBlocks = container.querySelectorAll("pre code.language-mermaid, pre code.hljs.language-mermaid");

  for (let i = 0; i < mermaidBlocks.length; i++) {
    const codeBlock = mermaidBlocks[i] as HTMLElement;
    const preBlock = codeBlock.parentElement;
    if (!preBlock) continue;

    const code = codeBlock.textContent || "";

    try {
      // Generate unique ID
      const id = `mermaid-${Date.now()}-${i}`;

      // Render the diagram
      const { svg } = await mermaid.render(id, code);

      // Create wrapper for the diagram
      const wrapper = document.createElement("div");
      wrapper.className = "mermaid-diagram";
      wrapper.innerHTML = svg;

      // Replace the pre block with the diagram
      preBlock.replaceWith(wrapper);
    } catch (error) {
      console.error("Mermaid rendering error:", error);

      // Show error message
      const errorDiv = document.createElement("div");
      errorDiv.className = "mermaid-error";
      errorDiv.innerHTML = `
        <div class="mermaid-error-title">Mermaid Syntax Error</div>
        <pre class="mermaid-error-code">${escapeHtml(code)}</pre>
        <div class="mermaid-error-message">${escapeHtml(String(error))}</div>
      `;

      preBlock.replaceWith(errorDiv);
    }
  }
}

/**
 * Check if content contains mermaid diagrams
 */
export function hasMermaidDiagrams(html: string): boolean {
  return html.includes('language-mermaid"') || html.includes("language-mermaid ");
}

/**
 * Escape HTML for error display
 */
function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}
