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
  onDescriptionChange?: (taskId: string, content: string) => void;
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
        <div class="flex items-center" style={{ gap: "8px" }}>
          <span class="text-sm font-medium text-gray-200">
            {COLUMN_LABELS[props.status]}
          </span>
          <span
            class="text-xs text-gray-500 bg-gray-700 rounded-full"
            style={{ padding: "2px 8px" }}
          >
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
              onDescriptionChange={(content) => props.onDescriptionChange?.(task.id, content)}
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
