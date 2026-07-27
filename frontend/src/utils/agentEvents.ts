import type {
  AgentEvent,
  AgentTaskStatus,
  AgentTaskUsage,
} from "./agentActivity";

/**
 * Translates the CLI's task telemetry into the reducer's event vocabulary.
 *
 * Kept apart from the reducer so the wire format and the state machine can be
 * tested separately: this file is where the SDK's snake_case and optional
 * fields are dealt with, and nothing downstream has to know about either.
 *
 * Every field is read defensively. These messages are the SDK's least stable
 * surface — several are documented as evolving — and a missing field should
 * cost one detail in a panel, not a thrown error mid-stream.
 */

/** SDK subtypes this module consumes; all are kept out of the transcript. */
export const AGENT_TASK_SUBTYPES: readonly string[] = [
  "task_started",
  "task_progress",
  "task_updated",
  "task_notification",
  "background_tasks_changed",
];

function readUsage(value: unknown): AgentTaskUsage | undefined {
  if (!value || typeof value !== "object") return undefined;
  const usage = value as {
    total_tokens?: unknown;
    tool_uses?: unknown;
    duration_ms?: unknown;
  };

  return {
    totalTokens:
      typeof usage.total_tokens === "number" ? usage.total_tokens : 0,
    toolUses: typeof usage.tool_uses === "number" ? usage.tool_uses : 0,
    durationMs: typeof usage.duration_ms === "number" ? usage.duration_ms : 0,
  };
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value !== "" ? value : undefined;
}

const STATUSES: ReadonlySet<string> = new Set([
  "pending",
  "running",
  "completed",
  "failed",
  "killed",
  "paused",
]);

function readStatus(value: unknown): AgentTaskStatus | undefined {
  return typeof value === "string" && STATUSES.has(value)
    ? (value as AgentTaskStatus)
    : undefined;
}

/**
 * A `type: "system"` message, if it is task telemetry. Returns null otherwise,
 * so callers can pass everything through without pre-filtering.
 */
export function toAgentEvent(message: unknown, now: number): AgentEvent | null {
  if (!message || typeof message !== "object") return null;

  const m = message as Record<string, unknown>;
  const taskId = readString(m.task_id);

  switch (m.subtype) {
    case "task_started":
      if (!taskId) return null;
      return {
        kind: "started",
        taskId,
        description: readString(m.description) ?? "Task",
        subagentType: readString(m.subagent_type),
        taskType: readString(m.task_type),
        workflowName: readString(m.workflow_name),
        prompt: readString(m.prompt),
        isAmbient: m.skip_transcript === true,
        at: now,
      };

    case "task_progress":
      if (!taskId) return null;
      return {
        kind: "progress",
        taskId,
        description: readString(m.description),
        subagentType: readString(m.subagent_type),
        lastToolName: readString(m.last_tool_name),
        summary: readString(m.summary),
        usage: readUsage(m.usage),
      };

    case "task_updated": {
      if (!taskId) return null;
      const patch = (m.patch ?? {}) as Record<string, unknown>;
      return {
        kind: "patched",
        taskId,
        status: readStatus(patch.status),
        description: readString(patch.description),
        endedAt:
          typeof patch.end_time === "number" ? patch.end_time : undefined,
        error: readString(patch.error),
        isBackgrounded:
          typeof patch.is_backgrounded === "boolean"
            ? patch.is_backgrounded
            : undefined,
      };
    }

    case "task_notification": {
      if (!taskId) return null;
      // The wire status is narrower than the reducer's: "stopped" is the CLI's
      // word for a task that was told to stop, which is a kill here.
      const wire = readString(m.status);
      const status: AgentTaskStatus =
        wire === "failed"
          ? "failed"
          : wire === "stopped"
            ? "killed"
            : "completed";

      return {
        kind: "finished",
        taskId,
        status,
        summary: readString(m.summary),
        outputFile: readString(m.output_file),
        usage: readUsage(m.usage),
        at: now,
      };
    }

    case "background_tasks_changed": {
      const raw = Array.isArray(m.tasks) ? m.tasks : [];
      return {
        kind: "liveSet",
        at: now,
        tasks: raw.flatMap((entry) => {
          if (!entry || typeof entry !== "object") return [];
          const t = entry as Record<string, unknown>;
          const id = readString(t.task_id);
          if (!id) return [];
          return [
            {
              taskId: id,
              taskType: readString(t.task_type) ?? "",
              description: readString(t.description) ?? "Background task",
            },
          ];
        }),
      };
    }

    default:
      return null;
  }
}

/**
 * A top-level `tool_progress` message, which reports the tool a task is
 * currently running — and, when the CLI is retrying a failed subagent, how
 * many attempts have gone by.
 *
 * Separate from the system subtypes above because it is its own top-level
 * type, and because it arrives for main-thread tools too: without a `task_id`
 * it belongs to no task and is dropped here.
 */
export function toToolProgressEvent(message: unknown): AgentEvent | null {
  if (!message || typeof message !== "object") return null;

  const m = message as Record<string, unknown>;
  const taskId = readString(m.task_id);
  const toolName = readString(m.tool_name);
  if (!taskId || !toolName) return null;

  const retryRaw = m.subagent_retry as
    | { attempt?: unknown; max_retries?: unknown }
    | undefined;

  const retry =
    retryRaw && typeof retryRaw.attempt === "number"
      ? {
          attempt: retryRaw.attempt,
          maxRetries:
            typeof retryRaw.max_retries === "number" ? retryRaw.max_retries : 0,
        }
      : undefined;

  return { kind: "tool", taskId, toolName, retry };
}
