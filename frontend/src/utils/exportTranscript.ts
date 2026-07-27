import dayjs from "dayjs";
import { marked } from "marked";
import { sanitizeHtml } from "./sanitizeHtml";
import type { AllMessage, TodoItem, ToolResultMessage } from "../types";

export type ExportFormat = "markdown" | "html" | "pdf";

export interface TranscriptMeta {
  title: string;
  sessionId: string | null;
  workingDirectory: string | null;
  /** Export time, injected so the serializers stay pure and testable. */
  exportedAt: number;
}

/**
 * Fences that will not be closed early by the content they wrap.
 *
 * Tool output routinely contains ``` — a diff of this very file would — and a
 * three-backtick fence around it ends at the first one, spilling the rest of
 * the transcript out as prose. CommonMark lets a fence be any run of three or
 * more backticks and closes it only on a run at least as long, so pick one
 * longer than anything inside.
 */
function fence(content: string): string {
  const longest = [...content.matchAll(/`+/g)].reduce(
    (max, [run]) => Math.max(max, run.length),
    0,
  );
  return "`".repeat(Math.max(3, longest + 1));
}

function codeBlock(content: string, language = ""): string {
  const marker = fence(content);
  return `${marker}${language}\n${content.replace(/\n+$/, "")}\n${marker}`;
}

function quote(content: string): string {
  return content
    .split("\n")
    .map((line) => (line ? `> ${line}` : ">"))
    .join("\n");
}

function todoList(todos: TodoItem[]): string {
  return todos
    .map((todo) => {
      const mark = todo.status === "completed" ? "x" : " ";
      const note = todo.status === "in_progress" ? " _(in progress)_" : "";
      return `- [${mark}] ${todo.content}${note}`;
    })
    .join("\n");
}

/**
 * Tool results are the bulk of a long transcript and the least readable part
 * of it, so they go in a code block under their one-line summary rather than
 * inline.
 */
function toolResult(message: ToolResultMessage): string {
  const heading = `**${message.toolName} result** — ${message.summary}`;
  if (!message.content.trim()) return heading;
  return `${heading}\n\n${codeBlock(message.content)}`;
}

function messageToMarkdown(message: AllMessage): string | null {
  const time = dayjs(message.timestamp).format("HH:mm:ss");

  switch (message.type) {
    case "chat":
      return `### ${message.role === "user" ? "User" : "Claude"} · ${time}\n\n${message.content}`;

    case "thinking":
      // A thinking block can arrive empty, which would render as a heading
      // over an empty quote mark.
      return message.content.trim()
        ? `#### Thinking\n\n${quote(message.content)}`
        : null;

    case "plan":
      return `#### Plan\n\n${message.plan}`;

    case "todo":
      return `#### Todos\n\n${todoList(message.todos)}`;

    case "tool":
      return `**Tool** \`${message.content}\``;

    case "tool_result":
      return toolResult(message);

    // A stream error carries `type: "error"` rather than "system", despite
    // being part of the SystemMessage union.
    case "error":
      return `> **Error** — ${message.message}`;

    case "system": {
      // An abort belongs in the transcript: one that silently dropped it would
      // read as though the turn simply ended. Everything else under `system`
      // is SDK telemetry — init banners, result summaries, hook chatter —
      // which is not conversation and would bury the parts that are.
      if ("subtype" in message && message.subtype === "abort") {
        return `> **Aborted** — ${message.message}`;
      }
      return null;
    }

    default:
      return null;
  }
}

export function transcriptToMarkdown(
  messages: AllMessage[],
  meta: TranscriptMeta,
): string {
  const header = [
    `# ${meta.title}`,
    "",
    ...(meta.workingDirectory
      ? [`- **Project:** ${meta.workingDirectory}`]
      : []),
    ...(meta.sessionId ? [`- **Session:** \`${meta.sessionId}\``] : []),
    `- **Exported:** ${dayjs(meta.exportedAt).format("YYYY-MM-DD HH:mm")}`,
    "",
    "---",
  ].join("\n");

  const body = messages
    .map(messageToMarkdown)
    .filter((section): section is string => section !== null)
    .join("\n\n");

  return `${header}\n\n${body}\n`;
}

/**
 * Deliberately plain and self-contained.
 *
 * The app's own stylesheet is ~160 kB of design-system tokens built for a
 * scrolling app shell, and an exported file has to survive being opened from
 * a Downloads folder years later and printed. So this is a small sheet in the
 * app's colours rather than a copy of it, and it commits to light: a page
 * printed from a dark theme is a wall of ink.
 */
const DOCUMENT_STYLES = `
  :root { color-scheme: light; }
  body {
    margin: 0 auto;
    padding: 2.5rem 1.5rem 4rem;
    max-width: 46rem;
    font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
    font-size: 15px;
    line-height: 1.65;
    color: #1c1c1c;
    background: #fff;
  }
  h1 { font-size: 1.6rem; margin: 0 0 1rem; }
  h3 {
    font-size: 1rem;
    margin: 2rem 0 0.5rem;
    padding-top: 1rem;
    border-top: 1px solid #e6e6e6;
    color: #111;
  }
  h4 { font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.04em;
       color: #6b6b6b; margin: 1.25rem 0 0.4rem; }
  hr { border: 0; border-top: 1px solid #e6e6e6; margin: 1.5rem 0; }
  a { color: #2c5fd6; }
  code {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.875em;
    background: #f4f4f5;
    padding: 0.1em 0.3em;
    border-radius: 4px;
  }
  pre {
    background: #f7f7f8;
    border: 1px solid #e6e6e6;
    border-radius: 8px;
    padding: 0.85rem 1rem;
    overflow-x: auto;
    /* An archive should not hide what it archived, but a single 4000-column
       log line should not stretch the page either. */
    white-space: pre-wrap;
    word-break: break-word;
  }
  pre code { background: none; padding: 0; font-size: 0.8125rem; }
  blockquote {
    margin: 0.5rem 0;
    padding: 0.1rem 0 0.1rem 0.9rem;
    border-left: 3px solid #d8d8d8;
    color: #55555f;
  }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #e6e6e6; padding: 0.4rem 0.6rem; text-align: left; }
  ul { padding-left: 1.25rem; }
  li { margin: 0.15rem 0; }
  img { max-width: 100%; }
  @media print {
    body { padding: 0; max-width: none; font-size: 11pt; }
    /* Keep a turn's heading with the turn. */
    h3, h4 { break-after: avoid; }
    pre, blockquote, li { break-inside: avoid; }
  }
`;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Renders the transcript as a standalone HTML document.
 *
 * The markdown form is the single source of truth — HTML is that, parsed —
 * so the two exports can never drift into saying different things.
 *
 * `marked` does not sanitize, and a transcript legitimately contains whatever
 * Claude read off the web or out of a repository, so the parsed result goes
 * through the sanitizer before it is written into a file the user will open.
 */
export function transcriptToHtml(
  messages: AllMessage[],
  meta: TranscriptMeta,
): string {
  const markdown = transcriptToMarkdown(messages, meta);
  const body = sanitizeHtml(
    marked.parse(markdown, { async: false, gfm: true, breaks: false }),
  );

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(meta.title)}</title>
<style>${DOCUMENT_STYLES}</style>
</head>
<body>
${body}
</body>
</html>
`;
}

/**
 * A filename that stays unique and sorts by date, since exports of a
 * conversation that is still going will otherwise collide in Downloads.
 */
export function transcriptFilename(
  meta: TranscriptMeta,
  extension: string,
): string {
  const slug =
    meta.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "transcript";

  return `${slug}-${dayjs(meta.exportedAt).format("YYYYMMDD-HHmm")}.${extension}`;
}
