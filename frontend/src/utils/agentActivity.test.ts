import { describe, it, expect } from "vitest";
import {
  EMPTY_ACTIVITY,
  groupByWorkflow,
  reduceAgentActivity,
  runningTasks,
  type AgentActivity,
  type AgentEvent,
} from "./agentActivity";

/** Folds a sequence, which is how these events actually arrive. */
function fold(...events: AgentEvent[]): AgentActivity {
  return events.reduce(reduceAgentActivity, EMPTY_ACTIVITY);
}

const started: AgentEvent = {
  kind: "started",
  taskId: "t1",
  description: "Review the parser",
  subagentType: "code-reviewer",
  at: 1000,
};

describe("reduceAgentActivity", () => {
  it("records a started task as running", () => {
    const { tasks } = fold(started);

    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({
      taskId: "t1",
      description: "Review the parser",
      subagentType: "code-reviewer",
      status: "running",
      startedAt: 1000,
    });
  });

  it("keeps tasks in the order they were spawned", () => {
    const { tasks } = fold(
      started,
      { ...started, taskId: "t2" },
      {
        ...started,
        taskId: "t3",
      },
    );

    expect(tasks.map((t) => t.taskId)).toEqual(["t1", "t2", "t3"]);
  });

  it("replaces rather than duplicates a re-announced task", () => {
    const { tasks } = fold(started, {
      ...started,
      description: "Review the parser again",
    });

    expect(tasks).toHaveLength(1);
    expect(tasks[0].description).toBe("Review the parser again");
  });

  it("merges progress without losing what started reported", () => {
    const { tasks } = fold(started, {
      kind: "progress",
      taskId: "t1",
      lastToolName: "Grep",
      usage: { totalTokens: 1200, toolUses: 3, durationMs: 4500 },
    });

    expect(tasks[0]).toMatchObject({
      subagentType: "code-reviewer",
      lastToolName: "Grep",
      usage: { totalTokens: 1200, toolUses: 3, durationMs: 4500 },
    });
  });

  it("applies a status patch", () => {
    const { tasks } = fold(started, {
      kind: "patched",
      taskId: "t1",
      status: "paused",
    });

    expect(tasks[0].status).toBe("paused");
  });

  it("carries the terminal status, summary and output file", () => {
    const { tasks } = fold(started, {
      kind: "finished",
      taskId: "t1",
      status: "failed",
      summary: "Could not parse",
      outputFile: "/tmp/out.md",
      at: 5000,
    });

    expect(tasks[0]).toMatchObject({
      status: "failed",
      summary: "Could not parse",
      outputFile: "/tmp/out.md",
      endedAt: 5000,
    });
  });

  it("does not resurrect a finished task on late progress", () => {
    // Frames can arrive out of order; a task that reported failure must not be
    // shown as running again by a progress frame queued behind it.
    const { tasks } = fold(
      started,
      { kind: "finished", taskId: "t1", status: "failed", at: 5000 },
      { kind: "progress", taskId: "t1", lastToolName: "Read" },
    );

    expect(tasks[0].status).toBe("failed");
    expect(tasks[0].lastToolName).toBe("Read");
  });

  it("synthesises a row for a task whose start was never seen", () => {
    // A resumed conversation, or a dropped frame: the evidence that the task
    // exists is worth more than the tidiness of ignoring it.
    const { tasks } = fold({
      kind: "progress",
      taskId: "orphan",
      description: "Something",
      lastToolName: "Bash",
    });

    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({ taskId: "orphan", status: "running" });
  });

  it("records a retry reported by tool progress", () => {
    const { tasks } = fold(started, {
      kind: "tool",
      taskId: "t1",
      toolName: "WebFetch",
      retry: { attempt: 2, maxRetries: 3 },
    });

    expect(tasks[0]).toMatchObject({
      lastToolName: "WebFetch",
      retry: { attempt: 2, maxRetries: 3 },
    });
  });

  describe("the live-set replacement", () => {
    it("completes tasks that have dropped out of the live set", () => {
      const { tasks } = fold(started, {
        kind: "liveSet",
        tasks: [],
        at: 9000,
      });

      expect(tasks[0]).toMatchObject({ status: "completed", endedAt: 9000 });
    });

    it("keeps the finished row rather than deleting it", () => {
      // The panel is a record of the conversation's work, not just a live
      // monitor, so absence ends a task instead of erasing it.
      const { tasks } = fold(started, { kind: "liveSet", tasks: [], at: 9000 });

      expect(tasks).toHaveLength(1);
    });

    it("adds tasks it has never seen before", () => {
      const { tasks } = fold({
        kind: "liveSet",
        tasks: [{ taskId: "bg", taskType: "bash", description: "long build" }],
        at: 100,
      });

      expect(tasks[0]).toMatchObject({
        taskId: "bg",
        description: "long build",
        status: "running",
      });
    });

    it("does not reopen a task that already failed", () => {
      const { tasks } = fold(
        started,
        { kind: "finished", taskId: "t1", status: "failed", at: 2000 },
        {
          kind: "liveSet",
          tasks: [{ taskId: "t1", taskType: "task", description: "x" }],
          at: 3000,
        },
      );

      expect(tasks[0].status).toBe("failed");
    });
  });
});

