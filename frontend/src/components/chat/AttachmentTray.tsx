import { Icon } from "@astryxdesign/core/Icon";
import { IconButton } from "@astryxdesign/core/IconButton";
import { Text } from "@astryxdesign/core/Text";
import { Paperclip, X } from "lucide-react";
import { formatFileSize } from "../../utils/fileSize";
import type { AttachmentInfo } from "../../types";

interface AttachmentTrayProps {
  attachments: AttachmentInfo[];
  error: string | null;
  onRemove: (path: string) => void;
}

/**
 * Files staged for the next message, shown above the composer.
 *
 * Each is already uploaded — the chip represents a real file on disk with a
 * real size, not a pending intent — so removing one only unstages it from this
 * message.
 */
export function AttachmentTray({
  attachments,
  error,
  onRemove,
}: AttachmentTrayProps) {
  if (attachments.length === 0 && error === null) {
    return null;
  }

  return (
    <div className="attachment-tray" data-testid="attachment-tray">
      {error ? (
        <Text size="sm" color="accent">
          {error}
        </Text>
      ) : null}
      {attachments.map((attachment) => (
        <span
          key={attachment.path}
          className="attachment-chip"
          data-testid="attachment-chip"
        >
          <Icon icon={Paperclip} size="sm" color="secondary" />
          <span className="attachment-chip-name" title={attachment.path}>
            {attachment.name}
          </span>
          <span className="attachment-chip-size">
            {formatFileSize(attachment.size)}
          </span>
          <IconButton
            onClick={() => onRemove(attachment.path)}
            label={`Remove ${attachment.name}`}
            variant="ghost"
            size="sm"
            icon={<Icon icon={X} />}
            tooltip={`Remove ${attachment.name}`}
          />
        </span>
      ))}
    </div>
  );
}
