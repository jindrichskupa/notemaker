# Kanban/Task List Feature - Design Document

**Date:** 2026-02-24
**Status:** Approved

## Overview

Add a new "kanban" file type to Notemaker, similar to notebooks but for task management. Tasks are displayed as a kanban board with drag-drop between columns.

## File Format

### Directory Structure

```
project.kanban/
├── .index.json          # Task metadata and order
├── abc123.md            # Task description (markdown)
├── def456.md
└── ...
```

### Index File (.index.json)

```json
{
  "version": 1,
  "columns": ["backlog", "ready", "working", "done", "closed"],
  "tasks": [
    {
      "id": "abc123",
      "title": "Fix authentication bug",
      "status": "working",
      "priority": "high",
      "due": "2026-03-01",
      "created": "2026-02-24T10:00:00Z",
      "updated": "2026-02-24T15:30:00Z"
    }
  ],
  "settings": {
    "cardDensity": "standard",
    "showClosed": false
  }
}
```

### Task File (abc123.md)

Plain markdown content for task description:

```markdown
Detailed description of the task...

Supports full markdown:
- Checklists
- Code blocks
- Links
```

## Columns

Fixed set of 5 columns:

| Column | Status Value | Default Visibility |
|--------|--------------|-------------------|
| Backlog | `backlog` | Visible |
| Ready | `ready` | Visible |
| Working | `working` | Visible |
| Done | `done` | Visible |
| Closed | `closed` | Hidden (toggle to show) |

## Task Metadata

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | string | Yes | Hex timestamp (like notebook blocks) |
| title | string | Yes | Task title |
| status | enum | Yes | backlog, ready, working, done, closed |
| priority | enum | No | low, medium, high |
| due | date string | No | ISO date (YYYY-MM-DD) |
| created | datetime | Yes | ISO datetime |
| updated | datetime | Yes | ISO datetime |

## UI Components

### KanbanEditor

Main component (similar to NotebookEditor):
- Displays 5 columns horizontally
- Handles drag-drop between columns
- Settings toggle for card density and closed column visibility

### KanbanColumn

Single column component:
- Header with column name and task count
- "+ Add" button for quick task creation
- Scrollable list of KanbanCard components
- Drop zone for drag-drop

### KanbanCard

Task card with 3 density modes:

**Compact:**
- Title only

**Standard:**
- Title
- Due date badge (if set)
- Priority indicator (if set)

**Detailed:**
- Title
- Description preview (first ~100 chars)
- Due date
- Priority

### TaskDetailPanel

Slide-out panel when clicking a task:
- Title (editable)
- Status dropdown
- Priority selector
- Due date picker
- Description editor (full markdown with preview)
- Delete button

## Interactions

| Action | Behavior |
|--------|----------|
| Click "+ Add" in column | Inline input appears, type title, Enter creates task in that column |
| Drag card to column | Updates task status, persists to .index.json |
| Click card | Opens TaskDetailPanel on right side |
| Double-click card title | Inline edit title |
| Press Escape | Cancel inline edit / close panel |
| Toggle density | Cycles: Compact → Standard → Detailed |
| Toggle Closed | Shows/hides the Closed column |

## Backend Commands (Rust)

```rust
// Create new kanban board
create_kanban(path: PathBuf, title: Option<String>) -> Result<Kanban, FsError>

// Read kanban board
read_kanban(path: PathBuf) -> Result<Kanban, FsError>

// Task operations
add_kanban_task(kanban_path: PathBuf, title: String, status: String) -> Result<KanbanTask, FsError>
update_kanban_task(kanban_path: PathBuf, task_id: String, updates: TaskUpdates) -> Result<(), FsError>
delete_kanban_task(kanban_path: PathBuf, task_id: String) -> Result<(), FsError>
move_kanban_task(kanban_path: PathBuf, task_id: String, new_status: String) -> Result<(), FsError>

// Task description (separate file)
get_task_description(kanban_path: PathBuf, task_id: String) -> Result<String, FsError>
update_task_description(kanban_path: PathBuf, task_id: String, content: String) -> Result<(), FsError>

// Settings
update_kanban_settings(kanban_path: PathBuf, settings: KanbanSettings) -> Result<(), FsError>
```

## Frontend Store

```typescript
interface KanbanTask {
  id: string;
  title: string;
  status: 'backlog' | 'ready' | 'working' | 'done' | 'closed';
  priority?: 'low' | 'medium' | 'high';
  due?: string;
  created: string;
  updated: string;
  description?: string; // Loaded on demand
}

interface KanbanSettings {
  cardDensity: 'compact' | 'standard' | 'detailed';
  showClosed: boolean;
}

interface Kanban {
  path: string;
  name: string;
  tasks: KanbanTask[];
  settings: KanbanSettings;
}
```

## Integration Points

### TreeView / Sidebar

- Recognize `.kanban/` directories as kanban boards
- Show kanban icon (different from notebook icon)
- Create via "New Kanban" command

### Command Palette

- "New Kanban Board"
- "Convert to Kanban" (future: convert markdown checklist to kanban)

### File Watcher

- Watch `.index.json` for external changes
- Reload on change (like notebooks)

## Implementation Phases

### Phase 1: Core
- File format and Rust backend
- Basic KanbanEditor with columns
- Drag-drop between columns
- Quick add tasks

### Phase 2: Polish
- TaskDetailPanel with markdown editor
- Card density modes
- Due date and priority

### Phase 3: Extras
- Closed column toggle
- Keyboard navigation
- Search/filter tasks
