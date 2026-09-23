import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_AI_SETTINGS } from "@/lib/aiSettings";
import type {
  AIMessage,
  AISession,
  AISessionScope,
  Tab,
  TerminalSessionPane,
} from "@/types/global";
import AIAssistantPanel from "./AIAssistantPanel";

const { invokeMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
}));

let appState: {
  appSettings: {
    ai: typeof DEFAULT_AI_SETTINGS;
    ui: { language: string };
  };
  updateAppSettings: ReturnType<typeof vi.fn>;
  tabs: Tab[];
  savedConnections: [];
};

vi.mock("@/context/AppContext", () => ({
  useApp: () => appState,
}));

vi.mock("@/context/ThemeContext", () => ({
  useTheme: () => ({ theme: { colors: {} } }),
}));

vi.mock("@/lib/invoke", () => ({ invoke: invokeMock }));

vi.mock("@tauri-apps/api/event", () => ({
  emit: vi.fn(),
  listen: vi.fn(async () => vi.fn()),
}));

vi.mock("react-i18next", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-i18next")>();
  return {
    ...actual,
    useTranslation: () => ({ t: (key: string) => key }),
  };
});

vi.mock("@/components/dialog/ai/AIAssistantDialogs", () => ({
  AIAssistantDialogs: () => null,
}));

vi.mock("./ModelCombobox", () => ({
  ModelCombobox: () => null,
}));

vi.mock("./utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./utils")>();
  return { ...actual, buildPrismThemeFromColors: () => ({}) };
});

