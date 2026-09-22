import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PanelHeaderProps {
  title: string;
  meta?: ReactNode;
  actions?: ReactNode;
  className?: string;
  titleClassName?: string;
}

export default function PanelHeader({
  title,
  meta,
  actions,
  className,
  titleClassName,
}: PanelHeaderProps) {
  return (
    <div
      className={cn(
        "workspace-panel-header nyaterm-wallpaper-transparent-surface flex shrink-0 items-center justify-between gap-3 px-3",
        className,
      )}
      style={{
        borderColor: "var(--df-border)",
        backgroundColor: "transparent",
      }}
    >
      <div className="flex min-w-0 flex-1 items-baseline gap-2">
        <span
          className={cn(
            "workspace-panel-title shrink-0 truncate",
            titleClassName,
          )}
          style={{ color: "var(--df-text-muted)" }}
        >
          {title}
        </span>
        {meta != null ? (
          <span
            className="min-w-0 truncate text-[0.6875rem]"
            style={{ color: "var(--df-text-dimmed)" }}
          >
            {meta}
          </span>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-1">{actions}</div> : null}
    </div>
  );
}
