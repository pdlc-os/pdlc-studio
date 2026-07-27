import { Icon } from "@astryxdesign/core/Icon";
import { Tooltip } from "@astryxdesign/core/Tooltip";
import { Loader } from "lucide-react";
import { formatTokens, type ContextUsage } from "../../utils/contextUsage";
import type { SDKStatus } from "../../types";

interface ContextIslandProps {
  usage: ContextUsage | null;
  status: SDKStatus;
  /** Tasks still working, which take the island over while they run. */
  runningAgents?: number;
  /** Opens the Agents tab; absent outside the chat route. */
  onShowAgents?: () => void;
}

/**
 * Above this the window is filling up enough to be worth noticing; above the
 * second threshold compaction is close. Purely presentational — nothing acts
 * on these.
 */
const WARN_PERCENT = 70;
const HIGH_PERCENT = 90;

function level(percent: number): "normal" | "warn" | "high" {
  if (percent >= HIGH_PERCENT) return "high";
  if (percent >= WARN_PERCENT) return "warn";
  return "normal";
}

/**
 * A small status surface beside the model control.
 *
 * It shows one thing at a time and swaps what that is as state changes — the
 * context window normally, compaction while it runs. Deliberately built as a
 * slot rather than a percentage readout, so later states (rate limits, queued
 * work) can take the same space without a new control appearing in the
 * composer.
 *
 * It renders nothing until there is something true to say: a fresh
 * conversation has no usage figure, and inventing a 0% would be a claim about
 * a window nothing has measured.
 */
export function ContextIsland({
  usage,
  status,
  runningAgents = 0,
  onShowAgents,
}: ContextIslandProps) {
  const isCompacting = status === "compacting";

  /*
   * Always present once a conversation is open.
   *
   * It used to hide until a turn had reported usage, which meant a new session
   * showed nothing at all and the control appeared to be missing. The window
   * genuinely has not been measured yet, so the idle state says so with a dash
   * rather than inventing a 0% — but it occupies its slot, so the composer
   * does not reflow the moment the first result lands.
   */

  if (isCompacting) {
    return (
      <Tooltip content="Claude is compacting the conversation to free up context.">
        <span
          className="context-island"
          data-state="compacting"
          data-testid="context-island"
          // A live region: compaction can take a while, and a sighted user sees
          // the spinner where a screen-reader user would otherwise get nothing.
          role="status"
        >
          <span className="context-island-spinner" aria-hidden="true">
            <Icon icon={Loader} size="sm" />
          </span>
          <span>Compacting…</span>
        </span>
      </Tooltip>
    );
  }

  /*
   * Agents outrank the context reading.
   *
   * Both are ambient status, but only one is transient: a fan-out is the thing
   * you want to know about while it is happening, and the percentage is still
   * a click away in the same place. Compaction still outranks both above,
   * since it is the state that blocks everything else.
   */
  if (runningAgents > 0) {
    const noun = runningAgents === 1 ? "agent" : "agents";

    return (
      <Tooltip content="Show what the agents and workflows are doing">
        <button
          type="button"
          className="context-island"
          data-state="agents"
          data-testid="context-island"
          onClick={onShowAgents}
          aria-label={`${runningAgents} ${noun} running. Show the Agents panel.`}
          // A live region: agents come and go without the user acting, and the
          // count changing is the only notice of it.
          aria-live="polite"
        >
          <span className="context-island-pulse" aria-hidden="true" />
          <span className="context-island-percent">{runningAgents}</span>
          <span className="context-island-label">{noun} running</span>
        </button>
      </Tooltip>
    );
  }

  if (!usage) {
    return (
      <Tooltip content="Context usage is reported when a turn completes.">
        <span
          className="context-island"
          data-state="idle"
          data-testid="context-island"
        >
          <span className="context-island-meter" aria-hidden="true">
            <span className="context-island-fill" style={{ inlineSize: 0 }} />
          </span>
          <span className="context-island-percent">—</span>
          <span className="context-island-label">context</span>
        </span>
      </Tooltip>
    );
  }

  const { percent, usedTokens, contextWindow } = usage;

  return (
    <Tooltip
      content={`${formatTokens(usedTokens)} of ${formatTokens(contextWindow)} tokens used`}
    >
      <span
        className="context-island"
        data-state="context"
        data-level={level(percent)}
        data-testid="context-island"
      >
        <span className="context-island-meter" aria-hidden="true">
          <span
            className="context-island-fill"
            style={{ inlineSize: `${percent}%` }}
          />
        </span>
        <span className="context-island-percent">{percent}%</span>
        <span className="context-island-label">context</span>
      </span>
    </Tooltip>
  );
}
