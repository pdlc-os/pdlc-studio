import { useState, useEffect } from "react";
import { Text } from "@astryxdesign/core/Text";
import type { TextColor, TextSize } from "@astryxdesign/core/Text";
import { formatAbsoluteTime, formatRelativeTime } from "../utils/time";

interface TimestampProps {
  timestamp: number;
  mode?: "absolute" | "relative";
  color?: TextColor;
  size?: TextSize;
}

export function TimestampComponent({
  timestamp,
  mode = "absolute",
  color = "secondary",
  size = "xsm",
}: TimestampProps) {
  const [displayTime, setDisplayTime] = useState<string>("");

  useEffect(() => {
    const updateTime = () => {
      setDisplayTime(
        mode === "absolute"
          ? formatAbsoluteTime(timestamp)
          : formatRelativeTime(timestamp),
      );
    };

    // Initial update
    updateTime();

    // For relative time, update every minute
    // TODO: Consider using a shared timer/context for batch updates when many messages use relative mode
    if (mode === "relative") {
      const interval = setInterval(updateTime, 60000);
      return () => clearInterval(interval);
    }
  }, [timestamp, mode]);

  return (
    <Text
      type="supporting"
      size={size}
      color={color}
      aria-label={`Sent at ${displayTime}`}
    >
      {displayTime}
    </Text>
  );
}
