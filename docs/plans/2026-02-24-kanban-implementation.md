# Kanban/Task List Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a kanban board file type (`.kanban/` directory) with drag-drop task management across 5 columns.

**Architecture:** Directory-based storage like notebooks (`.index.json` + task `.md` files), Rust backend for CRUD, SolidJS frontend with drag-drop library, dedicated store for kanban state.

**Tech Stack:** Rust (Tauri), SolidJS, @thisbeyond/solid-dnd (drag-drop), TypeScript

---

## Phase 1: Core Backend

### Task 1: Add Kanban Types (Rust)

**Files:**
- Modify: `src-tauri/src/fs/types.rs`

**Step 1: Add kanban types**

Add after the existing notebook types:

```rust
// Kanban types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KanbanTask {
    pub id: String,
    pub title: String,
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub priority: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub due: Option<String>,
    pub created: String,
    pub updated: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KanbanSettings {
    #[serde(default = "default_card_density")]
    pub card_density: String,
    #[serde(default)]
    pub show_closed: bool,
}

fn default_card_density() -> String {
    "standard".to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KanbanIndex {
    pub version: u32,
    pub columns: Vec<String>,
    pub tasks: Vec<KanbanTask>,
    #[serde(default)]
    pub settings: KanbanSettings,
}

impl Default for KanbanSettings {
    fn default() -> Self {
        Self {
            card_density: "standard".to_string(),
            show_closed: false,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Kanban {
    pub path: String,
    pub name: String,
    pub tasks: Vec<KanbanTaskWithContent>,
    pub settings: KanbanSettings,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KanbanTaskWithContent {
    pub id: String,
    pub title: String,
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub priority: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub due: Option<String>,
    pub created: String,
    pub updated: String,
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskUpdates {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub priority: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub due: Option<String>,
}
```

**Step 2: Verify it compiles**

Run: `cd src-tauri && cargo check`

**Step 3: Commit**

```bash
git add src-tauri/src/fs/types.rs
git commit -m "feat(kanban): Add Rust types for kanban boards"
```

---

### Task 2: Add Kanban Backend Commands (Rust)

**Files:**
- Modify: `src-tauri/src/fs/commands.rs`
- Modify: `src-tauri/src/lib.rs`

**Step 1: Add helper functions**

Add after the notebook helper functions:

```rust
// ============================================================================
// Kanban operations
// ============================================================================

const KANBAN_EXTENSION: &str = ".kanban";
const KANBAN_INDEX_FILE: &str = ".index.json";
const DEFAULT_COLUMNS: [&str; 5] = ["backlog", "ready", "working", "done", "closed"];

pub fn is_kanban(path: &Path) -> bool {
    path.is_dir() && path.extension().map_or(false, |ext| ext == "kanban")
}

fn read_kanban_index(kanban_path: &Path) -> Result<KanbanIndex, FsError> {
    let index_path = kanban_path.join(KANBAN_INDEX_FILE);
    let content = std::fs::read_to_string(&index_path)
        .map_err(|e| FsError::ReadError(e.to_string()))?;
    serde_json::from_str(&content)
        .map_err(|e| FsError::ParseError(e.to_string()))
}

fn write_kanban_index(kanban_path: &Path, index: &KanbanIndex) -> Result<(), FsError> {
    let index_path = kanban_path.join(KANBAN_INDEX_FILE);
    let content = serde_json::to_string_pretty(index)
        .map_err(|e| FsError::ParseError(e.to_string()))?;
    std::fs::write(&index_path, content)
        .map_err(|e| FsError::WriteError(e.to_string()))
}

fn generate_task_id() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_millis();
    format!("{:x}", now)
}

fn get_task_file_path(kanban_path: &Path, task_id: &str) -> PathBuf {
    kanban_path.join(format!("{}.md", task_id))
}
```

**Step 2: Add create_kanban command**

```rust
#[tauri::command]
pub async fn create_kanban(
    path: PathBuf,
    title: Option<String>,
) -> Result<Kanban, FsError> {
    // Ensure path ends with .kanban
    let kanban_path = if path.extension().map_or(true, |ext| ext != "kanban") {
        path.with_extension("kanban")
    } else {
        path
    };

    // Create directory
    std::fs::create_dir_all(&kanban_path)
        .map_err(|e| FsError::WriteError(e.to_string()))?;

    // Create index
    let index = KanbanIndex {
        version: 1,
        columns: DEFAULT_COLUMNS.iter().map(|s| s.to_string()).collect(),
        tasks: vec![],
        settings: KanbanSettings::default(),
    };
    write_kanban_index(&kanban_path, &index)?;

    let name = title.unwrap_or_else(|| {
        kanban_path
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("Untitled")
            .to_string()
    });

    Ok(Kanban {
        path: kanban_path.to_string_lossy().to_string(),
        name,
        tasks: vec![],
        settings: index.settings,
    })
}
```