describe("AIAssistantPanel history scope ownership", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    appState = {
      appSettings: {
        ai: { ...DEFAULT_AI_SETTINGS },
        ui: { language: "zh-CN" },
      },
      updateAppSettings: vi.fn(),
      tabs: [],
      savedConnections: [],
    };
  });

  it("allows a history session to move after its terminal reconnects with a new session id", async () => {
    const oldPane = terminalPane("old-session");
    const newPane = terminalPane("new-session");
    let historySession = aiSession("ai-session", oldPane.sessionId);
    let messageLoadCount = 0;

    invokeMock.mockImplementation(
      (command: string, args?: Record<string, unknown>) => {
        switch (command) {
          case "get_ai_sessions":
            return Promise.resolve([historySession]);
          case "get_ai_messages": {
            messageLoadCount += 1;
            return Promise.resolve([
              aiMessage(
                historySession.id,
                messageLoadCount === 1 ? "before reconnect" : "after reconnect",
              ),
            ]);
          }
          case "rebind_ai_session":
            historySession = {
              ...historySession,
              scope: args?.ownerScope as AISessionScope,
            };
            return Promise.resolve(historySession);
          default:
            return Promise.reject(new Error(`Unexpected command: ${command}`));
        }
      },
    );

    appState.tabs = [tabWithPane(oldPane)];
    const view = render(
      <AIAssistantPanel activePane={oldPane} intent={null} />,
    );

    openHistory(view.container);
    fireEvent.click(await historySessionButton(historySession.title));
    await screen.findByText("before reconnect");
    expect(invokeMock).not.toHaveBeenCalledWith(
      "rebind_ai_session",
      expect.anything(),
    );

    appState.tabs = [tabWithPane(newPane)];
    view.rerender(<AIAssistantPanel activePane={newPane} intent={null} />);

    openHistory(view.container);
    const movableSessionButton = await historySessionButton(
      historySession.title,
    );
    expect(movableSessionButton.disabled).toBe(false);
    expect(screen.queryByText("ai.historyInUse")).toBeNull();
    expect(screen.getByText("ai.historyMoveToCurrent")).not.toBeNull();

    fireEvent.click(movableSessionButton);

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith("rebind_ai_session", {
        sessionId: historySession.id,
        ownerScope: {
          type: "terminal",
          targetId: newPane.sessionId,
          connectionIds: [newPane.connectionId],
          label: newPane.name,
        },
      });
    });
    await screen.findByText("after reconnect");
    expect(messageLoadCount).toBe(2);
  });

  it("keeps history locked while the owning terminal pane still exists", async () => {
    const owningPane = terminalPane("owning-session", {
      connectError: "connection lost",
    });
    const currentPane = terminalPane("current-session", {
      id: "current-pane",
      connectionId: "current-connection",
      name: "Current terminal",
    });
    const historySession = aiSession("shared-ai-session", owningPane.sessionId);

    invokeMock.mockImplementation((command: string) => {
      switch (command) {
        case "get_ai_sessions":
          return Promise.resolve([historySession]);
        case "get_ai_messages":
          return Promise.resolve([]);
        default:
          return Promise.reject(new Error(`Unexpected command: ${command}`));
      }
    });

    appState.tabs = [tabWithPane(owningPane, 0), tabWithPane(currentPane, 1)];
    const view = render(
      <AIAssistantPanel activePane={owningPane} intent={null} />,
    );

    openHistory(view.container);
    fireEvent.click(await historySessionButton(historySession.title));
    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith("get_ai_messages", {
        sessionId: historySession.id,
      });
    });

    view.rerender(<AIAssistantPanel activePane={currentPane} intent={null} />);
    openHistory(view.container);

    const lockedSessionButton = await historySessionButton(
      historySession.title,
    );
    expect(lockedSessionButton.disabled).toBe(true);
    expect(screen.getByText("ai.historyInUse")).not.toBeNull();
    expect(invokeMock).not.toHaveBeenCalledWith(
      "rebind_ai_session",
      expect.anything(),
    );
  });

  it("keeps history locked while its AI stream is still running after the terminal closes", async () => {
    const owningPane = terminalPane("stream-owner");
    const currentPane = terminalPane("current-session", {
      id: "current-pane",
      connectionId: "current-connection",
      name: "Current terminal",
    });
    const historySession = aiSession("stream-ai-session", owningPane.sessionId);

    appState.appSettings.ai = {
      ...DEFAULT_AI_SETTINGS,
      enabled: true,
      default_model_id: "test-model",
      models: [
        {
          id: "test-model",
          name: "Test model",
          provider_kind: "openai",
          enabled: true,
          source: "manual",
        },
      ],
    };

    invokeMock.mockImplementation((command: string) => {
      switch (command) {
        case "get_ai_sessions":
          return Promise.resolve([historySession]);
        case "start_ai_chat_stream":
          return Promise.resolve({ sessionId: historySession.id });
        case "append_ai_audit":
          return Promise.resolve(null);
        default:
          return Promise.reject(new Error(`Unexpected command: ${command}`));
      }
    });

    appState.tabs = [tabWithPane(owningPane)];
    const intent = {
      id: "stream-intent",
      action: "generate_command" as const,
      userInput: "keep streaming",
    };
    const view = render(
      <AIAssistantPanel activePane={owningPane} intent={intent} />,
    );

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith(
        "start_ai_chat_stream",
        expect.objectContaining({
          request: expect.objectContaining({ sessionId: null }),
        }),
      );
    });

    appState.tabs = [tabWithPane(currentPane)];
    view.rerender(<AIAssistantPanel activePane={currentPane} intent={intent} />);
    openHistory(view.container);

    const lockedSessionButton = await historySessionButton(historySession.title);
    expect(lockedSessionButton.disabled).toBe(true);
    expect(screen.getByText("ai.historyInUse")).not.toBeNull();
    expect(invokeMock).not.toHaveBeenCalledWith(
      "rebind_ai_session",
      expect.anything(),
    );
  });
});

