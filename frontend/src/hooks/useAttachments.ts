import { useCallback, useState } from "react";
import { getAttachmentsUrl } from "../config/api";
import type { AttachmentInfo, UploadAttachmentsResponse } from "../types";

/**
 * Files staged for the next message.
 *
 * Upload happens as soon as a file is dropped or picked, not on send: the user
 * gets an immediate chip with a real size, and a failure surfaces while they
 * can still do something about it rather than at the moment they hit Send.
 *
 * The list is cleared by the caller once a message goes out — attachments
 * belong to the message that names them, not to the session.
 */
export function useAttachments() {
  const [attachments, setAttachments] = useState<AttachmentInfo[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const add = useCallback(async (files: File[]) => {
    if (files.length === 0) return;

    setIsUploading(true);
    setError(null);
    try {
      const body = new FormData();
      for (const file of files) {
        body.append("files", file);
      }

      const response = await fetch(getAttachmentsUrl(), {
        method: "POST",
        body,
      });
      if (!response.ok) {
        const detail = await response
          .json()
          .then((payload: { error?: string }) => payload?.error)
          .catch(() => undefined);
        throw new Error(detail ?? "Upload failed");
      }

      const data: UploadAttachmentsResponse = await response.json();
      setAttachments((current) => [...current, ...(data.attachments ?? [])]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setIsUploading(false);
    }
  }, []);

  const remove = useCallback((path: string) => {
    setAttachments((current) =>
      current.filter((attachment) => attachment.path !== path),
    );
  }, []);

  const clear = useCallback(() => {
    setAttachments([]);
    setError(null);
  }, []);

  return { attachments, isUploading, error, add, remove, clear };
}

/**
 * Appends the attachment paths to the outgoing message.
 *
 * Paths rather than content: Claude opens what it needs with its own tools,
 * which is how the CLI works with files and keeps a 20MB PDF out of the
 * prompt. The block is labelled so the model can tell a deliberate attachment
 * from a path that merely appears in the prose.
 */
export function withAttachments(
  message: string,
  attachments: AttachmentInfo[],
): string {
  if (attachments.length === 0) return message;

  const list = attachments
    .map((attachment) => `- ${attachment.path}`)
    .join("\n");

  const preamble =
    attachments.length === 1
      ? "The user attached this file:"
      : "The user attached these files:";

  return `${message.trim()}\n\n${preamble}\n${list}`.trim();
}
