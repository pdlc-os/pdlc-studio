interface AppIconProps {
  /** Rendered width and height in pixels. */
  size?: number;
  /**
   * Decorative by default. The mark almost always sits next to the words
   * "PDLC Studio", so announcing it again would just repeat the name. Pass a
   * label only where the mark stands alone.
   */
  label?: string;
}

/**
 * PDLC Studio app mark.
 *
 * Inlined rather than loaded from `/pdlc-studio-mark.svg` so it inherits the
 * surrounding layout and cannot flash in late on a cold load. The same
 * artwork is also in `public/pdlc-studio-mark.svg`, which serves the favicon —
 * keep the two paths in sync.
 *
 * The mark is deliberately **not** theme-reactive: it carries its own tile
 * background, so it renders identically in light and dark mode the way an OS
 * app icon does. Both fills are explicit for that reason — inheriting
 * `currentColor` would repaint the glyph near-white on the light blue tile in
 * dark mode.
 */
export function AppIcon({ size = 32, label }: AppIconProps) {
  const isDecorative = label === undefined;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      width={size}
      height={size}
      role={isDecorative ? undefined : "img"}
      aria-hidden={isDecorative ? true : undefined}
      aria-label={label}
      focusable="false"
      style={{ display: "block", flexShrink: 0 }}
    >
      <path
        fill="#60b8e3"
        fillRule="evenodd"
        d="M512 64c0-35.3-28.7-64-64-64H64C28.7 0 0 28.7 0 64v384c0 35.3 28.7 64 64 64h384c35.3 0 64-28.7 64-64z"
      />
      <path
        fill="#000000"
        d="M416 416H96v-94.4h108.2v32H128V384h256v-30.4h-85L195.4 190.4H96V96h320v94.4H307.8v-32H384V128H128v30.4h85l103.6 163.2H416z"
      />
    </svg>
  );
}
