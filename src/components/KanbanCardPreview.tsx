import { createMemo } from "solid-js";
import { renderMarkdownSync } from "../lib/markdown/renderer";

interface KanbanCardPreviewProps {
  content: string;
  maxLength?: number;
  onCheckboxToggle?: (newContent: string) => void;
}

export function KanbanCardPreview(props: KanbanCardPreviewProps) {
  // Truncate content for preview (by lines, not chars, to preserve markdown structure)
  const truncatedContent = createMemo(() => {
    const maxLen = props.maxLength || 200;
    const lines = props.content.split('\n').slice(0, 5); // Max 5 lines
    let result = lines.join('\n');
    if (result.length > maxLen) {
      result = result.slice(0, maxLen);
    }
    return result;
  });

  // Render markdown to HTML
  const html = createMemo(() => {
    return renderMarkdownSync(truncatedContent());
  });

  // Handle checkbox click
  const handleClick = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName === "INPUT" && target.getAttribute("type") === "checkbox") {
      e.preventDefault();
      e.stopPropagation(); // Don't trigger card selection
      if (!props.onCheckboxToggle) return;

      // Find which checkbox was clicked (by index)
      const container = e.currentTarget as HTMLElement;
      const checkboxes = container.querySelectorAll('input[type="checkbox"]');
      const index = Array.from(checkboxes).indexOf(target as HTMLInputElement);
      if (index === -1) return;

      // Toggle the checkbox in markdown source (using full content, not truncated)
      const newContent = toggleCheckboxInMarkdown(props.content, index);
      props.onCheckboxToggle(newContent);
    }
  };

  return (
    <div
      class="kanban-card-preview text-xs text-gray-400"
      innerHTML={html()}
      onClick={handleClick}
      style={{
        "max-height": "60px",
        overflow: "hidden",
      }}
    />
  );
}

// Helper: toggle nth checkbox in markdown
function toggleCheckboxInMarkdown(content: string, index: number): string {
  let currentIndex = 0;
  return content.replace(/\[([ xX])\]/g, (match, check) => {
    if (currentIndex === index) {
      currentIndex++;
      return check === " " ? "[x]" : "[ ]";
    }
    currentIndex++;
    return match;
  });
}
