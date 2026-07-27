import { describe, it, expect } from "vitest";
import { readLocalCommandOutput } from "./localCommandOutput";

describe("readLocalCommandOutput", () => {
  it("ignores ordinary user text", () => {
    expect(readLocalCommandOutput("run the tests")).toBeNull();
  });

  it("ignores text that merely mentions the tag", () => {
    // The block has to *be* the message, not appear in it, or a question about
    // the tag would vanish from the transcript.
    expect(
      readLocalCommandOutput(
        "why does <local-command-stdout>x</local-command-stdout> show up?",
      ),
    ).toBeNull();
  });

  it("marks a compaction acknowledgement as redundant", () => {
    const result = readLocalCommandOutput(
      "<local-command-stdout>Compacted </local-command-stdout>",
    );

    expect(result).toEqual({ text: "Compacted", isRedundant: true });
  });

  it("marks an empty block as redundant", () => {
    expect(
      readLocalCommandOutput("<local-command-stdout></local-command-stdout>")
        ?.isRedundant,
    ).toBe(true);
  });

  it("keeps output that carries the command's actual answer", () => {
    // /cost and friends put their whole result here; dropping every block
    // would throw that away along with the noise.
    const result = readLocalCommandOutput(
      "<local-command-stdout>Total cost: $0.42\nDuration: 3m</local-command-stdout>",
    );

    expect(result).toEqual({
      text: "Total cost: $0.42\nDuration: 3m",
      isRedundant: false,
    });
  });
});
