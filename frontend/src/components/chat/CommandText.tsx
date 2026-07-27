import { getCommandToken } from "../../utils/slashCommands";
import { useSlashCommandsContext } from "../../hooks/useSlashCommandsContext";

/**
 * A sent message, with a leading slash command carrying the app mark's
 * gradient.
 *
 * The composer already paints commands this way, and a command that loses its
 * colour the instant it is sent reads as though something different was sent
 * from what was typed. Same token rule and same `--command-sweep` as the
 * composer and the picker, so a command looks identical in all three places.
 *
 * Only a *known* command is coloured, matching the composer: an unrecognised
 * `/foo` was sent to Claude as ordinary text and should not be dressed up as
 * something the CLI understood.
 */
export function CommandText({ content }: { content: string }) {
  const { commands } = useSlashCommandsContext();
  const token = getCommandToken(content, commands);

  if (!token) return <>{content}</>;

  // The command is by definition a prefix, so the split is positional rather
  // than a search — a body that repeats the command's own name must not be
  // coloured too.
  const command = `/${token}`;

  return (
    <>
      <span className="transcript-command">{command}</span>
      {content.slice(command.length)}
    </>
  );
}
