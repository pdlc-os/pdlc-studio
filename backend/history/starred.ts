/**
 * Which conversations the user has starred.
 *
 * Kept in this app's own state directory rather than in the session JSONL.
 * A star is a PDLC Studio preference, not part of the conversation: writing
 * one into a file the Claude CLI owns and appends to would be putting our
 * bookkeeping in someone else's record, and it would be lost the moment the
 * CLI rewrote it.
 *
 * Stored server-side rather than in the browser so a star survives a cleared
 * cache and shows up in whichever browser the user opens the app in — the
 * conversations themselves live on this machine, and so should the marks on
 * them.
 */

import { logger } from "../utils/logger.ts";
import { exists, mkdir, readTextFile, writeTextFile } from "../utils/fs.ts";
import { getHomeDir } from "../utils/os.ts";

/** `{ "<encoded project name>": ["<session id>", ...] }` */
type StarredFile = Record<string, string[]>;

function getStateDir(): string | null {
  const homeDir = getHomeDir();
  return homeDir ? `${homeDir}/.pdlc-studio` : null;
}

function getStarredPath(): string | null {
  const dir = getStateDir();
  return dir ? `${dir}/starred.json` : null;
}

/**
 * Reads the store, treating every failure as "nothing is starred".
 *
 * A corrupt or unreadable file must not take the conversation list down with
 * it: the list is the feature, the stars are an accent on it.
 */
async function readStarred(): Promise<StarredFile> {
  const path = getStarredPath();
  if (!path || !(await exists(path))) return {};

  try {
    const parsed: unknown = JSON.parse(await readTextFile(path));

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    // Hand-checked rather than trusted: this file is on disk and editable.
    const result: StarredFile = {};
    for (const [project, sessions] of Object.entries(parsed)) {
      if (Array.isArray(sessions)) {
        result[project] = sessions.filter(
          (id): id is string => typeof id === "string",
        );
      }
    }
    return result;
  } catch (error) {
    logger.history.warn(`Could not read starred conversations: {error}`, {
      error,
    });
    return {};
  }
}

async function writeStarred(starred: StarredFile): Promise<void> {
  const dir = getStateDir();
  const path = getStarredPath();
  if (!dir || !path) throw new Error("No home directory");

  if (!(await exists(dir))) {
    await mkdir(dir, { recursive: true });
  }

  await writeTextFile(path, `${JSON.stringify(starred, null, 2)}\n`);
}

/** The starred session ids for one project. */
export async function getStarredSessions(
  encodedProjectName: string,
): Promise<Set<string>> {
  const starred = await readStarred();
  return new Set(starred[encodedProjectName] ?? []);
}

/**
 * Sets or clears a star.
 *
 * Idempotent: starring twice leaves one star, and unstarring something that
 * was never starred is not an error. The UI toggles from a list that may be a
 * few seconds stale, so a repeated call is expected rather than exceptional.
 */
export async function setSessionStarred(
  encodedProjectName: string,
  sessionId: string,
  isStarred: boolean,
): Promise<void> {
  const starred = await readStarred();
  const current = new Set(starred[encodedProjectName] ?? []);

  if (isStarred) {
    current.add(sessionId);
  } else {
    current.delete(sessionId);
  }

  if (current.size === 0) {
    delete starred[encodedProjectName];
  } else {
    starred[encodedProjectName] = [...current];
  }

  await writeStarred(starred);
}