**Step 3: Add read_kanban command**

```rust
#[tauri::command]
pub async fn read_kanban(path: PathBuf) -> Result<Kanban, FsError> {
    if !is_kanban(&path) {
        return Err(FsError::InvalidPath("Not a kanban board".to_string()));
    }

    let index = read_kanban_index(&path)?;

    // Load task descriptions
    let mut tasks_with_content = Vec::new();
    for task in index.tasks {
        let task_path = get_task_file_path(&path, &task.id);
        let description = std::fs::read_to_string(&task_path).unwrap_or_default();

        tasks_with_content.push(KanbanTaskWithContent {
            id: task.id,
            title: task.title,
            status: task.status,
            priority: task.priority,
            due: task.due,
            created: task.created,
            updated: task.updated,
            description,
        });
    }

    let name = path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("Untitled")
        .to_string();

    Ok(Kanban {
        path: path.to_string_lossy().to_string(),
        name,
        tasks: tasks_with_content,
        settings: index.settings,
    })
}
```

**Step 4: Add task CRUD commands**

```rust
#[tauri::command]
pub async fn add_kanban_task(
    kanban_path: PathBuf,
    title: String,
    status: String,
) -> Result<KanbanTaskWithContent, FsError> {
    let mut index = read_kanban_index(&kanban_path)?;

    let now = chrono::Utc::now().to_rfc3339();
    let task_id = generate_task_id();

    let task = KanbanTask {
        id: task_id.clone(),
        title: title.clone(),
        status: status.clone(),
        priority: None,
        due: None,
        created: now.clone(),
        updated: now.clone(),
    };

    index.tasks.push(task);
    write_kanban_index(&kanban_path, &index)?;

    // Create empty description file
    let task_path = get_task_file_path(&kanban_path, &task_id);
    std::fs::write(&task_path, "")
        .map_err(|e| FsError::WriteError(e.to_string()))?;

    Ok(KanbanTaskWithContent {
        id: task_id,
        title,
        status,
        priority: None,
        due: None,
        created: now.clone(),
        updated: now,
        description: String::new(),
    })
}

#[tauri::command]
pub async fn update_kanban_task(
    kanban_path: PathBuf,
    task_id: String,
    updates: TaskUpdates,
) -> Result<(), FsError> {
    let mut index = read_kanban_index(&kanban_path)?;

    let task = index.tasks.iter_mut()
        .find(|t| t.id == task_id)
        .ok_or_else(|| FsError::NotFound(format!("Task {} not found", task_id)))?;

    if let Some(title) = updates.title {
        task.title = title;
    }
    if let Some(status) = updates.status {
        task.status = status;
    }
    if let Some(priority) = updates.priority {
        task.priority = Some(priority);
    }
    if let Some(due) = updates.due {
        task.due = Some(due);
    }
    task.updated = chrono::Utc::now().to_rfc3339();

    write_kanban_index(&kanban_path, &index)
}

#[tauri::command]
pub async fn delete_kanban_task(
    kanban_path: PathBuf,
    task_id: String,
) -> Result<(), FsError> {
    let mut index = read_kanban_index(&kanban_path)?;

    index.tasks.retain(|t| t.id != task_id);
    write_kanban_index(&kanban_path, &index)?;

    // Delete description file
    let task_path = get_task_file_path(&kanban_path, &task_id);
    if task_path.exists() {
        std::fs::remove_file(&task_path)
            .map_err(|e| FsError::WriteError(e.to_string()))?;
    }

    Ok(())
}

#[tauri::command]
pub async fn update_task_description(
    kanban_path: PathBuf,
    task_id: String,
    content: String,
) -> Result<(), FsError> {
    // Update the updated timestamp in index
    let mut index = read_kanban_index(&kanban_path)?;
    if let Some(task) = index.tasks.iter_mut().find(|t| t.id == task_id) {
        task.updated = chrono::Utc::now().to_rfc3339();
    }
    write_kanban_index(&kanban_path, &index)?;

    // Write description file
    let task_path = get_task_file_path(&kanban_path, &task_id);
    std::fs::write(&task_path, content)
        .map_err(|e| FsError::WriteError(e.to_string()))
}

#[tauri::command]
pub async fn update_kanban_settings(
    kanban_path: PathBuf,
    settings: KanbanSettings,
) -> Result<(), FsError> {
    let mut index = read_kanban_index(&kanban_path)?;
    index.settings = settings;
    write_kanban_index(&kanban_path, &index)
}
```

