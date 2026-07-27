/**
 * The AskUserQuestion tool: Claude asks, the user picks, the turn continues.
 *
 * Claude Code's own `AskUserQuestion` is **not exposed to SDK-driven
 * sessions** — a live session reports 29 tools and it is not among them — so
 * this registers an equivalent as an in-process MCP tool rather than rendering
 * one Claude sends us.
 *
 * Two things about that were verified against a live CLI rather than assumed:
 *
 * - The tool arrives namespaced. Claude sees `mcp__<server>__AskUserQuestion`,
 *   not the bare name, so the *description* has to carry every semantic it
 *   would otherwise infer from a familiar tool — above all that "Other" is
 *   automatic and must never be authored into `options`.
 * - `alwaysLoad` is required. Without it the tool sits behind ToolSearch and
 *   Claude has to go looking for it before it can ask anything.
 *
 * The handler suspends until the user answers. A 45s suspension was measured
 * end to end: the handler resumed, the turn completed `success`, and Claude
 * used the answer. There is no timeout here by design — an unanswered question
 * holds the turn open, and Stop (which interrupts rather than kills) is the
 * escape hatch.
 */

import { Context } from "hono";
import { randomUUID } from "node:crypto";
import { createSdkMcpServer, tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { logger } from "../utils/logger.ts";

/**
 * The name Claude sees, namespaced by the MCP server it is mounted on.
 *
 * Exported because it has to be auto-allowed by name: bypassPermissions does
 * not cover MCP tools, so without this a user in YOLO mode is prompted for
 * permission before Claude may ask them a question.
 */
export const ASK_USER_QUESTION_TOOL = "mcp__pdlc__AskUserQuestion";

/** One option the user can pick. Mirrors Claude Code's own shape. */
export interface AskOption {
  label: string;
  description: string;
  /** Markdown rendered in a monospace pane; single-select questions only. */
  preview?: string;
}

export interface AskQuestion {
  question: string;
  /** Short chip beside the question. Claude Code caps this at 12 characters. */
  header: string;
  options: AskOption[];
  multiSelect: boolean;
}

/** Pushed to the frontend so it can render the card. */
export interface PendingQuestion {
  questionId: string;
  requestId: string;
  questions: AskQuestion[];
}

/** What the user chose, keyed by the question text. */
export type QuestionAnswers = Record<string, string>;

interface Waiting {
  pending: PendingQuestion;
  resolve: (answers: QuestionAnswers) => void;
}

/**
 * Questions waiting on a user.
 *
 * Keyed by questionId alone: ids are UUIDs, so a lookup cannot collide across
 * turns, and the answer endpoint does not have to know which request a
 * question belonged to in order to resolve it.
 */
const waiting = new Map<string, Waiting>();

/** Every question still unanswered, so a reloaded client can rebuild its UI. */
export function listPendingQuestions(requestId?: string): PendingQuestion[] {
  const all = [...waiting.values()].map((entry) => entry.pending);
  return requestId
    ? all.filter((question) => question.requestId === requestId)
    : all;
}

/**
 * Resolves a waiting question. Returns false when there is nothing to answer,
 * so the route can reply 404 rather than pretending it worked.
 */
export function answerQuestion(
  questionId: string,
  answers: QuestionAnswers,
): boolean {
  const entry = waiting.get(questionId);
  if (!entry) return false;

  waiting.delete(questionId);
  entry.resolve(answers);
  return true;
}

/**
 * Abandons a turn's questions.
 *
 * Called when a turn ends by any route — interrupt, abort, error. Without it a
 * suspended handler would hold its promise forever and leak the entry, and the
 * frontend would keep showing a card nothing can answer.
 */
export function cancelQuestions(requestId: string): void {
  for (const [id, entry] of waiting) {
    if (entry.pending.requestId !== requestId) continue;
    waiting.delete(id);
    entry.resolve({});
  }
}

const OPTION_SCHEMA = z.object({
  label: z.string().describe("Display text, 1-5 words."),
  description: z
    .string()
    .describe("What this option means or what happens if chosen."),
  preview: z
    .string()
    .optional()
    .describe(
      "Optional markdown rendered in a monospace pane beside the options — " +
        "mockups, code snippets, config to compare. Single-select only.",
    ),
});

const QUESTION_SCHEMA = z.object({
  question: z.string().describe("The complete question, ending in a '?'."),
  header: z
    .string()
    .describe("Very short label shown as a chip, max 12 characters."),
  options: z
    .array(OPTION_SCHEMA)
    .min(2)
    .max(4)
    .describe(
      "2-4 mutually exclusive choices. Do NOT add an 'Other' option — the " +
        "interface always provides one for free-text input.",
    ),
  multiSelect: z
    .boolean()
    .describe("True when several options may be chosen together."),
});

/**
 * Spelled out at length on purpose.
 *
 * The tool reaches Claude under a namespaced MCP name, so none of Claude
 * Code's built-in semantics come along with it. Everything the model needs to
 * use this well has to be stated here.
 */
const TOOL_DESCRIPTION = `Ask the user a multiple-choice question and wait for their answer.

Use this when you are blocked on a decision that is genuinely the user's to make: one you cannot resolve from the request, the code, or a sensible default. Do not use it for choices with an obvious convention, or for facts you can verify yourself — decide those and say what you decided.

The interface ALWAYS offers the user an "Other" escape hatch for free-text, so never include an "Other" option yourself.

If you recommend an option, put it first and end its label with "(Recommended)".

Use \`preview\` when the user needs to compare concrete artifacts — UI mockups, code variants, config. It renders as markdown in a monospace pane beside the options, and only for single-select questions.

This call blocks until the user answers, and their reply comes back keyed by question text.`;

/**
 * An MCP server exposing the tool for one turn.
 *
 * Built per request rather than once at startup so `requestId` and the stream
 * publisher can be closed over: the handler has no other way to know which
 * turn it belongs to, and inventing a way to thread it through the SDK's
 * untyped `extra` argument would be guessing at an interface.
 */
export function createAskUserQuestionTool(options: {
  requestId: string;
  /** Pushes the question onto the turn's NDJSON stream. */
  publish: (pending: PendingQuestion) => void;
}) {
  return tool(
    "AskUserQuestion",
    TOOL_DESCRIPTION,
    {
      questions: z
        .array(QUESTION_SCHEMA)
        .min(1)
        .max(4)
        .describe("1-4 questions, answered together."),
    },
    async (args) => {
      const questionId = randomUUID();
      const pending: PendingQuestion = {
        questionId,
        requestId: options.requestId,
        questions: args.questions as AskQuestion[],
      };

      logger.chat.debug("Asking the user {questionId}", { questionId });

      const answers = await new Promise<QuestionAnswers>((resolve) => {
        waiting.set(questionId, { pending, resolve });
        // Published only once the entry exists, so an answer that arrives
        // immediately cannot find nothing to resolve.
        options.publish(pending);
      });

      // An empty object means the turn was abandoned rather than answered.
      if (Object.keys(answers).length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: "The user did not answer; the question was cancelled.",
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text" as const,
            text: Object.entries(answers)
              .map(([question, answer]) => `${question}\n${answer}`)
              .join("\n\n"),
          },
        ],
      };
    },
    // Required: without it the tool sits behind ToolSearch and Claude has to
    // go looking for it before it can ask anything. Measured.
    { alwaysLoad: true },
  );
}

