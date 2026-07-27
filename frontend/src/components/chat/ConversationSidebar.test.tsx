import { render, screen, within, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ConversationSidebar } from "./ConversationSidebar";
import { AstryxProvider } from "../AstryxProvider";
import { SettingsProvider } from "../../contexts/SettingsContext";
import type { ConversationSummary } from "../../types";

function summary(
  sessionId: string,
  title: string,
  isStarred = false,
): ConversationSummary {
  return {
    sessionId,
    title,
    isStarred,
    startTime: "2026-07-26T10:00:00.000Z",
    lastTime: "2026-07-26T10:05:00.000Z",
    messageCount: 4,
    lastMessagePreview: "preview",
  };
}

function renderSidebar(
  conversations: ConversationSummary[],
  overrides: Partial<Parameters<typeof ConversationSidebar>[0]> = {},
) {
  const onToggleStar = vi.fn();

  render(
    <SettingsProvider>
      <AstryxProvider>
        <ConversationSidebar
          projectPath="/Users/dev/project"
          conversations={conversations}
          isLoading={false}
          error={null}
          activeSessionId={null}
          onSelect={vi.fn()}
          onNewSession={vi.fn()}
          onRefresh={vi.fn()}
          onRename={vi.fn()}
          onDelete={vi.fn()}
          onClose={vi.fn()}
          onToggleStar={onToggleStar}
          onClearAll={vi.fn()}
          searchTerm=""
          onSearchChange={vi.fn()}
          isSearching={false}
          {...overrides}
        />
      </AstryxProvider>
    </SettingsProvider>,
  );

  return { onToggleStar };
}

/** The rows under a named section heading. */
function rowsUnder(heading: string): string[] {
  const section = screen
    .getAllByRole("region", { hidden: true })
    .concat(Array.from(document.querySelectorAll("section")) as HTMLElement[])
    .find((node) =>
      within(node).queryByRole("heading", { name: heading, level: 2 }),
    );

  if (!section) return [];
  return Array.from(section.querySelectorAll(".conversation-item-title")).map(
    (node) => node.textContent ?? "",
  );
}

describe("ConversationSidebar starring", () => {
  it("has no starred section when nothing is starred", () => {
    renderSidebar([summary("a", "First"), summary("b", "Second")]);

    // An empty heading would be a standing reminder of an unused feature.
    expect(screen.queryByRole("heading", { name: "Starred" })).toBeNull();
    expect(
      screen.queryByRole("heading", { name: "All conversations" }),
    ).toBeNull();
    expect(screen.getAllByTestId("conversation-item")).toHaveLength(2);
  });

  it("lists starred conversations in their own section, above the rest", () => {
    renderSidebar([
      summary("a", "First"),
      summary("b", "Second", true),
      summary("c", "Third"),
    ]);

    expect(rowsUnder("Starred")).toEqual(["Second"]);
    expect(rowsUnder("All conversations")).toEqual(["First", "Third"]);

    // Starred must come first in the document, not just in its own box.
    const headings = screen.getAllByRole("heading", { level: 2 });
    expect(headings.map((h) => h.textContent)).toEqual([
      "Starred",
      "All conversations",
    ]);
  });

  it("never lists the same conversation twice", () => {
    renderSidebar([summary("a", "First", true), summary("b", "Second")]);

    const titles = screen
      .getAllByTestId("conversation-item")
      .map((row) => row.querySelector(".conversation-item-title")?.textContent);

    expect(titles).toEqual(["First", "Second"]);
    expect(new Set(titles).size).toBe(titles.length);
  });

  it("asks to star an unstarred conversation, and unstar a starred one", () => {
    const { onToggleStar } = renderSidebar([
      summary("a", "First"),
      summary("b", "Second", true),
    ]);

    // The desired state is derived by the caller from `isStarred`, so the
    // control only has to identify which conversation was clicked.
    fireEvent.click(screen.getByRole("button", { name: /^Star First$/ }));
    expect(onToggleStar).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: "a" }),
    );

    fireEvent.click(screen.getByRole("button", { name: /^Unstar Second$/ }));
    expect(onToggleStar).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: "b" }),
    );
  });

  it("marks the row so the star can be styled as set", () => {
    renderSidebar([summary("a", "First", true), summary("b", "Second")]);

    const rows = screen.getAllByTestId("conversation-item");
    expect(rows[0].dataset.starred).toBe("true");
    expect(rows[1].dataset.starred).toBeUndefined();
  });
});
