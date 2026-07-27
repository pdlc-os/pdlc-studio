import {
  render,
  screen,
  waitFor,
  fireEvent,
  act,
  within,
} from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useState } from "react";
import { MemoryRouter } from "react-router-dom";
import { ChatInput } from "./ChatInput";
import { AstryxProvider } from "../AstryxProvider";
import { SlashCommandsProvider } from "../../contexts/SlashCommandsContext";
import { SettingsProvider } from "../../contexts/SettingsContext";
import type { SlashCommandInfo } from "../../types";

global.fetch = vi.fn();

const COMMANDS: SlashCommandInfo[] = [
  { name: "clear", description: "Clear history", argumentHint: "" },
  {
    name: "compact",
    description: "Compact the conversation",
    argumentHint: "",
  },
  { name: "review", description: "Review a PR", argumentHint: "<pr>" },
  { name: "security-review", description: "Audit changes", argumentHint: "" },
];

function mockCommands(commands: SlashCommandInfo[] = COMMANDS) {
  const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ commands }),
  });
}

/** Wraps ChatInput with real input state so typing behaves as it does in the app. */
function Harness({ onSubmit = vi.fn() }: { onSubmit?: () => void }) {
  const [input, setInput] = useState("");
  return (
    <MemoryRouter>
      <SettingsProvider>
        <AstryxProvider>
          <SlashCommandsProvider workingDirectory="/tmp/project">
            <ChatInput
              input={input}
              isLoading={false}
              currentRequestId={null}
              onInputChange={setInput}
              onSubmit={onSubmit}
              onAbort={vi.fn()}
              permissionMode="default"
              onPermissionModeChange={vi.fn()}
            />
          </SlashCommandsProvider>
        </AstryxProvider>
      </SettingsProvider>
    </MemoryRouter>
  );
}

/**
 * Renders the harness and lets the discovery fetch settle.
 *
 * Without the flush, the resolving promise updates state after the test body
 * has moved on, which React reports as an un-acted update.
 */
async function renderHarness(props: { onSubmit?: () => void } = {}) {
  const utils = render(<Harness {...props} />);
  await act(async () => {});
  return utils;
}

/**
 * Options *within the slash menu*.
 *
 * The model selector beside Send is built from Selectors, which put their own
 * `role="option"` nodes in the DOM, so an unscoped query counts those too.
 */
function slashOptions() {
  const menu = screen.queryByTestId("slash-command-menu");
  return menu ? within(menu).queryAllByRole("option") : [];
}

function getTextarea() {
  // Named explicitly: the model selector's dropdowns are comboboxes too, so a
  // bare role query is ambiguous once the composer has one beside Send.
  return screen.getByRole("combobox", {
    name: "Message",
  }) as HTMLTextAreaElement;
}

