/**
 * Markdown list continuation for a plain `<textarea>`.
 *
 * A textarea has no notion of a list, so "typing a list" means the newline
 * carries the next marker: press a newline-producing key on `- foo` and the
 * next line opens with `- `. That is the whole of it — no rich text, no
 * contenteditable, and the buffer stays plain markdown, which is what actually
 * reaches Claude.
 */

/**
 * A list line: leading indent, a marker, whitespace, then the content.
 *
 * Ordered markers accept `.` and `)` because both are valid markdown and
 * people type both. Unordered accepts the three bullet characters markdown
 * allows, and the marker is echoed rather than normalised — someone typing `*`
 * deliberately should not have it silently rewritten to `-`.
 */
const LIST_LINE = /^(\s*)([-*+]|\d+[.)])([ \t]+)(.*)$/;

export interface Insertion {
  value: string;
  caret: number;
}

/** The line the caret sits on, as offsets into the value. */
function lineAround(
  value: string,
  caret: number,
): { start: number; end: number } {
  const start = value.lastIndexOf("\n", caret - 1) + 1;
  const lineEnd = value.indexOf("\n", caret);
  return { start, end: lineEnd === -1 ? value.length : lineEnd };
}

/**
 * Inserts a newline at the caret, continuing a list if the caret is in one.
 *
 * Three outcomes:
 *
 * - Not in a list: a plain newline, exactly as the textarea would have done.
 * - In a list with content: the next marker, with ordered lists incremented.
 * - In a list with an empty item: the marker is removed instead. That is how
 *   every markdown editor ends a list, and without it there is no way to stop
 *   without deleting the marker by hand.
 */
export function insertNewline(value: string, caret: number): Insertion {
  const { start } = lineAround(value, caret);
  const line = value.slice(start, caret);
  const match = LIST_LINE.exec(line);

  if (!match) {
    return {
      value: `${value.slice(0, caret)}\n${value.slice(caret)}`,
      caret: caret + 1,
    };
  }

  const [, indent, marker, spacing, content] = match;

  // An empty item ends the list: clear the marker, leave the caret on a blank
  // line rather than inserting another one.
  if (content.trim() === "") {
    return {
      value: value.slice(0, start) + value.slice(caret),
      caret: start,
    };
  }

  const next = /^\d+[.)]$/.test(marker)
    ? `${Number.parseInt(marker, 10) + 1}${marker.slice(-1)}`
    : marker;

  const prefix = `\n${indent}${next}${spacing}`;
  return {
    value: value.slice(0, caret) + prefix + value.slice(caret),
    caret: caret + prefix.length,
  };
}

/**
 * True when the keypress should produce a newline rather than send.
 *
 * Any of Alt/Opt, Ctrl, Cmd or Shift. The first three are unambiguous — no
 * mode binds them — so they insert a newline whichever way Enter is
 * configured. Shift is deliberately excluded here: in "newline" mode it is the
 * user's configured *send*, and quietly overriding a setting is worse than
 * offering one key fewer.
 */
export function isNewlineChord(event: {
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
}): boolean {
  return event.altKey || event.ctrlKey || event.metaKey;
}
