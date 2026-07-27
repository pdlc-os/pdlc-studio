/**
 * Maps a file path to a syntax-highlighting language.
 *
 * The keys are deliberately limited to what Astryx's CodeBlock tokenizer
 * recognises. Naming a language it does not know gains nothing — the block
 * renders unhighlighted either way — but returning `undefined` keeps the
 * language label off the header rather than promising highlighting that never
 * arrives.
 */
const EXTENSION_LANGUAGES: Record<string, string> = {
  ts: "typescript",
  mts: "typescript",
  cts: "typescript",
  tsx: "tsx",
  js: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  jsx: "jsx",
  json: "json",
  jsonc: "json",
  html: "html",
  htm: "html",
  xml: "xml",
  svg: "svg",
  css: "css",
  scss: "scss",
  less: "less",
  py: "python",
  pyi: "python",
  sh: "bash",
  bash: "bash",
  zsh: "zsh",
  php: "php",
  hack: "hack",
  hh: "hack",
  yaml: "yaml",
  yml: "yaml",
  md: "markdown",
  markdown: "markdown",
};

/**
 * Filenames with no extension that still have a known syntax.
 *
 * Matched on the basename, since a dotfile's "extension" is really its whole
 * name.
 */
const FILENAME_LANGUAGES: Record<string, string> = {
  dockerfile: "bash",
  makefile: "bash",
  ".bashrc": "bash",
  ".zshrc": "zsh",
  ".gitignore": "bash",
};

/** The language for a path, or undefined when nothing is known about it. */
export function languageFromPath(path: string | undefined): string | undefined {
  if (!path) return undefined;

  const base = path.split("/").pop()?.trim().toLowerCase() ?? "";
  if (base === "") return undefined;

  if (FILENAME_LANGUAGES[base]) return FILENAME_LANGUAGES[base];

  // `lastIndexOf` rather than split: "component.test.ts" should resolve on
  // "ts", not on "test".
  const dot = base.lastIndexOf(".");
  if (dot <= 0 || dot === base.length - 1) return undefined;

  return EXTENSION_LANGUAGES[base.slice(dot + 1)];
}
