import { Context } from "hono";
import { deleteSession, renameSession } from "@anthropic-ai/claude-agent-sdk";
import type {
  DeleteConversationsResponse,
  RenameConversationRequest,
} from "../../shared/types.ts";
import { validateEncodedProjectName } from "../history/pathUtils.ts";
import { logger } from "../utils/logger.ts";
import { readDir } from "../utils/fs.ts";
import { getHomeDir } from "../utils/os.ts";

/**
 * Longest accepted title. Generous — the point is to stop a runaway paste
 * being appended to the session file, not to impose a naming style.
 */
const MAX_TITLE_LENGTH = 200;

/**
 * Session IDs name files under ~/.claude/projects, so anything that is not a
 * plain UUID is rejected before it reaches the filesystem.
 */
const SESSION_ID_PATTERN = /^[A-Za-z0-9-]{8,64}$/;

/**
 * Both mutations deliberately omit the SDK's `dir` option.
 *
 * The route carries the *encoded* project name (`-Users-me-my-project`), and
 * decoding it back to a path is genuinely ambiguous: the separator and a
 * literal hyphen are the same character, so `-Users-me-pdlc-studio` could be
 * `/Users/me/pdlc-studio` or `/Users/me/pdlc/studio`. Session IDs are UUIDs, so
 * letting the SDK find the session across projects is both simpler and correct.
 */
type SessionScope = Record<string, never>;
const ALL_PROJECTS: SessionScope = {};

function resolveHistoryDir(encodedProjectName: string): string | null {
  const homeDir = getHomeDir();
  if (!homeDir) return null;
  return `${homeDir}/.claude/projects/${encodedProjectName}`;
}

/** Validates the two path params every route here shares. */
function readParams(
  c: Context,
): { encodedProjectName: string; sessionId: string } | null {
  const encodedProjectName = c.req.param("encodedProjectName");
  const sessionId = c.req.param("sessionId");

  if (!encodedProjectName || !validateEncodedProjectName(encodedProjectName)) {
    return null;
  }
  if (!sessionId || !SESSION_ID_PATTERN.test(sessionId)) {
    return null;
  }

  return { encodedProjectName, sessionId };
}

/**
 * Handles `PATCH /api/projects/:encodedProjectName/histories/:sessionId`.
 *
 * Renaming goes through the SDK rather than editing the JSONL here, which is
 * what makes it equivalent to the CLI's `/rename`: it appends the same
 * `custom-title` entry, so a session renamed in this UI shows the new name in
 * `claude --resume` as well.
 */
export async function handleRenameConversationRequest(c: Context) {
  const params = readParams(c);
  if (!params) {
    return c.json({ error: "Invalid project name or session id" }, 400);
  }

  let body: RenameConversationRequest;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const title = typeof body?.title === "string" ? body.title.trim() : "";
  if (title === "") {
    return c.json({ error: "Title is required" }, 400);
  }
  if (title.length > MAX_TITLE_LENGTH) {
    return c.json(
      { error: `Title must be ${MAX_TITLE_LENGTH} characters or fewer` },
      400,
    );
  }

  try {
    await renameSession(params.sessionId, title, ALL_PROJECTS);
    logger.history.debug("Renamed session {sessionId}", {
      sessionId: params.sessionId,
    });
    return c.json({ sessionId: params.sessionId, title });
  } catch (error) {
    logger.history.error("Failed to rename session: {error}", { error });
    return c.json({ error: "Failed to rename conversation" }, 500);
  }
}

/** Handles `DELETE /api/projects/:encodedProjectName/histories/:sessionId`. */
export async function handleDeleteConversationRequest(c: Context) {
  const params = readParams(c);
  if (!params) {
    return c.json({ error: "Invalid project name or session id" }, 400);
  }

  try {
    await deleteSession(params.sessionId, ALL_PROJECTS);
    logger.history.debug("Deleted session {sessionId}", {
      sessionId: params.sessionId,
    });
    return c.json({ sessionId: params.sessionId, deleted: 1 });
  } catch (error) {
    logger.history.error("Failed to delete session: {error}", { error });
    return c.json({ error: "Failed to delete conversation" }, 500);
  }
}

/**
 * Handles `DELETE /api/projects/:encodedProjectName/histories`.
 *
 * Deletes every session in the project. Sessions are enumerated from the
 * project's own history directory — the filename *is* the session id — so this
 * cannot reach beyond the project even though each delete is unscoped.
 *
 * A failure on one session does not abort the rest: a half-cleared history with
 * an accurate count is more useful than stopping on the first bad file.
 */
export async function handleClearConversationsRequest(c: Context) {
  const encodedProjectName = c.req.param("encodedProjectName");
  if (!encodedProjectName || !validateEncodedProjectName(encodedProjectName)) {
    return c.json({ error: "Invalid encoded project name" }, 400);
  }

  const historyDir = resolveHistoryDir(encodedProjectName);
  if (!historyDir) {
    return c.json({ error: "Home directory not found" }, 500);
  }

  const sessionIds: string[] = [];
  try {
    for await (const entry of readDir(historyDir)) {
      if (entry.isFile && entry.name.endsWith(".jsonl")) {
        sessionIds.push(entry.name.replace(/\.jsonl$/, ""));
      }
    }
  } catch {
    // No history directory means nothing to clear, which is a success.
    return c.json<DeleteConversationsResponse>({ deleted: 0 });
  }

  let deleted = 0;
  for (const sessionId of sessionIds) {
    try {
      await deleteSession(sessionId, ALL_PROJECTS);
      deleted++;
    } catch (error) {
      logger.history.warn("Failed to delete session {sessionId}: {error}", {
        sessionId,
        error,
      });
    }
  }

  logger.history.debug("Cleared {deleted} of {total} sessions", {
    deleted,
    total: sessionIds.length,
  });
  return c.json<DeleteConversationsResponse>({ deleted });
}
