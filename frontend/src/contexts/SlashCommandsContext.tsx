import { useMemo, type ReactNode } from "react";
import { useSlashCommands } from "../hooks/useSlashCommands";
import { SlashCommandsContext } from "./slashCommandsValue";

/**
 * Discovers the CLI's commands once for the whole chat view.
 *
 * Discovery spawns a Claude CLI process, so this cannot be a hook each consumer
 * calls: the composer needs the list to offer the `/` picker, and the transcript
 * needs it to know which tokens are real commands worth colouring. Two callers
 * meant two process spawns for one answer.
 */
export function SlashCommandsProvider({
  workingDirectory,
  children,
}: {
  workingDirectory?: string;
  children: ReactNode;
}) {
  const { commands, models, isLoading } = useSlashCommands(workingDirectory);

  const value = useMemo(
    () => ({ commands, models, isLoading }),
    [commands, models, isLoading],
  );

  return (
    <SlashCommandsContext.Provider value={value}>
      {children}
    </SlashCommandsContext.Provider>
  );
}
