# Kanban Markdown Preview Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Render markdown in Detailed kanban view and allow checkbox toggling

**Architecture:** Reuse existing `renderMarkdownSync` for card preview, add checkbox click handler that updates task description

**Tech Stack:** SolidJS, unified/remark/rehype (existing)

---

## Task 1: Create Mini Markdown Preview for Kanban Cards

**Files:**
- Create: `src/components/KanbanCardPreview.tsx`

**What to build:**
A lightweight markdown preview component specifically for kanban cards. It should:
- Render markdown to HTML using existing `renderMarkdownSync`
- Handle checkbox clicks to toggle `[ ]` ↔ `[x]` in the source
- Be compact (no mermaid diagrams, simpler styling)

**Step 1: Create the component**

```tsx
import { createMemo } from "solid-js";
import { renderMarkdownSync } from "../lib/markdown/renderer";

interface KanbanCardPreviewProps {
  content: string;
  maxLength?: number;
  onCheckboxToggle?: (newContent: string) => void;
}

export function KanbanCardPreview(props: KanbanCardPreviewProps) {
  // Truncate content for preview
  const truncatedContent = createMemo(() => {
    const maxLen = props.maxLength || 200;
    if (props.content.length <= maxLen) return props.content;
    return props.content.slice(0, maxLen) + "...";
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
      if (!props.onCheckboxToggle) return;

      // Find which checkbox was clicked (by index)
      const container = (e.currentTarget as HTMLElement);
      const checkboxes = container.querySelectorAll('input[type="checkbox"]');
      const index = Array.from(checkboxes).indexOf(target as HTMLInputElement);
      if (index === -1) return;

      // Toggle the checkbox in markdown source
      const newContent = toggleCheckboxInMarkdown(props.content, index);
      props.onCheckboxToggle(newContent);
    }
  };

  return (
    <div
      class="kanban-preview prose prose-invert prose-sm max-w-none"
      innerHTML={html()}
      onClick={handleClick}
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
```

**Step 2: Add CSS for compact preview**

The prose classes should work, but we may need to override some styles for compact display.

**Step 3: Verify**

Run: `pnpm tsc --noEmit`

**Step 4: Commit**

```bash
git add src/components/KanbanCardPreview.tsx
git commit -m "feat(kanban): Add KanbanCardPreview component for markdown rendering"
```

---

## Task 2: Use Preview in KanbanCard Detailed Mode

**Files:**
- Modify: `src/components/KanbanCard.tsx`

**What to change:**
Replace the plain text description preview with `KanbanCardPreview` component.

**Step 1: Import and use the component**

```tsx
import { KanbanCardPreview } from "./KanbanCardPreview";

// In the detailed density section, replace:
<p class="text-xs text-gray-400 line-clamp-2" style={{ "margin-top": "8px" }}>
  {props.task.description.slice(0, 100)}
  {props.task.description.length > 100 ? "..." : ""}
</p>

// With:
<div style={{ "margin-top": "8px" }}>
  <KanbanCardPreview
    content={props.task.description}
    maxLength={150}
    onCheckboxToggle={(newContent) => props.onDescriptionChange?.(newContent)}
  />
</div>
```

**Step 2: Add onDescriptionChange prop to KanbanCard**

```tsx
interface KanbanCardProps {
  task: KanbanTask;
  density: CardDensity;
  isSelected: boolean;
  onClick: () => void;
  onDoubleClick: () => void;
  onDescriptionChange?: (content: string) => void;  // NEW
}
```

**Step 3: Verify**

Run: `pnpm tsc --noEmit`

**Step 4: Commit**

```bash
git add src/components/KanbanCard.tsx
git commit -m "feat(kanban): Use markdown preview in detailed card view"
```

---

## Task 3: Wire Up Checkbox Toggle to Store

**Files:**
- Modify: `src/components/KanbanColumn.tsx`
- Modify: `src/components/KanbanEditor.tsx`

**What to change:**
Pass the `onDescriptionChange` handler through the component tree to update the task description in the store.

**Step 1: Update KanbanColumn to pass handler**

```tsx
<KanbanCard
  task={task}
  density={props.density}
  isSelected={props.selectedTaskId === task.id}
  onClick={() => props.onTaskClick(task.id)}
  onDoubleClick={() => props.onTaskDoubleClick(task.id)}
  onDescriptionChange={(content) => props.onDescriptionChange?.(task.id, content)}
/>
```

**Step 2: Update KanbanColumn props**

```tsx
interface KanbanColumnProps {
  // ... existing props
  onDescriptionChange?: (taskId: string, content: string) => void;
}
```

**Step 3: Update KanbanEditor to provide handler**

```tsx
<KanbanColumn
  // ... existing props
  onDescriptionChange={(taskId, content) => store.setTaskDescription(taskId, content)}
/>
```

**Step 4: Verify**

Run: `pnpm tsc --noEmit`

**Step 5: Commit**

```bash
git add src/components/KanbanColumn.tsx src/components/KanbanEditor.tsx
git commit -m "feat(kanban): Wire checkbox toggle to store"
```

---

## Summary

| Task | Description |
|------|-------------|
| 1 | Create KanbanCardPreview component with markdown rendering and checkbox toggle |
| 2 | Use the preview in KanbanCard detailed mode |
| 3 | Wire checkbox toggle through component tree to update store |