describe("ChatInput slash command picker", () => {
  beforeEach(() => {
    mockCommands();
  });

  it("stays closed for ordinary text", async () => {
    await renderHarness();
    fireEvent.change(getTextarea(), { target: { value: "hello" } });

    expect(screen.queryByTestId("slash-command-menu")).not.toBeInTheDocument();
  });

  it("opens on '/' and lists every discovered command", async () => {
    await renderHarness();
    fireEvent.change(getTextarea(), { target: { value: "/" } });

    await waitFor(() => {
      expect(screen.getByTestId("slash-command-menu")).toBeInTheDocument();
    });
    expect(slashOptions()).toHaveLength(COMMANDS.length);
  });

  it("narrows the list as the query is typed", async () => {
    await renderHarness();
    fireEvent.change(getTextarea(), { target: { value: "/comp" } });

    await waitFor(() => {
      expect(slashOptions()).toHaveLength(1);
    });
    expect(slashOptions()[0]).toHaveTextContent("compact");
  });

  it("selects a command without typing its full name", async () => {
    await renderHarness();
    // "srev" is only a subsequence of "security-review", never a prefix.
    fireEvent.change(getTextarea(), { target: { value: "/srev" } });

    await waitFor(() => {
      expect(slashOptions()[0]).toHaveTextContent("security-review");
    });

    fireEvent.keyDown(getTextarea(), { key: "Enter" });
    expect(getTextarea().value).toBe("/security-review ");
  });

  it("moves the highlight with the arrow keys and commits on Enter", async () => {
    await renderHarness();
    fireEvent.change(getTextarea(), { target: { value: "/c" } });

    await waitFor(() => {
      expect(slashOptions().length).toBeGreaterThan(1);
    });

    // Both "clear" and "compact" prefix-match "c"; the shorter name ranks
    // first, so arrowing down once lands on "compact".
    const options = slashOptions();
    expect(options[0]).toHaveAttribute("aria-selected", "true");

    fireEvent.keyDown(getTextarea(), { key: "ArrowDown" });
    expect(slashOptions()[1]).toHaveAttribute("aria-selected", "true");

    fireEvent.keyDown(getTextarea(), { key: "Enter" });
    expect(getTextarea().value).toBe("/compact ");
  });

  it("does not submit while the menu is open", async () => {
    const onSubmit = vi.fn();
    await renderHarness({ onSubmit });
    fireEvent.change(getTextarea(), { target: { value: "/clear" } });

    await waitFor(() => {
      expect(screen.getByTestId("slash-command-menu")).toBeInTheDocument();
    });

    fireEvent.keyDown(getTextarea(), { key: "Enter" });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("closes once arguments are typed, so Enter sends again", async () => {
    const onSubmit = vi.fn();
    await renderHarness({ onSubmit });
    fireEvent.change(getTextarea(), { target: { value: "/review 42" } });

    await waitFor(() => {
      expect(
        screen.queryByTestId("slash-command-menu"),
      ).not.toBeInTheDocument();
    });

    fireEvent.keyDown(getTextarea(), { key: "Enter" });
    expect(onSubmit).toHaveBeenCalled();
  });

  it("Escape dismisses the menu without clearing the text", async () => {
    await renderHarness();
    fireEvent.change(getTextarea(), { target: { value: "/cle" } });

    await waitFor(() => {
      expect(screen.getByTestId("slash-command-menu")).toBeInTheDocument();
    });

    fireEvent.keyDown(getTextarea(), { key: "Escape" });

    expect(screen.queryByTestId("slash-command-menu")).not.toBeInTheDocument();
    expect(getTextarea().value).toBe("/cle");
  });

  it("keeps working when discovery fails", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("no cli"),
    );
    await renderHarness();
    fireEvent.change(getTextarea(), { target: { value: "/" } });

    // No menu, but the text is still accepted and sendable.
    await waitFor(() => {
      expect(getTextarea().value).toBe("/");
    });
    expect(screen.queryByTestId("slash-command-menu")).not.toBeInTheDocument();
  });
});

describe("ChatInput command highlighting", () => {
  beforeEach(() => {
    mockCommands();
  });

  /** The overlay copy of the text; the textarea itself renders transparent. */
  function highlighted() {
    return document.querySelector(".composer-highlight-command");
  }

  it("tints the command and leaves the rest of the message alone", async () => {
    await renderHarness();
    fireEvent.change(getTextarea(), {
      target: { value: "/review the auth module" },
    });

    await waitFor(() => expect(highlighted()).not.toBeNull());
    expect(highlighted()).toHaveTextContent("/review");

    // The remainder is present in the overlay but outside the tinted span.
    const overlay = document.querySelector(".composer-highlight");
    expect(overlay).toHaveTextContent("/review the auth module");
    expect(highlighted()).not.toHaveTextContent("auth");
  });

  it("carries the tint over when a command is picked from the menu", async () => {
    await renderHarness();
    fireEvent.change(getTextarea(), { target: { value: "/sec" } });

    await waitFor(() => {
      expect(slashOptions()[0]).toHaveTextContent("security-review");
    });
    fireEvent.keyDown(getTextarea(), { key: "Enter" });

    expect(getTextarea().value).toBe("/security-review ");
    await waitFor(() =>
      expect(highlighted()).toHaveTextContent("/security-review"),
    );
  });

  it("leaves an unknown command untinted", async () => {
    await renderHarness();
    fireEvent.change(getTextarea(), { target: { value: "/notacommand" } });

    await waitFor(() => expect(getTextarea().value).toBe("/notacommand"));
    expect(highlighted()).toBeNull();
  });

  it("leaves ordinary prose untinted", async () => {
    await renderHarness();
    fireEvent.change(getTextarea(), { target: { value: "see /review later" } });

    await waitFor(() => expect(getTextarea().value).toBe("see /review later"));
    expect(highlighted()).toBeNull();
  });
});