**Step 5: Register commands in lib.rs**

Find the `invoke_handler` and add:
```rust
fs::create_kanban,
fs::read_kanban,
fs::add_kanban_task,
fs::update_kanban_task,
fs::delete_kanban_task,
fs::update_task_description,
fs::update_kanban_settings,
```

**Step 6: Verify it compiles**

Run: `cd src-tauri && cargo check`

**Step 7: Commit**

```bash
git add src-tauri/src/fs/commands.rs src-tauri/src/lib.rs
git commit -m "feat(kanban): Add Rust backend commands for kanban boards"
```

---

### Task 3: Add TypeScript Types and API Bindings

**Files:**
- Modify: `src/lib/fs.ts`

**Step 1: Add kanban types**

After the notebook types, add:

```typescript
// Kanban types
export type TaskStatus = 'backlog' | 'ready' | 'working' | 'done' | 'closed';
export type TaskPriority = 'low' | 'medium' | 'high';
export type CardDensity = 'compact' | 'standard' | 'detailed';

export interface KanbanTask {
  id: string;
  title: string;
  status: TaskStatus;
  priority?: TaskPriority;
  due?: string;
  created: string;
  updated: string;
  description: string;
}

export interface KanbanSettings {
  cardDensity: CardDensity;
  showClosed: boolean;
}

export interface Kanban {
  path: string;
  name: string;
  tasks: KanbanTask[];
  settings: KanbanSettings;
}

export interface TaskUpdates {
  title?: string;
  status?: string;
  priority?: string;
  due?: string;
}
```

**Step 2: Add API functions**

```typescript
// Kanban operations

export async function createKanban(
  path: string,
  title?: string
): Promise<Kanban> {
  return invoke<Kanban>("create_kanban", { path, title });
}

export async function readKanban(path: string): Promise<Kanban> {
  return invoke<Kanban>("read_kanban", { path });
}

export async function addKanbanTask(
  kanbanPath: string,
  title: string,
  status: TaskStatus
): Promise<KanbanTask> {
  return invoke<KanbanTask>("add_kanban_task", { kanbanPath, title, status });
}

export async function updateKanbanTask(
  kanbanPath: string,
  taskId: string,
  updates: TaskUpdates
): Promise<void> {
  return invoke("update_kanban_task", { kanbanPath, taskId, updates });
}

export async function deleteKanbanTask(
  kanbanPath: string,
  taskId: string
): Promise<void> {
  return invoke("delete_kanban_task", { kanbanPath, taskId });
}

export async function updateTaskDescription(
  kanbanPath: string,
  taskId: string,
  content: string
): Promise<void> {
  return invoke("update_task_description", { kanbanPath, taskId, content });
}

export async function updateKanbanSettings(
  kanbanPath: string,
  settings: KanbanSettings
): Promise<void> {
  return invoke("update_kanban_settings", { kanbanPath, settings });
}

export function isKanban(path: string): boolean {
  return path.endsWith('.kanban') || path.includes('.kanban/');
}
```

**Step 3: Verify TypeScript compiles**

Run: `pnpm tsc --noEmit`

**Step 4: Commit**

```bash
git add src/lib/fs.ts
git commit -m "feat(kanban): Add TypeScript types and API bindings"
```

---

### Task 4: Add Kanban Store

**Files:**
- Create: `src/lib/store/kanban.ts`

**Step 1: Create the store**

