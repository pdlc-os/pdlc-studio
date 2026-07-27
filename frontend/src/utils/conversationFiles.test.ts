import { describe, it, expect } from "vitest";
import {
  collectConversationFiles,
  parseAttachedPaths,
} from "./conversationFiles";
import { withAttachments } from "../hooks/useAttachments";
import type { AllMessage } from "../types";

function userMessage(content: string, timestamp: number): AllMessage {
  return { type: "chat", role: "user", content, timestamp };
}

function toolMessage(
  toolName: string,
  filePath: string | undefined,
  timestamp: number,
  redirectPaths?: string[],
): AllMessage {
  return {
    type: "tool",
    content: `${toolName}(...)`,
    timestamp,
    toolName,
    ...(filePath ? { filePath } : {}),
    ...(redirectPaths ? { redirectPaths } : {}),
  };
}

describe("parseAttachedPaths", () => {
  it("round-trips what withAttachments writes", () => {
    // The parser and the writer must agree; asserting against a hand-written
    // string would let them drift apart.
    const message = withAttachments("look at this", [
      { name: "a.txt", path: "/tmp/x/a.txt", size: 1 },
      { name: "b.csv", path: "/tmp/x/b.csv", size: 2 },
    ]);

    expect(parseAttachedPaths(message)).toEqual([
      "/tmp/x/a.txt",
      "/tmp/x/b.csv",
    ]);
  });

  it("handles the single-file wording", () => {
    const message = withAttachments("one", [
      { name: "a.txt", path: "/tmp/x/a.txt", size: 1 },
    ]);

    expect(parseAttachedPaths(message)).toEqual(["/tmp/x/a.txt"]);
  });

  it("finds nothing in ordinary prose", () => {
    expect(parseAttachedPaths("just a message")).toEqual([]);
    expect(parseAttachedPaths("- /looks/like/a/list")).toEqual([]);
  });
});

describe("collectConversationFiles", () => {
  it("lists attached and generated files in the order they appeared", () => {
    const files = collectConversationFiles([
      userMessage(
        withAttachments("review", [
          { name: "spec.md", path: "/tmp/a/spec.md", size: 1 },
        ]),
        100,
      ),
      toolMessage("Write", "/project/out.ts", 200),
      toolMessage("Edit", "/project/other.ts", 300),
    ]);

    expect(files.map((f) => [f.name, f.origin])).toEqual([
      ["spec.md", "attached"],
      ["out.ts", "generated"],
      ["other.ts", "generated"],
    ]);
  });

  it("ignores tools that only read", () => {
    // Read carries file_path too; listing it would claim Claude produced a
    // file it merely opened.
    const files = collectConversationFiles([
      toolMessage("Read", undefined, 100),
      toolMessage("Bash", undefined, 200),
    ]);

    expect(files).toEqual([]);
  });

  it("de-duplicates a file written more than once, keeping the first time", () => {
    const files = collectConversationFiles([
      toolMessage("Write", "/project/out.ts", 100),
      toolMessage("Edit", "/project/out.ts", 500),
    ]);

    expect(files).toHaveLength(1);
    expect(files[0].timestamp).toBe(100);
  });

  it("ignores attachment blocks in assistant messages", () => {
    // Only the user attaches files; the same words from Claude are just prose.
    const assistant: AllMessage = {
      type: "chat",
      role: "assistant",
      content: "The user attached these files:\n- /etc/passwd\n",
      timestamp: 100,
    };

    expect(collectConversationFiles([assistant])).toEqual([]);
  });

  it("returns nothing for a conversation with no files", () => {
    expect(collectConversationFiles([userMessage("hello", 1)])).toEqual([]);
  });
});

describe("collectConversationFiles with shell redirections", () => {
  it("lists a file a Bash command redirected into", () => {
    // No structured path exists for these — without the inference they were
    // simply missing from the tab.
    const files = collectConversationFiles(
      [toolMessage("Bash", undefined, 100, ["/Users/dev/project/out.txt"])],
      "/proj",
    );

    expect(files.map((f) => [f.name, f.origin])).toEqual([
      ["out.txt", "generated"],
    ]);
  });

  it("resolves a relative target against the working directory", () => {
    const files = collectConversationFiles(
      [toolMessage("Bash", undefined, 100, ["notes.md"])],
      "/proj",
    );

    expect(files[0].path).toBe("/proj/notes.md");
  });

  it("drops a relative target when there is no working directory", () => {
    expect(
      collectConversationFiles([
        toolMessage("Bash", undefined, 100, ["notes.md"]),
      ]),
    ).toEqual([]);
  });

  it("does not double-list a file both written and redirected to", () => {
    const files = collectConversationFiles(
      [
        toolMessage("Write", "/proj/a.ts", 100),
        toolMessage("Bash", undefined, 200, ["/proj/a.ts"]),
      ],
      "/proj",
    );

    expect(files).toHaveLength(1);
    expect(files[0].timestamp).toBe(100);
  });
});

describe("scratch files", () => {
  /*
   * Anything under /tmp is scratch the OS reclaims, so listing it as
   * "Generated" invites opening a file that may already be gone. /var is
   * deliberately still listed — that is where kept artifacts land, and where
   * the attachment temp root lives.
   */
  it("omits files written under /tmp", () => {
    const files = collectConversationFiles(
      [toolMessage("Write", "/tmp/scratch.md", 100)],
      undefined,
    );

    expect(files.filter((f) => f.origin === "generated")).toEqual([]);
  });

  it("omits /tmp redirect targets too", () => {
    const files = collectConversationFiles(
      [toolMessage("Bash", undefined, 100, ["/private/tmp/out.txt"])],
      undefined,
    );

    expect(files.filter((f) => f.origin === "generated")).toEqual([]);
  });

  it("still lists artifacts under /var", () => {
    const files = collectConversationFiles(
      [toolMessage("Write", "/var/folders/zz/T/report.md", 100)],
      undefined,
    );

    expect(files.map((f) => f.name)).toContain("report.md");
  });
});
