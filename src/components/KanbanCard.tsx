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

  const priorityColors: Record<string, string> = {
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
        <div class="flex items-center" style={{ gap: "8px", "margin-top": "4px" }}>
          <Show when={props.task.due}>
            <span class={`text-xs ${isOverdue() ? "text-red-400" : "text-gray-400"}`}>
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
        <p class="text-xs text-gray-400 line-clamp-2" style={{ "margin-top": "8px" }}>
          {props.task.description.slice(0, 100)}
          {props.task.description.length > 100 ? "..." : ""}
        </p>
      </Show>
    </div>
  );
}