```typescript
import { createSignal, createRoot } from "solid-js";
import {
  readKanban,
  createKanban,
  addKanbanTask,
  updateKanbanTask,
  deleteKanbanTask,
  updateTaskDescription,
  updateKanbanSettings,
  type Kanban,
  type KanbanTask,
  type KanbanSettings,
  type TaskStatus,
  type TaskUpdates,
  type CardDensity,
} from "../fs";

export const COLUMNS: TaskStatus[] = ['backlog', 'ready', 'working', 'done', 'closed'];

export const COLUMN_LABELS: Record<TaskStatus, string> = {
  backlog: 'Backlog',
  ready: 'Ready',
  working: 'Working',
  done: 'Done',
  closed: 'Closed',
};

function createKanbanStore() {
  const [kanban, setKanban] = createSignal<Kanban | null>(null);
  const [isLoading, setIsLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = createSignal<string | null>(null);
  const [editingTaskId, setEditingTaskId] = createSignal<string | null>(null);

  async function open(path: string): Promise<boolean> {
    setIsLoading(true);
    setError(null);
    try {
      const data = await readKanban(path);
      setKanban(data);
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      return false;
    } finally {
      setIsLoading(false);
    }
  }

  async function create(path: string, title?: string): Promise<boolean> {
    setIsLoading(true);
    setError(null);
    try {
      const data = await createKanban(path, title);
      setKanban(data);
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      return false;
    } finally {
      setIsLoading(false);
    }
  }

  function close(): void {
    setKanban(null);
    setSelectedTaskId(null);
    setEditingTaskId(null);
    setError(null);
  }

  async function addTask(title: string, status: TaskStatus): Promise<KanbanTask | null> {
    const k = kanban();
    if (!k) return null;

    try {
      const task = await addKanbanTask(k.path, title, status);
      setKanban({
        ...k,
        tasks: [...k.tasks, task],
      });
      return task;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      return null;
    }
  }

  async function updateTask(taskId: string, updates: TaskUpdates): Promise<boolean> {
    const k = kanban();
    if (!k) return false;

    try {
      await updateKanbanTask(k.path, taskId, updates);
      setKanban({
        ...k,
        tasks: k.tasks.map(t =>
          t.id === taskId
            ? { ...t, ...updates, updated: new Date().toISOString() }
            : t
        ),
      });
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      return false;
    }
  }

  async function moveTask(taskId: string, newStatus: TaskStatus): Promise<boolean> {
    return updateTask(taskId, { status: newStatus });
  }

  async function removeTask(taskId: string): Promise<boolean> {
    const k = kanban();
    if (!k) return false;

    try {
      await deleteKanbanTask(k.path, taskId);
      setKanban({
        ...k,
        tasks: k.tasks.filter(t => t.id !== taskId),
      });
      if (selectedTaskId() === taskId) {
        setSelectedTaskId(null);
      }
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      return false;
    }
  }

  async function setTaskDescription(taskId: string, content: string): Promise<boolean> {
    const k = kanban();
    if (!k) return false;

    try {
      await updateTaskDescription(k.path, taskId, content);
      setKanban({
        ...k,
        tasks: k.tasks.map(t =>
          t.id === taskId
            ? { ...t, description: content, updated: new Date().toISOString() }
            : t
        ),
      });
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      return false;
    }
  }

  async function setSettings(settings: Partial<KanbanSettings>): Promise<boolean> {
    const k = kanban();
    if (!k) return false;

    const newSettings = { ...k.settings, ...settings };
    try {
      await updateKanbanSettings(k.path, newSettings);
      setKanban({ ...k, settings: newSettings });
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      return false;
    }
  }

  function getTasksByStatus(status: TaskStatus): KanbanTask[] {
    const k = kanban();
    if (!k) return [];
    return k.tasks.filter(t => t.status === status);
  }

  function getSelectedTask(): KanbanTask | null {
    const k = kanban();
    const id = selectedTaskId();
    if (!k || !id) return null;
    return k.tasks.find(t => t.id === id) || null;
  }

  return {
    // State
    kanban,
    isLoading,
    error,
    selectedTaskId,
    editingTaskId,

    // Actions
    open,
    create,
    close,
    addTask,
    updateTask,
    moveTask,
    removeTask,
    setTaskDescription,
    setSettings,
    setSelectedTaskId,
    setEditingTaskId,

    // Helpers
    getTasksByStatus,
    getSelectedTask,
  };
}

export const kanbanStore = createRoot(createKanbanStore);
```

**Step 2: Verify TypeScript compiles**

Run: `pnpm tsc --noEmit`

**Step 3: Commit**

```bash
git add src/lib/store/kanban.ts
git commit -m "feat(kanban): Add kanban store for state management"
```

---

## Phase 2: UI Components

### Task 5: Install Drag-Drop Library

**Step 1: Install @thisbeyond/solid-dnd**

