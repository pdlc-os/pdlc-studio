/**
 * Static-serving tests.
 *
 * The SPA fallback answers every unmatched path with index.html and a 200,
 * which makes status codes useless for telling "served" from "silently fell
 * through". These tests assert on the *body*: a request for a real file must
 * come back as that file, not as HTML wearing a 200.
 */

import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "./app";
import { NodeRuntime } from "./runtime/node";

const INDEX_HTML = "<!doctype html><html><body>app shell</body></html>";
const FAVICON_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg"><circle r="1"/></svg>';
const BUNDLE_JS = "console.log('bundle');";

describe("static file serving", () => {
  let staticPath: string;

  /** A dist/static tree shaped like the one Vite produces. */
  beforeEach(async () => {
    staticPath = await mkdtemp(join(tmpdir(), "pdlc-static-"));
    await writeFile(join(staticPath, "index.html"), INDEX_HTML);
    await writeFile(join(staticPath, "pdlc-studio-favicon.svg"), FAVICON_SVG);
    await mkdir(join(staticPath, "assets"));
    await writeFile(join(staticPath, "assets", "index-abc123.js"), BUNDLE_JS);
  });

  afterEach(async () => {
    await rm(staticPath, { recursive: true, force: true });
  });

  const app = () =>
    createApp(new NodeRuntime(), {
      debugMode: false,
      staticPath,
      cliPath: "/usr/bin/false",
    });

  it("serves root-level public files rather than the SPA shell", async () => {
    // Regression: these were mounted only under /assets/*, so the favicon fell
    // through to the SPA handler and every icon request returned HTML with a
    // 200 — invisible to a status-code check, and the tab just showed no icon.
    const res = await app().request("http://localhost/pdlc-studio-favicon.svg");

    expect(res.status).toBe(200);
    expect(await res.text()).toBe(FAVICON_SVG);
  });

  it("serves hashed build output from /assets", async () => {
    const res = await app().request("http://localhost/assets/index-abc123.js");

    expect(res.status).toBe(200);
    expect(await res.text()).toBe(BUNDLE_JS);
  });

  it("falls back to the SPA shell for client-side routes", async () => {
    const res = await app().request(
      "http://localhost/projects/Users/someone/code",
    );

    expect(res.status).toBe(200);
    expect(await res.text()).toContain("app shell");
  });

  it("falls back to the SPA shell for a missing file", async () => {
    // The file-shaped mount must call next() on a miss rather than 404, or one
    // stale asset reference would break the page instead of one request.
    const res = await app().request("http://localhost/not-here.svg");

    expect(res.status).toBe(200);
    expect(await res.text()).toContain("app shell");
  });

  it("does not let static serving swallow API routes", async () => {
    const res = await app().request("http://localhost/api/nope.json");

    expect(res.status).toBe(404);
    expect(await res.text()).toBe("Not found");
  });
});
