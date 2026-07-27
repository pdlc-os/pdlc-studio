import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  answerQuestion,
  cancelQuestions,
  createAskUserQuestionServer,
  createAskUserQuestionTool,
  listPendingQuestions,
  type PendingQuestion,
} from "./askUserQuestion";

vi.mock("../utils/logger", () => ({
  logger: { chat: { debug: vi.fn(), warn: vi.fn(), error: vi.fn() } },
}));

/** The tool's own handler, which is where the suspend/resolve contract lives. */
function buildTool(requestId: string) {
  const published: PendingQuestion[] = [];
  const definition = createAskUserQuestionTool({
    requestId,
    publish: (pending) => published.push(pending),
  });
  return { handler: definition.handler, published };
}

const QUESTIONS = [
  {
    question: "Which database?",
    header: "DB",
    options: [
      { label: "Postgres", description: "Relational" },
      { label: "SQLite", description: "Embedded" },
    ],
    multiSelect: false,
  },
];

describe("AskUserQuestion", () => {
  beforeEach(() => {
    for (const q of listPendingQuestions()) answerQuestion(q.questionId, {});
  });

  it("mounts as an MCP server the SDK accepts", () => {
    expect(
      createAskUserQuestionServer({ requestId: "r", publish: () => {} }),
    ).toBeDefined();
  });

  it("publishes the question before it starts waiting", async () => {
    // Ordering matters: an answer arriving immediately must find an entry to
    // resolve, so the pending entry has to exist before the push.
    const { handler, published } = buildTool("r1");

    const call = handler({ questions: QUESTIONS }, undefined);
    await Promise.resolve();

    expect(published).toHaveLength(1);
    expect(published[0].questions[0].header).toBe("DB");
    expect(listPendingQuestions("r1")).toHaveLength(1);

    answerQuestion(published[0].questionId, { "Which database?": "SQLite" });
    await call;
  });

  it("suspends until answered, then returns the choice to Claude", async () => {
    const { handler, published } = buildTool("r2");

    const call = handler({ questions: QUESTIONS }, undefined);
    await Promise.resolve();

    let settled = false;
    void call.then(() => {
      settled = true;
    });
    await new Promise((r) => setTimeout(r, 20));
    expect(settled).toBe(false);

    answerQuestion(published[0].questionId, { "Which database?": "SQLite" });
    const result = (await call) as { content: { text: string }[] };

    expect(result.content[0].text).toContain("SQLite");
    // Answered questions must not linger as pending.
    expect(listPendingQuestions("r2")).toHaveLength(0);
  });

  it("tells Claude the question was cancelled rather than answered", async () => {
    // A turn abandoned by Stop must not look like the user chose something.
    const { handler, published } = buildTool("r3");

    const call = handler({ questions: QUESTIONS }, undefined);
    await Promise.resolve();
    expect(published).toHaveLength(1);

    cancelQuestions("r3");
    const result = (await call) as { content: { text: string }[] };

    expect(result.content[0].text).toContain("did not answer");
  });

  it("cancels only the turn named", async () => {
    const a = buildTool("keep");
    const b = buildTool("drop");
    void a.handler({ questions: QUESTIONS }, undefined);
    void b.handler({ questions: QUESTIONS }, undefined);
    await Promise.resolve();

    cancelQuestions("drop");

    expect(listPendingQuestions("keep")).toHaveLength(1);
    expect(listPendingQuestions("drop")).toHaveLength(0);
  });

  it("reports nothing to answer for an unknown question", () => {
    expect(answerQuestion("does-not-exist", { a: "b" })).toBe(false);
  });
});
