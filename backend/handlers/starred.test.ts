import { describe, it, expect, vi, beforeEach } from "vitest";
import { Context } from "hono";
import { handleStarConversationRequest } from "./sessions";
import { getStarredSessions, setSessionStarred } from "../history/starred";

vi.mock("../history/starred", () => ({
  getStarredSessions: vi.fn(),
  setSessionStarred: vi.fn(),
}));

vi.mock("../utils/logger", () => ({
  logger: {
    history: { debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
  },
}));

const mockSet = vi.mocked(setSessionStarred);

const VALID_PROJECT = "-Users-dev-Projects-demo";
const VALID_SESSION = "22d0db63-3fe8-4acf-98ec-151b228846d2";

function makeContext(params: Record<string, string>, body?: unknown) {
  const json = vi.fn((payload: unknown, status?: number) => ({
    payload,
    status,
  }));
  const c = {
    req: {
      param: (key: string) => params[key],
      json: () =>
        body === undefined
          ? Promise.reject(new Error("no body"))
          : Promise.resolve(body),
    },
    json,
  } as unknown as Context;
  return { c, json };
}

describe("star conversation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("stores the state the request asked for", async () => {
    const { c } = makeContext(
      { encodedProjectName: VALID_PROJECT, sessionId: VALID_SESSION },
      { isStarred: true },
    );

    await handleStarConversationRequest(c);

    expect(mockSet).toHaveBeenCalledWith(VALID_PROJECT, VALID_SESSION, true);
  });

  it("clears a star when asked to", async () => {
    const { c } = makeContext(
      { encodedProjectName: VALID_PROJECT, sessionId: VALID_SESSION },
      { isStarred: false },
    );

    await handleStarConversationRequest(c);

    expect(mockSet).toHaveBeenCalledWith(VALID_PROJECT, VALID_SESSION, false);
  });

  it("rejects a session id that is not a plain identifier", async () => {
    // Session ids reach a store keyed by them; anything with a separator is
    // not something this route should be writing down.
    const { c, json } = makeContext(
      { encodedProjectName: VALID_PROJECT, sessionId: "../../etc/passwd" },
      { isStarred: true },
    );

    await handleStarConversationRequest(c);

    expect(mockSet).not.toHaveBeenCalled();
    expect(json.mock.calls[0][1]).toBe(400);
  });

  it("rejects a non-boolean state rather than guessing", async () => {
    const { c, json } = makeContext(
      { encodedProjectName: VALID_PROJECT, sessionId: VALID_SESSION },
      { isStarred: "yes" },
    );

    await handleStarConversationRequest(c);

    expect(mockSet).not.toHaveBeenCalled();
    expect(json.mock.calls[0][1]).toBe(400);
  });

  it("reports a write failure instead of claiming success", async () => {
    mockSet.mockRejectedValueOnce(new Error("read-only filesystem"));
    const { c, json } = makeContext(
      { encodedProjectName: VALID_PROJECT, sessionId: VALID_SESSION },
      { isStarred: true },
    );

    await handleStarConversationRequest(c);

    expect(json.mock.calls[0][1]).toBe(500);
  });

  it("exposes a reader for the listing to annotate rows with", () => {
    // The listing needs stars in the same response, so this has to exist
    // alongside the mutation rather than being folded into it.
    expect(typeof getStarredSessions).toBe("function");
  });
});
