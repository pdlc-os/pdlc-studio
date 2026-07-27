import type { ModelOption } from "../types";

/**
 * How a model is named in the composer's selector.
 *
 * Three sources, in order of how much they can be trusted:
 *
 * 1. The description, which on a first-party CLI opens with exactly what is
 *    wanted ("Opus 5 with 1M context", "Haiku 4.5").
 * 2. The model id, which is all a Bedrock-backed CLI may offer in a
 *    recognisable form.
 * 3. `displayName`, unchanged, when neither parses.
 *
 * The fallback chain matters more than any single rule: a provider this code
 * has never seen should degrade to the CLI's own wording rather than to a
 * blank or a mangled string.
 */

/**
 * Families known today. Not a closed set — see `familyFrom` — but these are
 * matched first so a known name never loses to a generic guess.
 */
const FAMILIES = ["opus", "sonnet", "haiku", "fable"] as const;

/** Tokens that appear beside a family but are never one. */
const NOT_A_FAMILY = /^(v?\d+|\d{6,8}|claude|anthropic|us|eu|apac|latest)$/;

/**
 * The family token in an id, known or not.
 *
 * A closed list would go stale the first time a new model ships, so an
 * unrecognised id is still mined for a family-shaped token: purely alphabetic,
 * plausible length, and not one of the version/date/region tokens that sit
 * beside it. Anything failing that returns undefined and the caller falls back
 * to the CLI's own name — a wrong name is worse than the provider's.
 */
function familyFrom(id: string): string | undefined {
  const known = FAMILIES.find((candidate) =>
    new RegExp(`[.\\-]${candidate}([.\\-:]|$)`).test(id),
  );
  if (known) return known;

  const tokens = id
    .replace(/^arn:[^/]*\//, "")
    .split(/[.\-:/]/)
    .filter(Boolean);

  const claudeAt = tokens.indexOf("claude");
  if (claudeAt === -1) return undefined;

  return tokens
    .slice(claudeAt + 1)
    .find((token) => /^[a-z]{3,12}$/.test(token) && !NOT_A_FAMILY.test(token));
}

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/**
 * "Opus 5 with 1M context · Best for everyday tasks" -> "Opus 5".
 *
 * The first segment names the model and its version; everything after the
 * separator is capability copy, and "with … context" is a capability rather
 * than an identity.
 */
export function modelNameFromDescription(
  description: string,
): string | undefined {
  const head = description.split("·")[0]?.trim();
  if (!head) return undefined;

  const name = head.replace(/\s+with\s+.*$/i, "").trim();
  return name === "" ? undefined : name;
}

/**
 * A Bedrock-style model id -> "Sonnet 3.5", "Opus 5".
 *
 * Two generations of id are in circulation and they order the parts
 * differently:
 *
 *   anthropic.claude-3-5-sonnet-20240620-v1:0   version before family
 *   anthropic.claude-v5-opus:0                  family after a v-prefix
 *
 * Both are normalised to family-then-version, so the list reads consistently
 * however old the model is. A regional prefix ("us.", "eu.") is ignored, and
 * the date stamp is dropped: it distinguishes builds, not models.
 *
 * The trailing revision is kept **only when it is not v1**. Two Claude 3.5
 * Sonnets ship as -v1 and -v2 with the same family and version, so dropping it
 * would render them identically and make one of them unselectable.
 */
export function modelNameFromId(modelId: string): string | undefined {
  const id = modelId.toLowerCase();
  if (!id.includes("claude")) return undefined;

  const family = familyFrom(id);
  if (!family) return undefined;

  // "claude-v5-opus" / "claude-v4-5-sonnet" -> 5, 4.5
  // "claude-3-5-sonnet" / "claude-3-opus"   -> 3.5, 3
  const versioned =
    /claude-v(\d+)(?:-(\d+))?[-.]/.exec(id) ??
    /claude-(\d+)(?:-(\d+))?[-.]/.exec(id);

  if (!versioned) return undefined;

  const version = versioned[2]
    ? `${versioned[1]}.${versioned[2]}`
    : versioned[1];

  // A revision above v1 is a distinct model to the user ("Sonnet 3.5 v2").
  const revision = /-v([2-9]\d*):/.exec(id)?.[1];

  return revision
    ? `${titleCase(family)} ${version} v${revision}`
    : `${titleCase(family)} ${version}`;
}

/** The label for one option, and the identity used to de-duplicate the list. */
export function modelLabel(option: ModelOption): string {
  return (
    modelNameFromDescription(option.description) ??
    modelNameFromId(option.value) ??
    option.displayName
  );
}
