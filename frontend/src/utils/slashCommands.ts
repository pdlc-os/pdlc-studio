import type { SlashCommandInfo } from "../types";

/**
 * The query the `/` picker should filter on, or null when the picker should be
 * closed.
 *
 * The menu is only open while the entire input is a single unbroken `/token`.
 * Typing a space means the user has moved on to arguments (`/review 123`), and
 * a command that is still being *chosen* is indistinguishable from one already
 * chosen unless the picker gets out of the way at that point. Anything with
 * leading text ("see /review") is prose, not an invocation.
 */
export function getSlashQuery(input: string): string | null {
  const match = /^\/(\S*)$/.exec(input);
  return match ? match[1] : null;
}

/**
 * The leading `/command` token, but only when it names a command that actually
 * exists.
 *
 * Used to tint the command inside the composer. Gating on a real command means
 * the colour doubles as validation — a typo stays plain text — and it is why a
 * half-typed `/rev` is not tinted until it resolves. An empty `commands` list
 * (discovery failed) simply highlights nothing.
 */
export function getCommandToken(
  input: string,
  commands: SlashCommandInfo[],
): string | null {
  const match = /^\/(\S+)/.exec(input);
  if (!match) return null;

  const token = match[1];
  const isKnown = commands.some(
    (command) => command.name === token || command.aliases?.includes(token),
  );

  return isKnown ? token : null;
}

/**
 * Stable per-option DOM id, so the composer textarea can point at the active
 * row via `aria-activedescendant`.
 */
export function slashOptionId(listboxId: string, index: number) {
  return `${listboxId}-option-${index}`;
}

export interface CommandMatch {
  command: SlashCommandInfo;
  /** Indices into the display name that matched, for highlighting. */
  matchedIndices: number[];
  /** The name that produced the match — an alias when one scored better. */
  matchedName: string;
  score: number;
}

/**
 * Case-insensitive subsequence match.
 *
 * Returns the matched character positions, or null when `query` is not a
 * subsequence of `target`. Preferring the earliest match for each query
 * character keeps highlights anchored to the front of the name, which reads
 * better than a greedy tail-biased match.
 */
function subsequenceMatch(target: string, query: string): number[] | null {
  if (query === "") return [];

  const haystack = target.toLowerCase();
  const needle = query.toLowerCase();
  const indices: number[] = [];

  let position = 0;
  for (const char of needle) {
    const found = haystack.indexOf(char, position);
    if (found === -1) return null;
    indices.push(found);
    position = found + 1;
  }

  return indices;
}

/**
 * Scores one name against the query. Higher is better; null means no match.
 *
 * The tiers matter more than the exact numbers: an exact name always wins, a
 * prefix beats a substring, and a scattered subsequence ranks last. Within a
 * tier, shorter names win, so `/init` outranks `/initialize-everything` for
 * the query "init".
 */
function scoreName(name: string, query: string): CommandMatch["score"] | null {
  const lowerName = name.toLowerCase();
  const lowerQuery = query.toLowerCase();

  if (query === "") return 1000 - Math.min(lowerName.length, 100);
  if (lowerName === lowerQuery) return 5000;
  if (lowerName.startsWith(lowerQuery)) {
    return 4000 - Math.min(lowerName.length, 100);
  }

  const substringIndex = lowerName.indexOf(lowerQuery);
  if (substringIndex !== -1) {
    // A match right after a separator reads as a prefix of a segment
    // ("security-review" for "review"), so rank it above a mid-word hit.
    const isSegmentStart =
      substringIndex > 0 && /[-_:/]/.test(lowerName[substringIndex - 1]);
    return (isSegmentStart ? 3500 : 3000) - substringIndex;
  }

  return subsequenceMatch(lowerName, lowerQuery) ? 2000 : null;
}

/**
 * Filters and ranks commands for the picker.
 *
 * Aliases are searched too, but the result always reports the canonical name
 * alongside whichever name actually matched, so typing "cost" can surface
 * `/usage` without the row lying about what it will insert.
 */
export function filterCommands(
  commands: SlashCommandInfo[],
  query: string,
): CommandMatch[] {
  const matches: CommandMatch[] = [];

  for (const command of commands) {
    // Aliases only compete when there is something to match against. On an
    // empty query every name scores purely on length, so a short alias would
    // beat its own canonical name and every row would be annotated "via
    // /alias" before the user has typed anything.
    const candidates =
      query === ""
        ? [command.name]
        : [command.name, ...(command.aliases ?? [])];

    let best: { name: string; score: number } | null = null;
    for (const candidate of candidates) {
      const score = scoreName(candidate, query);
      if (score !== null && (best === null || score > best.score)) {
        best = { name: candidate, score };
      }
    }

    if (best === null) continue;

    matches.push({
      command,
      matchedName: best.name,
      matchedIndices: subsequenceMatch(best.name, query) ?? [],
      score: best.score,
    });
  }

  return matches.sort(
    (a, b) => b.score - a.score || a.command.name.localeCompare(b.command.name),
  );
}
