import { useEffect, useRef, useState } from "react";
import { Button } from "@astryxdesign/core/Button";
import { Icon } from "@astryxdesign/core/Icon";
import { Check, Copy } from "lucide-react";

interface CopyMessageButtonProps {
  /** The text to place on the clipboard — this message alone. */
  text: string;
  /** Names what is being copied, for screen readers. */
  label?: string;
}

/** How long the confirmation shows before reverting. */
const CONFIRM_MS = 1600;

/**
 * Copies one message out of the transcript.
 *
 * Sits in the metadata footer beside the timestamp, so copying a single reply
 * does not mean selecting across bubbles and picking up names and times with
 * it.
 *
 * The confirmation is the whole feedback mechanism: nothing else on screen
 * changes when the clipboard is written, so without it there is no way to know
 * whether the click registered.
 */
export function CopyMessageButton({ text, label }: CopyMessageButtonProps) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // A message can scroll out and unmount while the confirmation is showing.
  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const copy = async () => {
    try {
      /*
       * `navigator.clipboard` is undefined outside a secure context, which
       * includes plain-http access to this app from another machine on the
       * network — a supported way to run it. Reporting the failure is better
       * than a button that silently does nothing.
       */
      if (!navigator.clipboard?.writeText) {
        throw new Error("Clipboard unavailable");
      }
      await navigator.clipboard.writeText(text);
      setState("copied");
    } catch {
      setState("failed");
    }

    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setState("idle"), CONFIRM_MS);
  };

  const description =
    state === "copied" ? "Copied" : state === "failed" ? "Copy failed" : "Copy";

  return (
    <Button
      variant="ghost"
      size="sm"
      isIconOnly
      className="copy-message-button"
      data-testid="copy-message"
      data-state={state}
      // The visible glyph carries no name, so the label is the accessible one.
      label={label ? `${description} ${label}` : description}
      icon={<Icon icon={state === "copied" ? Check : Copy} size="sm" />}
      onClick={() => void copy()}
    />
  );
}
