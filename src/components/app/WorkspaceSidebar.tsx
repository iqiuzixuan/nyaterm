import type { ComponentProps, ReactNode } from "react";
import ActivityBar from "@/components/layout/ActivityBar";

interface WorkspaceSidebarProps {
  side: "left" | "right";
  width: number;
  visible: boolean;
  panelOpen: boolean;
  activity: Omit<
    ComponentProps<typeof ActivityBar>,
    "side" | "zone" | "orientation" | "region"
  >;
  children: ReactNode;
}

/** Toolbars and content share one card. Collapsing never unmounts active tools. */
export default function WorkspaceSidebar({
  side,
  width,
  visible,
  panelOpen,
  activity,
  children,
}: WorkspaceSidebarProps) {
  const zone = { top: `${side}_top`, bottom: `${side}_bottom` } as const;
  return (
    <aside
      id={`workspace-${side}`}
      className="workspace-sidebar workspace-card"
      data-side={side}
      data-collapsed={!visible}
      data-rail={!panelOpen}
      style={{ width: panelOpen ? width : 42 }}
    >
      {panelOpen ? (
        <>
          <ActivityBar
            {...activity}
            side={side}
            zone={zone}
            orientation="horizontal"
            region="top"
          />
          <div className="workspace-sidebar-content">{children}</div>
          <ActivityBar
            {...activity}
            side={side}
            zone={zone}
            orientation="horizontal"
            region="bottom"
          />
        </>
      ) : (
        <ActivityBar {...activity} side={side} zone={zone} />
      )}
    </aside>
  );
}
