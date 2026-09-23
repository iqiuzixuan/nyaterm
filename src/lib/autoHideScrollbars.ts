// Matches VS Code's scrollableElement.ts HIDE_TIMEOUT. Hover/drag visibility is
// handled by CSS so this observer never intercepts wheel or pointer input.
export const SCROLLBAR_IDLE_DELAY_MS = 500;

export function installAutoHideScrollbars(doc: Document = document): () => void {
  const timers = new Map<HTMLElement, ReturnType<typeof setTimeout>>();

  const clear = (element: HTMLElement) => {
    const timer = timers.get(element);
    if (timer !== undefined) clearTimeout(timer);
    timers.delete(element);
    element.removeAttribute("data-nyaterm-scrolling");
  };

  const onScroll = (event: Event) => {
    const element = event.target === doc ? doc.scrollingElement : event.target;
    if (!(element instanceof HTMLElement)) return;
    // xterm owns its own VS Code-derived scrollbar and fade controller. The tab
    // strip intentionally has no visible scrollbar even while it is scrolling.
    if (element.closest(".xterm, .tab-strip-scroll")) return;
    if (element.scrollHeight <= element.clientHeight && element.scrollWidth <= element.clientWidth) {
      return;
    }

    const timer = timers.get(element);
    if (timer !== undefined) clearTimeout(timer);
    element.setAttribute("data-nyaterm-scrolling", "true");
    timers.set(element, setTimeout(() => clear(element), SCROLLBAR_IDLE_DELAY_MS));
  };

  const clearAll = () => {
    for (const element of timers.keys()) clear(element);
  };
  const onVisibilityChange = () => {
    if (doc.visibilityState === "hidden") clearAll();
  };

  // Scroll doesn't bubble; capture also observes dynamically mounted panes,
  // popovers and textareas, without a listener or MutationObserver per panel.
  doc.addEventListener("scroll", onScroll, { capture: true, passive: true });
  doc.addEventListener("visibilitychange", onVisibilityChange);
  return () => {
    doc.removeEventListener("scroll", onScroll, true);
    doc.removeEventListener("visibilitychange", onVisibilityChange);
    clearAll();
  };
}
