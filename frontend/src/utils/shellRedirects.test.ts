import { describe, it, expect } from "vitest";
import { parseRedirectTargets, resolveRedirectTargets } from "./shellRedirects";

describe("parseRedirectTargets", () => {
  it("finds a simple truncating redirect", () => {
    expect(parseRedirectTargets("printf 'hi' > /tmp/out.txt")).toEqual([
      "/tmp/out.txt",
    ]);
  });

  it("finds an append redirect", () => {
    expect(parseRedirectTargets("echo hi >> /tmp/log.txt")).toEqual([
      "/tmp/log.txt",
    ]);
  });

  it("handles no space before the target", () => {
    expect(parseRedirectTargets("echo hi >/tmp/out.txt")).toEqual([
      "/tmp/out.txt",
    ]);
  });

  it("finds targets across chained commands", () => {
    expect(
      parseRedirectTargets(
        "mkdir -p /tmp/d && echo a > /tmp/d/a.txt && echo b > /tmp/d/b.txt",
      ),
    ).toEqual(["/tmp/d/a.txt", "/tmp/d/b.txt"]);
  });

  it("reads a quoted target with spaces", () => {
    expect(parseRedirectTargets('echo hi > "/tmp/my file.txt"')).toEqual([
      "/tmp/my file.txt",
    ]);
  });

  it("ignores a redirect that is only inside a quoted string", () => {
    // `echo "a > b"` writes nothing; a regex over the raw text would claim it
    // wrote a file called "b".
    expect(parseRedirectTargets('echo "a > b"')).toEqual([]);
    expect(parseRedirectTargets("grep '>' file.txt")).toEqual([]);
  });

  it("ignores stderr and descriptor duplication", () => {
    expect(parseRedirectTargets("cmd 2> /tmp/err.log")).toEqual([]);
    expect(parseRedirectTargets("cmd > /tmp/out.txt 2>&1")).toEqual([
      "/tmp/out.txt",
    ]);
  });

  it("accepts an explicit stdout descriptor", () => {
    expect(parseRedirectTargets("cmd 1> /tmp/out.txt")).toEqual([
      "/tmp/out.txt",
    ]);
  });

  it("ignores /dev targets", () => {
    expect(parseRedirectTargets("cmd > /dev/null")).toEqual([]);
    expect(parseRedirectTargets("cmd > /dev/null 2>&1")).toEqual([]);
  });

  it("ignores an escaped angle bracket", () => {
    expect(parseRedirectTargets("echo a \\> b")).toEqual([]);
  });

  it("de-duplicates a target written twice", () => {
    expect(parseRedirectTargets("echo a > f.txt && echo b >> f.txt")).toEqual([
      "f.txt",
    ]);
  });

  it("returns nothing for commands that write no files", () => {
    expect(parseRedirectTargets("ls -la")).toEqual([]);
    expect(parseRedirectTargets("cat a.txt | grep x")).toEqual([]);
    expect(parseRedirectTargets(undefined)).toEqual([]);
    expect(parseRedirectTargets("")).toEqual([]);
  });
});

describe("resolveRedirectTargets", () => {
  it("keeps absolute paths", () => {
    expect(resolveRedirectTargets(["/tmp/a.txt"], "/proj")).toEqual([
      "/tmp/a.txt",
    ]);
  });

  it("resolves relative paths against the working directory", () => {
    expect(resolveRedirectTargets(["out.txt", "./b.txt"], "/proj")).toEqual([
      "/proj/out.txt",
      "/proj/b.txt",
    ]);
  });

  it("drops relative paths when there is no working directory", () => {
    // Guessing a base would produce a row pointing at a file that is not there.
    expect(resolveRedirectTargets(["out.txt"], undefined)).toEqual([]);
  });

  it("drops home-relative paths it cannot expand", () => {
    expect(resolveRedirectTargets(["~/notes.txt"], "/proj")).toEqual([]);
  });
});
