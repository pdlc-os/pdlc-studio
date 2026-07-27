/**
 * The CLI's slash-command plumbing, which arrives as user-role turns.
 *
 * Running `/compact` produces up to three of these, none of which is something
 * the user typed:
 *
 *   <local-command-caveat>  an instruction to the model about the turns below
 *   <command-name>…         the invocation, in the CLI's own markup
 *   <local-command-stdout>  whatever the command printed
 *
 * Rendered verbatim they read as the user having said several paragraphs of
 * XML. This turns each back into what it actually is, so the transcript can
 * show the command the user ran and drop the machinery around it.
 */

const OUTPUT =
  /^\s*<local-command-stdout>([\s\S]*?)<\/local-command-stdout>\s*$/;

const CAVEAT = /^\s*<local-command-caveat>[\s\S]*?<\/local-command-caveat>\s*$/;

const INVOCATION = /^\s*<command-name>([\s\S]*?)<\/command-name>/;
const INVOCATION_ARGS = /<command-args>([\s\S]*?)<\/command-args>/;

export type LocalCommandTurn =
  /** The command the user ran, as they would have typed it. */
  | { kind: "invocation"; text: string }
  /** Guidance aimed at the model, never at the reader. */
  | { kind: "caveat" }
  /** What the command printed. */
  | { kind: "output"; text: string; isRedundant: boolean };

/**
 * Acknowledgements that restate what just happened.
 *
 * Matched rather than listed exhaustively: these are the single words the CLI
 * prints on success, and a transcript that already shows the command and its
 * effect does not need a turn saying the command ran.
 */
const ACKNOWLEDGEMENT = /^(compacted|cleared|done|ok)\b[\s.!]*$/i;

/**
 * Returns null when the content is ordinary user text, so a message that
 * merely mentions one of these tags is left alone.
 */
export function readLocalCommandTurn(content: string): LocalCommandTurn | null {
  const output = OUTPUT.exec(content);
  if (output) {
    const text = output[1].trim();
    return {
      kind: "output",
      text,
      isRedundant: text === "" || ACKNOWLEDGEMENT.test(text),
    };
  }

  if (CAVEAT.test(content)) return { kind: "caveat" };

  const invocation = INVOCATION.exec(content);
  if (invocation) {
    const name = invocation[1].trim();
    const args = INVOCATION_ARGS.exec(content)?.[1].trim() ?? "";

    // Reassembled as the user typed it, which is also what makes the
    // transcript's command highlighting recognise it.
    return { kind: "invocation", text: args ? `${name} ${args}` : name };
  }

  return null;
}
