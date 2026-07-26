import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { AppIcon } from "./AppIcon";

/**
 * The mark exists in three places at once: the canonical SVGs in `brand/`, the
 * copies `frontend/public/` serves as favicon and apple-touch-icon, and the
 * geometry `AppIcon` inlines so the component cannot flash in late on a cold
 * load. That duplication is deliberate, but it only stays safe if something
 * fails when the copies drift — otherwise a mark edited in one place ships
 * looking like two different products.
 */

/**
 * Walk up from the working directory to the repo root rather than assuming it.
 * Vitest's cwd is `frontend/` under `make test-frontend` but the repo root when
 * run from there, and `import.meta.url` is not reliable in this environment.
 */
const repoRoot = (() => {
  let dir = process.cwd();
  while (!existsSync(join(dir, "brand", "pdlc-studio-mark.svg"))) {
    const parent = dirname(dir);
    if (parent === dir) throw new Error("Could not locate the repo root");
    dir = parent;
  }
  return dir;
})();

const repoFile = (relative: string) =>
  readFileSync(resolve(repoRoot, relative), "utf-8");

/** `cx`, `cy`, `r` of every circle, as a comparable set. */
const circlesIn = (svg: string) =>
  new Set(
    [...svg.matchAll(/<circle[^>]*?>/g)].map((match) => {
      const attr = (name: string) =>
        Number(new RegExp(`\\b${name}="([\\d.]+)"`).exec(match[0])?.[1]);
      return `${attr("cx")},${attr("cy")},${attr("r")}`;
    }),
  );

/** Every `d` attribute, whitespace-normalised. */
const pathsIn = (svg: string) =>
  new Set(
    [...svg.matchAll(/\sd="([^"]+)"/g)].map((m) =>
      m[1].replace(/\s+/g, " ").trim(),
    ),
  );

const renderedSvg = (size: number) => {
  const { container } = render(<AppIcon size={size} />);
  const svg = container.querySelector("svg");
  if (!svg) throw new Error("AppIcon rendered no <svg>");
  return svg;
};

describe("AppIcon", () => {
  describe("stays in sync with brand/", () => {
    it("serves the display mark byte-for-byte from brand/", () => {
      expect(repoFile("frontend/public/pdlc-studio-mark.svg")).toBe(
        repoFile("brand/pdlc-studio-mark.svg"),
      );
    });

    it("serves the favicon byte-for-byte from brand/", () => {
      expect(repoFile("frontend/public/pdlc-studio-favicon.svg")).toBe(
        repoFile("brand/pdlc-studio-mark-small.svg"),
      );
    });

    it("inlines the display mark's dots and prompt unchanged", () => {
      const source = repoFile("brand/pdlc-studio-mark.svg");
      const svg = renderedSvg(88);

      expect(circlesIn(svg.outerHTML)).toEqual(circlesIn(source));
      expect(pathsIn(svg.outerHTML)).toEqual(pathsIn(source));
    });

    it("inlines the small mark's prompt unchanged", () => {
      const source = repoFile("brand/pdlc-studio-mark-small.svg");
      const svg = renderedSvg(22);

      expect(pathsIn(svg.outerHTML)).toEqual(pathsIn(source));
    });
  });

  describe("optical sizes", () => {
    // The threshold is the whole reason two drawings exist: 22 dots plus a
    // glyph is more detail than a 22px header icon can resolve.
    it("drops the dot ring below the threshold", () => {
      expect(renderedSvg(22).querySelectorAll("circle")).toHaveLength(0);
    });

    it("keeps the dot ring at and above the threshold", () => {
      expect(renderedSvg(32).querySelectorAll("circle").length).toBeGreaterThan(
        0,
      );
    });

    it("forces the dot ring below the threshold when asked", () => {
      // The chat header does this: the ring's presence matters more there than
      // the satellites it loses at 28px.
      const svg = render(
        <AppIcon size={28} variant="mark" />,
      ).container.querySelector("svg")!;

      expect(svg.querySelectorAll("circle").length).toBeGreaterThan(0);
    });

    it("forces the small drawing above the threshold when asked", () => {
      const svg = render(
        <AppIcon size={88} variant="small" />,
      ).container.querySelector("svg")!;

      expect(svg.querySelectorAll("circle")).toHaveLength(0);
    });

    it("renders at the requested size in both drawings", () => {
      for (const size of [16, 22, 32, 88]) {
        const svg = renderedSvg(size);
        expect(svg.getAttribute("width")).toBe(String(size));
        expect(svg.getAttribute("height")).toBe(String(size));
      }
    });
  });

  describe("gradient wiring", () => {
    // Under the default objectBoundingBox each dot would get the whole ramp
    // across its own few pixels, and the ring would come out muddy.
    it("anchors the sweep to the canvas, not to each dot", () => {
      const gradient = renderedSvg(88).querySelector("linearGradient");
      expect(gradient?.getAttribute("gradientUnits")).toBe("userSpaceOnUse");
    });

    it("gives concurrent instances distinct gradient ids", () => {
      const { container } = render(
        <>
          <AppIcon size={88} />
          <AppIcon size={88} />
        </>,
      );
      const ids = [...container.querySelectorAll("linearGradient")].map((g) =>
        g.getAttribute("id"),
      );

      expect(ids).toHaveLength(2);
      expect(new Set(ids).size).toBe(2);
    });

    it("keeps the gradient id valid in an XML Name", () => {
      // useId returns ":r1:" on React 18 and "«r1d»" on 19; neither colons nor
      // guillemets are legal NameChars. Browsers match url(#...) as an opaque
      // string and let it slide, so nothing visibly breaks until something
      // stricter parses the markup.
      const id = renderedSvg(88)
        .querySelector("linearGradient")
        ?.getAttribute("id");

      expect(id).toMatch(/^[A-Za-z][A-Za-z0-9-]*$/);
    });

    it("points each mark at its own gradient", () => {
      const svg = renderedSvg(88);
      const id = svg.querySelector("linearGradient")?.getAttribute("id");
      const dots = svg.querySelector("g[fill^='url(']");

      expect(dots?.getAttribute("fill")).toBe(`url(#${id})`);
    });
  });

  describe("accessibility", () => {
    it("is hidden from assistive tech when unlabelled", () => {
      const svg = renderedSvg(88);
      expect(svg.getAttribute("aria-hidden")).toBe("true");
      expect(svg.getAttribute("role")).toBeNull();
    });

    it("is exposed as an image when labelled", () => {
      const { container } = render(<AppIcon size={88} label="PDLC Studio" />);
      const svg = container.querySelector("svg");

      expect(svg?.getAttribute("role")).toBe("img");
      expect(svg?.getAttribute("aria-label")).toBe("PDLC Studio");
      expect(svg?.getAttribute("aria-hidden")).toBeNull();
    });
  });
});