describe("AIAssistantPanel composer interactions", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    appState = {
      appSettings: {
        ai: {
          ...DEFAULT_AI_SETTINGS,
          enabled: true,
          default_model_id: "test-model",
          models: [{ id: "test-model", name: "Test model", provider_kind: "openai", enabled: true, source: "manual" }],
        },
        ui: { language: "zh-CN" },
      },
      updateAppSettings: vi.fn(),
      tabs: [tabWithPane(terminalPane("composer-session"))],
      savedConnections: [],
    };
    invokeMock.mockImplementation((command: string) => {
      if (command === "get_ai_sessions") return Promise.resolve([]);
      if (command === "start_ai_chat_stream") return Promise.resolve({ sessionId: "composer-chat" });
      if (command === "append_ai_audit" || command === "cancel_ai_chat_stream") return Promise.resolve(null);
      return Promise.reject(new Error(`Unexpected command: ${command}`));
    });
  });

  it("keeps IME and Shift+Enter from sending, then sends once and stops the same stream", async () => {
    render(<AIAssistantPanel activePane={terminalPane("composer-session")} intent={null} />);
    const input = screen.getByRole("textbox", { name: "ai.placeholder" });
    expect((screen.getByRole("button", { name: "ai.send" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(input, { target: { value: "explain this output" } });
    fireEvent.compositionStart(input);
    fireEvent.keyDown(input, { key: "Enter", isComposing: true });
    fireEvent.compositionEnd(input);
    fireEvent.keyDown(input, { key: "Enter", shiftKey: true });
    expect(invokeMock.mock.calls.some(([command]) => command === "start_ai_chat_stream")).toBe(false);

    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => expect(invokeMock).toHaveBeenCalledWith(
      "start_ai_chat_stream",
      expect.objectContaining({ request: expect.objectContaining({ userInput: "explain this output" }) }),
    ));
    const calls = invokeMock.mock.calls.filter(([command]) => command === "start_ai_chat_stream");
    expect(calls).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "ai.stopResponse" }));
    expect(invokeMock).toHaveBeenCalledWith("cancel_ai_chat_stream", {
      streamId: calls[0][1].request.streamId,
    });
  });

  it("uses Enter to choose an @ target without submitting and lets the chip remove it", async () => {
    render(<AIAssistantPanel activePane={terminalPane("composer-session")} intent={null} />);
    const input = screen.getByRole("textbox", { name: "ai.placeholder" });
    fireEvent.change(input, { target: { value: "@SSH", selectionStart: 4 } });
    fireEvent.keyDown(input, { key: "Enter" });
    const remove = await screen.findByRole("button", { name: "common.remove SSH terminal" });
    expect(invokeMock.mock.calls.some(([command]) => command === "start_ai_chat_stream")).toBe(false);
    expect((input as HTMLTextAreaElement).value).toBe("");
    fireEvent.click(remove);
    expect(screen.queryByRole("button", { name: "common.remove SSH terminal" })).toBeNull();
  });
});

function openHistory(container: HTMLElement) {
  const button = container.querySelector<HTMLButtonElement>(
    'button[aria-label="ai.history"]',
  );
  if (!button) throw new Error("History button not found");
  fireEvent.click(button);
}

async function historySessionButton(title: string) {
  const titleElement = await screen.findByText(title);
  const button = titleElement.closest("button");
  if (!(button instanceof HTMLButtonElement))
    throw new Error("History session button not found");
  return button;
}

function terminalPane(
  sessionId: string,
  overrides: Partial<TerminalSessionPane> = {},
): TerminalSessionPane {
  return {
    id: "terminal-pane",
    kind: "leaf",
    paneKind: "terminal",
    sessionId,
    name: "SSH terminal",
    type: "SSH",
    connectionId: "connection-1",
    ...overrides,
  };
}

function tabWithPane(pane: TerminalSessionPane, persistOrder = 0): Tab {
  return {
    id: `tab-${pane.id}`,
    persistOrder,
    activePaneId: pane.id,
    root: pane,
  };
}

function aiSession(id: string, targetId: string): AISession {
  return {
    id,
    title: "Reconnect chat",
    createdAt: "2026-09-07T10:00:00Z",
    updatedAt: "2026-09-07T10:05:00Z",
    connectionId: "connection-1",
    scope: {
      type: "terminal",
      targetId,
      connectionIds: ["connection-1"],
      label: "SSH terminal",
    },
  };
}

function aiMessage(sessionId: string, content: string): AIMessage {
  return {
    id: `message-${content}`,
    sessionId,
    role: "user",
    content,
    createdAt: "2026-09-07T10:01:00Z",
  };
}
