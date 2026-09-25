import { Terminal } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface DockerLogsDialogProps {
  logs: { title: string; text: string } | null;
  onOpenChange: (open: boolean) => void;
}

export default function DockerLogsDialog({ logs, onOpenChange }: DockerLogsDialogProps) {
  const { t } = useTranslation();

  return (
    <Dialog open={Boolean(logs)} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(720px,calc(100vw-2rem))] sm:max-w-[720px] p-0 gap-0 overflow-hidden">
        <DialogHeader className="border-b px-4 py-3 pr-12">
          <DialogTitle className="flex min-w-0 items-center gap-2 text-sm">
            <Terminal className="h-4 w-4 shrink-0" />
            <span className="truncate" title={logs?.title}>
              {logs?.title ?? t("dockerManager.logs")}
            </span>
          </DialogTitle>
          <DialogDescription className="sr-only">{t("dockerManager.logs")}</DialogDescription>
        </DialogHeader>
        <pre className="max-h-[70vh] min-h-56 overflow-auto whitespace-pre-wrap break-words p-4 font-mono text-[0.6875rem] text-muted-foreground terminal-scroll">
          {logs?.text ?? ""}
        </pre>
      </DialogContent>
    </Dialog>
  );
}
