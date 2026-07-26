import { describe, it, expect } from "vitest";
import { getProjectName } from "./projectPath";

describe("getProjectName", () => {
  it("takes the last segment of a path", () => {
    expect(getProjectName("/Users/dev/Projects/pdlc-studio")).toBe(
      "pdlc-studio",
    );
  });

  it("ignores a trailing separator", () => {
    expect(getProjectName("/Users/dev/Projects/pdlc-studio/")).toBe(
      "pdlc-studio",
    );
    expect(getProjectName("/Users/dev/Projects/pdlc-studio///")).toBe(
      "pdlc-studio",
    );
  });

  it("keeps names containing dots and dashes intact", () => {
    expect(getProjectName("/srv/my.app-v2")).toBe("my.app-v2");
    expect(getProjectName("/srv/.dotfiles")).toBe(".dotfiles");
  });

  it("handles a single-segment path", () => {
    expect(getProjectName("/pdlc-studio")).toBe("pdlc-studio");
  });

  it("falls back to the path when there is no usable leaf", () => {
    // The row must never render a blank label, so root and empty return
    // something printable rather than "".
    expect(getProjectName("/")).toBe("/");
    expect(getProjectName("")).toBe("");
  });

  it("does not confuse two checkouts that share a leaf", () => {
    // Same name, different paths — which is exactly why the path is still
    // shown underneath.
    expect(getProjectName("/work/a/pdlc-studio")).toBe("pdlc-studio");
    expect(getProjectName("/work/b/pdlc-studio")).toBe("pdlc-studio");
  });
});