Run: `pnpm add @thisbeyond/solid-dnd`

**Step 2: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: Add solid-dnd for drag-drop support"
```

---

### Task 6: Create KanbanCard Component

**Files:**
- Create: `src/components/KanbanCard.tsx`

**Step 1: Create the component**

```tsx
import { Show } from "solid-js";
import { createDraggable } from "@thisbeyond/solid-dnd";
import type { KanbanTask, CardDensity } from "../lib/fs";

interface KanbanCardProps {
  task: KanbanTask;
  density: CardDensity;
  isSelected: boolean;
  onClick: () => void;
  onDoubleClick: () => void;
}

export function KanbanCard(props: KanbanCardProps) {
  const draggable = createDraggable(props.task.id);

  const priorityColors = {
    high: "border-l-red-500",
    medium: "border-l-yellow-500",
    low: "border-l-blue-500",
  };

  const isOverdue = () => {
    if (!props.task.due) return false;
    return new Date(props.task.due) < new Date();
  };

  return (
    <div
      ref={draggable.ref}
      {...draggable.dragActivators}
      class={`bg-gray-700 rounded border border-gray-600 cursor-grab active:cursor-grabbing transition-all ${
        props.isSelected ? "ring-2 ring-blue-500" : ""
      } ${props.task.priority ? `border-l-2 ${priorityColors[props.task.priority]}` : ""}`}
      style={{ padding: "8px 10px", "margin-bottom": "6px" }}
      onClick={() => props.onClick()}
      onDblClick={() => props.onDoubleClick()}
    >
      {/* Title - always shown */}
      <div class="text-sm text-gray-200 font-medium">{props.task.title}</div>

      {/* Standard density: show due date and priority */}
      <Show when={props.density !== "compact" && (props.task.due || props.task.priority)}>
        <div class="flex items-center gap-2 mt-1">
          <Show when={props.task.due}>
            <span
              class={`text-xs ${isOverdue() ? "text-red-400" : "text-gray-400"}`}
            >
              {props.task.due}
            </span>
          </Show>
          <Show when={props.task.priority}>
            <span class="text-xs text-gray-500 capitalize">
              {props.task.priority}
            </span>
          </Show>
        </div>
      </Show>

      {/* Detailed density: show description preview */}
      <Show when={props.density === "detailed" && props.task.description}>
        <p class="text-xs text-gray-400 mt-2 line-clamp-2">
          {props.task.description.slice(0, 100)}
          {props.task.description.length > 100 ? "..." : ""}
        </p>
      </Show>
    </div>
  );
}
```

**Step 2: Verify TypeScript compiles**

Run: `pnpm tsc --noEmit`

**Step 3: Commit**

```bash
git add src/components/KanbanCard.tsx
git commit -m "feat(kanban): Add KanbanCard component"
```

---

### Task 7: Create KanbanColumn Component

**Files:**
- Create: `src/components/KanbanColumn.tsx`

**Step 1: Create the component**

```tsx
import { For, Show, createSignal } from "solid-js";
import { createDroppable } from "@thisbeyond/solid-dnd";
import { KanbanCard } from "./KanbanCard";
import type { KanbanTask, CardDensity, TaskStatus } from "../lib/fs";
import { COLUMN_LABELS } from "../lib/store/kanban";

interface KanbanColumnProps {
  status: TaskStatus;
  tasks: KanbanTask[];
  density: CardDensity;
  selectedTaskId: string | null;
  onTaskClick: (taskId: string) => void;
  onTaskDoubleClick: (taskId: string) => void;
  onAddTask: (title: string) => void;
}

