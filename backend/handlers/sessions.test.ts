import { describe, it, expect, vi, beforeEach } from "vitest";
import { Context } from "hono";
import {
  handleRenameConversationRequest,
  handleDeleteConversationRequest,
} from "./sessions";
import { deleteSession, renameSession } from "@anthropic-ai/claude-agent-sdk";

vi.mock("@anthropic-ai/claude-agent-sdk", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@anthropic-ai/claude-agent-sdk")>();
  return {
    ...actual,
    renameSession: vi.fn(),
    deleteSession: vi.fn(),
  };
});

vi.mock("../utils/logger", () => ({
  logger: {
    history: { debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
  },
}));

const mockRename = vi.mocked(renameSession);
const mockDelete = vi.mocked(deleteSession);

const VALID_PROJECT = "-Users-dev-Projects-demo";
const VALID_SESSION = "22d0db63-3fe8-4acf-98ec-151b228846d2";

function makeContext(
  params: Record<string, string>,
  body?: unknown,
): { c: Context; json: ReturnType<typeof vi.fn> } {
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

describe("rename conversation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("delegates to the SDK, which is what makes it equal to /rename", async () => {
    const { c } = makeContext(
      { encodedProjectName: VALID_PROJECT, sessionId: VALID_SESSION },
      { title: "New title" },
    );

    await handleRenameConversationRequest(c);

    expect(mockRename).toHaveBeenCalledWith(VALID_SESSION, "New title", {});
  });

  it("trims the title before storing it", async () => {
    const { c } = makeContext(
      { encodedProjectName: VALID_PROJECT, sessionId: VALID_SESSION },
      { title: "  padded  " },
    );

    await handleRenameConversationRequest(c);

    expect(mockRename).toHaveBeenCalledWith(VALID_SESSION, "padded", {});
  });

  it("rejects a blank title rather than storing an unnameable session", async () => {
    const { c, json } = makeContext(
      { encodedProjectName: VALID_PROJECT, sessionId: VALID_SESSION },
      { title: "   " },
    );

    await handleRenameConversationRequest(c);

    expect(mockRename).not.toHaveBeenCalled();
    expect(json).toHaveBeenCalledWith({ error: "Title is required" }, 400);
  });

  it("rejects an overlong title", async () => {
    const { c, json } = makeContext(
      { encodedProjectName: VALID_PROJECT, sessionId: VALID_SESSION },
      { title: "x".repeat(201) },
    );

    await handleRenameConversationRequest(c);

    expect(mockRename).not.toHaveBeenCalled();
    expect(json.mock.calls[0][1]).toBe(400);
  });

  it("rejects a session id that is not a plain identifier", async () => {
    // Session ids name files under ~/.claude/projects, so anything with a
    // separator must not reach the SDK.
    const { c, json } = makeContext(
      { encodedProjectName: VALID_PROJECT, sessionId: "../../etc/passwd" },
      { title: "x" },
    );

    await handleRenameConversationRequest(c);

    expect(mockRename).not.toHaveBeenCalled();
    expect(json.mock.calls[0][1]).toBe(400);
  });

  it("reports a failure instead of claiming success", async () => {
    mockRename.mockRejectedValueOnce(new Error("disk full"));
    const { c, json } = makeContext(
      { encodedProjectName: VALID_PROJECT, sessionId: VALID_SESSION },
      { title: "x" },
    );

    await handleRenameConversationRequest(c);

    expect(json.mock.calls[0][1]).toBe(500);
  });
});

describe("delete conversation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("delegates to the SDK", async () => {
    const { c } = makeContext({
      encodedProjectName: VALID_PROJECT,
      sessionId: VALID_SESSION,
    });

    await handleDeleteConversationRequest(c);

    expect(mockDelete).toHaveBeenCalledWith(VALID_SESSION, {});
  });

  it("rejects an invalid project name", async () => {
    const { c, json } = makeContext({
      encodedProjectName: "../escape",
      sessionId: VALID_SESSION,
    });

    await handleDeleteConversationRequest(c);

    expect(mockDelete).not.toHaveBeenCalled();
    expect(json.mock.calls[0][1]).toBe(400);
  });
});
