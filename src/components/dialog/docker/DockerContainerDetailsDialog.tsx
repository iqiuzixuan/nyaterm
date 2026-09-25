import { Check, Copy, Loader2, RefreshCw, X } from "lucide-react";
import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getErrorMessage } from "@/lib/errors";
import { invoke } from "@/lib/invoke";
import { cn } from "@/lib/utils";
import type { DockerContainer, DockerContainerDetails, DockerContainerStats } from "@/types/global";

type DockerStateKind = "danger" | "running" | "stopped" | "transition" | "unknown";

interface DockerContainerDetailsDialogProps {
  container: DockerContainer | null;
  pollIntervalMs: number;
  sessionId: string | null;
  onOpenChange: (open: boolean) => void;
}

export default function DockerContainerDetailsDialog({
  container,
  pollIntervalMs,
  sessionId,
  onOpenChange,
}: DockerContainerDetailsDialogProps) {
  const { t } = useTranslation();
  const [details, setDetails] = useState<DockerContainerDetails | null>(null);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const requestIdRef = useRef(0);
  const stats = details?.stats;
  const ports = parseDockerPorts(container?.ports ?? "");
  const portValue = ports.length > 0 ? ports.map(formatPort).join("\n") : "-";

  const loadDetails = useCallback(async () => {
    if (!container || !sessionId) return;
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setDetailsLoading(true);
    setDetailsError(null);

    try {
      const data = await invoke<DockerContainerDetails>("get_docker_container_details", {
        sessionId,
        containerId: container.id,
      });
      if (requestIdRef.current === requestId) {
        setDetails(data);
      }
    } catch (error) {
      if (requestIdRef.current === requestId) {
        setDetailsError(getErrorMessage(error));
      }
    } finally {
      if (requestIdRef.current === requestId) {
        setDetailsLoading(false);
      }
    }
  }, [container, sessionId]);

  const loadStats = useCallback(async () => {
    if (!container || !sessionId) return;
    try {
      const data = await invoke<DockerContainerStats | null>("get_docker_container_stats", {
        sessionId,
        containerId: container.id,
      });
      setDetails((current) => (current ? { ...current, stats: data } : current));
    } catch {
      // Stats refresh is best-effort; keep the last snapshot if the daemon is busy.
    }
  }, [container, sessionId]);

  useEffect(() => {
    requestIdRef.current += 1;
    setDetails(null);
    setDetailsError(null);
    setDetailsLoading(false);
    if (container && sessionId) {
      void loadDetails();
    }
  }, [container, loadDetails, sessionId]);

  useEffect(() => {
    if (!container || !sessionId) return;
    const interval = window.setInterval(() => void loadStats(), pollIntervalMs);
    return () => window.clearInterval(interval);
  }, [container, loadStats, pollIntervalMs, sessionId]);

  return (
    <Dialog open={Boolean(container)} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-[min(620px,calc(100vw-2rem))] sm:max-w-[620px] p-0 gap-0 overflow-hidden"
        showCloseButton={false}
      >
        <DialogHeader className="border-b bg-muted/10 px-4 py-4">
          <div className="flex min-h-8 min-w-0 items-center gap-3">
            <DialogTitle className="flex min-w-0 flex-1 items-center gap-2 text-sm">
              <span className="min-w-0 truncate" title={container?.name}>
                {container?.name ?? t("dockerManager.containerDetails")}
              </span>
              {container ? <StateBadge state={container.state} /> : null}
            </DialogTitle>
            <div className="flex shrink-0 items-center gap-1">
              {container ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-md text-muted-foreground hover:text-foreground"
                      disabled={detailsLoading}
                      onClick={() => void loadDetails()}
                      aria-label={t("common.refresh")}
                    >
                      {detailsLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t("common.refresh")}</TooltipContent>
                </Tooltip>
              ) : null}
              <Tooltip>
                <TooltipTrigger asChild>
                  <DialogClose asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-md text-muted-foreground hover:text-foreground"
                      aria-label={t("common.close")}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </DialogClose>
                </TooltipTrigger>
                <TooltipContent>{t("common.close")}</TooltipContent>
              </Tooltip>
            </div>
          </div>
          <DialogDescription className="sr-only">
            {t("dockerManager.containerDetails")}
          </DialogDescription>
        </DialogHeader>

        {container ? (
          <div className="max-h-[75vh] overflow-y-auto p-4 terminal-scroll">
            <div className="space-y-4">
              <ContainerSnapshot
                container={container}
                details={details}
                detailsLoading={detailsLoading}
              />
              {detailsError ? (
                <div className="flex items-center justify-between gap-3 rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
                  <span className="min-w-0 truncate">{detailsError}</span>
                  <Button variant="ghost" size="xs" onClick={() => void loadDetails()}>
                    {t("common.retry")}
                  </Button>
                </div>
              ) : null}

              <DetailSection title={t("dockerManager.identity")}>
                <CopyableDetailRow
                  label={t("dockerManager.containerName")}
                  value={container.name}
                />
                <CopyableDetailRow
                  label={t("dockerManager.containerId")}
                  value={container.id}
                  displayValue={middleEllipsis(container.id, 28, 12)}
                />
                <CopyableDetailRow label={t("dockerManager.image")} value={container.image} />
                <DetailRow
                  label={t("dockerManager.status")}
                  value={container.status || container.state}
                />
                <DetailRow
                  label={t("dockerManager.createdAt")}
                  value={container.created_at || "-"}
                />
                <DetailRow label={t("dockerManager.size")} value={container.size || "-"} />
                <DetailRow
                  label={t("dockerManager.startedAt")}
                  value={details?.started_at || "-"}
                />
                <DetailRow
                  label={t("dockerManager.finishedAt")}
                  value={details?.finished_at || "-"}
                />
                <DetailRow
                  label={t("dockerManager.restartCount")}
                  value={details ? String(details.restart_count) : "-"}
                />
                <CopyableDetailRow
                  label={t("dockerManager.entrypoint")}
                  value={details?.entrypoint || "-"}
                />
                <CopyableDetailRow
                  label={t("dockerManager.command")}
                  value={details?.command || "-"}
                />
              </DetailSection>

              <DetailSection title={t("dockerManager.networking")}>
                <CopyableDetailRow
                  label={t("dockerManager.ports")}
                  value={portValue}
                  displayValue={portValue}
                  multiline
                />
                <DetailRow
                  label={t("dockerManager.networks")}
                  value={formatContainerNetworks(details)}
                  multiline
                />
              </DetailSection>

              <DetailSection title={t("dockerManager.io")}>
                <DetailRow label={t("dockerManager.netIo")} value={stats?.net_io || "-"} />
                <DetailRow label={t("dockerManager.blockIo")} value={stats?.block_io || "-"} />
              </DetailSection>

              <DetailSection title={t("dockerManager.mounts")}>
                <DetailRow
                  label={t("dockerManager.mounts")}
                  value={formatContainerMounts(details)}
                  multiline
                />
              </DetailSection>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function ContainerSnapshot({
  container,
  details,
  detailsLoading,
}: {
  container: DockerContainer;
  details: DockerContainerDetails | null;
  detailsLoading: boolean;
}) {
  const { t } = useTranslation();
  const stats = details?.stats;

  return (
    <div className="rounded-md border border-border bg-muted/[0.04] p-3">
      <div className="mb-3 grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-3">
        <div className="min-w-0">
          <div className="truncate font-mono text-xs text-foreground/90" title={container.image}>
            {container.image}
          </div>
          <div className="mt-1 truncate font-mono text-[0.6875rem] text-muted-foreground">
            {middleEllipsis(container.id, 22, 10)}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2 font-mono text-[0.6875rem] text-muted-foreground">
          {detailsLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          <span>{container.size || "-"}</span>
        </div>
      </div>
      <DetailGrid>
        <DetailMetric
          label={t("dockerManager.cpu")}
          tone={(stats?.cpu_percent ?? 0) > 0 ? "active" : undefined}
          value={`${stats?.cpu_percent.toFixed(1) ?? "0.0"}%`}
        />
        <DetailMetric
          label={t("dockerManager.memory")}
          value={stats ? formatMemoryUsed(stats.memory_usage) : "-"}
        />
        <DetailMetric label={t("dockerManager.pids")} value={stats?.pids || "-"} />
      </DetailGrid>
    </div>
  );
}

function DetailSection({ children, title }: { children: ReactNode; title: string }) {
  return (
    <section className="space-y-2">
      <h3 className="px-0.5 text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      <div className="divide-y rounded-md border border-border bg-muted/[0.03]">{children}</div>
    </section>
  );
}

function CopyableDetailRow({
  displayValue,
  label,
  multiline,
  value,
}: {
  displayValue?: string;
  label: string;
  multiline?: boolean;
  value: string;
}) {
  const { t } = useTranslation();

  return (
    <div className="group/row grid min-w-0 grid-cols-[6rem_minmax(0,1fr)_1.5rem] items-start gap-2 px-3 py-2 text-xs transition-colors hover:bg-muted/20">
      <span className="truncate pt-1 text-muted-foreground">{label}</span>
      <span
        className={cn(
          "min-w-0 pt-1 font-mono text-foreground/90",
          multiline ? "whitespace-pre-wrap break-all" : "truncate",
        )}
        title={value}
      >
        {displayValue ?? value}
      </span>
      <CopyValueButton label={t("common.copyToClipboard")} value={value} />
    </div>
  );
}

function DetailRow({
  displayValue,
  label,
  multiline,
  value,
}: {
  displayValue?: string;
  label: string;
  multiline?: boolean;
  value: string;
}) {
  return (
    <div className="grid min-w-0 grid-cols-[6rem_minmax(0,1fr)] items-start gap-2 px-3 py-2 text-xs transition-colors hover:bg-muted/20">
      <span className="truncate pt-1 text-muted-foreground">{label}</span>
      <span
        className={cn(
          "min-w-0 pt-1 font-mono text-foreground/90",
          multiline ? "whitespace-pre-wrap break-all" : "truncate",
        )}
        title={value}
      >
        {displayValue ?? value}
      </span>
    </div>
  );
}

function DetailGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-3 gap-2">{children}</div>;
}

function DetailMetric({
  label,
  tone,
  value,
}: {
  label: string;
  tone?: "active" | "hot";
  value: string;
}) {
  return (
    <div
      className={cn(
        "min-w-0 rounded-md bg-background/35 px-2.5 py-2",
        tone === "active" && "text-sky-300",
        tone === "hot" && "text-red-300",
      )}
    >
      <div className="truncate text-[0.625rem] text-muted-foreground">{label}</div>
      <div className="truncate font-mono text-xs text-foreground/90" title={value}>
        {value}
      </div>
    </div>
  );
}

function CopyValueButton({ label, value }: { label: string; value: string }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success(t("common.copied"));
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      toast.error(t("dockerManager.copyFailed"));
    }
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 opacity-0 text-muted-foreground transition-opacity hover:text-foreground group-hover/row:opacity-100 focus-visible:opacity-100"
          onClick={copy}
          aria-label={label}
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{copied ? t("common.copied") : label}</TooltipContent>
    </Tooltip>
  );
}

function StateBadge({ state }: { state: string }) {
  const { t } = useTranslation();
  const kind = getDockerStateKind(state);
  const labelKey = getDockerStateLabelKey(state);
  return (
    <Badge
      variant="outline"
      className={cn("max-w-24 px-1.5 text-[0.625rem] leading-4", stateBadgeClass(kind))}
      title={state}
    >
      {t(`dockerManager.stateLabels.${labelKey}`)}
    </Badge>
  );
}

function parseDockerPorts(ports: string) {
  return ports
    .split(",")
    .map((port) => port.trim())
    .filter(Boolean);
}

function formatPort(port: string) {
  if (!port || port === "-") return "-";
  return port.replace(/->/g, " -> ");
}

function formatContainerNetworks(details: DockerContainerDetails | null) {
  if (!details?.networks.length) return "-";
  return details.networks
    .map((network) =>
      network.ip_address ? `${network.name}: ${network.ip_address}` : network.name,
    )
    .join("\n");
}

function formatContainerMounts(details: DockerContainerDetails | null) {
  if (!details?.mounts.length) return "-";
  return details.mounts
    .map((mount) => {
      const access = mount.rw ? "rw" : "ro";
      const mode = mount.mode ? `,${mount.mode}` : "";
      return `${mount.kind || "mount"} ${mount.source || "-"} -> ${mount.destination || "-"} (${access}${mode})`;
    })
    .join("\n");
}

function formatMemoryUsed(memoryUsage: string) {
  return memoryUsage.split("/")[0]?.trim() || "-";
}

function middleEllipsis(value: string, prefixLength = 20, suffixLength = 8) {
  if (value.length <= prefixLength + suffixLength + 3) return value;
  return `${value.slice(0, prefixLength)}...${value.slice(-suffixLength)}`;
}

function getDockerStateKind(state: string): DockerStateKind {
  const normalized = state.toLowerCase();
  if (normalized === "running") return "running";
  if (normalized === "exited" || normalized === "created") return "stopped";
  if (normalized === "paused" || normalized === "restarting" || normalized === "removing") {
    return "transition";
  }
  if (normalized === "dead") return "danger";
  return "unknown";
}

function getDockerStateLabelKey(state: string) {
  const normalized = state.toLowerCase();
  if (
    normalized === "created" ||
    normalized === "dead" ||
    normalized === "exited" ||
    normalized === "paused" ||
    normalized === "removing" ||
    normalized === "restarting" ||
    normalized === "running"
  ) {
    return normalized;
  }
  return "unknown";
}

function stateBadgeClass(kind: DockerStateKind) {
  switch (kind) {
    case "danger":
      return "border-red-500/35 bg-red-500/10 text-red-300";
    case "running":
      return "border-emerald-500/35 bg-emerald-500/10 text-emerald-300";
    case "transition":
      return "border-amber-500/35 bg-amber-500/10 text-amber-300";
    case "stopped":
      return "border-slate-500/35 bg-slate-500/10 text-slate-300";
    default:
      return "border-border bg-background text-muted-foreground";
  }
}