export function KanbanColumn(props: KanbanColumnProps) {
  const droppable = createDroppable(props.status);
  const [isAdding, setIsAdding] = createSignal(false);
  const [newTitle, setNewTitle] = createSignal("");

  const handleAddSubmit = () => {
    const title = newTitle().trim();
    if (title) {
      props.onAddTask(title);
      setNewTitle("");
      setIsAdding(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddSubmit();
    } else if (e.key === "Escape") {
      setNewTitle("");
      setIsAdding(false);
    }
  };

  return (
    <div
      ref={droppable.ref}
      class={`flex flex-col bg-gray-800/50 rounded-lg border ${
        droppable.isActiveDroppable ? "border-blue-500" : "border-gray-700"
      }`}
      style={{ width: "280px", "min-width": "280px", height: "100%" }}
    >
      {/* Header */}
      <div
        class="flex items-center justify-between border-b border-gray-700"
        style={{ padding: "12px" }}
      >
        <div class="flex items-center gap-2">
          <span class="text-sm font-medium text-gray-200">
            {COLUMN_LABELS[props.status]}
          </span>
          <span class="text-xs text-gray-500 bg-gray-700 rounded-full" style={{ padding: "2px 8px" }}>
            {props.tasks.length}
          </span>
        </div>
        <button
          onClick={() => setIsAdding(true)}
          class="text-gray-400 hover:text-gray-200 transition-colors"
          title="Add task"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 2a.75.75 0 0 1 .75.75v4.5h4.5a.75.75 0 0 1 0 1.5h-4.5v4.5a.75.75 0 0 1-1.5 0v-4.5h-4.5a.75.75 0 0 1 0-1.5h4.5v-4.5A.75.75 0 0 1 8 2Z" />
          </svg>
        </button>
      </div>

      {/* Task list */}
      <div class="flex-1 overflow-y-auto" style={{ padding: "8px" }}>
        {/* Quick add input */}
        <Show when={isAdding()}>
          <div style={{ "margin-bottom": "6px" }}>
            <input
              ref={(el) => setTimeout(() => el?.focus(), 10)}
              type="text"
              value={newTitle()}
              onInput={(e) => setNewTitle(e.currentTarget.value)}
              onKeyDown={handleKeyDown}
              onBlur={() => {
                if (!newTitle().trim()) {
                  setIsAdding(false);
                }
              }}
              placeholder="Task title..."
              class="w-full bg-gray-700 border border-gray-600 rounded text-sm text-gray-200"
              style={{ padding: "8px 10px" }}
            />
          </div>
        </Show>

        {/* Tasks */}
        <For each={props.tasks}>
          {(task) => (
            <KanbanCard
              task={task}
              density={props.density}
              isSelected={props.selectedTaskId === task.id}
              onClick={() => props.onTaskClick(task.id)}
              onDoubleClick={() => props.onTaskDoubleClick(task.id)}
            />
          )}
        </For>

        <Show when={props.tasks.length === 0 && !isAdding()}>
          <div class="text-center text-gray-500 text-xs" style={{ padding: "20px" }}>
            No tasks
          </div>
        </Show>
      </div>
    </div>
  );
}
```

**Step 2: Verify TypeScript compiles**

Run: `pnpm tsc --noEmit`

**Step 3: Commit**

```bash
git add src/components/KanbanColumn.tsx
git commit -m "feat(kanban): Add KanbanColumn component"
```

---

### Task 8: Create KanbanEditor Component

**Files:**
- Create: `src/components/KanbanEditor.tsx`

**Step 1: Create the component**

```tsx
import { For, Show } from "solid-js";
import {
  DragDropProvider,
  DragDropSensors,
  DragOverlay,
  closestCenter,
} from "@thisbeyond/solid-dnd";
import { KanbanColumn } from "./KanbanColumn";
import { KanbanCard } from "./KanbanCard";
import { kanbanStore, COLUMNS } from "../lib/store/kanban";
import type { TaskStatus } from "../lib/fs";

export function KanbanEditor() {
  const store = kanbanStore;

  const handleDragEnd = ({ draggable, droppable }: any) => {
    if (draggable && droppable) {
      const taskId = draggable.id as string;
      const newStatus = droppable.id as TaskStatus;
      store.moveTask(taskId, newStatus);
    }
  };

  const handleAddTask = async (status: TaskStatus, title: string) => {
    await store.addTask(title, status);
  };

  const visibleColumns = () => {
    const k = store.kanban();
    if (!k) return COLUMNS;
    return k.settings.showClosed
      ? COLUMNS
      : COLUMNS.filter((c) => c !== "closed");
  };

  const draggedTask = () => {
    const k = store.kanban();
    // Find task being dragged - this would need DragDropContext
    return null;
  };

  return (
    <div class="flex flex-col h-full bg-gray-900">
      {/* Header */}
      <div
        class="flex items-center justify-between border-b border-gray-700"
        style={{ padding: "12px 16px" }}
      >
        <h2 class="text-lg font-medium text-gray-200">
          {store.kanban()?.name || "Kanban"}
        </h2>
        <div class="flex items-center gap-2">
          {/* Density toggle */}
          <select
            value={store.kanban()?.settings.cardDensity || "standard"}
            onChange={(e) =>
              store.setSettings({
                cardDensity: e.currentTarget.value as any,
              })
            }
            class="bg-gray-700 border border-gray-600 rounded text-sm text-gray-200"
            style={{ padding: "4px 8px" }}
          >
            <option value="compact">Compact</option>
            <option value="standard">Standard</option>
            <option value="detailed">Detailed</option>
          </select>

          {/* Show closed toggle */}
          <label class="flex items-center gap-2 text-sm text-gray-400">
            <input
              type="checkbox"
              checked={store.kanban()?.settings.showClosed || false}
              onChange={(e) =>
                store.setSettings({ showClosed: e.currentTarget.checked })
              }
              class="rounded"
            />
            Show Closed
          </label>
        </div>
      </div>

      {/* Board */}
      <div class="flex-1 overflow-x-auto" style={{ padding: "16px" }}>
        <DragDropProvider onDragEnd={handleDragEnd} collisionDetector={closestCenter}>
          <DragDropSensors />
          <div class="flex gap-4 h-full">
            <For each={visibleColumns()}>
              {(status) => (
                <KanbanColumn
                  status={status}
                  tasks={store.getTasksByStatus(status)}
                  density={store.kanban()?.settings.cardDensity || "standard"}
                  selectedTaskId={store.selectedTaskId()}
                  onTaskClick={(id) => store.setSelectedTaskId(id)}
                  onTaskDoubleClick={(id) => store.setEditingTaskId(id)}
                  onAddTask={(title) => handleAddTask(status, title)}
                />
              )}
            </For>
          </div>
          <DragOverlay>
            {/* Render dragged card */}
          </DragOverlay>
        </DragDropProvider>
      </div>

      {/* Loading/Error states */}
      <Show when={store.isLoading()}>
        <div class="absolute inset-0 bg-gray-900/50 flex items-center justify-center">
          <span class="text-gray-400">Loading...</span>
        </div>
      </Show>

      <Show when={store.error()}>
        <div
          class="absolute bottom-4 right-4 bg-red-900/80 text-red-200 rounded"
          style={{ padding: "8px 12px" }}
        >
          {store.error()}
        </div>
      </Show>
    </div>
  );
}
```

**Step 2: Verify TypeScript compiles**

Run: `pnpm tsc --noEmit`

**Step 3: Commit**

```bash
git add src/components/KanbanEditor.tsx
git commit -m "feat(kanban): Add KanbanEditor component with drag-drop"
```

---

### Task 9: Integrate Kanban into App

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/Sidebar.tsx` or `src/components/TreeView.tsx`

**Step 1: Add kanban detection to TreeView**

Find where file types are detected and add:
```typescript
import { isKanban } from "../lib/fs";

// In the file rendering logic, add kanban icon/handling
```

**Step 2: Add KanbanEditor to App.tsx**

Import and render KanbanEditor when a .kanban file is opened:
```typescript
import { KanbanEditor } from "./components/KanbanEditor";
import { kanbanStore } from "./lib/store/kanban";
import { isKanban } from "./lib/fs";

// In the main content area, add condition:
<Show when={isKanban(currentPath())}>
  <KanbanEditor />
</Show>
```

**Step 3: Verify app builds**

Run: `pnpm build`

**Step 4: Commit**

```bash
git add src/App.tsx src/components/TreeView.tsx
git commit -m "feat(kanban): Integrate kanban editor into app"
```

---

### Task 10: Add "New Kanban" Command

**Files:**
- Modify: `src/lib/commands/index.ts`

**Step 1: Add create kanban command**

```typescript
{
  id: "create-kanban",
  name: "New Kanban Board",
  shortcut: "Cmd+Shift+K",
  category: "File",
  action: async () => {
    // Similar to create notebook logic
  },
}
```

**Step 2: Commit**

```bash
git add src/lib/commands/index.ts
git commit -m "feat(kanban): Add New Kanban Board command"
```

---

## Phase 3: Task Detail Panel (Future)

### Task 11: Create TaskDetailPanel Component

To be implemented after core functionality is working.

---

## Summary

**Phase 1 (Core Backend):** Tasks 1-4
- Rust types and commands
- TypeScript bindings
- Store

**Phase 2 (UI):** Tasks 5-10
- Drag-drop library
- Card, Column, Editor components
- App integration
- Command palette

**Phase 3 (Polish):** Task 11+
- Task detail panel with markdown editor
- Due date picker
- Priority selector
