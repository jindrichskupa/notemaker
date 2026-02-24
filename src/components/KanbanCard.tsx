import { Show } from "solid-js";
import { createDraggable } from "@thisbeyond/solid-dnd";
import type { KanbanTask, CardDensity } from "../lib/fs";
import { KanbanCardPreview } from "./KanbanCardPreview";

interface KanbanCardProps {
  task: KanbanTask;
  density: CardDensity;
  isSelected: boolean;
  onClick: () => void;
  onDoubleClick: () => void;
  onDescriptionChange?: (content: string) => void;
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
      {/* Title - always shown, same size for all densities */}
      <div class="text-sm text-gray-200 font-medium">
        {props.task.title}
      </div>

      {/* Standard & Detailed: show metadata row */}
      <Show when={props.density !== "compact" && (props.task.priority || props.task.due)}>
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
        </div>
      </Show>

      {/* Detailed density: show markdown description preview */}
      <Show when={props.density === "detailed" && props.task.description}>
        <div style={{ "margin-top": "8px" }}>
          <KanbanCardPreview
            content={props.task.description}
            maxLength={150}
            onCheckboxToggle={props.onDescriptionChange}
          />
        </div>
      </Show>
    </div>
  );
}
