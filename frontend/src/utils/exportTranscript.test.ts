import { describe, it, expect } from "vitest";
import {
  transcriptToHtml,
  transcriptToMarkdown,
  transcriptFilename,
  type TranscriptMeta,
} from "./exportTranscript";
import type { AllMessage } from "../types";

const META: TranscriptMeta = {
  title: "Fix the parser",
  sessionId: "22d0db63-3fe8-4acf-98ec-151b228846d2",
  workingDirectory: "/Users/dev/project",
  exportedAt: Date.parse("2026-07-26T14:30:00Z"),
};

function chat(role: "user" | "assistant", content: string): AllMessage {
  return { type: "chat", role, content, timestamp: META.exportedAt };
}

describe("transcriptToMarkdown", () => {
  it("puts the conversation's identity at the top", () => {
    const md = transcriptToMarkdown([chat("user", "hi")], META);

    expect(md).toContain("# Fix the parser");
    expect(md).toContain("/Users/dev/project");
    expect(md).toContain(META.sessionId);
  });

  it("labels who said what", () => {
    const md = transcriptToMarkdown(
      [chat("user", "run the tests"), chat("assistant", "Done.")],
      META,
    );

    expect(md).toMatch(/### User .*\n\nrun the tests/);
    expect(md).toMatch(/### Claude .*\n\nDone\./);
  });

  it("keeps assistant markdown intact", () => {
    // The content is already markdown; re-escaping it would turn a code block
    // into literal backticks.
    const md = transcriptToMarkdown(
      [chat("assistant", "## Heading\n\n- item\n\n**bold**")],
      META,
    );

    expect(md).toContain("## Heading");
    expect(md).toContain("- item");
    expect(md).toContain("**bold**");
  });

  it("uses a fence long enough to survive fenced content", () => {
    // A three-backtick fence around output that itself contains ``` closes at
    // the first one and spills the rest of the transcript out as prose.
    const md = transcriptToMarkdown(
      [
        {
          type: "tool_result",
          toolName: "Read",
          summary: "README.md",
          content: "```js\nconst a = 1;\n```",
          timestamp: META.exportedAt,
        },
      ],
      META,
    );

    expect(md).toContain("````\n```js");
    expect(md.trimEnd().endsWith("````")).toBe(true);
  });

  it("renders todos as a checklist", () => {
    const md = transcriptToMarkdown(
      [
        {
          type: "todo",
          todos: [
            { content: "one", status: "completed", activeForm: "doing one" },
            { content: "two", status: "in_progress", activeForm: "doing two" },
            { content: "three", status: "pending", activeForm: "doing three" },
          ],
          timestamp: META.exportedAt,
        },
      ],
      META,
    );

    expect(md).toContain("- [x] one");
    expect(md).toContain("- [ ] two _(in progress)_");
    expect(md).toContain("- [ ] three");
  });

  it("records failures rather than reading as a clean run", () => {
    const md = transcriptToMarkdown(
      [
        {
          type: "error",
          subtype: "stream_error",
          message: "connection lost",
          timestamp: META.exportedAt,
        },
        {
          type: "system",
          subtype: "abort",
          message: "Operation was aborted by user",
          timestamp: META.exportedAt,
        },
      ],
      META,
    );

    expect(md).toContain("connection lost");
    expect(md).toContain("Aborted");
  });

  it("leaves SDK telemetry out", () => {
    const md = transcriptToMarkdown(
      [
        {
          type: "system",
          subtype: "init",
          session_id: "s1",
          model: "claude-opus-5",
          cwd: "/tmp",
          tools: [],
          timestamp: META.exportedAt,
        } as unknown as AllMessage,
        chat("user", "hello"),
      ],
      META,
    );

    expect(md).not.toContain("claude-opus-5");
    expect(md).toContain("hello");
  });
});

describe("transcriptToHtml", () => {
  it("is a standalone document with the title in it", () => {
    const html = transcriptToHtml([chat("user", "hi")], META);

    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain("<title>Fix the parser</title>");
    // Self-contained: nothing to fetch when opened years later from a folder.
    expect(html).toContain("<style>");
    expect(html).not.toMatch(/<(link|script)[\s>]/);
  });

  it("renders the markdown rather than printing it", () => {
    const html = transcriptToHtml(
      [chat("assistant", "## Heading\n\n- item")],
      META,
    );

    expect(html).toContain("<h2>Heading</h2>");
    expect(html).toContain("<li>item</li>");
  });

  it("does not carry script out of the conversation into the file", () => {
    // Claude quotes what it reads; a page or repo file can contain this.
    const html = transcriptToHtml(
      [chat("assistant", 'Found: <img src=x onerror="alert(1)"> and more')],
      META,
    );

    expect(html).not.toContain("onerror");
    expect(html).not.toContain("alert(1)");
  });

  it("escapes the title instead of letting it break out", () => {
    const html = transcriptToHtml([chat("user", "x")], {
      ...META,
      title: "</title><script>alert(1)</script>",
    });

    expect(html).not.toContain("<script>");
  });
});

describe("transcriptFilename", () => {
  it("slugs the title and stamps the time", () => {
    // The stamp is local time — the filename is read in the timezone it was
    // saved in — so assert its shape rather than a fixed hour.
    expect(transcriptFilename(META, "md")).toMatch(
      /^fix-the-parser-\d{8}-\d{4}\.md$/,
    );
  });

  it("falls back when the title has nothing sluggable", () => {
    expect(transcriptFilename({ ...META, title: "🎉🎉" }, "html")).toMatch(
      /^transcript-/,
    );
  });
});