describe("runningTasks", () => {
  it("counts only what is still working", () => {
    const state = fold(
      started,
      { ...started, taskId: "t2" },
      { kind: "finished", taskId: "t2", status: "completed", at: 2000 },
    );

    expect(runningTasks(state).map((t) => t.taskId)).toEqual(["t1"]);
  });

  it("counts a paused task as still live", () => {
    // Paused work is not finished; hiding it would understate what is in play.
    const state = fold(started, {
      kind: "patched",
      taskId: "t1",
      status: "paused",
    });

    expect(runningTasks(state)).toHaveLength(1);
  });
});

describe("groupByWorkflow", () => {
  it("groups tasks under the workflow that spawned them", () => {
    const state = fold(
      {
        ...started,
        taskId: "w1",
        taskType: "local_workflow",
        workflowName: "review-changes",
      },
      {
        ...started,
        taskId: "w2",
        taskType: "local_workflow",
        workflowName: "review-changes",
      },
    );

    const groups = groupByWorkflow(state);

    expect(groups).toHaveLength(1);
    expect(groups[0].workflowName).toBe("review-changes");
    expect(groups[0].tasks.map((t) => t.taskId)).toEqual(["w1", "w2"]);
  });

  it("puts workflow-less tasks in a single unnamed group", () => {
    // Only local_workflow tasks carry a name, so plain subagents must not be
    // filed under an invented heading.
    const state = fold(started, { ...started, taskId: "t2" });
    const groups = groupByWorkflow(state);

    expect(groups).toHaveLength(1);
    expect(groups[0].workflowName).toBeNull();
    expect(groups[0].tasks).toHaveLength(2);
  });

  it("keeps groups in the order their first task appeared", () => {
    const state = fold(
      { ...started, taskId: "a", workflowName: "first" },
      { ...started, taskId: "b" },
      { ...started, taskId: "c", workflowName: "second" },
    );

    expect(groupByWorkflow(state).map((g) => g.workflowName)).toEqual([
      "first",
      null,
      "second",
    ]);
  });
});

describe("scale", () => {
  /**
   * Real fan-outs are not small. Nothing here caps, truncates or samples, and
   * these assert that rather than trusting it — a silent top-N would make the
   * panel quietly lie about how much work is in flight.
   */
  const MANY = 250;

  function bigTeam(): AgentActivity {
    const events: AgentEvent[] = [];
    for (let i = 0; i < MANY; i++) {
      events.push({
        kind: "started",
        taskId: `t${i}`,
        description: `Task ${i}`,
        // Spread across 25 workflows, plus some with none at all.
        workflowName: i % 10 === 0 ? undefined : `workflow-${i % 25}`,
        at: 1000 + i,
      });
    }
    return fold(...events);
  }

  it("keeps every task, however many there are", () => {
    expect(bigTeam().tasks).toHaveLength(MANY);
  });

  it("counts every running task", () => {
    expect(runningTasks(bigTeam())).toHaveLength(MANY);
  });

  it("groups them all without dropping any", () => {
    const groups = groupByWorkflow(bigTeam());
    const total = groups.reduce((sum, g) => sum + g.tasks.length, 0);

    expect(total).toBe(MANY);
    // 25 named workflows minus those whose slots fell on the unnamed stride,
    // plus the single unnamed group.
    expect(groups.length).toBeGreaterThan(20);
    expect(groups.filter((g) => g.workflowName === null)).toHaveLength(1);
  });

  it("replaces a large live set in one event", () => {
    const state = reduceAgentActivity(bigTeam(), {
      kind: "liveSet",
      at: 9999,
      tasks: Array.from({ length: MANY }, (_, i) => ({
        taskId: `t${i}`,
        taskType: "task",
        description: `Task ${i}`,
      })),
    });

    expect(state.tasks).toHaveLength(MANY);
    expect(runningTasks(state)).toHaveLength(MANY);
  });
});
