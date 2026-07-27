import { describe, it, expect } from "vitest";
import { sanitizeHtml } from "./sanitizeHtml";

describe("sanitizeHtml", () => {
  it("keeps the markup a transcript is made of", () => {
    const html =
      "<h1>Title</h1><p><strong>bold</strong> <em>it</em> <code>x</code></p>" +
      '<pre><code class="language-ts">const a = 1;</code></pre>' +
      "<ul><li>one</li></ul><blockquote><p>q</p></blockquote>";

    expect(sanitizeHtml(html)).toBe(html);
  });

  it("drops script elements and their source", () => {
    // Unwrapping would paste the source in as visible text, which is why
    // these are removed whole rather than replaced by their children.
    const out = sanitizeHtml('<p>hi</p><script>alert("x")</script>');

    expect(out).toBe("<p>hi</p>");
    expect(out).not.toContain("alert");
  });

  it("drops style, iframe and svg", () => {
    const out = sanitizeHtml(
      "<style>body{display:none}</style><iframe src='x'></iframe><svg><script/></svg><p>kept</p>",
    );

    expect(out).toBe("<p>kept</p>");
  });

  it("strips event handlers", () => {
    const out = sanitizeHtml('<p onclick="steal()" onmouseover="x()">text</p>');

    expect(out).toBe("<p>text</p>");
  });

  it("removes javascript: urls but keeps the link text", () => {
    const out = sanitizeHtml('<a href="javascript:alert(1)">click</a>');

    expect(out).toContain("click");
    expect(out).not.toContain("javascript:");
  });

  it("sees through whitespace and control characters in a scheme", () => {
    // "java\tscript:" is the classic way past a startsWith check; the parser
    // has already decoded the entity by the time we inspect the attribute.
    const out = sanitizeHtml('<a href="java\tscript:alert(1)">x</a>');

    expect(out).not.toContain("script:");
  });

  it("keeps ordinary links, and stops them handing over the opener", () => {
    const out = sanitizeHtml('<a href="https://example.com">x</a>');

    expect(out).toContain('href="https://example.com"');
    expect(out).toContain('rel="noopener noreferrer"');
  });

  it("keeps inline images but not inline documents", () => {
    expect(sanitizeHtml('<img src="data:image/png;base64,AAA">')).toContain(
      "data:image/png",
    );
    // An SVG data URL is a document that can carry script, image type or not.
    expect(
      sanitizeHtml('<img src="data:image/svg+xml;base64,AAA">'),
    ).not.toContain("data:");
    expect(sanitizeHtml('<a href="data:text/html,<b>x">y</a>')).not.toContain(
      "data:",
    );
  });

  it("unwraps unknown tags instead of losing their text", () => {
    const out = sanitizeHtml("<marquee><p>still here</p></marquee>");

    expect(out).toBe("<p>still here</p>");
  });

  it("sanitizes nested content, not just the top level", () => {
    const out = sanitizeHtml(
      '<blockquote><p><a href="javascript:x()" onclick="y()">deep</a></p></blockquote>',
    );

    expect(out).not.toContain("javascript:");
    expect(out).not.toContain("onclick");
    expect(out).toContain("deep");
  });
});
