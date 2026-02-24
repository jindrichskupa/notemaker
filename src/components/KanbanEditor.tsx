import { For, Show } from "solid-js";
import {
  DragDropProvider,
  DragDropSensors,
  DragOverlay,
  closestCenter,
  type DragEvent,
} from "@thisbeyond/solid-dnd";
import { KanbanColumn } from "./KanbanColumn";
import { TaskDetailPanel } from "./TaskDetailPanel";
import { kanbanStore, COLUMNS } from "../lib/store/kanban";
import type { TaskStatus } from "../lib/fs";

export function KanbanEditor() {
  const store = kanbanStore;

  const handleDragEnd = (event: DragEvent) => {
    const { draggable, droppable } = event;
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

  // Helper to find task by ID for drag overlay
  const getTaskTitle = (taskId: string): string => {
    const k = store.kanban();
    if (!k) return taskId;
    const task = k.tasks.find(t => t.id === taskId);
    return task?.title || taskId;
  };

  return (
    <div class="relative flex h-full bg-gray-900">
      {/* Main board area */}
      <div class="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div
          class="flex items-center justify-between border-b border-gray-700"
          style={{ padding: "12px 16px" }}
        >
          <h2 class="text-lg font-medium text-gray-200">
            {store.kanban()?.name || "Kanban"}
          </h2>
          <div class="flex items-center" style={{ gap: "8px" }}>
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
            <label class="flex items-center text-sm text-gray-400" style={{ gap: "8px" }}>
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
            <div class="flex h-full" style={{ gap: "16px" }}>
              <For each={visibleColumns()}>
                {(status) => (
                  <KanbanColumn
                    status={status}
                    tasks={store.getTasksByStatus(status)}
                    density={store.kanban()?.settings.cardDensity || "standard"}
                    selectedTaskId={store.selectedTaskId()}
                    onTaskClick={(id) => store.setSelectedTaskId(id)}
                    onTaskDoubleClick={(id) => store.setSelectedTaskId(id)}
                    onAddTask={(title) => handleAddTask(status, title)}
                  />
                )}
              </For>
            </div>
            <DragOverlay>
              {(draggable) => (
                <div class="bg-gray-700 rounded border border-gray-500 shadow-lg opacity-80" style={{ padding: "8px 12px" }}>
                  {draggable ? getTaskTitle(String(draggable.id)) : null}
                </div>
              )}
            </DragOverlay>
          </DragDropProvider>
        </div>

        {/* Loading state */}
        <Show when={store.isLoading()}>
          <div class="absolute inset-0 bg-gray-900/50 flex items-center justify-center">
            <span class="text-gray-400">Loading...</span>
          </div>
        </Show>

        {/* Error state */}
        <Show when={store.error()}>
          <div
            class="absolute bottom-4 right-4 bg-red-900/80 text-red-200 rounded"
            style={{ padding: "8px 12px" }}
          >
            {store.error()}
          </div>
        </Show>
      </div>

      {/* Task Detail Panel - shown when a task is selected */}
      <Show when={store.getSelectedTask()}>
        {(task) => (
          <TaskDetailPanel
            task={task()}
            onClose={() => store.setSelectedTaskId(null)}
          />
        )}
      </Show>
    </div>
  );
}
