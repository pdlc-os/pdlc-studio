import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { ContextIsland } from "./ContextIsland";
import { AstryxProvider } from "../AstryxProvider";
import { SettingsProvider } from "../../contexts/SettingsContext";
import type { ContextUsage } from "../../utils/contextUsage";

function renderIsland(usage: ContextUsage | null, status: "compacting" | null) {
  return render(
    <SettingsProvider>
      <AstryxProvider>
        <ContextIsland usage={usage} status={status} />
      </AstryxProvider>
    </SettingsProvider>,
  );
}

const USAGE: ContextUsage = {
  percent: 42,
  usedTokens: 42_000,
  contextWindow: 100_000,
};

describe("ContextIsland", () => {
  it("shows nothing before a turn has reported usage", () => {
    // A fresh conversation has measured nothing, and rendering 0% would be a
    // claim rather than a reading.
    renderIsland(null, null);
    expect(screen.queryByTestId("context-island")).toBeNull();
  });

  it("shows the context percentage", () => {
    renderIsland(USAGE, null);
    const island = screen.getByTestId("context-island");
    expect(island).toHaveAttribute("data-state", "context");
    expect(island).toHaveTextContent("42%");
  });

  it("escalates the level as the window fills", () => {
    const levels = [10, 75, 95].map((percent) => {
      const { unmount } = renderIsland({ ...USAGE, percent }, null);
      const level = screen.getByTestId("context-island").dataset.level;
      unmount();
      return level;
    });

    expect(levels).toEqual(["normal", "warn", "high"]);
  });

  it("announces compaction, and drops the percentage while it runs", () => {
    // Compaction changes the number that would be on screen, so showing the
    // stale one next to a spinner would be worse than showing neither.
    renderIsland(USAGE, "compacting");

    const island = screen.getByRole("status");
    expect(island).toHaveAttribute("data-state", "compacting");
    expect(island).toHaveTextContent("Compacting");
    expect(island).not.toHaveTextContent("42%");
  });

  it("appears during compaction even with no usage yet", () => {
    renderIsland(null, "compacting");
    expect(screen.getByTestId("context-island")).toHaveAttribute(
      "data-state",
      "compacting",
    );
  });
});