/** The tool mounted as an MCP server, which is what `query()` accepts. */
export function createAskUserQuestionServer(options: {
  requestId: string;
  publish: (pending: PendingQuestion) => void;
}) {
  return createSdkMcpServer({
    name: "pdlc",
    version: "1.0.0",
    tools: [createAskUserQuestionTool(options)],
  });
}

/**
 * Handles `POST /api/questions/:questionId`.
 *
 * The suspended handler lives in this process, so the answer arrives on its
 * own request rather than through the chat stream — the stream only goes one
 * way.
 */
export async function handleAnswerQuestionRequest(c: Context) {
  const questionId = c.req.param("questionId");
  if (!questionId) {
    return c.json({ error: "Question id is required" }, 400);
  }

  let answers: QuestionAnswers;
  try {
    const body = (await c.req.json()) as { answers?: unknown };
    if (!body?.answers || typeof body.answers !== "object") {
      return c.json({ error: "answers must be an object" }, 400);
    }
    answers = Object.fromEntries(
      Object.entries(body.answers as Record<string, unknown>)
        .filter(([, value]) => typeof value === "string")
        .map(([key, value]) => [key, value as string]),
    );
  } catch {
    return c.json({ error: "Request body must be JSON" }, 400);
  }

  // An empty object is how a cancelled question reports itself, so refuse it
  // here rather than letting an answer masquerade as a cancellation.
  if (Object.keys(answers).length === 0) {
    return c.json({ error: "At least one answer is required" }, 400);
  }

  if (!answerQuestion(questionId, answers)) {
    return c.json({ error: "No question is waiting on that id" }, 404);
  }

  return c.json({ success: true });
}

/** Handles `GET /api/questions` — lets a reloaded client rebuild its cards. */
export function handlePendingQuestionsRequest(c: Context) {
  return c.json({ questions: listPendingQuestions() });
}
