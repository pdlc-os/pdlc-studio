/**
 * Live state of the agents and workflows a conversation has spawned.
 *
 * The CLI reports this as a stream of small events rather than a snapshot:
 * `task_started` announces a task, `task_progress` and `tool_progress` report
 * on it, `task_updated` patches individual fields, `task_notification` ends it,
 * and `background_tasks_changed` replaces the live set wholesale. Nothing sends
 * "here is the current tree", so the tree is folded up here.
 *
 * Deliberately a pure reducer over those events: it is the one part of this
 * feature that can be tested without a browser or a live Claude session, and
 * the ordering rules below are the whole substance of it.
 */

export type AgentTaskStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "killed"
  | "paused";

export interface AgentTaskUsage {
  totalTokens: number;
  toolUses: number;
  durationMs: number;
}

export interface AgentTask {
  taskId: string;
  description: string;
  /** e.g. "general-purpose", "code-reviewer". Absent for non-Task tasks. */
  subagentType?: string;
  /** e.g. "local_workflow". */
  taskType?: string;
  /** `meta.name` from a workflow script; set only when taskType is local_workflow. */
  workflowName?: string;
  /** The instruction the task was given, when the CLI reports it. */
  prompt?: string;
  status: AgentTaskStatus;
  /**
   * Housekeeping work the SDK asks consumers to keep out of the transcript.
   * Shown here — a panel is exactly where it says such tasks may appear — but
   * flagged so the UI can de-emphasise it.
   */
  isAmbient: boolean;
  isBackgrounded?: boolean;
  startedAt: number;
  endedAt?: number;
  lastToolName?: string;
  summary?: string;
  error?: string;
  /** Written by a finished task; readable through the files endpoint. */
  outputFile?: string;
  usage?: AgentTaskUsage;
  retry?: { attempt: number; maxRetries: number };
}

export interface AgentActivity {
  /** Insertion-ordered, so the panel lists tasks as they were spawned. */
  tasks: AgentTask[];
}

export const EMPTY_ACTIVITY: AgentActivity = { tasks: [] };

const TERMINAL: ReadonlySet<AgentTaskStatus> = new Set([
  "completed",
  "failed",
  "killed",
]);

export function isTerminal(status: AgentTaskStatus): boolean {
  return TERMINAL.has(status);
}

/** Tasks still doing something, which is what the island counts. */
export function runningTasks(activity: AgentActivity): AgentTask[] {
  return activity.tasks.filter((task) => !isTerminal(task.status));
}

export interface AgentGroup {
  /** Workflow name, or null for tasks that belong to no workflow. */
  workflowName: string | null;
  tasks: AgentTask[];
}

/**
 * Tasks grouped by the workflow that spawned them.
 *
 * Only `local_workflow` tasks carry a `workflowName`, so everything else —
 * plain Task-tool subagents, teammates — falls into a single unnamed group
 * rather than being forced under a fabricated heading. Groups keep the order
 * their first task appeared in.
 */
export function groupByWorkflow(activity: AgentActivity): AgentGroup[] {
  const groups = new Map<string | null, AgentTask[]>();

  for (const task of activity.tasks) {
    const key = task.workflowName ?? null;
    const existing = groups.get(key);
    if (existing) {
      existing.push(task);
    } else {
      groups.set(key, [task]);
    }
  }

  return [...groups].map(([workflowName, tasks]) => ({ workflowName, tasks }));
}

/** The events this reducer folds, narrowed from the SDK's wider union. */
export type AgentEvent =
  | {
      kind: "started";
      taskId: string;
      description: string;
      subagentType?: string;
      taskType?: string;
      workflowName?: string;
      prompt?: string;
      isAmbient?: boolean;
      at: number;
    }
  | {
      kind: "progress";
      taskId: string;
      description?: string;
      subagentType?: string;
      lastToolName?: string;
      summary?: string;
      usage?: AgentTaskUsage;
    }
  | {
      kind: "patched";
      taskId: string;
      status?: AgentTaskStatus;
      description?: string;
      endedAt?: number;
      error?: string;
      isBackgrounded?: boolean;
    }
  | {
      kind: "finished";
      taskId: string;
      status: AgentTaskStatus;
      summary?: string;
      outputFile?: string;
      usage?: AgentTaskUsage;
      at: number;
    }
  | {
      kind: "tool";
      taskId: string;
      toolName: string;
      retry?: { attempt: number; maxRetries: number };
    }
  | {
      kind: "liveSet";
      tasks: { taskId: string; taskType: string; description: string }[];
      at: number;
    };

