import {
  VscLayoutPanel,
  VscLayoutSidebarLeft,
  VscLayoutSidebarRight
} from "react-icons/vsc";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface WorkspaceControlsProps {
  leftVisible: boolean;
  rightVisible: boolean;
  bottomVisible: boolean;
  leftAvailable: boolean;
  rightAvailable: boolean;
  onToggleLeft: () => void;
  onToggleRight: () => void;
  onToggleBottom: () => void;
}

export default function WorkspaceControls(props: WorkspaceControlsProps) {
  const { t } = useTranslation();
  const controls = [
    {
      id: "left",
      Icon: VscLayoutSidebarLeft,
      visible: props.leftVisible,
      available: props.leftAvailable,
      toggle: props.onToggleLeft,
    },
    {
      id: "bottom",
      Icon: VscLayoutPanel,
      visible: props.bottomVisible,
      available: true,
      toggle: props.onToggleBottom,
    },
    {
      id: "right",
      Icon: VscLayoutSidebarRight,
      visible: props.rightVisible,
      available: props.rightAvailable,
      toggle: props.onToggleRight,
    },
  ];
  return (
    <fieldset
      className="workspace-controls"
      aria-label={t("workspaceLayout.title")}
    >
      {controls.map(({ id, Icon, visible, available, toggle }) => (
        <Tooltip key={id}>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className="workspace-control"
              disabled={!available}
              aria-label={t(`workspaceLayout.${id}`)}
              aria-pressed={visible}
              aria-controls={`workspace-${id}`}
              onClick={toggle}
            >
              <Icon className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t(`workspaceLayout.${id}`)}</TooltipContent>
        </Tooltip>
      ))}
    </fieldset>
  );
}
