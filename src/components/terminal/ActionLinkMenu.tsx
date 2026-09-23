import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { MdArchive, MdLink, MdRouter, MdStorage, MdTerminal } from "react-icons/md";
import type { MenuState } from "@/hooks/useActionLinks";
import type { EntityKind } from "@/lib/actionLinksAddon";

interface ActionLinkMenuProps {
  state: MenuState | null;
  onClose: () => void;
}

const KIND_ICONS: Record<string, React.ReactNode> = {
  ip: <MdRouter className="text-blue-400" />,
  hostPort: <MdStorage className="text-purple-400" />,
  archive: <MdArchive className="text-amber-400" />,
  url: <MdLink className="text-blue-400" />,
};

function getKindIcon(kind: EntityKind | string): React.ReactNode {
  return KIND_ICONS[kind] ?? <MdTerminal className="text-muted-foreground" />;
}

export default function ActionLinkMenu({ state, onClose }: ActionLinkMenuProps) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);

  // Close on Escape or outside click
  useEffect(() => {
    if (!state) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const handlePointerDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [state, onClose]);

  if (!state) return null;

  const { x, y, link, actions, prepare } = state;
  const pos = computeMenuPosition(x, y, ref.current);

  const handleAction = (actionId: string) => {
    prepare(actionId);
    onClose();
  };

  return createPortal(
    <div
      ref={ref}
      className="fixed z-[9999] min-w-[220px] max-w-[320px] rounded-md border bg-popover text-popover-foreground shadow-lg text-sm overflow-hidden animate-in fade-in-0 zoom-in-95 duration-100"
      style={{ left: pos.left, top: pos.top }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-muted/40">
        <span className="text-base leading-none">{getKindIcon(link.ctx.kind)}</span>
        <span className="text-xs text-muted-foreground shrink-0">
          {t(`terminal.actionLinkKind_${link.ctx.kind}`, { defaultValue: link.ctx.kind })}
        </span>
        <span className="font-mono text-xs text-foreground truncate flex-1">{link.ctx.value}</span>
      </div>

      {/* Actions */}
      <div className="py-1">
        {actions.map((action) => (
          <button
            key={action.id}
            type="button"
            onClick={() => handleAction(action.id)}
            className={[
              "w-full flex items-start gap-3 px-3 py-2 text-left",
              "hover:bg-accent hover:text-accent-foreground",
              "focus:outline-none focus:bg-accent focus:text-accent-foreground",
              "transition-colors",
              action.isDefault ? "font-medium" : "",
              action.danger ? "text-destructive hover:text-destructive" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <span className="flex-1 min-w-0">
              <span className="block">{action.label}</span>
              {action.command && (
                <span className="block text-[11px] font-mono text-muted-foreground truncate mt-0.5">
                  {action.command}
                </span>
              )}
            </span>
            {action.isDefault && (
              <span className="shrink-0 text-[10px] text-muted-foreground bg-muted rounded px-1.5 py-0.5 self-center">
                {t("terminal.actionLinkDefaultBadge")}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>,
    document.body,
  );
}

function computeMenuPosition(
  clientX: number,
  clientY: number,
  el: HTMLDivElement | null,
): { left: number; top: number } {
  const margin = 8;
  const w = el?.offsetWidth ?? 240;
  const h = el?.offsetHeight ?? 180;

  let left = clientX;
  let top = clientY;

  if (left + w + margin > window.innerWidth) {
    left = window.innerWidth - w - margin;
  }
  if (top + h + margin > window.innerHeight) {
    top = window.innerHeight - h - margin;
  }

  return {
    left: Math.max(margin, left),
    top: Math.max(margin, top),
  };
}
