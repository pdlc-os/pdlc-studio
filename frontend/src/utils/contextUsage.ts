import type { ModelUsage } from "../types";

export interface ContextUsage {
  /** Tokens currently occupying the context window. */
  usedTokens: number;
  /** The model's total context window. */
  contextWindow: number;
  /** 0-100, clamped. */
  percent: number;
}

/**
 * How full the context window is, from a result message's per-model usage.
 *
 * Everything the model had to read counts, not just fresh input: cached tokens
 * still occupy the window, and omitting them understates a long session badly
 * — which is exactly when the number matters.
 *
 * A turn can touch more than one model (a subagent on a cheaper one). The
 * largest window is taken as the main conversation's, since that is the one the
 * user is watching fill up.
 */
export function readContextUsage(
  modelUsage: Record<string, ModelUsage> | undefined,
): ContextUsage | null {
  if (!modelUsage) return null;

  let best: ContextUsage | null = null;

  for (const usage of Object.values(modelUsage)) {
    if (!usage || typeof usage.contextWindow !== "number") continue;
    if (usage.contextWindow <= 0) continue;

    const usedTokens =
      (usage.inputTokens ?? 0) +
      (usage.cacheReadInputTokens ?? 0) +
      (usage.cacheCreationInputTokens ?? 0);

    const candidate = usageFromTokens(usedTokens, usage.contextWindow);

    if (candidate && (!best || candidate.contextWindow > best.contextWindow)) {
      best = candidate;
    }
  }

  return best;
}

/**
 * A reading built from a token count against a known window.
 *
 * Compaction reports what it left behind (`post_tokens`) but not the window it
 * left it in, so the window has to come from the last reading. Without this the
 * island would sit on its pre-compaction number until the *next* turn ended,
 * which is precisely the moment a user looks at it to see whether compaction
 * bought them anything.
 */
export function usageFromTokens(
  usedTokens: number,
  contextWindow: number,
): ContextUsage | null {
  if (!Number.isFinite(usedTokens) || usedTokens < 0) return null;
  if (!Number.isFinite(contextWindow) || contextWindow <= 0) return null;

  return {
    usedTokens,
    contextWindow,
    percent: Math.min(
      100,
      Math.max(0, Math.round((usedTokens / contextWindow) * 100)),
    ),
  };
}

/** Compact form for the island: "12k / 200k". */
export function formatTokens(count: number): string {
  if (count < 1000) return `${count}`;
  if (count < 1_000_000) return `${Math.round(count / 1000)}k`;
  return `${(count / 1_000_000).toFixed(1)}M`;
}
