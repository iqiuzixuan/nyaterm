import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installAutoHideScrollbars, SCROLLBAR_IDLE_DELAY_MS } from "./autoHideScrollbars";

describe("auto-hide scrollbars", () => {
  let dispose: () => void;

  beforeEach(() => {
    vi.useFakeTimers();
    dispose = installAutoHideScrollbars();
  });
  afterEach(() => {
    dispose();
    document.body.replaceChildren();
    vi.useRealTimers();
  });

  function scroller(horizontal = false) {
    const element = document.createElement("div");
    element.style.overflow = "auto";
    Object.defineProperties(element, {
      clientHeight: { value: 100 },
      scrollHeight: { value: horizontal ? 100 : 1000 },
      clientWidth: { value: 100 },
      scrollWidth: { value: horizontal ? 1000 : 100 },
    });
    document.body.append(element);
    return element;
  }

  it("reveals a newly mounted scroller and restarts the idle delay on every scroll", () => {
    const element = scroller();
    element.dispatchEvent(new Event("scroll"));
    expect(element.dataset.nyatermScrolling).toBe("true");
    vi.advanceTimersByTime(SCROLLBAR_IDLE_DELAY_MS - 1);
    element.dispatchEvent(new Event("scroll"));
    vi.advanceTimersByTime(SCROLLBAR_IDLE_DELAY_MS - 1);
    expect(element.dataset.nyatermScrolling).toBe("true");
    vi.advanceTimersByTime(1);
    expect(element.hasAttribute("data-nyaterm-scrolling")).toBe(false);
  });

  it("tracks horizontal and vertical areas independently, without changing their scroll position", () => {
    const vertical = scroller();
    const horizontal = scroller(true);
    vertical.scrollTop = 200;
    vertical.dispatchEvent(new Event("scroll"));
    vi.advanceTimersByTime(250);
    horizontal.scrollLeft = 150;
    horizontal.dispatchEvent(new Event("scroll"));
    vi.advanceTimersByTime(250);
    expect(vertical.hasAttribute("data-nyaterm-scrolling")).toBe(false);
    expect(horizontal.dataset.nyatermScrolling).toBe("true");
    expect(vertical.scrollTop).toBe(200);
    expect(horizontal.scrollLeft).toBe(150);
  });

  it("does not interfere with xterm's controller or the hidden tab-strip scrollbar", () => {
    for (const className of ["xterm", "tab-strip-scroll"]) {
      const element = scroller();
      element.className = className;
      element.dispatchEvent(new Event("scroll"));
      expect(element.hasAttribute("data-nyaterm-scrolling")).toBe(false);
    }
    expect(vi.getTimerCount()).toBe(0);
  });

  it("does not reveal ancestors or containers without overflow", () => {
    const parent = document.createElement("div");
    document.body.append(parent);
    const element = scroller();
    parent.append(element);
    element.dispatchEvent(new Event("scroll"));
    parent.dispatchEvent(new Event("scroll"));
    expect(parent.hasAttribute("data-nyaterm-scrolling")).toBe(false);
    expect(element.dataset.nyatermScrolling).toBe("true");
  });

  it("clears pending timers and detached elements on disposal", () => {
    const element = scroller();
    element.dispatchEvent(new Event("scroll"));
    element.remove();
    dispose();
    expect(vi.getTimerCount()).toBe(0);
    expect(element.hasAttribute("data-nyaterm-scrolling")).toBe(false);
    document.body.append(element);
    element.dispatchEvent(new Event("scroll"));
    expect(element.hasAttribute("data-nyaterm-scrolling")).toBe(false);
  });

  it("hides after pointer activity stops even while the pointer stays in the pane", () => {
    const element = scroller();
    const row = document.createElement("span");
    element.append(row);
    row.dispatchEvent(new MouseEvent("pointermove", { bubbles: true }));
    expect(element.dataset.nyatermScrolling).toBe("true");
    vi.advanceTimersByTime(SCROLLBAR_IDLE_DELAY_MS);
    expect(element.hasAttribute("data-nyaterm-scrolling")).toBe(false);
    row.dispatchEvent(new MouseEvent("pointermove", { bubbles: true }));
    expect(element.dataset.nyatermScrolling).toBe("true");
  });

  it("reveals only the pane under the pointer and clears the previous pane", () => {
    const left = scroller();
    const right = scroller();
    left.dispatchEvent(new MouseEvent("pointermove", { bubbles: true }));
    right.dispatchEvent(new MouseEvent("pointermove", { bubbles: true }));
    expect(left.hasAttribute("data-nyaterm-scrolling")).toBe(false);
    expect(right.dataset.nyatermScrolling).toBe("true");
    document.body.dispatchEvent(new MouseEvent("pointermove", { bubbles: true }));
    expect(right.hasAttribute("data-nyaterm-scrolling")).toBe(false);
  });

  it("keeps the pane visible during a drag and starts the idle delay on release", () => {
    const element = scroller();
    element.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
    vi.advanceTimersByTime(SCROLLBAR_IDLE_DELAY_MS * 2);
    expect(element.dataset.nyatermScrolling).toBe("true");
    document.dispatchEvent(new MouseEvent("pointerup"));
    vi.advanceTimersByTime(SCROLLBAR_IDLE_DELAY_MS);
    expect(element.hasAttribute("data-nyaterm-scrolling")).toBe(false);
  });

  it("clears visibility when leaving the window or switching apps", () => {
    const element = scroller();
    element.dispatchEvent(new Event("scroll"));
    document.dispatchEvent(new MouseEvent("pointerout", { relatedTarget: null }));
    expect(element.hasAttribute("data-nyaterm-scrolling")).toBe(false);
    element.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
    window.dispatchEvent(new Event("blur"));
    expect(element.hasAttribute("data-nyaterm-scrolling")).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("maps overlay track activity to its Radix viewport", () => {
    const root = document.createElement("div");
    root.dataset.slot = "scroll-area";
    const viewport = scroller();
    viewport.dataset.slot = "scroll-area-viewport";
    const track = document.createElement("div");
    track.dataset.slot = "scroll-area-scrollbar";
    root.append(viewport, track);
    document.body.append(root);
    track.dispatchEvent(new MouseEvent("pointermove", { bubbles: true }));
    expect(viewport.dataset.nyatermScrolling).toBe("true");
    vi.advanceTimersByTime(SCROLLBAR_IDLE_DELAY_MS);
    expect(viewport.hasAttribute("data-nyaterm-scrolling")).toBe(false);
  });
});
