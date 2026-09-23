import { createContext, type ReactNode, useContext, useMemo } from "react";

interface PanelToolbarSlot {
  target: HTMLElement | null;
  active: boolean;
}

const PanelToolbarContext = createContext<PanelToolbarSlot | null>(null);

/** A docked panel can contribute its existing actions to the shared tab row. */
export function PanelToolbarProvider({
  target,
  active,
  children,
}: PanelToolbarSlot & { children: ReactNode }) {
  const value = useMemo(() => ({ target, active }), [target, active]);
  return <PanelToolbarContext.Provider value={value}>{children}</PanelToolbarContext.Provider>;
}

export function usePanelToolbarSlot() {
  return useContext(PanelToolbarContext);
}
