/**
 * Kanban store - manages state for kanban board functionality
 */

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

export type { Kanban, KanbanTask, KanbanSettings, TaskStatus, TaskUpdates, CardDensity };

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
      const updatedTask = await updateKanbanTask(k.path, taskId, updates);
      setKanban({
        ...k,
        tasks: k.tasks.map(t => t.id === taskId ? updatedTask : t),
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

    // Update UI immediately (optimistic update)
    setKanban({
      ...k,
      tasks: k.tasks.map(t =>
        t.id === taskId
          ? { ...t, description: content, updated: new Date().toISOString() }
          : t
      ),
    });

    // Then persist to disk
    try {
      await updateTaskDescription(k.path, taskId, content);
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

    // Update UI immediately (optimistic update)
    setKanban({ ...k, settings: newSettings });

    // Then persist to disk
    try {
      await updateKanbanSettings(k.path, newSettings);
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
