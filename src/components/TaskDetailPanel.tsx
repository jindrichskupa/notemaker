import { Show, createSignal, createEffect } from "solid-js";
import type { KanbanTask, TaskStatus, TaskPriority } from "../lib/fs";
import { kanbanStore, COLUMNS, COLUMN_LABELS } from "../lib/store/kanban";

interface TaskDetailPanelProps {
  task: KanbanTask;
  onClose: () => void;
}

export function TaskDetailPanel(props: TaskDetailPanelProps) {
  const [title, setTitle] = createSignal(props.task.title);
  const [status, setStatus] = createSignal<TaskStatus>(props.task.status);
  const [priority, setPriority] = createSignal<TaskPriority | "">(props.task.priority || "");
  const [due, setDue] = createSignal(props.task.due || "");
  const [description, setDescription] = createSignal(props.task.description || "");
  const [isSaving, setIsSaving] = createSignal(false);

  // Update local state when task changes
  createEffect(() => {
    setTitle(props.task.title);
    setStatus(props.task.status);
    setPriority(props.task.priority || "");
    setDue(props.task.due || "");
    setDescription(props.task.description || "");
  });

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await kanbanStore.updateTask(props.task.id, {
        title: title(),
        status: status(),
        priority: priority() || undefined,
        due: due() || undefined,
        description: description(),
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (confirm("Delete this task?")) {
      await kanbanStore.removeTask(props.task.id);
      props.onClose();
    }
  };

  // Auto-save on blur
  const handleBlur = () => {
    handleSave();
  };

  return (
    <div
      class="w-80 bg-gray-800 border-l border-gray-700 flex flex-col h-full"
    >
      {/* Header */}
      <div
        class="flex items-center justify-between border-b border-gray-700"
        style={{ padding: "12px 16px" }}
      >
        <h3 class="text-sm font-medium text-gray-200">Edit Task</h3>
        <button
          onClick={props.onClose}
          class="text-gray-400 hover:text-gray-200"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.749.749 0 0 1 1.275.326.749.749 0 0 1-.215.734L9.06 8l3.22 3.22a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215L8 9.06l-3.22 3.22a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z" />
          </svg>
        </button>
      </div>

      {/* Form */}
      <div class="flex-1 overflow-y-auto" style={{ padding: "16px" }}>
        {/* Title */}
        <div style={{ "margin-bottom": "16px" }}>
          <label class="block text-xs text-gray-400" style={{ "margin-bottom": "4px" }}>
            Title
          </label>
          <input
            type="text"
            value={title()}
            onInput={(e) => setTitle(e.currentTarget.value)}
            onBlur={handleBlur}
            class="w-full bg-gray-700 border border-gray-600 rounded text-sm text-gray-200"
            style={{ padding: "8px 10px" }}
          />
        </div>

        {/* Status */}
        <div style={{ "margin-bottom": "16px" }}>
          <label class="block text-xs text-gray-400" style={{ "margin-bottom": "4px" }}>
            Status
          </label>
          <select
            value={status()}
            onChange={(e) => {
              setStatus(e.currentTarget.value as TaskStatus);
              handleSave();
            }}
            class="w-full bg-gray-700 border border-gray-600 rounded text-sm text-gray-200"
            style={{ padding: "8px 10px" }}
          >
            {COLUMNS.map((col) => (
              <option value={col}>{COLUMN_LABELS[col]}</option>
            ))}
          </select>
        </div>

        {/* Priority */}
        <div style={{ "margin-bottom": "16px" }}>
          <label class="block text-xs text-gray-400" style={{ "margin-bottom": "4px" }}>
            Priority
          </label>
          <select
            value={priority()}
            onChange={(e) => {
              setPriority(e.currentTarget.value as TaskPriority | "");
              handleSave();
            }}
            class="w-full bg-gray-700 border border-gray-600 rounded text-sm text-gray-200"
            style={{ padding: "8px 10px" }}
          >
            <option value="">None</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>

        {/* Due Date */}
        <div style={{ "margin-bottom": "16px" }}>
          <label class="block text-xs text-gray-400" style={{ "margin-bottom": "4px" }}>
            Due Date
          </label>
          <input
            type="date"
            value={due()}
            onInput={(e) => setDue(e.currentTarget.value)}
            onBlur={handleBlur}
            class="w-full bg-gray-700 border border-gray-600 rounded text-sm text-gray-200"
            style={{ padding: "8px 10px" }}
          />
        </div>

        {/* Description */}
        <div style={{ "margin-bottom": "16px" }}>
          <label class="block text-xs text-gray-400" style={{ "margin-bottom": "4px" }}>
            Description
          </label>
          <textarea
            value={description()}
            onInput={(e) => setDescription(e.currentTarget.value)}
            onBlur={handleBlur}
            rows={6}
            class="w-full bg-gray-700 border border-gray-600 rounded text-sm text-gray-200 resize-none"
            style={{ padding: "8px 10px" }}
            placeholder="Add a description..."
          />
        </div>
      </div>

      {/* Footer */}
      <div
        class="border-t border-gray-700 flex justify-between"
        style={{ padding: "12px 16px" }}
      >
        <button
          onClick={handleDelete}
          class="text-red-400 hover:text-red-300 text-sm"
        >
          Delete Task
        </button>
        <Show when={isSaving()}>
          <span class="text-xs text-gray-500">Saving...</span>
        </Show>
      </div>
    </div>
  );
}