describe("ChatInput auto-resize", () => {
  beforeEach(() => {
    mockCommands([]);
  });

  it("grows the textarea to fit content and caps it", async () => {
    await renderHarness();
    const textarea = getTextarea();

    // jsdom does not lay text out, so scrollHeight is driven directly to stand
    // in for a tall block of content.
    Object.defineProperty(textarea, "scrollHeight", {
      configurable: true,
      value: 120,
    });
    fireEvent.change(textarea, { target: { value: "many\nlines\nof\ntext" } });
    expect(textarea.style.height).toBe("120px");
    expect(textarea.style.overflowY).toBe("hidden");

    // Past the ceiling the box stops growing and starts scrolling instead.
    Object.defineProperty(textarea, "scrollHeight", {
      configurable: true,
      value: 5000,
    });
    fireEvent.change(textarea, {
      target: { value: "an enormous pasted file" },
    });
    expect(textarea.style.height).toBe("320px");
    expect(textarea.style.overflowY).toBe("auto");
  });

  it("shrinks back to a single row when cleared", async () => {
    await renderHarness();
    const textarea = getTextarea();

    Object.defineProperty(textarea, "scrollHeight", {
      configurable: true,
      value: 200,
    });
    fireEvent.change(textarea, { target: { value: "several\nlines" } });
    expect(textarea.style.height).toBe("200px");

    Object.defineProperty(textarea, "scrollHeight", {
      configurable: true,
      value: 0,
    });
    fireEvent.change(textarea, { target: { value: "" } });
    expect(textarea.style.height).toBe("40px");
  });
});

describe("ChatInput permission mode tag", () => {
  beforeEach(() => {
    mockCommands([]);
  });

  it("shows the tag for each mode, and explains it to assistive tech", async () => {
    // The visible tag is intentionally terse, so the accessible name has to
    // carry the meaning — and must still contain the visible text, or
    // speech-input users cannot name the control they can see.
    const cases = [
      ["bypassPermissions", "#YOLO", "bypass permissions"],
      ["default", "#Classic", "normal mode"],
      ["plan", "#Plan", "plan mode"],
      ["acceptEdits", "#Auto", "accept edits"],
    ] as const;

    for (const [mode, tag, description] of cases) {
      const { unmount } = render(
        <MemoryRouter>
          <SettingsProvider>
            <AstryxProvider>
              <ChatInput
                input=""
                isLoading={false}
                currentRequestId={null}
                onInputChange={vi.fn()}
                onSubmit={vi.fn()}
                onAbort={vi.fn()}
                permissionMode={mode}
                onPermissionModeChange={vi.fn()}
              />
            </AstryxProvider>
          </SettingsProvider>
        </MemoryRouter>,
      );

      const toggle = screen.getByTestId("permission-mode-toggle");
      expect(toggle).toHaveTextContent(tag);

      const name = toggle.getAttribute("aria-label") ?? "";
      expect(name).toContain(tag);
      expect(name).toContain(description);

      unmount();
    }
  });
});

/**
 * The context island is the one control that has to survive the send/stop
 * swap: compaction only ever runs mid-turn, so an island that lives in the
 * idle branch is hidden for exactly the window it has something to report.
 * That is how it originally shipped, and only a live /compact caught it.
 */
