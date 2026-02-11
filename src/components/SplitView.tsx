/**
 * Resizable split view component
 */

import { createSignal, JSX, onMount, onCleanup } from "solid-js";

export interface SplitViewProps {
  left: JSX.Element;
  right: JSX.Element;
  initialRatio?: number;
  minRatio?: number;
  maxRatio?: number;
  class?: string;
}

export function SplitView(props: SplitViewProps) {
  const [ratio, setRatio] = createSignal(props.initialRatio ?? 0.5);
  const [isDragging, setIsDragging] = createSignal(false);
  let containerRef: HTMLDivElement | undefined;

  const minRatio = props.minRatio ?? 0.2;
  const maxRatio = props.maxRatio ?? 0.8;

  const handleMouseDown = (e: MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging() || !containerRef) return;

    const rect = containerRef.getBoundingClientRect();
    const newRatio = (e.clientX - rect.left) / rect.width;
    setRatio(Math.max(minRatio, Math.min(maxRatio, newRatio)));
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Handle double-click to reset ratio
  const handleDoubleClick = () => {
    setRatio(0.5);
  };

  onMount(() => {
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  });

  onCleanup(() => {
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", handleMouseUp);
  });

  return (
    <div
      ref={containerRef}
      class={`split-view flex h-full overflow-hidden ${
        isDragging() ? "select-none cursor-col-resize" : ""
      } ${props.class || ""}`}
    >
      {/* Left panel */}
      <div
        class="split-left overflow-hidden"
        style={{ width: `${ratio() * 100}%` }}
      >
        {props.left}
      </div>

      {/* Resize handle */}
      <div
        class={`split-handle w-1 bg-gray-700 cursor-col-resize hover:bg-blue-500 transition-colors flex-shrink-0 ${
          isDragging() ? "bg-blue-500" : ""
        }`}
        onMouseDown={handleMouseDown}
        onDblClick={handleDoubleClick}
        title="Drag to resize, double-click to reset"
      />

      {/* Right panel */}
      <div
        class="split-right overflow-hidden"
        style={{ width: `${(1 - ratio()) * 100}%` }}
      >
        {props.right}
      </div>
    </div>
  );
}

export default SplitView;
