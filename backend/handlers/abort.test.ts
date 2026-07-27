import { describe, it, expect, vi, beforeEach } from "vitest";
import { Context } from "hono";
import { handleAbortRequest } from "./abort";
import { getActiveSession } from "./chat";

vi.mock("./chat", () => ({
  getActiveSession: vi.fn(),
  markInterrupted: vi.fn(),
}));
vi.mock("../utils/logger", () => ({
  logger: { api: { debug: vi.fn(), warn: vi.fn(), error: vi.fn() } },
}));

const mockGetSession = vi.mocked(getActiveSession);

function makeContext(requestId?: string) {
  const json = vi.fn((body: unknown, status?: number) => ({ body, status }));
  const c = {
    req: { param: () => requestId },
    json,
  } as unknown as Context;
  return { c, json };
}

/** A Query stub exposing only what the handler touches. */
function sessionWith(interrupt: () => Promise<unknown>) {
  return { interrupt } as never;
}

describe("stopping a request", () => {
  let controllers: Map<string, AbortController>;

  beforeEach(() => {
    vi.clearAllMocks();
    controllers = new Map();
    mockGetSession.mockReturnValue(undefined);
  });

  it("interrupts rather than killing when a live session exists", async () => {
    // Killing throws the turn away; interrupt ends it, so the partial work
    // stays in the session and the conversation remains resumable.
    const interrupt = vi.fn().mockResolvedValue(undefined);
    mockGetSession.mockReturnValue(sessionWith(interrupt));
    const controller = new AbortController();
    controllers.set("r1", controller);

    const { c, json } = makeContext("r1");
    await handleAbortRequest(c, controllers);

    expect(interrupt).toHaveBeenCalled();
    expect(controller.signal.aborted).toBe(false);
    expect(json.mock.calls[0][0]).toMatchObject({ method: "interrupt" });
  });

  it("kills the process when the interrupt rejects", async () => {
    mockGetSession.mockReturnValue(
      sessionWith(vi.fn().mockRejectedValue(new Error("no channel"))),
    );
    const controller = new AbortController();
    controllers.set("r1", controller);

    const { c, json } = makeContext("r1");
    await handleAbortRequest(c, controllers);

    expect(controller.signal.aborted).toBe(true);
    expect(json.mock.calls[0][0]).toMatchObject({ method: "abort" });
  });

  it("kills the process when the interrupt hangs", async () => {
    // A wedged CLI is exactly when someone reaches for Stop, so Stop must not
    // wait on it forever.
    vi.useFakeTimers();
    try {
      mockGetSession.mockReturnValue(sessionWith(() => new Promise(() => {})));
      const controller = new AbortController();
      controllers.set("r1", controller);

      const { c, json } = makeContext("r1");
      const pending = handleAbortRequest(c, controllers);
      await vi.advanceTimersByTimeAsync(3001);
      await pending;

      expect(controller.signal.aborted).toBe(true);
      expect(json.mock.calls[0][0]).toMatchObject({ method: "abort" });
    } finally {
      vi.useRealTimers();
    }
  });

  it("still kills when there is no session, only a controller", async () => {
    // A turn can be mid-startup, with a controller registered before the
    // session object exists.
    const controller = new AbortController();
    controllers.set("r1", controller);

    const { c, json } = makeContext("r1");
    await handleAbortRequest(c, controllers);

    expect(controller.signal.aborted).toBe(true);
    expect(json.mock.calls[0][0]).toMatchObject({ method: "abort" });
  });

  it("reports 404 for a request that is already finished", async () => {
    const { c, json } = makeContext("gone");
    await handleAbortRequest(c, controllers);

    expect(json.mock.calls[0][1]).toBe(404);
  });

  it("rejects a missing request id", async () => {
    const { c, json } = makeContext(undefined);
    await handleAbortRequest(c, controllers);

    expect(json.mock.calls[0][1]).toBe(400);
  });
});
