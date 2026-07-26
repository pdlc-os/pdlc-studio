import { describe, it, expect } from "vitest";
import {
  getSlashQuery,
  filterCommands,
  getCommandToken,
} from "./slashCommands";
import type { SlashCommandInfo } from "../types";

function command(
  name: string,
  overrides: Partial<SlashCommandInfo> = {},
): SlashCommandInfo {
  return {
    name,
    description: `${name} description`,
    argumentHint: "",
    ...overrides,
  };
}

const COMMANDS: SlashCommandInfo[] = [
  command("init"),
  command("clear"),
  command("compact"),
  command("review"),
  command("security-review"),
  command("usage", { aliases: ["cost", "stats"] }),
];

describe("getSlashQuery", () => {
  it("opens on a bare slash with an empty query", () => {
    expect(getSlashQuery("/")).toBe("");
  });

  it("returns the typed token", () => {
    expect(getSlashQuery("/rev")).toBe("rev");
  });

  it("closes once arguments begin", () => {
    // A space means the command has been chosen and the user is typing
    // arguments; keeping the menu open would cover the text being written.
    expect(getSlashQuery("/review ")).toBeNull();
    expect(getSlashQuery("/review 123")).toBeNull();
  });

  it("ignores a slash that is not at the start", () => {
    expect(getSlashQuery("see /review")).toBeNull();
    expect(getSlashQuery("http://example.com")).toBeNull();
  });

  it("stays closed for ordinary prose", () => {
    expect(getSlashQuery("")).toBeNull();
    expect(getSlashQuery("hello")).toBeNull();
  });
});

describe("getCommandToken", () => {
  it("returns the token for a known command", () => {
    expect(getCommandToken("/review 42", COMMANDS)).toBe("review");
  });

  it("returns the token when the command is the whole input", () => {
    expect(getCommandToken("/clear", COMMANDS)).toBe("clear");
  });

  it("resolves an alias", () => {
    expect(getCommandToken("/cost", COMMANDS)).toBe("cost");
  });

  it("ignores a command that does not exist", () => {
    // Tinting arbitrary text would make the colour meaningless; a typo should
    // stay plain so the absence of colour is the signal.
    expect(getCommandToken("/nosuchcommand", COMMANDS)).toBeNull();
  });

  it("ignores a partially typed command", () => {
    expect(getCommandToken("/revi", COMMANDS)).toBeNull();
  });

  it("ignores prose and mid-string slashes", () => {
    expect(getCommandToken("just text", COMMANDS)).toBeNull();
    expect(getCommandToken("see /review", COMMANDS)).toBeNull();
    expect(getCommandToken("", COMMANDS)).toBeNull();
  });

  it("highlights nothing when discovery returned no commands", () => {
    expect(getCommandToken("/review", [])).toBeNull();
  });
});

describe("filterCommands", () => {
  it("returns everything for an empty query, shortest first", () => {
    const names = filterCommands(COMMANDS, "").map((m) => m.command.name);
    expect(names).toHaveLength(COMMANDS.length);
    expect(names[0]).toBe("init");
  });

  it("ranks an exact match above a longer prefix match", () => {
    const names = filterCommands(COMMANDS, "review").map((m) => m.command.name);
    expect(names[0]).toBe("review");
    expect(names).toContain("security-review");
  });

  it("matches a segment after a separator", () => {
    // "security-review" should surface for "review" even though the hit is not
    // at position 0.
    expect(
      filterCommands(COMMANDS, "review").map((m) => m.command.name),
    ).toContain("security-review");
  });

  it("supports subsequence matching so a name need not be typed in full", () => {
    const names = filterCommands(COMMANDS, "cmpt").map((m) => m.command.name);
    expect(names).toContain("compact");
  });

  it("is case insensitive", () => {
    expect(filterCommands(COMMANDS, "INIT")[0].command.name).toBe("init");
  });

  it("does not credit an alias when nothing has been typed", () => {
    // "cost" is shorter than "usage", so a length-only score would let the
    // alias win and annotate the row "via /cost" on the bare "/" listing.
    const match = filterCommands(COMMANDS, "").find(
      (m) => m.command.name === "usage",
    );
    expect(match?.matchedName).toBe("usage");
  });

  it("finds a command through an alias but reports the canonical name", () => {
    const [match] = filterCommands(COMMANDS, "cost");
    expect(match.command.name).toBe("usage");
    expect(match.matchedName).toBe("cost");
  });

  it("returns nothing when no command matches", () => {
    expect(filterCommands(COMMANDS, "zzzz")).toEqual([]);
  });

  it("reports matched positions for highlighting", () => {
    const [match] = filterCommands(COMMANDS, "in");
    expect(match.command.name).toBe("init");
    expect(match.matchedIndices).toEqual([0, 1]);
  });
});
