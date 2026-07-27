import { useEffect, useState } from "react";
import { getSessionTeamUrl } from "../config/api";
import type { SessionTeamResponse, TeamInfo } from "../types";

/**
 * The agent team behind a conversation, if it has one.
 *
 * Most do not — a conversation only gets a team when it spawns teammates — so
 * "no team" is the normal answer and failure is silent: the Agents panel is
 * useful without this section, and an error banner for a conversation that
 * simply never used teams would be noise.
 */
export function useSessionTeam(
  encodedProjectName: string | null,
  sessionId: string | null,
) {
  const [team, setTeam] = useState<TeamInfo | null>(null);

  useEffect(() => {
    if (!encodedProjectName || !sessionId) {
      setTeam(null);
      return;
    }

    let isCurrent = true;
    const abortController = new AbortController();

    fetch(getSessionTeamUrl(encodedProjectName, sessionId), {
      signal: abortController.signal,
    })
      .then((response) => (response.ok ? response.json() : { team: null }))
      .then((data: SessionTeamResponse) => {
        if (isCurrent) setTeam(data.team ?? null);
      })
      .catch(() => {
        if (isCurrent) setTeam(null);
      });

    return () => {
      isCurrent = false;
      abortController.abort();
    };
  }, [encodedProjectName, sessionId]);

  return team;
}
