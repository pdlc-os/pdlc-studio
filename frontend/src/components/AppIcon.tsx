import { useId } from "react";

/**
 * Below this size the display mark's dots merge into each other and the ring
 * turns into a smudge, so the small-size drawing is used instead. Dots are a
 * texture and need room.
 *
 * 32 is a conservative default, because this is a CSS-pixel size and what
 * actually matters is device pixels: at DPR 2 a 28px mark gets 56 real pixels
 * and the ring holds comfortably, while at DPR 1 it gets 28 and does not.
 * Rather than branch on DPR — which would make the icon change shape when a
 * window moves between displays — call sites that have looked at the result and
 * want the ring anyway pass `variant="mark"`.
 */
const SMALL_SIZE_THRESHOLD = 32;

/** Blue-to-green sweep, sampled once and shared by both optical sizes. */
const SWEEP = [
  { offset: 0, color: "#3992F9" },
  { offset: 0.35, color: "#26B6D0" },
  { offset: 0.7, color: "#13D2A6" },
  { offset: 1, color: "#06F28C" },
];

/**
 * Main ring: 14 dots on a circle of radius 150 from 12 o'clock, radii cycling
 * 25, 15, 21, 26, 14, 22, 18 — a 7-step cycle against 14 positions, so
 * opposite sides mirror. Then 8 smaller satellites outside it, irregular on
 * purpose. Generated rather than hand-placed; see brand/README.md.
 */
const DOTS: ReadonlyArray<readonly [number, number, number]> = [
  [256.0, 106.0, 25],
  [321.1, 120.9, 15],
  [373.3, 162.5, 21],
  [402.2, 222.6, 26],
  [402.2, 289.4, 14],
  [373.3, 349.5, 22],
  [321.1, 391.1, 18],
  [256.0, 406.0, 25],
  [190.9, 391.1, 15],
  [138.7, 349.5, 21],
  [109.8, 289.4, 26],
  [109.8, 222.6, 14],
  [138.7, 162.5, 22],
  [190.9, 120.9, 18],
  [329.4, 74.3, 9],
  [432.3, 177.5, 7],
  [449.1, 304.1, 10],
  [357.2, 418.0, 7],
  [208.3, 447.1, 9],
  [93.2, 357.7, 6],
  [65.7, 201.4, 8],
  [153.2, 91.5, 7],
];

/** The `>_` prompt, shared by both sizes at different scales. */
const PROMPT_LARGE = ["M193 205 L241 254 L193 302", "M280 302 H319"];
const PROMPT_SMALL = ["M152 176 L232 256 L152 336", "M288 336 H360"];

interface AppIconProps {
  /** Rendered width and height in pixels. Selects the optical size by default. */
  size?: number;
  /**
   * Which drawing to use.
   *
   * `"auto"` picks by {@link SMALL_SIZE_THRESHOLD} and is right almost
   * everywhere. Pass `"mark"` to force the full dot ring below the threshold —
   * a deliberate call that the ring's presence matters more at that spot than
   * the detail it loses, as in the chat header.
   */
  variant?: "auto" | "mark" | "small";
  /**
   * Decorative by default. The mark almost always sits next to the words
   * "PDLC Studio", so announcing it again would just repeat the name. Pass a
   * label only where the mark stands alone.
   */
  label?: string;
}

/**
 * PDLC Studio app mark: a shell prompt at the centre of a ring of graduated
 * dots — the command line this app drives, ringed by the development life
 * cycle its name refers to.
 *
 * Inlined rather than loaded from `/pdlc-studio-mark.svg` so it inherits the
 * surrounding layout and cannot flash in late on a cold load. `brand/` holds
 * the canonical editable SVGs; `AppIcon.test.tsx` fails if this drifts from
 * them.
 *
 * **Two optical sizes, one identity.** 22 dots plus a glyph is more detail than
 * a 22px header icon can resolve, so below {@link SMALL_SIZE_THRESHOLD} the
 * ring is dropped and the prompt fills the tile.
 *
 * The mark is deliberately **not** theme-reactive: it carries its own tile
 * background, so it renders identically in light and dark mode the way an OS
 * app icon does. Every colour is explicit for that reason — inheriting
 * `currentColor` would repaint the glyph.
 */
export function AppIcon({ size = 32, variant = "auto", label }: AppIconProps) {
  const isDecorative = label === undefined;
  const isSmall =
    variant === "auto" ? size < SMALL_SIZE_THRESHOLD : variant === "small";

  // Two AppIcons on one page would otherwise declare the same gradient id;
  // the first would win and the second would silently reference it.
  //
  // useId's output is deliberately opaque and has changed shape between React
  // versions — ":r1:" on 18, "\u00abr1d\u00bb" on 19 — and neither guillemets nor
  // colons are valid in an XML Name. Browsers resolve url(#...) by exact string
  // match and tolerate both, but a stricter SVG parser need not. Strip
  // everything that is not safe rather than the one delimiter of the day.
  const gradientId = `pdlc-sweep-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;

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
      <defs>
        {/*
          userSpaceOnUse is load-bearing. Under the default objectBoundingBox
          each dot would get the whole ramp across its own few pixels and the
          ring would come out uniformly muddy; anchoring the ramp to the canvas
          gives every dot the one colour that belongs at its position.
        */}
        <linearGradient
          id={gradientId}
          gradientUnits="userSpaceOnUse"
          x1={isSmall ? 128 : 88}
          y1="256"
          x2={isSmall ? 384 : 424}
          y2="256"
        >
          {SWEEP.map(({ offset, color }) => (
            <stop key={offset} offset={offset} stopColor={color} />
          ))}
        </linearGradient>
      </defs>

      <rect width="512" height="512" rx="112" fill="#0B1A23" />

      {isSmall ? (
        <g
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth="48"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {PROMPT_SMALL.map((d) => (
            <path key={d} d={d} />
          ))}
        </g>
      ) : (
        <>
          <g fill={`url(#${gradientId})`}>
            {DOTS.map(([cx, cy, r]) => (
              <circle key={`${cx},${cy}`} cx={cx} cy={cy} r={r} />
            ))}
          </g>
          <g
            fill="none"
            stroke="#F2F7F9"
            strokeWidth="39"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {PROMPT_LARGE.map((d) => (
              <path key={d} d={d} />
            ))}
          </g>
        </>
      )}
    </svg>
  );
}