describe("context island placement", () => {
  const ISLAND_PROPS = {
    contextUsage: { percent: 42, usedTokens: 4200, contextWindow: 10000 },
  } as const;

  function renderComposer(extra: Record<string, unknown>) {
    return render(
      <MemoryRouter>
        <SettingsProvider>
          <AstryxProvider>
            <SlashCommandsProvider workingDirectory="/tmp/project">
              <ChatInput
                input=""
                isLoading={false}
                currentRequestId={null}
                onInputChange={vi.fn()}
                onSubmit={vi.fn()}
                onAbort={vi.fn()}
                permissionMode="default"
                onPermissionModeChange={vi.fn()}
                {...ISLAND_PROPS}
                {...extra}
              />
            </SlashCommandsProvider>
          </AstryxProvider>
        </SettingsProvider>
      </MemoryRouter>,
    );
  }

  it("stays visible while a turn is running", async () => {
    renderComposer({ isLoading: true, currentRequestId: "req-1" });
    await act(async () => {});

    // Stop has replaced Send, and the island is still there beside it.
    expect(
      screen.getByRole("button", { name: /stop generating/i }),
    ).toBeTruthy();
    expect(screen.getByTestId("context-island")).toHaveTextContent("42%");
  });

  it("shows compaction in place of the percentage", async () => {
    renderComposer({
      isLoading: true,
      currentRequestId: "req-1",
      cliStatus: "compacting",
    });
    await act(async () => {});

    const island = screen.getByTestId("context-island");
    expect(island).toHaveAttribute("data-state", "compacting");
    expect(island).toHaveTextContent("Compacting");
  });

  it("is visible when idle too", async () => {
    renderComposer({});
    await act(async () => {});
    expect(screen.getByTestId("context-island")).toHaveTextContent("42%");
  });
});

/**
 * The `@` picker completes attachments. Its unit-level rules live in
 * fileMentions.test.ts; these cover the wiring — that the menu appears over
 * the composer and that committing one edits the text.
 */
describe("file mention picker", () => {
  const ATTACHMENTS = [
    { path: "/tmp/up/notes.md", name: "notes.md", size: 12 },
    { path: "/tmp/up/report.pdf", name: "report.pdf", size: 34 },
  ];

  function MentionHarness({
    attachments = ATTACHMENTS,
    onSubmit = vi.fn(),
  }: {
    attachments?: typeof ATTACHMENTS;
    onSubmit?: () => void;
  }) {
    const [input, setInput] = useState("");
    return (
      <MemoryRouter>
        <SettingsProvider>
          <AstryxProvider>
            <SlashCommandsProvider workingDirectory="/tmp/project">
              <ChatInput
                input={input}
                isLoading={false}
                currentRequestId={null}
                onInputChange={setInput}
                onSubmit={onSubmit}
                onAbort={vi.fn()}
                permissionMode="default"
                onPermissionModeChange={vi.fn()}
                attachments={attachments}
              />
            </SlashCommandsProvider>
          </AstryxProvider>
        </SettingsProvider>
      </MemoryRouter>
    );
  }

  async function renderMentions(attachments = ATTACHMENTS) {
    render(<MentionHarness attachments={attachments} />);
    await act(async () => {});
    return screen.getByRole("combobox", { name: "Message" });
  }

  /** Types into the textarea with the caret at the end. */
  function type(textarea: HTMLElement, value: string) {
    fireEvent.change(textarea, { target: { value } });
  }

  const mentionOptions = () =>
    screen
      .queryAllByRole("option")
      .filter((option) => option.closest('[aria-label="Attached files"]'));

  it("offers the attachments on a bare @", async () => {
    const textarea = await renderMentions();

    type(textarea, "look at @");

    expect(mentionOptions().map((o) => o.textContent)).toEqual([
      expect.stringContaining("notes.md"),
      expect.stringContaining("report.pdf"),
    ]);
  });

  it("narrows as the name is typed", async () => {
    const textarea = await renderMentions();

    type(textarea, "look at @rep");

    expect(mentionOptions()).toHaveLength(1);
    expect(mentionOptions()[0].textContent).toContain("report.pdf");
  });

  it("stays shut when nothing is attached", async () => {
    // With no attachments the key is just a character, which is what it has
    // to stay for anyone typing an email address.
    const textarea = await renderMentions([]);

    type(textarea, "look at @");

    expect(mentionOptions()).toHaveLength(0);
  });

  it("inserts the filename on Enter", async () => {
    const textarea = await renderMentions();

    type(textarea, "read @rep");
    fireEvent.keyDown(textarea, { key: "Enter" });

    await waitFor(() => {
      expect((textarea as HTMLTextAreaElement).value).toBe("read @report.pdf ");
    });
    // The trailing space ends the token, so the menu closes with it.
    expect(mentionOptions()).toHaveLength(0);
  });

  it("does not send the message while the picker is open", async () => {
    const onSubmit = vi.fn();
    render(<MentionHarness onSubmit={onSubmit} />);
    await act(async () => {});

    const textarea = screen.getByRole("combobox", { name: "Message" });
    type(textarea, "read @rep");
    fireEvent.keyDown(textarea, { key: "Enter" });

    // Enter commits the highlighted attachment instead, matching the slash
    // picker and every other completion menu.
    expect(onSubmit).not.toHaveBeenCalled();
    await waitFor(() => {
      expect((textarea as HTMLTextAreaElement).value).toBe("read @report.pdf ");
    });
  });
});

