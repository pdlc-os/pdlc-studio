/**
 * Content search across a project's conversations.
 */

import type { ConversationFile, RawHistoryLine } from "./parser.ts";

/**
 * Every piece of human-readable text in one history line.
 *
 * Deliberately not a search over the raw JSONL: that would match structural
 * keys and ids, so searching "user" would hit every line in every file and the
 * filter would look broken rather than empty.
 */
function lineText(line: RawHistoryLine): string[] {
  const parts: string[] = [];

  if (typeof line.customTitle === "string") parts.push(line.customTitle);
  if (typeof line.aiTitle === "string") parts.push(line.aiTitle);

  const content = line.message?.content;
  if (typeof content === "string") {
    parts.push(content);
  } else if (Array.isArray(content)) {
    for (const item of content) {
      if (item && typeof item === "object" && "text" in item) {
        const text = (item as { text?: unknown }).text;
        if (typeof text === "string") parts.push(text);
      }
    }
  }

  return parts;
}

/**
 * True when the conversation contains `term`, case-insensitively.
 *
 * Stops at the first hit — a conversation is either in the filtered list or
 * not, and the long sessions this scans are exactly the ones where finishing
 * the scan would be wasted work.
 */
export function conversationMatches(
  file: ConversationFile,
  term: string,
): boolean {
  const needle = term.trim().toLowerCase();
  if (needle === "") return true;

  if (file.title?.toLowerCase().includes(needle)) return true;

  for (const line of file.messages) {
    for (const text of lineText(line)) {
      if (text.toLowerCase().includes(needle)) return true;
    }
  }

  return false;
}
