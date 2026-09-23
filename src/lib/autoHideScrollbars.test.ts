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
});
