import { IconButton } from "@astryxdesign/core/IconButton";
import { Icon } from "@astryxdesign/core/Icon";
import { Settings } from "lucide-react";

interface SettingsButtonProps {
  onClick: () => void;
}

export function SettingsButton({ onClick }: SettingsButtonProps) {
  return (
    <IconButton
      onClick={onClick}
      label="Open settings"
      variant="secondary"
      icon={<Icon icon={Settings} />}
      tooltip="Open settings"
    />
  );
}
