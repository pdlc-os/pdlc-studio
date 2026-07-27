import { describe, it, expect } from "vitest";
import { readContextUsage, formatTokens } from "./contextUsage";
import type { ModelUsage } from "../types";

function usage(partial: Partial<ModelUsage>): ModelUsage {
  return {
    inputTokens: 0,
    outputTokens: 0,
    cacheReadInputTokens: 0,
    cacheCreationInputTokens: 0,
    webSearchRequests: 0,
    costUSD: 0,
    contextWindow: 200_000,
    maxOutputTokens: 8192,
    ...partial,
  } as ModelUsage;
}

describe("readContextUsage", () => {
  it("counts cached tokens, which still occupy the window", () => {
    // Ignoring cache reads understates a long session badly — precisely when
    // the number matters most.
    const result = readContextUsage({
      opus: usage({
        inputTokens: 10_000,
        cacheReadInputTokens: 80_000,
        cacheCreationInputTokens: 10_000,
      }),
    });

    expect(result?.usedTokens).toBe(100_000);
    expect(result?.percent).toBe(50);
  });

  it("ignores output tokens, which do not sit in the window", () => {
    const result = readContextUsage({
      opus: usage({ inputTokens: 20_000, outputTokens: 100_000 }),
    });
    expect(result?.usedTokens).toBe(20_000);
  });

  it("prefers the largest window when a turn used several models", () => {
    // A subagent on a small model must not be mistaken for the conversation
    // the user is watching.
    const result = readContextUsage({
      haiku: usage({ inputTokens: 1_000, contextWindow: 20_000 }),
      opus: usage({ inputTokens: 50_000, contextWindow: 1_000_000 }),
    });

    expect(result?.contextWindow).toBe(1_000_000);
    expect(result?.percent).toBe(5);
  });

  it("clamps a window that somehow overflows", () => {
    const result = readContextUsage({
      opus: usage({ inputTokens: 500_000, contextWindow: 200_000 }),
    });
    expect(result?.percent).toBe(100);
  });

  it("returns null when there is nothing usable", () => {
    expect(readContextUsage(undefined)).toBeNull();
    expect(readContextUsage({})).toBeNull();
    expect(readContextUsage({ x: usage({ contextWindow: 0 }) })).toBeNull();
  });
});

describe("formatTokens", () => {
  it("shortens large counts", () => {
    expect(formatTokens(900)).toBe("900");
    expect(formatTokens(12_400)).toBe("12k");
    expect(formatTokens(1_500_000)).toBe("1.5M");
  });
});
