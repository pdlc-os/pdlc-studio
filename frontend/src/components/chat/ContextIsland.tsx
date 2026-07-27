import { Icon } from "@astryxdesign/core/Icon";
import { Tooltip } from "@astryxdesign/core/Tooltip";
import { Loader } from "lucide-react";
import { formatTokens, type ContextUsage } from "../../utils/contextUsage";
import type { SDKStatus } from "../../types";

interface ContextIslandProps {
  usage: ContextUsage | null;
  status: SDKStatus;
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
export function ContextIsland({ usage, status }: ContextIslandProps) {
  const isCompacting = status === "compacting";

  if (!usage && !isCompacting) return null;

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

  const { percent, usedTokens, contextWindow } = usage as ContextUsage;

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
