/**
 * Allowlist sanitizer for markdown-rendered HTML.
 *
 * A transcript is not trusted input. Claude reads web pages, issue threads and
 * source files, and quotes them back; anything it quoted ends up here. The
 * export writes that to a file the user opens in a browser, where an inline
 * `<script>` or an `onerror` attribute would run with whatever authority a
 * `file://` page has. The markdown renderer does not sanitize, so this does.
 *
 * Allowlist rather than blocklist: the set of tags a transcript legitimately
 * needs is small and closed, while the set of ways to smuggle script through a
 * blocklist is neither.
 */

const ALLOWED_TAGS = new Set([
  "a",
  "blockquote",
  "br",
  "code",
  "del",
  "em",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "hr",
  "img",
  "input", // GFM task lists render as a disabled checkbox
  "li",
  "ol",
  "p",
  "pre",
  "s",
  "span",
  "strong",
  "table",
  "tbody",
  "td",
  "th",
  "thead",
  "tr",
  "ul",
]);

/**
 * Dropped whole, contents and all.
 *
 * Unknown tags are unwrapped rather than deleted so their text survives, but
 * for these the *contents* are the payload: unwrapping `<script>` would paste
 * the source into the document as visible text, and unwrapping `<style>` would
 * do the same with a rule set.
 */
const DROP_WITH_CONTENT = new Set([
  "script",
  "style",
  "iframe",
  "object",
  "embed",
  "template",
  "noscript",
  "svg",
  "math",
]);

const GLOBAL_ATTRS = new Set(["class", "title"]);

const TAG_ATTRS: Record<string, Set<string>> = {
  a: new Set(["href"]),
  img: new Set(["src", "alt", "width", "height"]),
  input: new Set(["type", "checked", "disabled"]),
  td: new Set(["align", "colspan", "rowspan"]),
  th: new Set(["align", "colspan", "rowspan"]),
  ol: new Set(["start"]),
};

/**
 * URL schemes that cannot execute.
 *
 * `javascript:` is the obvious one, but a bare `data:` is equally live — a
 * `data:text/html` link opens a document with script in it — so data URLs are
 * admitted only as images, where the media type is the payload.
 */
function isSafeUrl(value: string, isImage: boolean): boolean {
  // "java&#9;script:" is how a naive prefix check gets beaten. The parser has
  // already decoded the entity by the time the attribute reaches us, so what
  // is left to strip is literal whitespace and control characters.
  // Control characters are the point of this class, not an oversight: they are
  // exactly what is used to break up a scheme.
  // eslint-disable-next-line no-control-regex
  const normalized = value.replace(/[\s\u0000-\u001f]/g, "").toLowerCase();

  if (normalized.startsWith("data:")) {
    // Inline images are worth keeping — a pasted screenshot is part of the
    // transcript. SVG is excluded despite being an image type, because it is a
    // document format and can carry script.
    return isImage && /^data:image\/(png|jpeg|gif|webp);/.test(normalized);
  }

  return !/^(javascript|vbscript|file):/.test(normalized);
}

function sanitizeElement(element: Element): void {
  const tag = element.tagName.toLowerCase();

  if (DROP_WITH_CONTENT.has(tag)) {
    element.remove();
    return;
  }

  // Depth first: unwrapping a parent must not skip the children it hoists.
  for (const child of [...element.children]) {
    sanitizeElement(child);
  }

  if (!ALLOWED_TAGS.has(tag)) {
    element.replaceWith(...element.childNodes);
    return;
  }

  const allowed = TAG_ATTRS[tag];
  for (const attr of [...element.attributes]) {
    const name = attr.name.toLowerCase();

    if (!GLOBAL_ATTRS.has(name) && !allowed?.has(name)) {
      element.removeAttribute(attr.name);
      continue;
    }

    if (
      (name === "href" || name === "src") &&
      !isSafeUrl(attr.value, tag === "img")
    ) {
      element.removeAttribute(attr.name);
    }
  }

  // A link that leaves the document should not hand the opener over with it.
  if (tag === "a" && element.hasAttribute("href")) {
    element.setAttribute("rel", "noopener noreferrer");
  }
}

export function sanitizeHtml(html: string): string {
  // text/html parsing is inert: it builds a document without running anything
  // in it, so the dangerous nodes exist only long enough to be removed.
  const doc = new DOMParser().parseFromString(
    `<!doctype html><body>${html}</body>`,
    "text/html",
  );

  for (const child of [...doc.body.children]) {
    sanitizeElement(child);
  }

  return doc.body.innerHTML;
}
