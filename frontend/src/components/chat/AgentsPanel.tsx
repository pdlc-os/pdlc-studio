import { Button } from "@astryxdesign/core/Button";
import { Icon } from "@astryxdesign/core/Icon";
import { Text } from "@astryxdesign/core/Text";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { ExternalLink, Users, Workflow as WorkflowIcon } from "lucide-react";
import {
  groupByWorkflow,
  isTerminal,
  type AgentActivity,
  type AgentTask,
  type AgentTaskStatus,
} from "../../utils/agentActivity";
import { getFileContentUrl } from "../../config/api";
import type { TeamInfo } from "../../types";

interface AgentsPanelProps {
  activity: AgentActivity;
  workingDirectory?: string;
  /** The conversation's agent team, when it has one. */
  team?: TeamInfo | null;
  /** Absent until the control tier is wired; the row hides its actions then. */
  onStopTask?: (task: AgentTask) => void;
  /** Opens a teammate's own session as a conversation. */
  onOpenSession?: (sessionId: string) => void;
}

/**
 * Wording for each status.
 *
 * "killed" is the reducer's word for a task the CLI reported as `stopped`;
 * "Stopped" is what a user would call it, and the distinction between being
 * stopped and failing matters when reading back what happened.
 */
const STATUS_LABEL: Record<AgentTaskStatus, string> = {
  pending: "Queued",
  running: "Running",
  paused: "Paused",
  completed: "Done",
  failed: "Failed",
  killed: "Stopped",
};

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${seconds % 60}s`;
}

function formatTokens(count: number): string {
  if (count < 1000) return `${count}`;
  if (count < 1_000_000) return `${Math.round(count / 1000)}k`;
  return `${(count / 1_000_000).toFixed(1)}M`;
}

/**
 * One task.
 *
 * The detail line is assembled from whatever the CLI has actually reported —
 * these fields arrive at different times and several never arrive for some
 * task types, so a fixed set of columns would be mostly empty dashes.
 */
function TaskRow({
  task,
  workingDirectory,
  onStopTask,
}: {
  task: AgentTask;
  workingDirectory?: string;
  onStopTask?: (task: AgentTask) => void;
}) {
  const details: string[] = [];
  if (task.subagentType) details.push(task.subagentType);
  if (!isTerminal(task.status) && task.lastToolName) {
    details.push(task.lastToolName);
  }
  if (task.usage?.totalTokens) {
    details.push(`${formatTokens(task.usage.totalTokens)} tokens`);
  }
  if (task.usage?.toolUses) {
    details.push(`${task.usage.toolUses} tool calls`);
  }
  if (task.usage?.durationMs) {
    details.push(formatDuration(task.usage.durationMs));
  }

  return (
    <li
      className="agent-task"
      data-status={task.status}
      data-ambient={task.isAmbient ? "true" : undefined}
      data-testid="agent-task"
    >
      <span className="agent-task-status" aria-hidden="true" />

      <div className="agent-task-body">
        <div className="agent-task-heading">
          <span className="agent-task-title">{task.description}</span>
          <span className="agent-task-badge">{STATUS_LABEL[task.status]}</span>
        </div>

        {details.length > 0 ? (
          <span className="agent-task-meta">{details.join(" · ")}</span>
        ) : null}

        {/* A retry is the one thing worth interrupting the layout for: it means
            the agent is failing and the run may not be progressing. */}
        {task.retry ? (
          <span className="agent-task-retry">
            retry {task.retry.attempt}
            {task.retry.maxRetries ? ` of ${task.retry.maxRetries}` : ""}
          </span>
        ) : null}

        {task.error ? (
          <span className="agent-task-error">{task.error}</span>
        ) : null}

        {task.summary && isTerminal(task.status) ? (
          <span className="agent-task-summary">{task.summary}</span>
        ) : null}
      </div>

      <span className="agent-task-actions">
        {task.outputFile ? (
          <Button
            variant="ghost"
            size="sm"
            label="Output"
            icon={<Icon icon={ExternalLink} />}
            href={getFileContentUrl(task.outputFile, { workingDirectory })}
            target="_blank"
          />
        ) : null}
        {onStopTask && !isTerminal(task.status) ? (
          <Button
            variant="ghost"
            size="sm"
            label="Stop"
            onClick={() => onStopTask(task)}
          />
        ) : null}
      </span>
    </li>
  );
}

/**
 * The conversation's agent team.
 *
 * Read from the CLI's own team config, which is the only place a team is
 * described — the SDK's session listing carries no agent or team metadata.
 *
 * A member is openable only when the CLI recorded its own session id. That
 * field is absent on every team observed so far, and a teammate running in a
 * tmux pane is a process this app cannot reach in any case, so the action
 * appears when it can actually work rather than always being offered and
 * sometimes failing.
 */
function TeamSection({
  team,
  onOpenSession,
}: {
  team: TeamInfo;
  onOpenSession?: (sessionId: string) => void;
}) {
  return (
    <section className="agent-group">
      <header className="agent-group-header">
        <Icon icon={Users} size="sm" color="secondary" />
        <Text size="sm" weight="semibold">
          {team.name}
        </Text>
        <Text size="xsm" color="secondary">
          {team.members.length}
        </Text>
      </header>

      <ul className="agent-task-list">
        {team.members.map((member) => {
          const isLead = member.agentId === team.leadAgentId;
          /*
           * Only the lead has a session. Teammates run in-process, write no
           * session file of their own, and are not attributed inside the
           * lead's transcript either — verified against a real six-member
           * team — so there is no teammate conversation to open.
           * `member.sessionId` is still read first, so this lights up by
           * itself if the CLI ever starts recording one.
           */
          const sessionId =
            member.sessionId ?? (isLead ? team.leadSessionId : undefined);
          const details = [
            member.agentType,
            member.model,
            member.backendType,
          ].filter(Boolean);

          return (
            <li
              key={member.agentId}
              className="agent-task"
              data-status={isLead ? "running" : "pending"}
              data-testid="team-member"
            >
              {/* The CLI assigns each teammate a colour; reusing it keeps
                  the panel and the terminal naming the same agent. */}
              <span
                className="agent-task-status"
                aria-hidden="true"
                style={
                  member.color ? { backgroundColor: member.color } : undefined
                }
              />
              <div className="agent-task-body">
                <div className="agent-task-heading">
                  <span className="agent-task-title">
                    {member.name ?? member.agentId}
                  </span>
                  {isLead ? (
                    <span className="agent-task-badge">Lead</span>
                  ) : null}
                </div>
                {details.length > 0 ? (
                  <span className="agent-task-meta">{details.join(" · ")}</span>
                ) : null}
                {/*
                 * The teammate's charter — the only record anywhere of what
                 * this agent was asked to do, since the transcript never shows
                 * it. Hundreds of words, so it starts closed.
                 */}
                {member.prompt ? (
                  <details className="agent-member-prompt">
                    <summary>Charter</summary>
                    <p>{member.prompt}</p>
                  </details>
                ) : null}
              </div>
              <span className="agent-task-actions">
                {sessionId && onOpenSession ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    label="Open"
                    data-testid="open-teammate"
                    onClick={() => onOpenSession(sessionId)}
                  />
                ) : null}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/**
 * What the conversation's agents and workflows are doing.
 *
 * Built from the CLI's task telemetry rather than the transcript: a workflow
 * fans out to agents whose work never appears as messages, so the transcript
 * shows a long pause where this shows the tree.
 */
export function AgentsPanel({
  activity,
  workingDirectory,
  team,
  onStopTask,
  onOpenSession,
}: AgentsPanelProps) {
  const groups = groupByWorkflow(activity);

  if (groups.length === 0 && !team) {
    return (
      <EmptyState
        title="No agents yet"
        description="Workflows and subagents this conversation spawns will appear here while they run, and stay afterwards as a record of the work."
      />
    );
  }

  return (
    <div className="agents-panel">
      {team ? <TeamSection team={team} onOpenSession={onOpenSession} /> : null}
      {groups.map((group) => (
        <section
          key={group.workflowName ?? "__ungrouped__"}
          className="agent-group"
        >
          <header className="agent-group-header">
            {group.workflowName ? (
              <>
                <Icon icon={WorkflowIcon} size="sm" color="secondary" />
                <Text size="sm" weight="semibold">
                  {group.workflowName}
                </Text>
              </>
            ) : (
              <Text size="sm" weight="semibold" color="secondary">
                Agents
              </Text>
            )}
            <Text size="xsm" color="secondary">
              {group.tasks.length}
            </Text>
          </header>

          <ul className="agent-task-list">
            {group.tasks.map((task) => (
              <TaskRow
                key={task.taskId}
                task={task}
                workingDirectory={workingDirectory}
                onStopTask={onStopTask}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
