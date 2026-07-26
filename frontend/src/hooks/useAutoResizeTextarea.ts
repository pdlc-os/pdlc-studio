import { useLayoutEffect, type RefObject } from "react";

/**
 * Growth bounds for the composer, in CSS pixels.
 *
 * MAX is the point where the textarea stops growing and starts scrolling. Left
 * unbounded, a pasted file would push the composer past the viewport and take
 * the send button with it.
 */
const MIN_HEIGHT_PX = 40;
const MAX_HEIGHT_PX = 320;

/**
 * Grows a textarea to fit its content, up to a ceiling, then scrolls.
 *
 * Astryx's `TextArea` sizes from a fixed `rows` count and has no auto-grow
 * prop, so this drives `style.height` on the element directly. Inline styles
 * outrank the component's own class-based rules, which is what makes it stick
 * without touching the design system's CSS.
 *
 * The measure-then-set dance is required: `scrollHeight` only reports the
 * content height when the box is not already taller than its content, so the
 * height has to collapse to `auto` before every read. Reading it in a layout
 * effect keeps the resize in the same frame as the paint, so the box never
 * visibly jumps between the old and new height.
 */
export function useAutoResizeTextarea(
  ref: RefObject<HTMLTextAreaElement | null>,
  value: string,
) {
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;

    element.style.height = "auto";

    const fitted = Math.max(
      MIN_HEIGHT_PX,
      Math.min(element.scrollHeight, MAX_HEIGHT_PX),
    );

    element.style.height = `${fitted}px`;
    // Only scroll once growth has actually been capped; below the ceiling an
    // overflow value of `auto` can still flash a scrollbar mid-resize.
    element.style.overflowY =
      element.scrollHeight > MAX_HEIGHT_PX ? "auto" : "hidden";
  }, [ref, value]);
}
