import { useEffect, useState } from "react";
import { getCommandsUrl } from "../config/api";
import type {
  ModelOption,
  SlashCommandInfo,
  SlashCommandsResponse,
} from "../types";

/**
 * Loads the slash commands the user's Claude CLI exposes for a directory.
 *
 * Discovery is the CLI's job, not ours: the backend asks it what it resolves,
 * so built-ins, user and project commands, skills, and plugin-provided
 * commands all arrive without this app knowing where any of them live.
 *
 * Failure is deliberately silent. The picker is an accelerator layered over an
 * input that works perfectly well without it, so a discovery error leaves the
 * list empty rather than putting an error in front of a usable chat.
 */
export function useSlashCommands(workingDirectory?: string) {
  const [commands, setCommands] = useState<SlashCommandInfo[]>([]);
  // Models ride along on the same response: one CLI handshake reports both.
  const [models, setModels] = useState<ModelOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Discovery spawns a CLI process, so it is not free — but it is also not
    // on any critical path, since the composer accepts typed commands whether
    // or not this ever resolves.
    let isCurrent = true;
    const abortController = new AbortController();

    setIsLoading(true);

    fetch(getCommandsUrl(workingDirectory), { signal: abortController.signal })
      .then((response) =>
        response.ok ? response.json() : { commands: [], models: [] },
      )
      .then((data: SlashCommandsResponse) => {
        if (!isCurrent) return;
        setCommands(data.commands ?? []);
        setModels(data.models ?? []);
      })
      .catch(() => {
        if (!isCurrent) return;
        setCommands([]);
        setModels([]);
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false);
      });

    return () => {
      isCurrent = false;
      abortController.abort();
    };
  }, [workingDirectory]);

  return { commands, models, isLoading };
}
