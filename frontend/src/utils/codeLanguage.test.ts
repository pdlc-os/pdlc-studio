import { describe, it, expect } from "vitest";
import { languageFromPath } from "./codeLanguage";

describe("languageFromPath", () => {
  it("maps common source extensions", () => {
    expect(languageFromPath("/src/app.ts")).toBe("typescript");
    expect(languageFromPath("/src/App.tsx")).toBe("tsx");
    expect(languageFromPath("/scripts/build.mjs")).toBe("javascript");
    expect(languageFromPath("/api/main.py")).toBe("python");
    expect(languageFromPath("/deploy/values.yaml")).toBe("yaml");
  });

  it("uses the last extension on a multi-dot filename", () => {
    // "component.test.ts" is TypeScript, not a language called "test".
    expect(languageFromPath("/src/component.test.ts")).toBe("typescript");
  });

  it("is case insensitive", () => {
    expect(languageFromPath("/docs/README.MD")).toBe("markdown");
  });

  it("recognises extensionless files by name", () => {
    expect(languageFromPath("/app/Dockerfile")).toBe("bash");
    expect(languageFromPath("/home/me/.zshrc")).toBe("zsh");
  });

  it("returns undefined when nothing is known", () => {
    // Better than guessing: an unknown language renders plain either way, and
    // undefined also keeps a wrong label off the header.
    expect(languageFromPath("/data/archive.bin")).toBeUndefined();
    expect(languageFromPath("/no/extension")).toBeUndefined();
    expect(languageFromPath("/trailing.")).toBeUndefined();
    expect(languageFromPath(undefined)).toBeUndefined();
    expect(languageFromPath("")).toBeUndefined();
  });
});
