import { createEvent, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import ActivityBar from "./ActivityBar";

describe("ActivityBar settings interactions", () => {
  it("keeps the native drag path and mouse activation for settings", () => {
    const onSelect = vi.fn();
    renderActivityBar(onSelect);
    const button = screen.getByRole("button", { name: "Settings" });
    const mouseDown = createEvent.mouseDown(button, { button: 0 });
    const dataTransfer = {
      effectAllowed: "",
      setData: vi.fn(),
    } as unknown as DataTransfer;

    fireEvent(button, mouseDown);
    fireEvent.dragStart(button, { dataTransfer });
    fireEvent.click(button);

    expect(button).toHaveProperty("draggable", true);
    expect(mouseDown.defaultPrevented).toBe(false);
    expect(dataTransfer.setData).toHaveBeenCalledWith(
      "application/x-nyaterm-activity",
      JSON.stringify({ id: "settings", zone: "left_bottom" }),
    );
    expect(dataTransfer.effectAllowed).toBe("move");
    expect(onSelect).toHaveBeenCalledWith("settings");
  });

  it.each(["{Enter}", " "])(
    "still supports keyboard activation with %s",
    async (key) => {
      const user = userEvent.setup();
      const onSelect = vi.fn();
      renderActivityBar(onSelect);
      const button = screen.getByRole("button", { name: "Settings" });
      button.focus();

      await user.keyboard(key);

      expect(document.activeElement).toBe(button);
      expect(onSelect).toHaveBeenCalledWith("settings");
    },
  );
});

function renderActivityBar(onSelect: (id: string) => void) {
  render(
    <ActivityBar
      items={[]}
      bottomItems={[{ id: "settings", icon: null, tooltip: "Settings" }]}
      activeId={null}
      onSelect={onSelect}
      onReorder={vi.fn()}
      onMoveItem={vi.fn()}
      onHideItem={vi.fn()}
      onShowItem={vi.fn()}
      onToggleLabel={vi.fn()}
      onRequestResetLayout={vi.fn()}
      panelOpenMode="docked"
      onPanelOpenModeChange={vi.fn()}
      showLabels
      side="left"
      zone={{ top: "left_top", bottom: "left_bottom" }}
    />,
  );
}

describe("horizontal workspace toolbars", () => {
  it("reorders using the horizontal midpoint without hiding any item", () => {
    const onReorder = vi.fn();
    render(
      <ActivityBar
        orientation="horizontal"
        region="top"
        items={[
          { id: "files", icon: null, tooltip: "Files" },
          { id: "notes", icon: null, tooltip: "Notes" },
        ]}
        activeId="files"
        onSelect={vi.fn()}
        onReorder={onReorder}
        onMoveItem={vi.fn()}
        onHideItem={vi.fn()}
        onShowItem={vi.fn()}
        onToggleLabel={vi.fn()}
        onRequestResetLayout={vi.fn()}
        panelOpenMode="docked"
        onPanelOpenModeChange={vi.fn()}
        showLabels={false}
        side="left"
        zone={{ top: "left_top", bottom: "left_bottom" }}
      />,
    );
    const target = screen.getByRole("button", { name: "Notes" });
    vi.spyOn(target, "getBoundingClientRect").mockReturnValue({
      left: 40,
      top: 0,
      width: 30,
      height: 30,
    } as DOMRect);
    const dataTransfer = {
      types: ["application/x-nyaterm-activity"],
      getData: () => JSON.stringify({ id: "files", zone: "left_top" }),
      dropEffect: "move",
    };
    const over = createEvent.dragOver(target, { dataTransfer });
    Object.defineProperty(over, "clientX", { value: 66 });
    fireEvent(target, over);
    fireEvent.drop(target, { dataTransfer });
    expect(onReorder).toHaveBeenCalledWith("top", ["notes", "files"]);
    expect(
      screen
        .getByRole("button", { name: "Files" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
  });
});
