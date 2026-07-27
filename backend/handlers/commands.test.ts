import { describe, it, expect, vi, beforeEach } from "vitest";
import { Context } from "hono";
import { handleCommandsRequest } from "./commands";
import { query } from "@anthropic-ai/claude-agent-sdk";

vi.mock("@anthropic-ai/claude-agent-sdk", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@anthropic-ai/claude-agent-sdk")>();
  return {
    ...actual,
    query: vi.fn(),
  };
});

vi.mock("../utils/logger", () => ({
  logger: {
    api: {
      debug: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
  },
}));

const mockQuery = vi.mocked(query);

const COMMANDS = [
  { name: "review", description: "Review a PR", argumentHint: "<pr>" },
  {
    name: "usage",
    description: "Show usage",
    argumentHint: "",
    aliases: ["cost"],
  },
];

/** A stand-in Query that answers the initialize handshake and nothing else. */
function mockSession(
  initializationResult: () => Promise<unknown>,
  close = vi.fn(),
) {
  mockQuery.mockReturnValue({
    [Symbol.asyncIterator]: async function* () {},
    initializationResult,
    close,
    interrupt: vi.fn(),
  } as never);
  return close;
}

function makeContext(workingDirectory?: string) {
  return {
    req: {
      query: vi.fn((key: string) =>
        key === "workingDirectory" ? workingDirectory : undefined,
      ),
    },
    json: vi.fn((body: unknown) => ({ body })),
    var: { config: { cliPath: "/path/to/claude-cli" } },
  } as unknown as Context;
}

/**
 * Each test uses a distinct working directory: the handler caches by that key
 * at module scope, so reusing one would let an earlier test's result answer a
 * later one.
 */
describe("handleCommandsRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the commands the CLI reports", async () => {
    mockSession(() => Promise.resolve({ commands: COMMANDS }));
    const c = makeContext("/tmp/a");

    await handleCommandsRequest(c);

    expect(c.json).toHaveBeenCalledWith({
      commands: [
        { name: "review", description: "Review a PR", argumentHint: "<pr>" },
        {
          name: "usage",
          description: "Show usage",
          argumentHint: "",
          aliases: ["cost"],
        },
      ],
      // Absent from this mock's initialize response, which an older CLI may
      // also omit — that must mean "no models", not a failed discovery.
      models: [],
    });
  });

  it("scopes discovery to the requested working directory", async () => {
    mockSession(() => Promise.resolve({ commands: [] }));

    await handleCommandsRequest(makeContext("/tmp/b"));

    expect(mockQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({ cwd: "/tmp/b" }),
      }),
    );
  });

  it("never sends a prompt string, so discovery costs no model call", async () => {
    mockSession(() => Promise.resolve({ commands: [] }));

    await handleCommandsRequest(makeContext("/tmp/c"));

    const { prompt } = mockQuery.mock.calls[0][0];
    expect(typeof prompt).not.toBe("string");
  });

  it("closes the session even when discovery succeeds", async () => {
    const close = mockSession(() => Promise.resolve({ commands: COMMANDS }));

    await handleCommandsRequest(makeContext("/tmp/d"));

    expect(close).toHaveBeenCalled();
  });

  it("degrades to an empty list rather than an error when the CLI fails", async () => {
    const close = mockSession(() => Promise.reject(new Error("no cli")));
    const c = makeContext("/tmp/e");

    await handleCommandsRequest(c);

    // A missing picker must not surface as an error over a usable chat.
    expect(c.json).toHaveBeenCalledWith({ commands: [], models: [] });
    expect(close).toHaveBeenCalled();
  });

  it("serves a repeat request from cache without respawning the CLI", async () => {
    mockSession(() => Promise.resolve({ commands: COMMANDS }));

    await handleCommandsRequest(makeContext("/tmp/f"));
    await handleCommandsRequest(makeContext("/tmp/f"));

    expect(mockQuery).toHaveBeenCalledTimes(1);
  });

  it("collapses concurrent cold requests into one spawn", async () => {
    mockSession(() => Promise.resolve({ commands: COMMANDS }));

    await Promise.all([
      handleCommandsRequest(makeContext("/tmp/g")),
      handleCommandsRequest(makeContext("/tmp/g")),
      handleCommandsRequest(makeContext("/tmp/g")),
    ]);

    expect(mockQuery).toHaveBeenCalledTimes(1);
  });
});

describe("model discovery", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the models the CLI reports, with their capabilities", async () => {
    // One handshake carries both commands and models, so the UI can offer a
    // model picker without a second CLI process.
    mockSession(() =>
      Promise.resolve({
        commands: [],
        models: [
          {
            value: "opus",
            displayName: "Opus",
            description: "Most capable",
            supportsEffort: true,
            supportedEffortLevels: ["low", "high"],
            supportsAdaptiveThinking: true,
          },
          { value: "haiku", displayName: "Haiku", description: "Fastest" },
        ],
      }),
    );
    const c = makeContext("/tmp/models");

    await handleCommandsRequest(c);

    const payload = (c.json as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as UploadShape;
    expect(payload.models).toEqual([
      {
        value: "opus",
        displayName: "Opus",
        description: "Most capable",
        supportsEffort: true,
        supportedEffortLevels: ["low", "high"],
        supportsAdaptiveThinking: true,
      },
      // Capability flags are omitted rather than guessed when the CLI does not
      // report them.
      { value: "haiku", displayName: "Haiku", description: "Fastest" },
    ]);
  });
});

/** Shape of the JSON the handler passes to `c.json`. */
interface UploadShape {
  commands: unknown[];
  models: unknown[];
}
