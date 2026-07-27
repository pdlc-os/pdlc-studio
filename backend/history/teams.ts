/**
 * Agent teams, read from the CLI's own state directory.
 *
 * A session that spawns teammates gets a team config at
 * `~/.claude/teams/session-<first 8 chars of the session id>/config.json`.
 * Nothing in the SDK exposes this — `listSessions` returns no agent or team
 * metadata at all — so the file is the only way to know a conversation has a
 * team, and this reads it directly.
 *
 * That makes it a private interface this app does not own. Every field is
 * optional here and unknown ones are preserved rather than dropped, so a shape
 * change costs a detail in the panel instead of an exception.
 */

import { logger } from "../utils/logger.ts";
import { exists, readTextFile } from "../utils/fs.ts";
import { getHomeDir } from "../utils/os.ts";

/** Session ids are UUIDs; anything else must not reach a path. */
const SESSION_ID_PATTERN = /^[A-Za-z0-9-]{8,64}$/;

export interface TeamMember {
  /** e.g. "team-lead@session-381fa295". Unique within the team. */
  agentId: string;
  /** Short display name, e.g. "team-lead". */
  name?: string;
  /** e.g. "team-lead", "general-purpose". */
  agentType?: string;
  /** "in-process", "tmux", ... — how the teammate is executing. */
  backendType?: string;
  tmuxPaneId?: string;
  cwd?: string;
  joinedAt?: number;
  /** Model the teammate runs on, e.g. "opus". Lead entries omit it. */
  model?: string;
  /** UI colour the CLI assigned the teammate. */
  color?: string;
  planModeRequired?: boolean;
  /**
   * The instruction the teammate was given — its charter, often several
   * hundred words. The single most useful thing in this file: it is the only
   * record anywhere of what a teammate was actually asked to do.
   */
  prompt?: string;
  /**
   * The teammate's own session, if the CLI ever records one.
   *
   * Verified absent on a real six-member team: teammates run in-process,
   * write no session file of their own, and are not attributed inside the
   * lead's transcript either. Only the lead has a session. Read through
   * anyway so the panel lights up on its own should that change.
   */
  sessionId?: string;
}

export interface TeamInfo {
  name: string;
  createdAt?: number;
  leadAgentId?: string;
  leadSessionId?: string;
  members: TeamMember[];
}

/** `session-<first 8>`, matching how the CLI names the directory. */
export function teamDirName(sessionId: string): string {
  return `session-${sessionId.slice(0, 8)}`;
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value !== "" ? value : undefined;
}

function readMember(value: unknown): TeamMember | null {
  if (!value || typeof value !== "object") return null;
  const m = value as Record<string, unknown>;

  const agentId = readString(m.agentId);
  if (!agentId) return null;

  return {
    agentId,
    name: readString(m.name),
    agentType: readString(m.agentType),
    backendType: readString(m.backendType),
    tmuxPaneId: readString(m.tmuxPaneId),
    cwd: readString(m.cwd),
    joinedAt: typeof m.joinedAt === "number" ? m.joinedAt : undefined,
    model: readString(m.model),
    color: readString(m.color),
    planModeRequired:
      typeof m.planModeRequired === "boolean" ? m.planModeRequired : undefined,
    prompt: readString(m.prompt),
    sessionId: readString(m.sessionId),
  };
}

/**
 * The team for a session, or null when it has none.
 *
 * Having no team is the overwhelmingly common case — a conversation only gets
 * one if it spawns teammates — so absence is not an error and is not logged.
 */
export async function readTeamForSession(
  sessionId: string,
): Promise<TeamInfo | null> {
  if (!SESSION_ID_PATTERN.test(sessionId)) return null;

  const homeDir = getHomeDir();
  if (!homeDir) return null;

  const path = `${homeDir}/.claude/teams/${teamDirName(sessionId)}/config.json`;
  if (!(await exists(path))) return null;

  try {
    const parsed: unknown = JSON.parse(await readTextFile(path));
    if (!parsed || typeof parsed !== "object") return null;

    const config = parsed as Record<string, unknown>;
    const rawMembers = Array.isArray(config.members) ? config.members : [];

    return {
      name: readString(config.name) ?? teamDirName(sessionId),
      createdAt:
        typeof config.createdAt === "number" ? config.createdAt : undefined,
      leadAgentId: readString(config.leadAgentId),
      leadSessionId: readString(config.leadSessionId),
      members: rawMembers
        .map(readMember)
        .filter((member): member is TeamMember => member !== null),
    };
  } catch (error) {
    // A malformed config must not take the conversation down with it.
    logger.history.warn("Could not read team config for {sessionId}: {error}", {
      sessionId,
      error,
    });
    return null;
  }
}
