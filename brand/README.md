# Brand assets

Canonical, editable source for the PDLC Studio app mark. Edit the SVGs here —
everywhere else is a copy.

## Files

| File                         | Use                               |
| ---------------------------- | --------------------------------- |
| `pdlc-studio-mark.svg`       | Display size, roughly 32px and up |
| `pdlc-studio-mark-small.svg` | Small size, below 32px            |

Two files, one identity. The display mark carries 22 dots plus a glyph, which is
more detail than a 16px favicon has pixels for — it reduces to a coloured
smudge. The small file drops the ring and grows the prompt to fill the tile.
This is an optical size, in the sense a type foundry means it, not a second
mark. The threshold lives in `AppIcon.tsx` as `SMALL_SIZE_THRESHOLD`.

## Palette

| Stop | Hex       | Position in the sweep |
| ---- | --------- | --------------------- |
| 1    | `#3992F9` | 0 (left)              |
| 2    | `#26B6D0` | 0.35                  |
| 3    | `#13D2A6` | 0.7                   |
| 4    | `#06F28C` | 1 (right)             |

Tile is `#0B1A23`; the display mark's prompt is `#F2F7F9`.

The tile is dark by necessity rather than taste — a blue-to-green sweep on a
light tile has almost no contrast. Changing the tile means rethinking the
gradient.

## Where the copies live

```
brand/pdlc-studio-mark.svg        -> frontend/public/pdlc-studio-mark.svg      (apple-touch-icon)
brand/pdlc-studio-mark-small.svg  -> frontend/public/pdlc-studio-favicon.svg   (favicon)
```

`README.md` at the repo root embeds `brand/pdlc-studio-mark.svg` directly.
`frontend/src/components/AppIcon.tsx` inlines the same geometry, because a
component that loaded the file over the network would flash in late on a cold
load.

After editing, run:

```bash
make sync-brand
```

`frontend/src/components/AppIcon.test.tsx` compares the dot positions and path
data in all three places and fails if they drift, so a forgotten sync is caught
by `make check` rather than in review.

## Editing notes

`gradientUnits="userSpaceOnUse"` on the gradient is load-bearing. Under the
default `objectBoundingBox`, every dot gets the whole blue-to-green ramp across
its own few pixels and the ring comes out uniformly muddy. The ramp is anchored
to the canvas so each dot picks up the one colour that belongs at its position.

Dot positions are generated, not hand-placed: 14 on a circle of radius 150 from
12 o'clock, radii cycling `25, 15, 21, 26, 14, 22, 18`. A 7-step cycle against
14 positions makes opposite sides of the ring mirror each other. The 8
satellites are irregular on purpose.
