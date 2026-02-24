# Kanban Improvements Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix compact density mode and add markdown support for task descriptions

**Architecture:** Reuse existing Editor and Preview components from notes/notebooks

**Tech Stack:** SolidJS, CodeMirror 6, unified/remark/rehype

---

## Task 1: Fix Priority and Due Date Clearing Bugs

**Files:**
- Modify: `src/components/TaskDetailPanel.tsx`
- Modify: `src/lib/store/kanban.ts` (if needed)
- Modify: `src-tauri/src/fs/commands.rs` (if needed)

**Problem:**
1. Setting priority to "None" jumps back to the previous value (e.g., Low)
2. Cannot clear/delete the due date

**Root cause:**
The `updateTask` function likely filters out empty strings or undefined values, so `priority: ""` and `due: ""` are ignored instead of clearing the field.

**Step 1: Check how TaskUpdates handles clearing**

The Rust `TaskUpdates` struct uses `Option<String>` for fields. When updating:
- `Some("value")` = set the value
- `None` = don't change (skip)
- Need a way to explicitly clear = set to empty or use a sentinel value

**Step 2: Fix the update logic**

Option A: Allow empty string to mean "clear the field" in Rust backend
Option B: Add separate `clear_priority` / `clear_due` fields

Simplest fix: In Rust `update_kanban_task`, treat empty string as "clear":
```rust
if let Some(priority) = updates.priority {
    task.priority = if priority.is_empty() { None } else { Some(priority) };
}
if let Some(due) = updates.due {
    task.due = if due.is_empty() { None } else { Some(due) };
}
```

**Step 3: Update frontend to send empty string for clearing**

In TaskDetailPanel, ensure we send `""` not `undefined` when clearing:
```tsx
priority: priority() || "",  // Send empty string to clear
due: due() || "",            // Send empty string to clear
```

**Step 4: Verify and commit**

```bash
git add src/components/TaskDetailPanel.tsx src-tauri/src/fs/commands.rs
git commit -m "fix(kanban): Allow clearing priority and due date"
```

---

## Task 2: Fix Compact Density Mode

**Files:**
- Modify: `src/components/KanbanCard.tsx`

**What to change:**
The compact mode currently uses smaller text and padding. Change it to use the same size as standard, but just hide the metadata row (priority/due/description).

**Step 1: Update KanbanCard**

Remove the `getPadding()` function and density-based text sizing. The only difference between modes should be what content is shown:

- **Compact**: Title only (same styling as standard)
- **Standard**: Title + priority/due badges
- **Detailed**: Title + priority/due badges + description preview

```tsx
// Remove getPadding() function
// Remove density-based text class

// Always use same padding and font size
style={{ padding: "8px 10px", "margin-bottom": "6px" }}
class="text-sm" // Always same size

// Only change what content is shown based on density
```

**Step 2: Verify**

Run: `pnpm tsc --noEmit`

**Step 3: Commit**

```bash
git add src/components/KanbanCard.tsx
git commit -m "fix(kanban): Make compact density same size as standard"
```

---

## Task 3: Add Markdown Editor to TaskDetailPanel

**Files:**
- Modify: `src/components/TaskDetailPanel.tsx`

**What to change:**
Replace the plain textarea with a proper markdown editor using the existing `Editor` component.

**Step 1: Import Editor component**

```tsx
import { Editor } from "./Editor";
```

**Step 2: Replace textarea with Editor**

```tsx
{/* Description - Markdown Editor */}
<div style={{ "margin-bottom": "16px" }}>
  <label class="block text-xs text-gray-400" style={{ "margin-bottom": "4px" }}>
    Description
  </label>
  <div class="border border-gray-600 rounded overflow-hidden" style={{ height: "200px" }}>
    <Editor
      content={description()}
      onChange={(value) => setDescription(value)}
      onSave={handleBlur}
      config={{
        vimMode: false,
        theme: "dark",
        lineNumbers: false,
        wordWrap: true,
        fontSize: 13,
        fontFamily: "monospace",
        lineHeight: 1.5,
        tabSize: 2,
        inlineMarkdown: true,
      }}
    />
  </div>
</div>
```

**Step 3: Verify**

Run: `pnpm tsc --noEmit`

**Step 4: Commit**

```bash
git add src/components/TaskDetailPanel.tsx
git commit -m "feat(kanban): Add markdown editor for task description"
```

---

## Summary

| Task | Description |
|------|-------------|
| 1 | Fix priority "None" and due date clearing bugs |
| 2 | Fix compact density to match standard size |
| 3 | Replace textarea with CodeMirror markdown editor (with inline preview) |
