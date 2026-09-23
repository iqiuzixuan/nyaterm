import { Archive, Cable, Globe, Link2, Server } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import type { TooltipState } from "@/hooks/useActionLinks";

interface ActionLinkTooltipProps {
  state: TooltipState | null;
}

const KIND_CONFIG: Record<string, { color: string; icon: React.ElementType }> = {
  ip: { color: "bg-blue-500/15 text-blue-500 border-blue-500/30", icon: Server },
  hostPort: { color: "bg-purple-500/15 text-purple-500 border-purple-500/30", icon: Cable },
  archive: { color: "bg-amber-500/15 text-amber-500 border-amber-500/30", icon: Archive },
  url: { color: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30", icon: Globe },
  custom: { color: "bg-muted text-muted-foreground border-border", icon: Link2 },
};

function isMacPlatform(): boolean {
  return (
    typeof navigator !== "undefined" &&
    /(Mac|iPhone|iPad|iPod)/i.test(`${navigator.platform} ${navigator.userAgent}`)
  );
}

export default function ActionLinkTooltip({ state }: ActionLinkTooltipProps) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const modLabel = useMemo(() => (isMacPlatform() ? "⌘" : "Ctrl"), []);

  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (!state) {
      setVisible(false);
      setPos(null);
      return;
    }

    setVisible(false);
    timerRef.current = setTimeout(() => {
      setPos(computePosition(state.x, state.y, ref.current));
      setVisible(true);
      timerRef.current = null;
    }, 250);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [state]);

  useEffect(() => {
    if (visible && state && ref.current) {
      setPos(computePosition(state.x, state.y, ref.current));
    }
  }, [visible, state]);

  if (!state) return null;

  const kind = state.link.ctx.kind as string;
  const kindLabel = t(`terminal.actionLinkKind_${kind}`, { defaultValue: kind });
  const config = KIND_CONFIG[kind] ?? KIND_CONFIG.custom;
  const KindIcon = config.icon;

  const defaultAction = state.link.actions.find((a) => a.isDefault) ?? state.link.actions[0];
  const hasMoreActions = state.link.actions.length > 1;

  return createPortal(
    <div
      ref={ref}
      className={`fixed z-[9999] pointer-events-none transition-all duration-200 ease-out will-change-[opacity,transform] ${
        visible ? "opacity-100 scale-100" : "opacity-0 scale-95"
      }`}
      style={{
        left: pos?.left ?? state.x + 16,
        top: pos?.top ?? state.y + 16,
      }}
    >
      <div className="rounded-xl border border-[var(--workspace-border)] bg-popover backdrop-blur-md text-popover-foreground shadow-2xl shadow-black/20 text-xs max-w-[340px] overflow-hidden select-none">
        {/* Header Section */}
        <div className="flex items-center gap-2.5 px-3 py-2.5 border-b border-border/40 bg-muted/20">
          <div
            className={`flex items-center justify-center rounded-md border px-1.5 py-1 gap-1.5 text-[10px] font-medium tracking-wide ${config.color}`}
          >
            <KindIcon className="w-3 h-3" />
            <span className="uppercase">{kindLabel}</span>
          </div>
          <span
            className="font-mono text-foreground font-medium truncate flex-1"
            title={state.link.ctx.value}
          >
            {state.link.ctx.value}
          </span>
        </div>

        {/* Action Body Section */}
        {defaultAction?.command && (
          <div className="px-3 py-2.5 flex flex-col gap-2 bg-popover/50">
            <div className="flex items-center gap-2 font-mono text-[11px] truncate">
              <div className="flex items-center gap-1 shrink-0">
                <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-border/80 bg-muted/60 px-1 font-sans font-medium text-foreground/80 shadow-[0_1px_1px_rgba(0,0,0,0.1)]">
                  {modLabel}
                </kbd>
                <span className="text-muted-foreground/50">+</span>
                <span className="text-muted-foreground font-sans">{t("terminal.click")}</span>
              </div>
              <span className="text-muted-foreground/40 shrink-0">→</span>
              <span className="text-muted-foreground font-sans shrink-0">
                {t("terminal.actionLinkPrepareCommand")}
              </span>
              <span
                className="text-foreground tracking-tight truncate border-b border-foreground/10 pb-[1px]"
                title={defaultAction.command}
              >
                {defaultAction.command}
              </span>
            </div>

            {hasMoreActions && (
              <div className="text-[10px] text-muted-foreground/70 flex items-center gap-1.5 pt-1.5 border-t border-border/30">
                <div className="w-1 h-1 rounded-full bg-muted-foreground/30" />
                {t("terminal.actionLinkAltClickHint")}
              </div>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

function computePosition(
  clientX: number,
  clientY: number,
  el: HTMLDivElement | null,
): { left: number; top: number } {
  const cursorOffset = 20;
  const viewportMargin = 16;
  const w = el?.offsetWidth ?? 300;
  const h = el?.offsetHeight ?? 100;

  let left = clientX + cursorOffset;
  let top = clientY + cursorOffset;

  if (left + w + viewportMargin > window.innerWidth) {
    left = clientX - w - cursorOffset * 0.5;
  }

  if (top + h + viewportMargin > window.innerHeight) {
    top = clientY - h - cursorOffset * 0.5;
  }

  return {
    left: Math.max(viewportMargin, Math.min(left, window.innerWidth - w - viewportMargin)),
    top: Math.max(viewportMargin, Math.min(top, window.innerHeight - h - viewportMargin)),
  };
}
