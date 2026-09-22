import type { TFunction } from "i18next";
import {
  type ComponentProps,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import FloatingPanel from "@/components/app/FloatingPanel";
import { MdClose, MdTerminal } from "react-icons/md";
import WorkspaceSidebar from "./WorkspaceSidebar";
import WorkspaceControls from "@/components/layout/WorkspaceControls";
import { Button } from "@/components/ui/button";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import PanelStack from "@/components/app/PanelStack";
import AboutDialog from "@/components/dialog/app/AboutDialog";
import LockScreen from "@/components/dialog/app/LockScreen";
import QuitConfirmDialog from "@/components/dialog/app/QuitConfirmDialog";
import UpdateDialog from "@/components/dialog/app/UpdateDialog";
import type { HostKeyVerifyRequest } from "@/components/dialog/connections/HostKeyVerifyDialog";
import { HostKeyVerifyDialog } from "@/components/dialog/connections/HostKeyVerifyDialog";
import type { OtpRequest } from "@/components/dialog/connections/OtpDialog";
import { OtpDialog } from "@/components/dialog/connections/OtpDialog";
import type { RdpCertificateVerifyRequest } from "@/components/dialog/connections/RdpCertificateVerifyDialog";
import { RdpCertificateVerifyDialog } from "@/components/dialog/connections/RdpCertificateVerifyDialog";
import type { SshAuthRequest } from "@/components/dialog/connections/SshAuthDialog";
import { SshAuthDialog } from "@/components/dialog/connections/SshAuthDialog";
import type { SshAgentAuthRequest } from "@/components/dialog/connections/SshAgentAuthDialog";
import { SshAgentAuthDialog } from "@/components/dialog/connections/SshAgentAuthDialog";
import DockerSudoPasswordDialog, {
  type DockerSudoPasswordRequest,
} from "@/components/dialog/docker/DockerSudoPasswordDialog";
import { TransferDuplicateDialog } from "@/components/dialog/file-explorer/TransferDuplicateDialog";
import SyncGroupDialog from "@/components/dialog/terminal/SyncGroupDialog";
import type ActivityBar from "@/components/layout/ActivityBar";
import Header from "@/components/layout/Header";
import ResizeHandle from "@/components/layout/ResizeHandle";
import QuickCommands from "@/components/panel/QuickCommands";
import SerialSendPanel from "@/components/panel/SendCommandPanel";
import TabWindowsWorkspace from "@/components/terminal/TabWindowsWorkspace";
import { useTheme } from "@/context/ThemeContext";
import { hasVisibleActivityBarItems } from "@/lib/appWorkspace";
import {
  buildBackgroundImageLayerStyle,
  buildSurfaceCssVariables,
  isWindowTransparencyEnabled,
  loadBackgroundImageDataUrl,
} from "@/lib/backgroundImage";
import { isWindows } from "@/lib/platform";
import type { SendCommandPanelDraft } from "@/lib/sendCommandPanelEvents";
import type { UpdateInfo } from "@/lib/updater";
import { bounceTopModalWindow } from "@/lib/windowManager";
import type {
  AppearanceSettings,
  SavedConnection,
  SessionType,
  SyncGroup,
  UiConfig,
} from "@/types/global";
import StartWorkspace from "./start-workspace/StartWorkspace";

type HeaderProps = ComponentProps<typeof Header>;
type ActivityBarProps = ComponentProps<typeof ActivityBar>;
type WorkspaceProps = ComponentProps<typeof TabWindowsWorkspace>;
type ActivityBarSideProps = Omit<ActivityBarProps, "side" | "zone">;

interface AppLayoutProps {
  t: TFunction;
  uiConfig: UiConfig;
  appearance: AppearanceSettings;
  header: Omit<HeaderProps, "onToggleLeft" | "onToggleRight">;
  mobile: {
    leftOpen: boolean;
    rightOpen: boolean;
    setLeftOpen: (open: boolean) => void;
    setRightOpen: (open: boolean) => void;
  };
  leftActivityBar: ActivityBarSideProps;
  rightActivityBar: ActivityBarSideProps;
  onLeftResize: (delta: number) => void;
  onRightResize: (delta: number) => void;
  panelContent: (panelId: string | null) => ReactNode;
  panelTitle: (panelId: string) => string;
  /** Panels visible per side, ordered top-to-bottom (single id in single-open mode). */
  leftPanelIds: string[];
  rightPanelIds: string[];
  floatingPanelIds: {
    left: string | null;
    right: string | null;
  };
  onCloseFloatingPanel: (side: "left" | "right") => void;
  /** Exclusive panel (e.g. AI assistant) shown alone instead of the stack (multi-open mode). */
  leftOverlayPanelId: string | null;
  rightOverlayPanelId: string | null;
  panelStackSizes: Record<string, number>;
  onPanelStackResize: (
    side: "left" | "right",
    aboveId: string,
    belowId: string,
    delta: number,
    containerHeight: number,
  ) => void;
  workspace: WorkspaceProps;
  tabsCount: number;
  emptyWorkspace: {
    temporarySshShortcut: string;
    openChatShortcut: string;
    showCommandsShortcut: string;
    switchTerminalShortcut: string;
    onTemporarySshLink: () => void;
    onOpenChat: () => void;
    onShowCommands: () => void;
    onSwitchTerminal: () => void;
    onConnectConnection: (connection: SavedConnection) => Promise<void> | void;
    onEditConnection: (connection: SavedConnection) => void;
  };
  bottomPanel: {
    activePanel: "quickCmdBar" | "serialSend" | null;
    onSelect: (panel: "quickCmdBar" | "serialSend") => void;
    quickCmdHeight: number;
    serialSendHeight: number;
    clearAfterSend: boolean;
    activeSerialSessionId: string | null;
    activeNonSerialSessionId: string | null;
    activeNonSerialSessionIds: string[];
    quickCommandsDisabled: boolean;
    syncGroups: SyncGroup[];
    currentWindowLabel: string;
    sessionTargets: {
      id: string;
      name: string;
      tabName: string;
      type: SessionType;
      ownerWindowLabel?: string | null;
    }[];
    sendCommandDraft: SendCommandPanelDraft | null;
    onSendCommandDraftConsumed: () => void;
    onQuickCmdResize: (delta: number) => void;
    onSerialSendResize: (delta: number) => void;
    onClearAfterSendChange: (enabled: boolean) => void;
    onCommandSend: (command: string, execute?: boolean) => void;
    onSendToAllSessions: (command: string, execute?: boolean) => void;
  };
  dialogs: {
    aboutOpen: boolean;
    onAboutOpenChange: (open: boolean) => void;
    syncGroupOpen: boolean;
    onSyncGroupOpenChange: (open: boolean) => void;
    updateOpen: boolean;
    onUpdateOpenChange: (open: boolean) => void;
    onUpdateFound: (info: UpdateInfo) => void;
    quitConfirmOpen: boolean;
    onQuitConfirmOpenChange: (open: boolean) => void;
    onQuitConfirm: () => void;
    otpRequest: OtpRequest | null;
    onOtpDone: (requestId: string) => void;
    sshAuthRequest: SshAuthRequest | null;
    onSshAuthDone: (requestId: string) => void;
    sshAgentAuthRequest: SshAgentAuthRequest | null;
    onSshAgentAuthDone: (requestId: string) => void;
    dockerSudoPasswordRequest: DockerSudoPasswordRequest | null;
    onDockerSudoPasswordDone: (requestId: string) => void;
    hostKeyVerifyRequest: HostKeyVerifyRequest | null;
    onHostKeyVerifyDone: (requestId: string) => void;
    rdpCertificateVerifyRequest: RdpCertificateVerifyRequest | null;
    onRdpCertificateVerifyDone: (requestId: string) => void;
    modalChildWindowCount: number;
    locked: boolean;
    hasMasterPassword: boolean;
    onUnlock: () => void;
    onRequestClose: () => void;
  };
}

export default function AppLayout({
  t,
  uiConfig,
  appearance,
  header,
  mobile,
  leftActivityBar,
  rightActivityBar,
  onLeftResize,
  onRightResize,
  panelContent,
  panelTitle,
  leftPanelIds,
  rightPanelIds,
  floatingPanelIds,
  onCloseFloatingPanel,
  leftOverlayPanelId,
  rightOverlayPanelId,
  panelStackSizes,
  onPanelStackResize,
  workspace,
  tabsCount,
  emptyWorkspace,
  bottomPanel,
  dialogs,
}: AppLayoutProps) {
  const { theme } = useTheme();
  const backgroundImagePath = appearance.background_image_path?.trim() ?? "";
  const [backgroundDataUrl, setBackgroundDataUrl] = useState("");
  const [serialSendRunning, setSerialSendRunning] = useState(false);
  // Latch the first time the serial send panel is shown so it stays mounted
  // (but hidden) afterwards, preserving the user's input across hide/show cycles.
  const serialSendEverShownRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    setBackgroundDataUrl("");
    if (!backgroundImagePath) return;

    void loadBackgroundImageDataUrl(backgroundImagePath).then((dataUrl) => {
      if (!cancelled) setBackgroundDataUrl(dataUrl);
    });

    return () => {
      cancelled = true;
    };
  }, [backgroundImagePath]);

  const backgroundEnabled = Boolean(backgroundDataUrl);
  const effectiveAppearance = useMemo(
    () =>
      backgroundEnabled
        ? appearance
        : {
            ...appearance,
            background_image_path: null,
          },
    [appearance, backgroundEnabled],
  );
  const backgroundLayerStyle = useMemo(
    () =>
      buildBackgroundImageLayerStyle(effectiveAppearance, backgroundDataUrl),
    [effectiveAppearance, backgroundDataUrl],
  );
  const windowTransparencyEnabled =
    isWindowTransparencyEnabled(effectiveAppearance);
  const shellStyle = useMemo(
    () => ({
      ...buildSurfaceCssVariables(theme.colors, effectiveAppearance),
      // When native window transparency is on, the shell background must be
      // transparent so the native backdrop is visible through the webview.
      backgroundColor: windowTransparencyEnabled
        ? "transparent"
        : theme.colors.bg,
      color: "var(--df-text)",
    }),
    [effectiveAppearance, theme.colors, windowTransparencyEnabled],
  );
  const hasLeftActivityItems = hasVisibleActivityBarItems(leftActivityBar);
  const hasRightActivityItems = hasVisibleActivityBarItems(rightActivityBar);
  const leftPanelOpen = leftPanelIds.length > 0 || Boolean(leftOverlayPanelId);
  const rightPanelOpen =
    rightPanelIds.length > 0 || Boolean(rightOverlayPanelId);
  const compactLeft = useMediaQuery("(max-width: 640px)");
  const compactRight = useMediaQuery("(max-width: 900px)");
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [bottomCollapsed, setBottomCollapsed] = useState(false);
  const [auxiliaryPanel, setAuxiliaryPanel] = useState<
    "fileTransfer" | "commandHistory" | null
  >(null);
  const leftVisible =
    hasLeftActivityItems && (compactLeft ? mobile.leftOpen : !leftCollapsed);
  const rightVisible =
    hasRightActivityItems &&
    (compactRight ? mobile.rightOpen : !rightCollapsed);
  const bottomView = auxiliaryPanel ?? bottomPanel.activePanel ?? "quickCmdBar";
  const bottomVisible =
    !bottomCollapsed && Boolean(auxiliaryPanel || bottomPanel.activePanel);
  const serialSendVisible = bottomVisible && bottomView === "serialSend";
  if (bottomPanel.activePanel === "serialSend")
    serialSendEverShownRef.current = true;
  const serialSendMounted = serialSendEverShownRef.current || serialSendRunning;
  const quickCommandsMounted = useRef(false);
  if (bottomPanel.activePanel === "quickCmdBar")
    quickCommandsMounted.current = true;
  const overlayVisible =
    (compactLeft && leftVisible) || (compactRight && rightVisible);

  // Menu/shortcut selections reveal the corresponding card without overwriting its layout.
  const selection = `${leftPanelIds.join(",")}:${leftOverlayPanelId}:${rightPanelIds.join(",")}:${rightOverlayPanelId}`;
  const previousSelection = useRef(selection);
  useEffect(() => {
    const previous = previousSelection.current.split(":");
    const next = selection.split(":");
    if (previous[0] !== next[0] || previous[1] !== next[1]) {
      setLeftCollapsed(false);
      if (compactLeft && leftPanelOpen) mobile.setLeftOpen(true);
    }
    if (previous[2] !== next[2] || previous[3] !== next[3]) {
      setRightCollapsed(false);
      if (compactRight && rightPanelOpen) mobile.setRightOpen(true);
    }
    previousSelection.current = selection;
  }, [
    selection,
    compactLeft,
    compactRight,
    leftPanelOpen,
    rightPanelOpen,
    mobile,
  ]);

  const previousBottom = useRef(bottomPanel.activePanel);
  useEffect(() => {
    if (previousBottom.current !== bottomPanel.activePanel) {
      setBottomCollapsed(false);
      setAuxiliaryPanel(null);
    }
    previousBottom.current = bottomPanel.activePanel;
  }, [bottomPanel.activePanel]);

  useEffect(() => {
    if (bottomPanel.sendCommandDraft) {
      setBottomCollapsed(false);
      setAuxiliaryPanel(null);
    }
  }, [bottomPanel.sendCommandDraft]);

  useEffect(() => {
    const roots = [document.documentElement, document.body];
    for (const root of roots) {
      if (windowTransparencyEnabled) root.dataset.windowTransparency = "true";
      else delete root.dataset.windowTransparency;
    }
    return () => {
      for (const root of roots) delete root.dataset.windowTransparency;
    };
  }, [windowTransparencyEnabled]);

  const toggleLeft = () =>
    compactLeft
      ? mobile.setLeftOpen(!mobile.leftOpen)
      : setLeftCollapsed((value) => !value);
  const toggleRight = () =>
    compactRight
      ? mobile.setRightOpen(!mobile.rightOpen)
      : setRightCollapsed((value) => !value);
  const toggleBottom = () => {
    if (!auxiliaryPanel && !bottomPanel.activePanel)
      bottomPanel.onSelect("quickCmdBar");
    setBottomCollapsed(bottomVisible);
  };
  const selectBottom = (panel: typeof bottomView) => {
    setBottomCollapsed(false);
    if (panel === "fileTransfer" || panel === "commandHistory")
      setAuxiliaryPanel(panel);
    else {
      setAuxiliaryPanel(null);
      if (bottomPanel.activePanel !== panel) bottomPanel.onSelect(panel);
    }
  };
  const renderSidebar = (side: "left" | "right") => {
    const left = side === "left";
    const activity = left ? leftActivityBar : rightActivityBar;
    const activeBottomIds = new Set(activity.activeBottomIds);
    activeBottomIds.delete("quickCmdBar");
    activeBottomIds.delete("serialSend");
    if (
      bottomVisible &&
      (bottomView === "quickCmdBar" || bottomView === "serialSend")
    ) {
      activeBottomIds.add(bottomView);
    }
    return (
      <WorkspaceSidebar
        side={side}
        width={left ? uiConfig.left_width : uiConfig.right_width}
        visible={left ? leftVisible : rightVisible}
        panelOpen={left ? leftPanelOpen : rightPanelOpen}
        activity={{
          ...activity,
          activeBottomIds,
          onSelect: (id) => {
            if (
              (id === "quickCmdBar" || id === "serialSend") &&
              (auxiliaryPanel || bottomCollapsed)
            ) {
              selectBottom(id);
            } else activity.onSelect(id);
          },
        }}
      >
        <PanelStack
          panelIds={left ? leftPanelIds : rightPanelIds}
          overlayPanelId={left ? leftOverlayPanelId : rightOverlayPanelId}
          sizes={panelStackSizes}
          renderPanel={panelContent}
          onResizePair={(aboveId, belowId, delta, height) =>
            onPanelStackResize(side, aboveId, belowId, delta, height)
          }
        />
      </WorkspaceSidebar>
    );
  };

  return (
    <div
      className="nyaterm-wallpaper-shell font-display relative h-full min-h-0 overflow-hidden"
      data-wallpaper-enabled={backgroundEnabled ? "true" : "false"}
      data-window-transparency={windowTransparencyEnabled ? "true" : "false"}
      data-window-transparency-blur={
        windowTransparencyEnabled &&
        isWindows &&
        effectiveAppearance.window_transparency_blur
          ? "true"
          : "false"
      }
      style={shellStyle}
    >
      {backgroundEnabled && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-0"
          style={backgroundLayerStyle}
        />
      )}
      <div className="relative z-10 flex h-full min-h-0 flex-col">
        <Header
          {...header}
          onToggleLeft={toggleLeft}
          onToggleRight={toggleRight}
          workspaceControls={
            <WorkspaceControls
              leftVisible={leftVisible}
              rightVisible={rightVisible}
              bottomVisible={bottomVisible}
              leftAvailable={hasLeftActivityItems}
              rightAvailable={hasRightActivityItems}
              onToggleLeft={toggleLeft}
              onToggleRight={toggleRight}
              onToggleBottom={toggleBottom}
            />
          }
        />
        <main className="workspace-layout">
          {overlayVisible && (
            <button
              type="button"
              className="workspace-sidebar-backdrop"
              aria-label={t("common.close")}
              onClick={() => {
                mobile.setLeftOpen(false);
                mobile.setRightOpen(false);
              }}
            />
          )}
          {hasLeftActivityItems && renderSidebar("left")}
          {leftVisible && !compactLeft && (
            <ResizeHandle
              direction="horizontal"
              variant="gutter"
              value={uiConfig.left_width}
              onResize={onLeftResize}
            />
          )}
          <section className="workspace-center">
            <div className="workspace-terminal-area">
              {tabsCount === 0 ? (
                <StartWorkspace
                  t={t}
                  backgroundEnabled={backgroundEnabled}
                  temporarySshShortcut={emptyWorkspace.temporarySshShortcut}
                  openChatShortcut={emptyWorkspace.openChatShortcut}
                  showCommandsShortcut={emptyWorkspace.showCommandsShortcut}
                  switchTerminalShortcut={emptyWorkspace.switchTerminalShortcut}
                  onTemporarySshLink={emptyWorkspace.onTemporarySshLink}
                  onOpenChat={emptyWorkspace.onOpenChat}
                  onShowCommands={emptyWorkspace.onShowCommands}
                  onSwitchTerminal={emptyWorkspace.onSwitchTerminal}
                  onConnectConnection={emptyWorkspace.onConnectConnection}
                  onEditConnection={emptyWorkspace.onEditConnection}
                />
              ) : workspace.layout ? (
                <TabWindowsWorkspace {...workspace} />
              ) : (
                <div className="flex items-center justify-center h-full text-slate-500">
                  <div className="text-center space-y-3">
                    <MdTerminal className="text-4xl mx-auto" />
                    <p className="text-sm">{t("common.loading")}</p>
                  </div>
                </div>
              )}
              {floatingPanelIds.left && (
                <FloatingPanel
                  side="left"
                  panelId={floatingPanelIds.left}
                  width={uiConfig.left_width}
                  title={panelTitle(floatingPanelIds.left)}
                  onClose={() => onCloseFloatingPanel("left")}
                  onResize={onLeftResize}
                >
                  {panelContent(floatingPanelIds.left)}
                </FloatingPanel>
              )}
              {floatingPanelIds.right && (
                <FloatingPanel
                  side="right"
                  panelId={floatingPanelIds.right}
                  width={uiConfig.right_width}
                  title={panelTitle(floatingPanelIds.right)}
                  onClose={() => onCloseFloatingPanel("right")}
                  onResize={onRightResize}
                >
                  {panelContent(floatingPanelIds.right)}
                </FloatingPanel>
              )}
            </div>

            {bottomVisible && (
              <ResizeHandle
                direction="vertical"
                variant="gutter"
                value={
                  bottomView === "serialSend"
                    ? bottomPanel.serialSendHeight
                    : bottomPanel.quickCmdHeight
                }
                onResize={
                  bottomView === "serialSend"
                    ? bottomPanel.onSerialSendResize
                    : bottomPanel.onQuickCmdResize
                }
              />
            )}
            <section
              id="workspace-bottom"
              className="workspace-bottom workspace-card"
              data-collapsed={!bottomVisible}
              style={{
                height:
                  bottomView === "serialSend"
                    ? bottomPanel.serialSendHeight
                    : bottomPanel.quickCmdHeight,
              }}
            >
              <div
                className="workspace-bottom-tabs"
                role="tablist"
                aria-label={t("workspaceLayout.bottom")}
              >
                {(
                  [
                    ["quickCmdBar", "panel.quickCommands"],
                    ["fileTransfer", "panel.fileTransfer"],
                    ["commandHistory", "panel.commandHistory"],
                    ["serialSend", "workspaceLayout.sendCommand"],
                  ] as const
                ).map(([id, key]) => (
                  <button
                    type="button"
                    key={id}
                    role="tab"
                    id={`workspace-tab-${id}`}
                    aria-selected={bottomView === id}
                    tabIndex={bottomView === id ? 0 : -1}
                    onKeyDown={(event) => {
                      const ids = [
                        "quickCmdBar",
                        "fileTransfer",
                        "commandHistory",
                        "serialSend",
                      ] as const;
                      const index = ids.indexOf(id);
                      const next =
                        event.key === "ArrowRight"
                          ? (index + 1) % ids.length
                          : event.key === "ArrowLeft"
                            ? (index + ids.length - 1) % ids.length
                            : event.key === "Home"
                              ? 0
                              : event.key === "End"
                                ? ids.length - 1
                                : -1;
                      if (next < 0) return;
                      event.preventDefault();
                      selectBottom(ids[next]);
                      document
                        .getElementById(`workspace-tab-${ids[next]}`)
                        ?.focus();
                    }}
                    aria-controls={`workspace-content-${id}`}
                    onClick={() => selectBottom(id)}
                  >
                    {t(key)}
                  </button>
                ))}
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="ml-auto"
                  aria-label={t("workspaceLayout.bottom")}
                  onClick={() => setBottomCollapsed(true)}
                >
                  <MdClose />
                </Button>
              </div>
              <div
                role="tabpanel"
                id="workspace-content-quickCmdBar"
                aria-labelledby="workspace-tab-quickCmdBar"
                className="workspace-bottom-content"
                hidden={bottomView !== "quickCmdBar"}
              >
                {quickCommandsMounted.current && (
                  <QuickCommands
                    onSend={bottomPanel.onCommandSend}
                    onSendToAll={bottomPanel.onSendToAllSessions}
                    sendDisabled={bottomPanel.quickCommandsDisabled}
                  />
                )}
              </div>
              <div
                role="tabpanel"
                id="workspace-content-fileTransfer"
                aria-labelledby="workspace-tab-fileTransfer"
                className="workspace-bottom-content"
                hidden={bottomView !== "fileTransfer"}
              >
                {auxiliaryPanel === "fileTransfer" &&
                  panelContent("fileTransfer")}
              </div>
              <div
                role="tabpanel"
                id="workspace-content-commandHistory"
                aria-labelledby="workspace-tab-commandHistory"
                className="workspace-bottom-content"
                hidden={bottomView !== "commandHistory"}
              >
                {auxiliaryPanel === "commandHistory" &&
                  panelContent("commandHistory")}
              </div>
              <div
                role="tabpanel"
                id="workspace-content-serialSend"
                aria-labelledby="workspace-tab-serialSend"
                className="workspace-bottom-content"
                hidden={!serialSendVisible}
              >
                {serialSendMounted && (
                  <SerialSendPanel
                    serialSessionId={bottomPanel.activeSerialSessionId}
                    currentShellSessionId={bottomPanel.activeNonSerialSessionId}
                    shellSessionIds={bottomPanel.activeNonSerialSessionIds}
                    syncGroups={bottomPanel.syncGroups}
                    currentWindowLabel={bottomPanel.currentWindowLabel}
                    sessionTargets={bottomPanel.sessionTargets}
                    clearAfterSend={bottomPanel.clearAfterSend}
                    draft={bottomPanel.sendCommandDraft}
                    onDraftConsumed={bottomPanel.onSendCommandDraftConsumed}
                    onSendingChange={setSerialSendRunning}
                    onClearAfterSendChange={bottomPanel.onClearAfterSendChange}
                  />
                )}
              </div>
            </section>
          </section>
          {rightVisible && !compactRight && (
            <ResizeHandle
              direction="horizontal"
              variant="gutter"
              value={uiConfig.right_width}
              onResize={onRightResize}
            />
          )}
          {hasRightActivityItems && renderSidebar("right")}
        </main>

        <AboutDialog
          open={dialogs.aboutOpen}
          onClose={() => dialogs.onAboutOpenChange(false)}
        />

        <SyncGroupDialog
          open={dialogs.syncGroupOpen}
          onClose={() => dialogs.onSyncGroupOpenChange(false)}
        />

        <UpdateDialog
          open={dialogs.updateOpen}
          onClose={() => dialogs.onUpdateOpenChange(false)}
          onUpdateFound={dialogs.onUpdateFound}
        />

        <QuitConfirmDialog
          open={dialogs.quitConfirmOpen}
          onOpenChange={dialogs.onQuitConfirmOpenChange}
          onConfirm={dialogs.onQuitConfirm}
        />

        <OtpDialog request={dialogs.otpRequest} onDone={dialogs.onOtpDone} />
        <SshAuthDialog
          request={dialogs.sshAuthRequest}
          onDone={dialogs.onSshAuthDone}
        />
        <SshAgentAuthDialog
          request={dialogs.sshAgentAuthRequest}
          onDone={dialogs.onSshAgentAuthDone}
        />
        <DockerSudoPasswordDialog
          request={dialogs.dockerSudoPasswordRequest}
          onDone={dialogs.onDockerSudoPasswordDone}
        />
        <HostKeyVerifyDialog
          request={dialogs.hostKeyVerifyRequest}
          onDone={dialogs.onHostKeyVerifyDone}
        />
        <RdpCertificateVerifyDialog
          request={dialogs.rdpCertificateVerifyRequest}
          onDone={dialogs.onRdpCertificateVerifyDone}
        />
        <TransferDuplicateDialog />

        {dialogs.modalChildWindowCount > 0 && (
          <div
            className="fixed inset-0 z-[9998]"
            onMouseDown={() => {
              void bounceTopModalWindow();
            }}
            style={{
              backgroundColor: "rgba(0, 0, 0, 0.3)",
              backdropFilter: "blur(4px)",
              WebkitBackdropFilter: "blur(4px)",
            }}
          />
        )}

        {dialogs.locked && (
          <LockScreen
            hasPassword={dialogs.hasMasterPassword}
            onUnlock={dialogs.onUnlock}
            onRequestClose={dialogs.onRequestClose}
          />
        )}
      </div>
    </div>
  );
}
