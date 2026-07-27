import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readTeamForSession, teamDirName } from "./teams";
import { exists, readTextFile } from "../utils/fs";
import { getHomeDir } from "../utils/os";

vi.mock("../utils/fs", () => ({ exists: vi.fn(), readTextFile: vi.fn() }));
vi.mock("../utils/os", () => ({ getHomeDir: vi.fn() }));
vi.mock("../utils/logger", () => ({
  logger: { history: { debug: vi.fn(), warn: vi.fn(), error: vi.fn() } },
}));

const mockExists = vi.mocked(exists);
const mockRead = vi.mocked(readTextFile);

const SESSION = "381fa295-5162-41a7-a40d-56efd1f3ef8b";

/** The shape observed on disk, verbatim. */
const REAL_CONFIG = {
  name: "session-381fa295",
  createdAt: 1785091229942,
  leadAgentId: "team-lead@session-381fa295",
  leadSessionId: SESSION,
  members: [
    {
      agentId: "team-lead@session-381fa295",
      name: "team-lead",
      agentType: "team-lead",
      joinedAt: 1785091229942,
      tmuxPaneId: "leader",
      cwd: "/Users/nishant/Projects/pdlc-studio",
      subscriptions: [],
      backendType: "in-process",
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getHomeDir).mockReturnValue("/home/dev");
  mockExists.mockResolvedValue(true);
});

afterEach(() => vi.restoreAllMocks());

describe("teamDirName", () => {
  it("uses the first eight characters, as the CLI does", () => {
    expect(teamDirName(SESSION)).toBe("session-381fa295");
  });
});

describe("readTeamForSession", () => {
  it("reads the config the CLI actually writes", async () => {
    mockRead.mockResolvedValue(JSON.stringify(REAL_CONFIG));

    const team = await readTeamForSession(SESSION);

    expect(team).toMatchObject({
      name: "session-381fa295",
      leadSessionId: SESSION,
    });
    expect(team?.members[0]).toMatchObject({
      agentId: "team-lead@session-381fa295",
      agentType: "team-lead",
      backendType: "in-process",
    });
  });

  it("looks under the session-prefixed directory", async () => {
    mockRead.mockResolvedValue(JSON.stringify(REAL_CONFIG));

    await readTeamForSession(SESSION);

    expect(mockRead).toHaveBeenCalledWith(
      "/home/dev/.claude/teams/session-381fa295/config.json",
    );
  });

  it("reports no team rather than an error when there is none", async () => {
    // The overwhelmingly common case: a conversation only gets a team if it
    // spawns teammates.
    mockExists.mockResolvedValue(false);

    expect(await readTeamForSession(SESSION)).toBeNull();
    expect(mockRead).not.toHaveBeenCalled();
  });

  it("reads a teammate's own session id when one is recorded", async () => {
    // Not present on any team observed so far, all of which held only the
    // lead — but it is what an open-as-conversation action needs, so it is
    // read through rather than dropped.
    mockRead.mockResolvedValue(
      JSON.stringify({
        ...REAL_CONFIG,
        members: [
          ...REAL_CONFIG.members,
          {
            agentId: "reviewer@session-381fa295",
            name: "reviewer",
            agentType: "code-reviewer",
            backendType: "tmux",
            sessionId: "aaaaaaaa-1111-2222-3333-444444444444",
          },
        ],
      }),
    );

    const team = await readTeamForSession(SESSION);

    expect(team?.members).toHaveLength(2);
    expect(team?.members[1]).toMatchObject({
      name: "reviewer",
      backendType: "tmux",
      sessionId: "aaaaaaaa-1111-2222-3333-444444444444",
    });
  });

  it("survives a malformed config", async () => {
    mockRead.mockResolvedValue("{ not json");

    expect(await readTeamForSession(SESSION)).toBeNull();
  });

  it("drops members with no agent id rather than half-rendering them", async () => {
    mockRead.mockResolvedValue(
      JSON.stringify({ ...REAL_CONFIG, members: [{ name: "nameless" }, null] }),
    );

    expect((await readTeamForSession(SESSION))?.members).toEqual([]);
  });

  it("refuses a session id that is not a plain identifier", async () => {
    // The id becomes a path segment.
    expect(await readTeamForSession("../../etc/passwd")).toBeNull();
    expect(mockExists).not.toHaveBeenCalled();
  });
});

describe("a real six-member team", () => {
  /** Trimmed from the config a live five-teammate team actually wrote. */
  const REAL_TEAM = {
    name: "session-c52d138e",
    createdAt: 1785131451784,
    leadAgentId: "team-lead@session-c52d138e",
    leadSessionId: "c52d138e-7479-433b-9783-3e028d7dda59",
    members: [
      {
        agentId: "team-lead@session-c52d138e",
        name: "team-lead",
        agentType: "team-lead",
        tmuxPaneId: "leader",
        cwd: "/Users/nishant/Projects/marko",
        backendType: "in-process",
      },
      {
        agentId: "Architect@session-c52d138e",
        name: "Architect",
        color: "blue",
        agentType: "general-purpose",
        model: "opus",
        prompt: "You are the ARCHITECT on a 5-agent team...",
        planModeRequired: false,
        cwd: "/Users/nishant/Projects/marko",
        backendType: "in-process",
      },
    ],
  };

  it("reads the fields only teammates carry", async () => {
    mockRead.mockResolvedValue(JSON.stringify(REAL_TEAM));

    const team = await readTeamForSession(SESSION);

    expect(team?.members[1]).toMatchObject({
      name: "Architect",
      agentType: "general-purpose",
      model: "opus",
      color: "blue",
      planModeRequired: false,
      prompt: "You are the ARCHITECT on a 5-agent team...",
    });
  });

  it("confirms no teammate carries a session of its own", async () => {
    // Verified against the live config: teammates run in-process and write no
    // session file, so only the lead is openable as a conversation. If this
    // ever changes, this assertion is the thing that should fail first.
    mockRead.mockResolvedValue(JSON.stringify(REAL_TEAM));

    const team = await readTeamForSession(SESSION);
    const teammates = team!.members.filter(
      (m) => m.agentId !== team!.leadAgentId,
    );

    expect(teammates).not.toHaveLength(0);
    expect(teammates.every((m) => m.sessionId === undefined)).toBe(true);
    expect(team?.leadSessionId).toBe("c52d138e-7479-433b-9783-3e028d7dda59");
  });
});
