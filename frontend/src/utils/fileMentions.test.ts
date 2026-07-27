import { describe, it, expect } from "vitest";
import {
  applyMention,
  attachmentName,
  filterAttachments,
  getMentionQuery,
  mentionText,
} from "./fileMentions";
import type { AttachmentInfo } from "../types";

function attachment(path: string): AttachmentInfo {
  return { path, name: path.split("/").pop() ?? path, size: 10 };
}

describe("getMentionQuery", () => {
  it("finds a mention being typed at the caret", () => {
    expect(getMentionQuery("@scr", 4)).toEqual({
      query: "scr",
      start: 0,
      end: 4,
    });
  });

  it("finds one mid-sentence, which is the whole point", () => {
    const value = "compare @scr";
    expect(getMentionQuery(value, value.length)).toEqual({
      query: "scr",
      start: 8,
      end: 12,
    });
  });

  it("opens on a bare @ before anything is typed", () => {
    expect(getMentionQuery("look at @", 9)).toMatchObject({ query: "" });
  });

  it("closes once the token ends", () => {
    // The caret has moved on to the next word.
    expect(getMentionQuery("@notes.md and", 13)).toBeNull();
  });

  it("ignores an @ that does not begin a word", () => {
    // An email address, or a decorator in pasted code.
    expect(getMentionQuery("mail me@example.com", 19)).toBeNull();
    expect(getMentionQuery("@Component", 10)).toMatchObject({
      query: "Component",
    });
  });

  it("reads the token at the caret, not the last one in the line", () => {
    const value = "@first and @second";
    // Caret parked right after "@first".
    expect(getMentionQuery(value, 6)).toMatchObject({ query: "first" });
  });

  it("returns null when there is no @ at all", () => {
    expect(getMentionQuery("no mentions here", 16)).toBeNull();
  });
});

describe("filterAttachments", () => {
  const files = [
    attachment("/tmp/a/report.pdf"),
    attachment("/tmp/a/screenshot.png"),
    attachment("/tmp/a/notes.md"),
  ];

  it("offers everything for a bare @", () => {
    expect(filterAttachments(files, "")).toHaveLength(3);
  });

  it("matches on the filename, not the directory", () => {
    expect(filterAttachments(files, "tmp")).toEqual([]);
    expect(filterAttachments(files, "note").map(attachmentName)).toEqual([
      "notes.md",
    ]);
  });

  it("is case-insensitive", () => {
    expect(filterAttachments(files, "SCREEN").map(attachmentName)).toEqual([
      "screenshot.png",
    ]);
  });

  it("puts a prefix match ahead of one in the middle", () => {
    const candidates = [
      attachment("/tmp/my-report.pdf"),
      attachment("/tmp/report.pdf"),
    ];

    expect(filterAttachments(candidates, "report").map(attachmentName)).toEqual(
      ["report.pdf", "my-report.pdf"],
    );
  });
});

describe("mentionText", () => {
  it("inserts the bare filename", () => {
    const files = [attachment("/tmp/a/notes.md")];
    expect(mentionText(files[0], files)).toBe("@notes.md");
  });

  it("falls back to the full path when the name is ambiguous", () => {
    // The message's path block cannot disambiguate two files with the same
    // name, so the mention has to.
    const files = [
      attachment("/tmp/a/notes.md"),
      attachment("/tmp/b/notes.md"),
    ];

    expect(mentionText(files[0], files)).toBe("@/tmp/a/notes.md");
  });
});

describe("applyMention", () => {
  it("replaces the token in place and leaves the caret after it", () => {
    const value = "compare @scr with the other";
    const token = getMentionQuery("compare @scr", 12)!;

    const result = applyMention(value, token, "@screenshot.png");

    expect(result.value).toBe("compare @screenshot.png  with the other");
    expect(result.value.slice(0, result.caret)).toBe(
      "compare @screenshot.png ",
    );
  });

  it("closes the picker by ending the token with a space", () => {
    const token = getMentionQuery("@no", 3)!;

    const { value, caret } = applyMention("@no", token, "@notes.md");

    expect(value).toBe("@notes.md ");
    expect(getMentionQuery(value, caret)).toBeNull();
  });
});
