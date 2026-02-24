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

  const priorityBadgeColors: Record<string, string> = {
    high: "bg-red-500/20 text-red-400",
    medium: "bg-yellow-500/20 text-yellow-400",
    low: "bg-blue-500/20 text-blue-400",
  };

  const isOverdue = () => {
    if (!props.task.due) return false;
    return new Date(props.task.due) < new Date();
  };

  // Format date for display
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Padding based on density
  const getPadding = () => {
    switch (props.density) {
      case "compact": return "4px 8px";
      case "standard": return "8px 10px";
      case "detailed": return "10px 12px";
    }
  };

  return (
    <div
      ref={draggable.ref}
      {...draggable.dragActivators}
      class={`bg-gray-700 rounded border border-gray-600 cursor-grab active:cursor-grabbing transition-all ${
        props.isSelected ? "ring-2 ring-blue-500" : ""
      } ${props.task.priority ? `border-l-2 ${priorityColors[props.task.priority]}` : ""}`}
      style={{ padding: getPadding(), "margin-bottom": "6px" }}
      onClick={() => props.onClick()}
      onDblClick={() => props.onDoubleClick()}
    >
      {/* Title - always shown */}
      <div class={`text-gray-200 font-medium ${props.density === "compact" ? "text-xs" : "text-sm"}`}>
        {props.task.title}
      </div>

      {/* Standard & Detailed: show metadata row */}
      <Show when={props.density !== "compact"}>
        <div class="flex items-center flex-wrap" style={{ gap: "6px", "margin-top": "6px" }}>
          {/* Priority badge */}
          <Show when={props.task.priority}>
            <span
              class={`text-xs rounded-full capitalize ${priorityBadgeColors[props.task.priority!]}`}
              style={{ padding: "2px 8px" }}
            >
              {props.task.priority}
            </span>
          </Show>

          {/* Due date badge */}
          <Show when={props.task.due}>
            <span
              class={`text-xs rounded-full ${
                isOverdue()
                  ? "bg-red-500/20 text-red-400"
                  : "bg-gray-600 text-gray-400"
              }`}
              style={{ padding: "2px 8px" }}
            >
              {formatDate(props.task.due!)}
            </span>
          </Show>

          {/* No metadata indicator */}
          <Show when={!props.task.priority && !props.task.due && !props.task.description}>
            <span class="text-xs text-gray-500 italic">Click to edit</span>
          </Show>
        </div>
      </Show>

      {/* Detailed density: show description preview */}
      <Show when={props.density === "detailed"}>
        <Show
          when={props.task.description}
          fallback={
            <p class="text-xs text-gray-500 italic" style={{ "margin-top": "8px" }}>
              No description
            </p>
          }
        >
          <p class="text-xs text-gray-400 line-clamp-2" style={{ "margin-top": "8px" }}>
            {props.task.description.slice(0, 100)}
            {props.task.description.length > 100 ? "..." : ""}
          </p>
        </Show>
      </Show>
    </div>
  );
}
