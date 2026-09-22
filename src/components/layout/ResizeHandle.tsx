import { useCallback, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

interface ResizeHandleProps {
  direction: "horizontal" | "vertical";
  onResize: (delta: number) => void;
  className?: string;
  variant?: "line" | "gutter";
  value?: number;
}

/** Pointer and keyboard resizing share the same delta contract as the existing layouts. */
export default function ResizeHandle({
  direction,
  onResize,
  className,
  variant = "line",
  value,
}: ResizeHandleProps) {
  const { t } = useTranslation();
  const onResizeRef = useRef(onResize);
  const cleanupRef = useRef<(() => void) | null>(null);
  onResizeRef.current = onResize;
  useEffect(() => () => cleanupRef.current?.(), []);

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      event.preventDefault();
      cleanupRef.current?.();
      const pointerId = event.pointerId;
      let position = direction === "horizontal" ? event.clientX : event.clientY;
      const { cursor, userSelect } = document.body.style;
      const target = event.currentTarget;
      target.dataset.dragging = "true";
      target.setPointerCapture?.(pointerId);
      document.body.style.cursor =
        direction === "horizontal" ? "col-resize" : "row-resize";
      document.body.style.userSelect = "none";

      const move = (next: PointerEvent) => {
        if (next.pointerId !== pointerId) return;
        const current =
          direction === "horizontal" ? next.clientX : next.clientY;
        onResizeRef.current(current - position);
        position = current;
      };
      const cleanup = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", end);
        window.removeEventListener("pointercancel", end);
        window.removeEventListener("blur", cleanup);
        if (target.hasPointerCapture?.(pointerId))
          target.releasePointerCapture(pointerId);
        delete target.dataset.dragging;
        document.body.style.cursor = cursor;
        document.body.style.userSelect = userSelect;
        cleanupRef.current = null;
      };
      const end = (next: PointerEvent) => {
        if (next.pointerId === pointerId) cleanup();
      };
      cleanupRef.current = cleanup;
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", end);
      window.addEventListener("pointercancel", end);
      window.addEventListener("blur", cleanup);
    },
    [direction],
  );

  return (
    // biome-ignore lint/a11y/useSemanticElements: An interactive window splitter is not a thematic break (hr).
    <div
      role="separator"
      tabIndex={0}
      aria-label={t(
        direction === "horizontal"
          ? "workspaceLayout.resizeWidth"
          : "workspaceLayout.resizeHeight",
      )}
      aria-orientation={direction === "horizontal" ? "vertical" : "horizontal"}
      aria-valuenow={value}
      className={cn("workspace-resize-handle", className)}
      data-direction={direction}
      data-variant={variant}
      onPointerDown={handlePointerDown}
      onKeyDown={(event) => {
        const decrement = direction === "horizontal" ? "ArrowLeft" : "ArrowUp";
        const increment =
          direction === "horizontal" ? "ArrowRight" : "ArrowDown";
        if (event.key !== decrement && event.key !== increment) return;
        event.preventDefault();
        onResizeRef.current(
          (event.key === increment ? 1 : -1) * (event.shiftKey ? 24 : 8),
        );
      }}
    >
      <span aria-hidden="true" />
    </div>
  );
}
