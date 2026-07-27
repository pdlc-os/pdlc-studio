/**
 * The CLI reports a slash command's own output by appending a user-role turn
 * whose entire content is a `<local-command-stdout>` block. It is not something
 * the user said, and the raw tags are not meant to be read.
 *
 * Most of it is an acknowledgement of an action the transcript already shows —
 * "Compacted" after a compaction — which is noise. But some commands put their
 * whole answer here (`/cost`), so the wrapper is unwrapped rather than the
 * message discarded wholesale.
 */

const BLOCK =
  /^\s*<local-command-stdout>([\s\S]*?)<\/local-command-stdout>\s*$/;

export interface LocalCommandOutput {
  /** The text inside the wrapper, trimmed. */
  text: string;
  /** True when the message says nothing the transcript does not already show. */
  isRedundant: boolean;
}

/**
 * Acknowledgements that restate what just happened.
 *
 * Matched rather than listed exhaustively: these are single words the CLI
 * prints on success, and a transcript that shows the command and its effect
 * does not need a turn saying the command ran.
 */
const ACKNOWLEDGEMENT = /^(compacted|cleared|done|ok)\b[\s.!]*$/i;

/**
 * Returns null when the content is not a command-output block, so ordinary
 * user text — including a message that merely mentions the tag — is untouched.
 */
export function readLocalCommandOutput(
  content: string,
): LocalCommandOutput | null {
  const match = BLOCK.exec(content);
  if (!match) return null;

  const text = match[1].trim();

  return { text, isRedundant: text === "" || ACKNOWLEDGEMENT.test(text) };
}
