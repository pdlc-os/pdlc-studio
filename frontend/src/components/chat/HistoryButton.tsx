import { IconButton } from "@astryxdesign/core/IconButton";
import { Icon } from "@astryxdesign/core/Icon";

interface HistoryButtonProps {
  onClick: () => void;
}

export function HistoryButton({ onClick }: HistoryButtonProps) {
  return (
    <IconButton
      onClick={onClick}
      label="View conversation history"
      variant="secondary"
      icon={<Icon icon="clock" />}
    />
  );
}