function upsert(
  tasks: AgentTask[],
  taskId: string,
  update: (task: AgentTask) => AgentTask,
  create?: () => AgentTask,
): AgentTask[] {
  const index = tasks.findIndex((task) => task.taskId === taskId);

  if (index === -1) {
    // Events can arrive for a task whose `started` was never seen — a resumed
    // conversation, or a dropped frame. Synthesising a row is better than
    // discarding the only evidence the task exists.
    return create ? [...tasks, create()] : tasks;
  }

  const next = [...tasks];
  next[index] = update(next[index]);
  return next;
}

export function reduceAgentActivity(
  state: AgentActivity,
  event: AgentEvent,
): AgentActivity {
  switch (event.kind) {
    case "started": {
      const task: AgentTask = {
        taskId: event.taskId,
        description: event.description,
        subagentType: event.subagentType,
        taskType: event.taskType,
        workflowName: event.workflowName,
        prompt: event.prompt,
        status: "running",
        isAmbient: event.isAmbient === true,
        startedAt: event.at,
      };

      // A task id can be re-announced; replace in place so the panel does not
      // grow a duplicate row.
      const existing = state.tasks.findIndex((t) => t.taskId === event.taskId);
      if (existing !== -1) {
        const tasks = [...state.tasks];
        tasks[existing] = { ...tasks[existing], ...task };
        return { tasks };
      }

      return { tasks: [...state.tasks, task] };
    }

    case "progress":
      return {
        tasks: upsert(
          state.tasks,
          event.taskId,
          (task) => ({
            ...task,
            description: event.description ?? task.description,
            subagentType: event.subagentType ?? task.subagentType,
            lastToolName: event.lastToolName ?? task.lastToolName,
            summary: event.summary ?? task.summary,
            usage: event.usage ?? task.usage,
            // Progress on a task previously believed finished means it is not.
            status: isTerminal(task.status) ? task.status : "running",
          }),
          () => ({
            taskId: event.taskId,
            description: event.description ?? "Task",
            subagentType: event.subagentType,
            status: "running",
            isAmbient: false,
            startedAt: 0,
            lastToolName: event.lastToolName,
            summary: event.summary,
            usage: event.usage,
          }),
        ),
      };

    case "patched":
      return {
        tasks: upsert(state.tasks, event.taskId, (task) => ({
          ...task,
          status: event.status ?? task.status,
          description: event.description ?? task.description,
          endedAt: event.endedAt ?? task.endedAt,
          error: event.error ?? task.error,
          isBackgrounded: event.isBackgrounded ?? task.isBackgrounded,
        })),
      };

    case "finished":
      return {
        tasks: upsert(
          state.tasks,
          event.taskId,
          (task) => ({
            ...task,
            status: event.status,
            summary: event.summary ?? task.summary,
            outputFile: event.outputFile ?? task.outputFile,
            usage: event.usage ?? task.usage,
            endedAt: task.endedAt ?? event.at,
          }),
          () => ({
            taskId: event.taskId,
            description: event.summary ?? "Task",
            status: event.status,
            isAmbient: false,
            startedAt: event.at,
            endedAt: event.at,
            summary: event.summary,
            outputFile: event.outputFile,
            usage: event.usage,
          }),
        ),
      };

    case "tool":
      return {
        tasks: upsert(state.tasks, event.taskId, (task) => ({
          ...task,
          lastToolName: event.toolName,
          retry: event.retry ?? task.retry,
        })),
      };

    case "liveSet": {
      /*
       * REPLACE semantics, but only over the *live* set.
       *
       * The payload lists what is running now, so anything in it is running and
       * anything absent from it has stopped. Finished tasks are kept — the
       * panel is a record of the conversation's work, not just a live monitor —
       * so absence marks them completed rather than deleting the row.
       */
      const live = new Map(event.tasks.map((task) => [task.taskId, task]));
      let tasks = state.tasks.map((task) => {
        const entry = live.get(task.taskId);
        if (entry) {
          return {
            ...task,
            description: entry.description || task.description,
            taskType: entry.taskType || task.taskType,
            status: isTerminal(task.status)
              ? task.status
              : ("running" as AgentTaskStatus),
          };
        }
        return isTerminal(task.status)
          ? task
          : {
              ...task,
              status: "completed" as AgentTaskStatus,
              endedAt: event.at,
            };
      });

      const known = new Set(tasks.map((task) => task.taskId));
      for (const entry of event.tasks) {
        if (known.has(entry.taskId)) continue;
        tasks = [
          ...tasks,
          {
            taskId: entry.taskId,
            description: entry.description,
            taskType: entry.taskType,
            status: "running",
            isAmbient: false,
            startedAt: event.at,
          },
        ];
      }

      return { tasks };
    }

    default:
      return state;
  }
}
