import { fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import PanelHeader from "./PanelHeader";
import { PanelToolbarProvider } from "./PanelToolbarContext";

describe("docked panel toolbar", () => {
  it("moves actions into the shared row and preserves search state across panel switches", () => {
    const run = vi.fn();
    function Fixture() {
      const [target, setTarget] = useState<HTMLDivElement | null>(null);
      const [active, setActive] = useState(true);
      const [search, setSearch] = useState("");
      return (
        <>
          <div ref={setTarget} data-testid="toolbar" />
          <button type="button" onClick={() => setActive(!active)}>
            Switch panel
          </button>
          <PanelToolbarProvider target={target} active={active}>
            <PanelHeader
              title="Commands"
              actions={
                <>
                  <input
                    aria-label="Search commands"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                  <button type="button" onClick={run}>
                    Run
                  </button>
                </>
              }
            />
            <span>Panel content</span>
          </PanelToolbarProvider>
        </>
      );
    }
    render(<Fixture />);
    const toolbar = within(screen.getByTestId("toolbar"));
    fireEvent.change(toolbar.getByRole("textbox"), { target: { value: "uptime" } });
    fireEvent.click(toolbar.getByRole("button", { name: "Run" }));
    expect(run).toHaveBeenCalledOnce();
    expect(document.querySelector(".workspace-panel-header")).toBeNull();
    fireEvent.click(screen.getByText("Switch panel"));
    expect(toolbar.queryByRole("textbox")).toBeNull();
    expect(screen.getByText("Panel content")).not.toBeNull();
    fireEvent.click(screen.getByText("Switch panel"));
    expect((toolbar.getByRole("textbox") as HTMLInputElement).value).toBe("uptime");
  });

  it("keeps the normal header when used outside a docked toolbar", () => {
    render(<PanelHeader title="Connections" actions={<button type="button">Add</button>} />);
    const header = document.querySelector(".workspace-panel-header") as HTMLElement;
    expect(within(header).getByText("Connections")).not.toBeNull();
    expect(within(header).getByRole("button", { name: "Add" })).not.toBeNull();
  });
});