describe("newline chords and list continuation", () => {
  function Harness2() {
    const [input, setInput] = useState("");
    return (
      <MemoryRouter>
        <SettingsProvider>
          <AstryxProvider>
            <SlashCommandsProvider workingDirectory="/tmp/project">
              <ChatInput
                input={input}
                isLoading={false}
                currentRequestId={null}
                onInputChange={setInput}
                onSubmit={vi.fn()}
                onAbort={vi.fn()}
                permissionMode="default"
                onPermissionModeChange={vi.fn()}
              />
            </SlashCommandsProvider>
          </AstryxProvider>
        </SettingsProvider>
      </MemoryRouter>
    );
  }

  async function typeInto(value: string) {
    render(<Harness2 />);
    await act(async () => {});
    const textarea = screen.getByRole("combobox", {
      name: "Message",
    }) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value } });
    return textarea;
  }

  it.each([
    ["altKey", { altKey: true }],
    ["ctrlKey", { ctrlKey: true }],
    ["metaKey", { metaKey: true }],
  ])("%s + Enter inserts a newline instead of sending", async (_name, mods) => {
    const textarea = await typeInto("hello");
    fireEvent.keyDown(textarea, { key: "Enter", ...mods });

    await waitFor(() => {
      expect(textarea.value).toBe("hello\n");
    });
  });

  it("carries the bullet onto the next line", async () => {
    const textarea = await typeInto("- first");
    fireEvent.keyDown(textarea, { key: "Enter", altKey: true });

    await waitFor(() => {
      expect(textarea.value).toBe("- first\n- ");
    });
  });

  it("increments a numbered list", async () => {
    const textarea = await typeInto("1. first");
    fireEvent.keyDown(textarea, { key: "Enter", metaKey: true });

    await waitFor(() => {
      expect(textarea.value).toBe("1. first\n2. ");
    });
  });

  it("ends the list on an empty item", async () => {
    const textarea = await typeInto("- first\n- ");
    fireEvent.keyDown(textarea, { key: "Enter", ctrlKey: true });

    await waitFor(() => {
      expect(textarea.value).toBe("- first\n");
    });
  });

  it("still sends on a bare Enter", async () => {
    // The chords add a way to break the line; they must not take away the
    // way to send.
    const onSubmit = vi.fn();
    render(
      <MemoryRouter>
        <SettingsProvider>
          <AstryxProvider>
            <SlashCommandsProvider workingDirectory="/tmp/project">
              <ChatInput
                input="hello"
                isLoading={false}
                currentRequestId={null}
                onInputChange={vi.fn()}
                onSubmit={onSubmit}
                onAbort={vi.fn()}
                permissionMode="default"
                onPermissionModeChange={vi.fn()}
              />
            </SlashCommandsProvider>
          </AstryxProvider>
        </SettingsProvider>
      </MemoryRouter>,
    );
    await act(async () => {});

    fireEvent.keyDown(screen.getByRole("combobox", { name: "Message" }), {
      key: "Enter",
    });

    expect(onSubmit).toHaveBeenCalled();
  });
});
