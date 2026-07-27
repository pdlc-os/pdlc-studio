import type { AttachmentInfo } from "../types";

export interface MentionQuery {
  /** Text typed after the `@`, which may be empty. */
  query: string;
  /** Index of the `@` itself, so the token can be replaced in place. */
  start: number;
  /** Index just past the token. */
  end: number;
}

/**
 * The `@` token the caret currently sits in, or null when there is none.
 *
 * Unlike the `/` picker, a mention is not anchored to the start of the line —
 * the point of it is to name a file *inside* a sentence ("compare @a.ts with
 * @b.ts"). So the search runs backwards from the caret and stops at the first
 * whitespace, and the token only counts when the `@` begins a word: an email
 * address or a decorator in pasted code is not someone reaching for the picker.
 */
export function getMentionQuery(
  value: string,
  caret: number,
): MentionQuery | null {
  const upToCaret = value.slice(0, caret);
  const at = upToCaret.lastIndexOf("@");
  if (at === -1) return null;

  const query = upToCaret.slice(at + 1);

  // Whitespace ends a token: the caret has moved on to the next word.
  if (/\s/.test(query)) return null;

  const before = at === 0 ? "" : value[at - 1];
  if (before !== "" && !/\s/.test(before)) return null;

  return { query, start: at, end: caret };
}

/** The trailing path segment, which is what a mention reads as. */
export function attachmentName(attachment: AttachmentInfo): string {
  const segments = attachment.path.split("/");
  return segments[segments.length - 1] || attachment.path;
}

/**
 * Attachments matching what has been typed, best first.
 *
 * Substring rather than fuzzy: the candidates are a handful of files the user
 * attached moments ago and whose names they already know, so ranking cleverness
 * would mostly be a way to put the wrong file first. A prefix match still wins
 * over a match in the middle.
 */
export function filterAttachments(
  attachments: AttachmentInfo[],
  query: string,
): AttachmentInfo[] {
  const needle = query.toLowerCase();
  if (needle === "") return attachments;

  return attachments
    .map((attachment) => {
      const name = attachmentName(attachment).toLowerCase();
      return { attachment, index: name.indexOf(needle) };
    })
    .filter((candidate) => candidate.index !== -1)
    .sort((a, b) => a.index - b.index)
    .map((candidate) => candidate.attachment);
}

/**
 * What a mention inserts.
 *
 * The bare filename, because that is what the user is writing a sentence
 * around and the message already carries a labelled block of full paths for
 * Claude to resolve against. When two attachments share a filename that block
 * cannot disambiguate them, so those mentions carry the full path instead —
 * unambiguous beats tidy when the alternative is Claude reading the wrong file.
 */
export function mentionText(
  attachment: AttachmentInfo,
  attachments: AttachmentInfo[],
): string {
  const name = attachmentName(attachment);
  const isAmbiguous =
    attachments.filter((other) => attachmentName(other) === name).length > 1;

  return `@${isAmbiguous ? attachment.path : name}`;
}

/** The text with the mention token replaced, and where the caret lands. */
export function applyMention(
  value: string,
  token: MentionQuery,
  insertion: string,
): { value: string; caret: number } {
  // A trailing space both continues the sentence and closes the picker, since
  // whitespace ends the token.
  const replacement = `${insertion} `;

  return {
    value: value.slice(0, token.start) + replacement + value.slice(token.end),
    caret: token.start + replacement.length,
  };
}
