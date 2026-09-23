// Keep visibility independent of sticky WebKit :hover/:focus states. Pointer
// activity and scrolling reveal only their own pane, then expire at rest.
export const SCROLLBAR_IDLE_DELAY_MS = 500;

export function installAutoHideScrollbars(doc: Document = document): () => void {
  const timers = new Map<HTMLElement, ReturnType<typeof setTimeout>>();
  let pointerArea: HTMLElement | null = null;
  let draggingArea: HTMLElement | null = null;

  const clear = (element: HTMLElement) => {
    const timer = timers.get(element);
    if (timer !== undefined) clearTimeout(timer);
    timers.delete(element);
    element.removeAttribute("data-nyaterm-scrolling");
  };
  const reveal = (element: HTMLElement) => {
    clear(element);
    element.setAttribute("data-nyaterm-scrolling", "true");
    timers.set(element, setTimeout(() => {
      if (draggingArea !== element) clear(element);
    }, SCROLLBAR_IDLE_DELAY_MS));
  };
  const overflows = (element: HTMLElement) =>
    element.scrollHeight > element.clientHeight || element.scrollWidth > element.clientWidth;
  const excluded = (element: Element) => element.closest(".xterm, .tab-strip-scroll");

  const onScroll = (event: Event) => {
    const element = event.target === doc ? doc.scrollingElement : event.target;
    if (!(element instanceof HTMLElement) || excluded(element) || !overflows(element)) return;
    reveal(element);
  };

  const findPointerArea = (target: EventTarget | null) => {
    if (!(target instanceof Element) || excluded(target)) return null;
    // Radix's overlay track is a sibling of its viewport, not a descendant.
    const track = target.closest('[data-slot="scroll-area-scrollbar"]');
    if (track) {
      return track.closest('[data-slot="scroll-area"]')
        ?.querySelector<HTMLElement>('[data-slot="scroll-area-viewport"]') ?? null;
    }
    for (let element: Element | null = target; element; element = element.parentElement) {
      if (!(element instanceof HTMLElement) || !overflows(element)) continue;
      const style = doc.defaultView?.getComputedStyle(element);
      if (style && /auto|scroll|overlay/.test(`${style.overflow} ${style.overflowX} ${style.overflowY}`)) {
        return element;
      }
    }
    return null;
  };
  const onPointerMove = (event: Event) => {
    const next = findPointerArea(event.target);
    if (pointerArea && pointerArea !== next && pointerArea !== draggingArea) clear(pointerArea);
    pointerArea = next;
    if (next) reveal(next);
  };
  const onPointerDown = (event: Event) => {
    onPointerMove(event);
    draggingArea = pointerArea;
  };
  const onPointerUp = () => {
    const previous = draggingArea;
    draggingArea = null;
    if (previous) reveal(previous);
  };
  const clearAll = () => {
    draggingArea = null;
    pointerArea = null;
    for (const element of timers.keys()) clear(element);
  };
  const onPointerOut = (event: Event) => {
    if ((event as PointerEvent).relatedTarget === null && !draggingArea) clearAll();
  };
  const onVisibilityChange = () => {
    if (doc.visibilityState === "hidden") clearAll();
  };

  // Capture handles dynamically mounted panes and keyboard scrolling without
  // changing native scroll positions, wheel handling or dragging behavior.
  const events = {
    scroll: onScroll,
    pointermove: onPointerMove,
    pointerdown: onPointerDown,
    pointerup: onPointerUp,
    pointercancel: onPointerUp,
    pointerout: onPointerOut,
  };
  for (const [name, handler] of Object.entries(events)) {
    doc.addEventListener(name, handler, { capture: true, passive: true });
  }
  doc.addEventListener("visibilitychange", onVisibilityChange);
  doc.defaultView?.addEventListener("blur", clearAll);
  return () => {
    for (const [name, handler] of Object.entries(events)) doc.removeEventListener(name, handler, true);
    doc.removeEventListener("visibilitychange", onVisibilityChange);
    doc.defaultView?.removeEventListener("blur", clearAll);
    clearAll();
  };
}
