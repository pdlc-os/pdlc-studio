import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  type RefObject,
} from "react";
import { getCommandToken } from "../../utils/slashCommands";
import type { SlashCommandInfo } from "../../types";

/**
 * Typography and box metrics copied from the textarea onto the overlay.
 *
 * Every one of these can shift where a glyph lands. Miss one and the overlay
 * drifts out of register with the real text, which shows up as a blurry
 * double-image rather than as an obvious break — so this list is deliberately
 * exhaustive rather than "the ones that seemed to matter".
 */
const MIRRORED_STYLES = [
  "fontFamily",
  "fontSize",
  "fontWeight",
  "fontStyle",
  "fontVariant",
  "letterSpacing",
  "lineHeight",
  "textIndent",
  "textTransform",
  "wordSpacing",
  "tabSize",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "borderTopWidth",
  "borderRightWidth",
  "borderBottomWidth",
  "borderLeftWidth",
  "boxSizing",
] as const;

interface ComposerHighlightProps {
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  value: string;
  commands: SlashCommandInfo[];
}

/**
 * Paints the composer's text so the leading `/command` carries the app mark's
 * gradient while everything else stays ordinary body text.
 *
 * A `<textarea>` cannot style ranges of its own content — it renders one flat
 * run of text, full stop. The standard way around that is this: the real
 * textarea keeps the text, the caret, selection, and every bit of native
 * editing behaviour, but paints its glyphs transparent; this element sits
 * exactly on top and draws the same string with markup. The user edits the
 * textarea and sees the overlay.
 *
 * Registration between the two is the whole game, which is why the metrics are
 * mirrored from the live element rather than hardcoded: Astryx styles the
 * textarea through StyleX, so its padding and font are not ours to assume and
 * can change with a design-system upgrade.
 *
 * Deliberately `aria-hidden`: it is a visual duplicate of text the textarea
 * already exposes, so announcing it would read the message twice.
 */
export function ComposerHighlight({
  textareaRef,
  value,
  commands,
}: ComposerHighlightProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  const sync = useCallback(() => {
    const textarea = textareaRef.current;
    const overlay = overlayRef.current;
    if (!textarea || !overlay) return;

    const computed = getComputedStyle(textarea);
    for (const property of MIRRORED_STYLES) {
      overlay.style[property] = computed[property];
    }

    // Position against the textarea's own box, not the shell's. Astryx nests
    // the <textarea> inside a wrapper of its own, so the element is inset
    // within the shell — anchoring the overlay to the shell with `inset: 0`
    // leaves it several pixels out of register in both axes.
    const shell = overlay.parentElement;
    if (shell) {
      const shellBox = shell.getBoundingClientRect();
      const textareaBox = textarea.getBoundingClientRect();
      overlay.style.left = `${textareaBox.left - shellBox.left}px`;
      overlay.style.top = `${textareaBox.top - shellBox.top}px`;
      overlay.style.width = `${textareaBox.width}px`;
      overlay.style.height = `${textareaBox.height}px`;
    }

    // Once the textarea is tall enough to scroll, the overlay has to follow it
    // or the tinted command slides away from the text under it.
    overlay.scrollTop = textarea.scrollTop;
    overlay.scrollLeft = textarea.scrollLeft;
  }, [textareaRef]);

  // No dependency array: the textarea's computed padding or font can change at
  // a breakpoint, so re-mirror on every render rather than trying to enumerate
  // what might have moved.
  useLayoutEffect(sync);

  /*
   * The auto-resize hook lives in the *parent*, and React runs a child's
   * effects first — so on the render where the textarea changes height, the
   * pass above measures the box before it has been resized. Growing hides
   * this, but shrinking leaves the overlay stuck at its old height.
   *
   * A ResizeObserver settles it regardless of effect order: it fires after
   * layout, so it always reports the size the textarea actually ended up.
   */
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const observer = new ResizeObserver(sync);
    observer.observe(textarea);
    textarea.addEventListener("scroll", sync);

    return () => {
      observer.disconnect();
      textarea.removeEventListener("scroll", sync);
    };
  }, [textareaRef, sync]);

  const token = getCommandToken(value, commands);

  // A value ending in a newline produces no final line box, so the overlay
  // would come up one line shorter than the textarea and stop scrolling in
  // step with it. The trailing space forces that last box into existence.
  const trailingSafe = value.endsWith("\n") ? `${value} ` : value;

  return (
    <div ref={overlayRef} className="composer-highlight" aria-hidden="true">
      {token === null ? (
        trailingSafe
      ) : (
        <>
          <span className="composer-highlight-command">/{token}</span>
          {trailingSafe.slice(token.length + 1)}
        </>
      )}
    </div>
  );
}
