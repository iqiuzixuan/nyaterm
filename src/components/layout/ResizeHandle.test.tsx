import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ResizeHandle from "./ResizeHandle";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

function pointer(type: string, x: number, id = 1) {
  const event = new MouseEvent(type, { bubbles: true, clientX: x, button: 0 });
  Object.defineProperty(event, "pointerId", { value: id });
  return event;
}

describe("workspace splitters", () => {
  it("uses the matching arrow axis and a larger Shift step", () => {
    const resize = vi.fn();
    render(
      <ResizeHandle direction="horizontal" onResize={resize} value={240} />,
    );
    const handle = screen.getByRole("separator");
    fireEvent.keyDown(handle, { key: "ArrowRight" });
    fireEvent.keyDown(handle, { key: "ArrowLeft", shiftKey: true });
    fireEvent.keyDown(handle, { key: "ArrowDown" });
    expect(resize.mock.calls).toEqual([[8], [-24]]);
    expect(handle.getAttribute("aria-orientation")).toBe("vertical");
    expect(handle.getAttribute("aria-valuenow")).toBe("240");
  });

  it("tracks only the captured pointer and releases body state on cancellation", () => {
    const resize = vi.fn();
    render(<ResizeHandle direction="horizontal" onResize={resize} />);
    fireEvent(screen.getByRole("separator"), pointer("pointerdown", 100));
    fireEvent(window, pointer("pointermove", 120, 2));
    fireEvent(window, pointer("pointermove", 114));
    fireEvent(window, pointer("pointercancel", 114));
    fireEvent(window, pointer("pointermove", 150));
    expect(resize.mock.calls).toEqual([[14]]);
    expect(document.body.style.userSelect).toBe("");
    expect(document.body.style.cursor).toBe("");
  });

  it("removes an active drag when its pane is unmounted", () => {
    const resize = vi.fn();
    document.body.style.cursor = "crosshair";
    const { unmount } = render(
      <ResizeHandle direction="horizontal" onResize={resize} />,
    );
    fireEvent(screen.getByRole("separator"), pointer("pointerdown", 100));
    unmount();
    fireEvent(window, pointer("pointermove", 150));
    expect(resize).not.toHaveBeenCalled();
    expect(document.body.style.cursor).toBe("crosshair");
    document.body.style.cursor = "";
  });
});
