import type { AllMessage } from "../types";
import { isChatMessage, isToolMessage } from "../types";
import { resolveRedirectTargets } from "./shellRedirects";

export interface ConversationFile {
  /** Absolute path on the machine running the backend. */
  path: string;
  /** Basename, for display. */
  name: string;
  /** Who put it there. */
  origin: "attached" | "generated";
  /** Timestamp of the message it came from, for ordering. */
  timestamp: number;
}
/**
 * Working directories whose contents are not deliverables.
 *
 * Anything Claude writes under /tmp is scratch that the OS reclaims, so
 * listing it as "Generated" invites the user to open a file that may already
 * be gone. Artifacts it means to keep land under /var — where the attachment
 * temp root also lives — so /var is deliberately not excluded.
 */
const SCRATCH_PREFIXES = ["/tmp/", "/private/tmp/"];

function isScratchPath(path: string): boolean {
  return SCRATCH_PREFIXES.some((prefix) => path.startsWith(prefix));
}

/**
 * Matches the block `withAttachments` adds to an outgoing message.
 *
 * Parsing the transcript rather than keeping a separate list is what makes the
 * Files tab work on a *resumed* conversation: the paths are in the message
 * history, so a session reopened tomorrow still lists what was attached to it.
 */
const ATTACHMENT_BLOCK =
  /The user attached (?:this file|these files):\n((?:- .+\n?)+)/;

function baseName(path: string): string {
  const trimmed = path.replace(/\/+$/, "");
  return trimmed.slice(trimmed.lastIndexOf("/") + 1) || trimmed;
}

/** Paths listed in a message's attachment block. */
export function parseAttachedPaths(content: string): string[] {
  const match = ATTACHMENT_BLOCK.exec(content);
  if (!match) return [];

  return match[1]
    .split("\n")
    .map((line) => line.replace(/^-\s*/, "").trim())
    .filter((line) => line !== "");
}

/**
 * Every file in a conversation, in the order it entered it.
 *
 * Three sources: paths the user attached (recovered from their own messages),
 * paths a file-writing tool named, and paths inferred from shell redirections.
 * De-duplicated by path, keeping the earliest occurrence — a file written three
 * times is one file, and the interesting timestamp is when it first appeared.
 */
export function collectConversationFiles(
  messages: AllMessage[],
  workingDirectory?: string,
): ConversationFile[] {
  const seen = new Map<string, ConversationFile>();

  const record = (
    path: string,
    origin: ConversationFile["origin"],
    timestamp: number,
  ) => {
    if (seen.has(path)) return;
    seen.set(path, { path, name: baseName(path), origin, timestamp });
  };

  for (const message of messages) {
    if (isChatMessage(message) && message.role === "user") {
      for (const path of parseAttachedPaths(message.content)) {
        record(path, "attached", message.timestamp);
      }
    } else if (isToolMessage(message)) {
      if (message.filePath && !isScratchPath(message.filePath)) {
        record(message.filePath, "generated", message.timestamp);
      }
      // Inferred from a shell redirection rather than a structured input; the
      // working directory is what makes a relative target resolvable.
      for (const path of resolveRedirectTargets(
        message.redirectPaths ?? [],
        workingDirectory,
      )) {
        if (!isScratchPath(path)) {
          record(path, "generated", message.timestamp);
        }
      }
    }
  }

  return [...seen.values()].sort((a, b) => a.timestamp - b.timestamp);
}
