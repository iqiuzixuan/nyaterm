import { inferConnectionIconKeyFromRemoteSystem, resolveConnectionIcon } from "@/components/icons";
import type { SavedConnection } from "@/types/global";

interface AssetConnectionIconProps {
  connection: SavedConnection;
  selected?: boolean;
  className?: string;
}

export default function AssetConnectionIcon({
  connection,
  selected = false,
  className = "",
}: AssetConnectionIconProps) {
  const iconDef = resolveAssetConnectionIcon(connection);
  const Icon = iconDef.icon;

  return (
    <span
      className={`flex size-6 shrink-0 items-center justify-center rounded ${className}`}
      style={{
        backgroundColor: selected
          ? "color-mix(in srgb, var(--df-primary) 12%, transparent)"
          : "transparent",
        color: selected ? "var(--df-primary)" : iconDef.color,
      }}
    >
      <Icon className="size-4 max-h-4 max-w-4" aria-hidden="true" />
    </span>
  );
}

function resolveAssetConnectionIcon(connection: SavedConnection) {
  const os = [connection.asset?.os_name, connection.asset?.os_version]
    .map((value) => value?.trim())
    .filter(Boolean)
    .join(" ");
  const inferredIcon = inferConnectionIconKeyFromRemoteSystem({
    os,
    arch: connection.asset?.architecture ?? "",
  });

  return inferredIcon
    ? resolveConnectionIcon(inferredIcon)
    : resolveConnectionIcon(connection.icon);
}
