import { fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { themes } from "@/lib/themes";
import AppLayout from "./AppLayout";

vi.mock("@/lib/windowManager", () => ({ bounceTopModalWindow: vi.fn() }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/context/ThemeContext", () => ({
  useTheme: () => ({ theme: themes["github-dark"] }),
}));
vi.mock("@/components/layout/Header", () => ({
  default: ({ workspaceControls }: { workspaceControls: React.ReactNode }) => (
    <header>{workspaceControls}</header>
  ),
}));
vi.mock("./start-workspace/StartWorkspace", () => ({
  default: () => <div>Start workspace</div>,
}));
vi.mock("@/components/terminal/TabWindowsWorkspace", () => ({
  default: () => <div>Terminal workspace</div>,
}));
vi.mock("@/components/panel/QuickCommands", () => ({
  default: () => <input aria-label="Quick command draft" />,
}));
vi.mock("@/components/panel/SendCommandPanel", () => ({
  default: () => <input aria-label="Serial draft" />,
}));
vi.mock("@/components/dialog/app/AboutDialog", () => ({ default: () => null }));
vi.mock("@/components/dialog/app/LockScreen", () => ({ default: () => null }));
vi.mock("@/components/dialog/app/QuitConfirmDialog", () => ({
  default: () => null,
}));
vi.mock("@/components/dialog/app/UpdateDialog", () => ({
  default: () => null,
}));
vi.mock("@/components/dialog/connections/HostKeyVerifyDialog", () => ({
  HostKeyVerifyDialog: () => null,
}));
vi.mock("@/components/dialog/connections/OtpDialog", () => ({
  OtpDialog: () => null,
}));
vi.mock("@/components/dialog/connections/RdpCertificateVerifyDialog", () => ({
  RdpCertificateVerifyDialog: () => null,
}));
vi.mock("@/components/dialog/connections/SshAuthDialog", () => ({
  SshAuthDialog: () => null,
}));
vi.mock("@/components/dialog/connections/SshAgentAuthDialog", () => ({
  SshAgentAuthDialog: () => null,
}));
vi.mock("@/components/dialog/docker/DockerSudoPasswordDialog", () => ({
  default: () => null,
}));
vi.mock("@/components/dialog/file-explorer/TransferDuplicateDialog", () => ({
  TransferDuplicateDialog: () => null,
}));
vi.mock("@/components/dialog/terminal/SyncGroupDialog", () => ({
  default: () => null,
}));

function fixture() {
  const activity = {
    items: [{ id: "savedConnections", icon: null, tooltip: "Connections" }],
    bottomItems: [{ id: "quickCmdBar", icon: null, tooltip: "Quick commands" }],
    activeId: "savedConnections",
    activeBottomIds: new Set(["quickCmdBar"]),
    onSelect: vi.fn(),
    onReorder: vi.fn(),
    onMoveItem: vi.fn(),
    onHideItem: vi.fn(),
    onShowItem: vi.fn(),
    onToggleLabel: vi.fn(),
    onRequestResetLayout: vi.fn(),
    panelOpenMode: "docked",
    onPanelOpenModeChange: vi.fn(),
    showLabels: false,
  };
  return {
    t: (key: string) => key,
    uiConfig: { left_width: 250, right_width: 280 },
    appearance: { background_image_path: null, window_transparency_tint: 1 },
    header: {},
    mobile: {
      leftOpen: false,
      rightOpen: false,
      setLeftOpen: vi.fn(),
      setRightOpen: vi.fn(),
    },
    leftActivityBar: activity,
    rightActivityBar: { ...activity, items: [], bottomItems: [] },
    onLeftResize: vi.fn(),
    onRightResize: vi.fn(),
    panelContent: (id: string) => <input key={id} aria-label={`Panel ${id}`} />,
    panelTitle: (id: string) => id,
    leftPanelIds: ["savedConnections"],
    rightPanelIds: [],
    floatingPanelIds: { left: null, right: null },
    onCloseFloatingPanel: vi.fn(),
    leftOverlayPanelId: null,
    rightOverlayPanelId: null,
    panelStackSizes: {},
    onPanelStackResize: vi.fn(),
    workspace: { layout: null },
    tabsCount: 0,
    emptyWorkspace: {},
    bottomPanel: {
      activePanel: "quickCmdBar",
      quickCmdHeight: 180,
      serialSendHeight: 180,
      onSelect: vi.fn(),
      onQuickCmdResize: vi.fn(),
      onSerialSendResize: vi.fn(),
    },
    dialogs: {},
  } as unknown as ComponentProps<typeof AppLayout>;
}

describe("rounded workspace layout", () => {
  it("switches bottom tools with the arrow keys and moves focus", () => {
    render(<AppLayout {...fixture()} />);
    fireEvent.keyDown(
      screen.getByRole("tab", { name: "panel.quickCommands" }),
      { key: "ArrowRight" },
    );
    const transfers = screen.getByRole("tab", { name: "panel.fileTransfer" });
    expect(transfers.getAttribute("aria-selected")).toBe("true");
    expect(document.activeElement).toBe(transfers);
  });

  it("collapses a sidebar without unmounting its content or losing its input", () => {
    render(<AppLayout {...fixture()} />);
    const input = screen.getByLabelText("Panel savedConnections");
    fireEvent.change(input, { target: { value: "retained filter" } });
    fireEvent.click(
      screen.getByRole("button", { name: "workspaceLayout.left" }),
    );
    expect(input.closest("aside")?.getAttribute("data-collapsed")).toBe("true");
    fireEvent.click(
      screen.getByRole("button", { name: "workspaceLayout.left" }),
    );
    expect(screen.getByLabelText("Panel savedConnections")).toBe(input);
    expect(input).toHaveProperty("value", "retained filter");
  });

  it("reuses transfer/history panels and returns to a retained command draft", () => {
    const props = fixture();
    render(<AppLayout {...props} />);
    const draft = screen.getByLabelText("Quick command draft");
    fireEvent.change(draft, { target: { value: "ls -lah" } });
    fireEvent.click(screen.getByRole("tab", { name: "panel.fileTransfer" }));
    expect(screen.getByLabelText("Panel fileTransfer")).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: "panel.commandHistory" }));
    expect(screen.getByLabelText("Panel commandHistory")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Quick commands" }));
    expect(props.bottomPanel.onSelect).not.toHaveBeenCalled();
    expect(draft).toHaveProperty("value", "ls -lah");
    expect(draft.closest('[role="tabpanel"]')).toHaveProperty("hidden", false);
  });

  it("reveals a collapsed send panel for an incoming command draft", () => {
    const props = fixture();
    props.bottomPanel.activePanel = "serialSend";
    const { rerender } = render(<AppLayout {...props} />);
    const input = screen.getByLabelText("Serial draft");
    fireEvent.change(input, { target: { value: "keep this" } });
    fireEvent.click(
      screen.getAllByRole("button", { name: "workspaceLayout.bottom" })[0],
    );
    expect(
      document
        .getElementById("workspace-bottom")
        ?.getAttribute("data-collapsed"),
    ).toBe("true");
    rerender(
      <AppLayout
        {...props}
        bottomPanel={{
          ...props.bottomPanel,
          sendCommandDraft: {
            text: "echo hello",
            sourceSessionId: null,
            sendMode: "line",
            count: 1,
            intervalSeconds: 1,
            target: "current",
          },
        }}
      />,
    );
    expect(
      document
        .getElementById("workspace-bottom")
        ?.getAttribute("data-collapsed"),
    ).toBe("false");
    expect(screen.getByLabelText("Serial draft")).toBe(input);
  });
});
