import type { TFunction } from "i18next";
import NyaTermLogo from "@/components/NyaTermLogo";
import { Kbd, KbdGroup } from "@/components/ui/kbd";

interface WorkbenchViewProps {
  t: TFunction;
  backgroundEnabled: boolean;
  temporarySshShortcut: string;
  openChatShortcut: string;
  showCommandsShortcut: string;
  switchTerminalShortcut: string;
  onTemporarySshLink: () => void;
  onOpenChat: () => void;
  onShowCommands: () => void;
  onSwitchTerminal: () => void;
}

export default function WorkbenchView({
  t,
  backgroundEnabled,
  temporarySshShortcut,
  openChatShortcut,
  showCommandsShortcut,
  switchTerminalShortcut,
  onTemporarySshLink,
  onOpenChat,
  onShowCommands,
  onSwitchTerminal,
}: WorkbenchViewProps) {
  const emptyWorkspaceActions = [
    {
      label: t("temporarySsh.title"),
      shortcut: temporarySshShortcut,
      onClick: onTemporarySshLink,
    },
    {
      label: t("app.openChat"),
      shortcut: openChatShortcut,
      onClick: onOpenChat,
    },
    {
      label: t("app.showAllCommands"),
      shortcut: showCommandsShortcut,
      onClick: onShowCommands,
    },
    {
      label: t("app.switchTerminal"),
      shortcut: switchTerminalShortcut,
      onClick: onSwitchTerminal,
    },
  ];

  return (
    <div
      className="flex h-full items-center justify-center px-6"
      style={{
        backgroundColor: backgroundEnabled ? "var(--workspace-content-bg)" : undefined,
      }}
    >
      <div className="flex w-full max-w-[34rem] flex-col items-center">
        {!backgroundEnabled && (
          <NyaTermLogo
            aria-hidden="true"
            className="mb-8 h-24 w-24 opacity-30 grayscale"
            style={{
              color: "var(--df-text-dimmed)",
              ["--grad-from" as string]: "currentColor",
              ["--grad-to" as string]: "currentColor",
            }}
          />
        )}

        <div className="flex w-full max-w-[22rem] flex-col gap-1 text-sm">
          {emptyWorkspaceActions.map((item) => (
            <button
              key={item.label}
              type="button"
              className="flex min-h-8 items-center justify-between gap-4 rounded px-2 text-left transition-colors hover:bg-[var(--df-bg-hover)] focus-visible:outline-2 focus-visible:outline-[var(--df-focus-ring)]"
              onClick={item.onClick}
            >
              <span
                className="justify-self-start transition-colors hover:text-[var(--df-primary)]"
                style={{ color: "var(--df-text-muted)" }}
              >
                {item.label}
              </span>
              <ShortcutKeys value={item.shortcut} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function ShortcutKeys({ value }: { value: string }) {
  const keys = value
    .split("+")
    .map((part) => part.trim())
    .filter(Boolean);

  if (!keys.length) return null;

  return (
    <KbdGroup className="justify-self-end text-[11px]" aria-hidden="true">
      {keys.map((key, index) => (
        <span key={key} className="inline-flex items-center gap-1">
          {index > 0 ? <span style={{ color: "var(--df-text-dimmed)" }}>+</span> : null}
          <Kbd className="h-[18px] min-w-[18px] border border-[var(--workspace-border)] bg-transparent px-1 text-[11px] font-normal text-[var(--df-text-muted)] shadow-none">
            {key}
          </Kbd>
        </span>
      ))}
    </KbdGroup>
  );
}
