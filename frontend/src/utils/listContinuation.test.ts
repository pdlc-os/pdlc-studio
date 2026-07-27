import { describe, it, expect } from "vitest";
import { insertNewline, isNewlineChord } from "./listContinuation";

/** Marks the caret with | for readability, then splits it back out. */
function at(text: string) {
  const caret = text.indexOf("|");
  return { value: text.replace("|", ""), caret };
}

function show({ value, caret }: { value: string; caret: number }) {
  return `${value.slice(0, caret)}|${value.slice(caret)}`;
}

describe("insertNewline", () => {
  it("inserts a plain newline outside a list", () => {
    const { value, caret } = at("hello|");
    expect(show(insertNewline(value, caret))).toBe("hello\n|");
  });

  it("continues a bulleted list", () => {
    const { value, caret } = at("- first|");
    expect(show(insertNewline(value, caret))).toBe("- first\n- |");
  });

  it("increments a numbered list", () => {
    const { value, caret } = at("1. first|");
    expect(show(insertNewline(value, caret))).toBe("1. first\n2. |");
  });

  it("keeps counting past the first item", () => {
    const { value, caret } = at("1. a\n2. b|");
    expect(show(insertNewline(value, caret))).toBe("1. a\n2. b\n3. |");
  });

  it("preserves indentation of a nested item", () => {
    const { value, caret } = at("  - nested|");
    expect(show(insertNewline(value, caret))).toBe("  - nested\n  - |");
  });

  it("echoes the marker the user chose rather than normalising it", () => {
    // Someone typing * meant *; silently rewriting it to - is a surprise.
    expect(
      show(
        insertNewline(...(Object.values(at("* star|")) as [string, number])),
      ),
    ).toBe("* star\n* |");
    expect(
      show(
        insertNewline(...(Object.values(at("1) paren|")) as [string, number])),
      ),
    ).toBe("1) paren\n2) |");
  });

  it("ends the list when the item is empty", () => {
    /*
     * How every markdown editor ends a list. Without it there is no way to
     * stop without deleting the marker by hand.
     */
    const { value, caret } = at("- first\n- |");
    expect(show(insertNewline(value, caret))).toBe("- first\n|");
  });

  it("ends a numbered list the same way", () => {
    const { value, caret } = at("1. first\n2. |");
    expect(show(insertNewline(value, caret))).toBe("1. first\n|");
  });

  it("continues from the middle of a line, splitting it", () => {
    const { value, caret } = at("- one| two");
    expect(show(insertNewline(value, caret))).toBe("- one\n- | two");
  });

  it("is not fooled by a dash that is not a marker", () => {
    // No space after the dash, so it is not a list.
    const { value, caret } = at("-nolist|");
    expect(show(insertNewline(value, caret))).toBe("-nolist\n|");
  });

  it("treats a hyphenated sentence as prose", () => {
    const { value, caret } = at("well-known thing|");
    expect(show(insertNewline(value, caret))).toBe("well-known thing\n|");
  });
});

describe("isNewlineChord", () => {
  const base = { altKey: false, ctrlKey: false, metaKey: false };

  it.each([["altKey"], ["ctrlKey"], ["metaKey"]])(
    "%s produces a newline",
    (key) => {
      expect(isNewlineChord({ ...base, [key]: true })).toBe(true);
    },
  );

  it("is false with no modifier", () => {
    expect(isNewlineChord(base)).toBe(false);
  });
});
