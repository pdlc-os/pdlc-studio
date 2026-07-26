import { describe, it, expect } from "vitest";
import {
  deriveRepositoryName,
  isValidProjectName,
  resolveBrowsePath,
  validateGitUrl,
} from "./paths";

describe("resolveBrowsePath", () => {
  it("defaults to the home directory when no path is given", () => {
    // The launch screen opens the picker with no path at all.
    expect(resolveBrowsePath(undefined)).toBe(process.env.HOME);
    expect(resolveBrowsePath("")).toBe(process.env.HOME);
  });

  it("expands a leading tilde", () => {
    expect(resolveBrowsePath("~")).toBe(process.env.HOME);
    expect(resolveBrowsePath("~/Projects")).toBe(
      `${process.env.HOME}/Projects`,
    );
  });

  it("accepts paths containing spaces and hyphens", () => {
    // Regression guard: an over-broad control-character class previously
    // rejected these, which would have made most real paths unbrowsable.
    expect(resolveBrowsePath("/Users/dev/My Project")).toBe(
      "/Users/dev/My Project",
    );
    expect(resolveBrowsePath("/tmp/some-dir")).toBe("/tmp/some-dir");
  });

  it("normalises relative segments", () => {
    expect(resolveBrowsePath("/tmp/x/../y")).toBe("/tmp/y");
  });

  it("rejects relative paths", () => {
    expect(resolveBrowsePath("relative/path")).toBeNull();
    expect(resolveBrowsePath("./x")).toBeNull();
  });
});

describe("isValidProjectName", () => {
  it("accepts ordinary directory names", () => {
    expect(isValidProjectName("my-app")).toBe(true);
    expect(isValidProjectName("My Project")).toBe(true);
  });

  it("rejects anything that is not a single name", () => {
    // A separator would let the name target a nested or sibling path.
    expect(isValidProjectName("a/b")).toBe(false);
    expect(isValidProjectName("a\\b")).toBe(false);
    expect(isValidProjectName(".")).toBe(false);
    expect(isValidProjectName("..")).toBe(false);
    expect(isValidProjectName("")).toBe(false);
    expect(isValidProjectName("   ")).toBe(false);
    expect(isValidProjectName("x".repeat(256))).toBe(false);
  });
});

describe("validateGitUrl", () => {
  it("accepts the supported remote forms", () => {
    for (const url of [
      "https://github.com/owner/repo.git",
      "http://example.com/repo.git",
      "ssh://git@example.com/owner/repo",
      "git://example.com/repo.git",
      "git@github.com:owner/repo.git",
    ]) {
      expect(validateGitUrl(url)).toBe(url);
    }
  });

  it("rejects a URL that git would read as an option", () => {
    // runCommand uses an argv array so there is no shell to inject into, but a
    // leading dash would still be parsed by git as a flag.
    expect(validateGitUrl("--upload-pack=touch /tmp/pwned")).toBeNull();
    expect(validateGitUrl("-o something")).toBeNull();
  });

  it("rejects unsupported schemes and malformed input", () => {
    expect(validateGitUrl("ftp://example.com/repo.git")).toBeNull();
    expect(validateGitUrl("file:///tmp/repo")).toBeNull();
    expect(validateGitUrl("just-a-string")).toBeNull();
    expect(validateGitUrl("https://example.com/a b")).toBeNull();
    expect(validateGitUrl("")).toBeNull();
  });
});

describe("deriveRepositoryName", () => {
  it("mirrors the directory name git clone would choose", () => {
    expect(deriveRepositoryName("https://github.com/owner/repo.git")).toBe(
      "repo",
    );
    expect(deriveRepositoryName("https://github.com/owner/repo")).toBe("repo");
    expect(deriveRepositoryName("https://github.com/owner/repo/")).toBe("repo");
    expect(deriveRepositoryName("git@github.com:owner/repo.git")).toBe("repo");
  });
});
