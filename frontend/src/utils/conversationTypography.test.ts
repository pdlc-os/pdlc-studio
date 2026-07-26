import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createRequire } from "node:module";
import { CONVERSATION_FONTS } from "../types/settings";

/**
 * Guards the font-size values duplicated into `.conversation-typography`.
 *
 * The conversation size control cannot work by setting `font-size`: Astryx
 * sizes text from `--font-size-*` tokens, which are rem values resolved against
 * the root element and therefore immune to a container's font-size. The only
 * way to scale a subtree is to redefine those tokens inside it — which means
 * restating their base values in `index.css`.
 *
 * Restated values drift silently on a design-system upgrade: nothing would
 * break, the transcript would just stop matching the rest of the app. So parse
 * both files and compare, the same way AppIcon.test.tsx keeps the brand mark's
 * three copies honest.
 */
const require = createRequire(import.meta.url);

function readAstryxTokens(): Map<string, string> {
  // Resolved through the package rather than a hardcoded node_modules path so
  // this keeps working under a different install layout.
  const themePath = require.resolve("@astryxdesign/theme-neutral/theme.css");
  const css = readFileSync(themePath, "utf8");

  const tokens = new Map<string, string>();
  for (const [, name, value] of css.matchAll(
    /(--font-size-[a-z0-9]+)\s*:\s*([^;}]+)/g,
  )) {
    tokens.set(name, value.trim());
  }
  return tokens;
}

function readMirroredTokens(): Map<string, string> {
  // Resolved from the workspace root: under Vitest `import.meta.url` is not a
  // file:// URL, so it cannot be used as a base for a filesystem read.
  const css = readFileSync(
    resolve(process.cwd(), "src/index.css"),
    "utf8",
  ).replace(/\r\n/g, "\n");

  const block = /\.conversation-typography\s*\{([^}]*)\}/.exec(css);
  if (!block) throw new Error(".conversation-typography block not found");

  const tokens = new Map<string, string>();
  for (const [, name, value] of block[1].matchAll(
    /(--font-size-[a-z0-9]+)\s*:\s*calc\(\s*([0-9.]+rem)\s*\*/g,
  )) {
    tokens.set(name, value.trim());
  }
  return tokens;
}

describe("conversation font options", () => {
  const css = readFileSync(resolve(process.cwd(), "src/index.css"), "utf8");

  const styled = new Set(
    [...css.matchAll(/\.conversation-typography\[data-font="([^"]+)"\]/g)].map(
      ([, value]) => value,
    ),
  );

  it("gives every picker entry a font stack", () => {
    // An entry with no rule inherits whatever the previous selection left
    // behind, so choosing it appears to do nothing.
    const offered = CONVERSATION_FONTS.map((font) => font.value);
    expect([...styled].sort()).toEqual([...offered].sort());
  });

  it("declares a @font-face for every bundled family", () => {
    // A stack naming a family nothing declares silently falls through to the
    // next entry, which is how a "bundled" font quietly stops being bundled.
    const fonts = readFileSync(resolve(process.cwd(), "src/fonts.css"), "utf8");
    for (const pkg of [
      "inter",
      "montserrat",
      "arimo",
      "nunito-sans",
      "eb-garamond",
      "gelasio",
      "bitter",
      "opendyslexic",
    ]) {
      for (const weight of [400, 700]) {
        expect(fonts).toContain(
          `@fontsource/${pkg}/files/${pkg}-latin-${weight}-normal.woff2`,
        );
      }
    }
  });

  it("ships no legacy .woff alongside the woff2", () => {
    // Importing the packages' own stylesheets pulls a .woff for every .woff2,
    // which Vite emits and which nothing that can run this app would use.
    // Checked against the url() targets only — prose about .woff in the file's
    // own comments is not a reference to one.
    const fonts = readFileSync(resolve(process.cwd(), "src/fonts.css"), "utf8");
    const urls = [...fonts.matchAll(/url\("([^"]+)"\)/g)].map(([, url]) => url);

    expect(urls.length).toBeGreaterThan(0);
    expect(urls.filter((url) => !url.endsWith(".woff2"))).toEqual([]);
  });
});

describe("conversation typography scale", () => {
  const astryx = readAstryxTokens();
  const mirrored = readMirroredTokens();

  it("finds tokens in both stylesheets", () => {
    expect(astryx.size).toBeGreaterThan(0);
    expect(mirrored.size).toBeGreaterThan(0);
  });

  it("mirrors every font-size token Astryx defines", () => {
    // A token added upstream and not mirrored here would render at its
    // unscaled size inside a scaled transcript.
    expect([...mirrored.keys()].sort()).toEqual([...astryx.keys()].sort());
  });

  it("mirrors each base value exactly", () => {
    for (const [name, value] of astryx) {
      expect(`${name}=${mirrored.get(name)}`).toBe(`${name}=${value}`);
    }
  });
});
