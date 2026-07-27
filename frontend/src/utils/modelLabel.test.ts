import { describe, it, expect } from "vitest";
import {
  modelLabel,
  modelNameFromDescription,
  modelNameFromId,
} from "./modelLabel";
import type { ModelOption } from "../types";

describe("modelNameFromDescription", () => {
  // The shapes a first-party CLI actually returns, taken from a live payload.
  it.each([
    ["Opus 5 with 1M context · Best for everyday, complex tasks", "Opus 5"],
    ["Fable 5 · Most capable for your hardest tasks", "Fable 5"],
    ["Sonnet 5 · Efficient for routine tasks", "Sonnet 5"],
    ["Haiku 4.5 · Fastest for quick answers", "Haiku 4.5"],
  ])("%s -> %s", (description, expected) => {
    expect(modelNameFromDescription(description)).toBe(expected);
  });

  it("gives up on a description it does not recognise", () => {
    expect(modelNameFromDescription("")).toBeUndefined();
  });
});

describe("modelNameFromId", () => {
  /*
   * Real Bedrock ids. Note the convention flips between generations — the
   * older ids put the version before the family, the newer ones after a
   * v-prefix — so both are normalised to family-then-version.
   */
  it.each([
    ["anthropic.claude-3-opus-20240229-v1:0", "Opus 3"],
    ["anthropic.claude-3-sonnet-20240229-v1:0", "Sonnet 3"],
    ["anthropic.claude-3-haiku-20240307-v1:0", "Haiku 3"],
    ["anthropic.claude-3-5-sonnet-20240620-v1:0", "Sonnet 3.5"],
    ["anthropic.claude-3-5-haiku-20241022-v1:0", "Haiku 3.5"],
    ["anthropic.claude-v4-5-sonnet-20250929-v1:0", "Sonnet 4.5"],
    ["anthropic.claude-v5-opus:0", "Opus 5"],
    ["anthropic.claude-v5-sonnet:0", "Sonnet 5"],
    ["anthropic.claude-v5-fable:0", "Fable 5"],
  ])("%s -> %s", (id, expected) => {
    expect(modelNameFromId(id)).toBe(expected);
  });

  it("keeps a revision above v1, which is a different model to the user", () => {
    // Both 3.5 Sonnets share family and version; without the revision they
    // would render identically and one would be unselectable.
    expect(modelNameFromId("anthropic.claude-3-5-sonnet-20241022-v2:0")).toBe(
      "Sonnet 3.5 v2",
    );
    expect(modelNameFromId("anthropic.claude-3-5-sonnet-20240620-v1:0")).toBe(
      "Sonnet 3.5",
    );
  });

  it("ignores a regional prefix", () => {
    expect(modelNameFromId("us.anthropic.claude-v5-opus:0")).toBe("Opus 5");
    expect(
      modelNameFromId("eu.anthropic.claude-3-5-sonnet-20240620-v1:0"),
    ).toBe("Sonnet 3.5");
  });

  it("names a family it has never seen, so the list does not go stale", () => {
    // A closed family list would be wrong the first time a new model ships.
    expect(modelNameFromId("anthropic.claude-v9-mystery:0")).toBe("Mystery 9");
  });

  it("handles ids beyond the ones this was written against", () => {
    // Real shapes in circulation that were not in the original sample.
    expect(modelNameFromId("anthropic.claude-3-7-sonnet-20250219-v1:0")).toBe(
      "Sonnet 3.7",
    );
    expect(modelNameFromId("apac.anthropic.claude-v5-sonnet:0")).toBe(
      "Sonnet 5",
    );
    expect(
      modelNameFromId(
        "arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-v5-opus:0",
      ),
    ).toBe("Opus 5");
  });

  it("returns undefined rather than a wrong name when it cannot tell", () => {
    /*
     * The guarantee that matters: an unparseable id degrades to the CLI's own
     * wording. A mangled name is worse than the provider's, because it looks
     * authoritative.
     */
    expect(modelNameFromId("meta.llama3-70b-instruct-v1:0")).toBeUndefined();
    expect(modelNameFromId("amazon.titan-text-express-v1")).toBeUndefined();
    expect(modelNameFromId("")).toBeUndefined();
    // Claude with no version at all.
    expect(modelNameFromId("anthropic.claude-instant-v1")).toBeUndefined();
  });
});

describe("modelLabel", () => {
  const option = (over: Partial<ModelOption>): ModelOption => ({
    value: "x",
    displayName: "Fallback name",
    description: "",
    ...over,
  });

  it("prefers the description when the CLI supplies a usable one", () => {
    expect(
      modelLabel(
        option({ value: "default", description: "Opus 5 with 1M context · x" }),
      ),
    ).toBe("Opus 5");
  });

  it("falls back to the id when the description is not recognisable", () => {
    expect(
      modelLabel(
        option({ value: "anthropic.claude-v5-sonnet:0", description: "" }),
      ),
    ).toBe("Sonnet 5");
  });

  it("falls back to the CLI's own name when neither parses", () => {
    // A provider this code has never seen should degrade to the CLI's wording
    // rather than to a blank or a mangled string.
    expect(modelLabel(option({ value: "some-provider/model-x" }))).toBe(
      "Fallback name",
    );
  });
});
