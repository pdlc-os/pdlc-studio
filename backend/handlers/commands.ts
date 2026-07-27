import { Context } from "hono";
import { query, type SDKUserMessage } from "@anthropic-ai/claude-agent-sdk";
import type {
  EffortLevel,
  ModelOption,
  SlashCommandInfo,
  SlashCommandsResponse,
} from "../../shared/types.ts";
import { logger } from "../utils/logger.ts";

/**
 * How long a discovered command list stays fresh.
 *
 * Every miss spawns a Claude CLI process purely to read its initialize
 * response, so this is not a micro-optimisation: without it, one process is
 * spawned per composer mount. A minute is short enough that a skill added
 * mid-session shows up on the next project switch, and the CLI also pushes
 * `commands_changed` for live updates within a session.
 */
const CACHE_TTL_MS = 60_000;

/**
 * Upper bound on waiting for the CLI handshake. A missing or wedged CLI must
 * degrade to "no completions" rather than hanging the composer.
 */
const DISCOVERY_TIMEOUT_MS = 15_000;

interface Discovered {
  commands: SlashCommandInfo[];
  models: ModelOption[];
}

interface CacheEntry extends Discovered {
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

/**
 * In-flight discoveries, keyed identically to `cache`.
 *
 * Mounting the chat page fires one request per composer, and a cold cache
 * would otherwise let several of them spawn their own CLI process for the same
 * directory. Sharing the promise collapses them into one spawn.
 */
const inFlight = new Map<string, Promise<Discovered>>();

/**
 * A prompt that never produces a message.
 *
 * `query()` accepts either a string or an async iterable. Passing a string
 * would start a turn and bill a model call; the iterable form lets the session
 * come up, answer the initialize handshake, and then be closed without ever
 * sending anything. It stays parked on `release` so the CLI does not treat an
 * immediately-exhausted stream as end-of-input.
 */
async function* idlePrompt(
  release: Promise<void>,
): AsyncGenerator<SDKUserMessage> {
  await release;
}

/**
 * Asks the Claude CLI which slash commands it knows about.
 *
 * The list is whatever the user's own installation resolves — built-ins, user
 * and project commands, skills, and plugin-provided commands — so nothing here
 * needs to know where those live on disk.
 */
async function discoverCommands(
  cliPath: string,
  workingDirectory?: string,
): Promise<Discovered> {
  let releasePrompt: () => void = () => {};
  const release = new Promise<void>((resolve) => {
    releasePrompt = resolve;
  });

  const session = query({
    prompt: idlePrompt(release),
    options: {
      executable: "node" as const,
      executableArgs: [],
      pathToClaudeCodeExecutable: cliPath,
      systemPrompt: {
        type: "preset" as const,
        preset: "claude_code" as const,
      },
      ...(workingDirectory ? { cwd: workingDirectory } : {}),
    },
  });

  try {
    const init = await withTimeout(
      session.initializationResult(),
      DISCOVERY_TIMEOUT_MS,
    );

    return {
      commands: (init.commands ?? []).map((command) => ({
        name: command.name,
        description: command.description,
        argumentHint: command.argumentHint,
        ...(command.aliases?.length ? { aliases: command.aliases } : {}),
      })),
      // The same handshake reports the models this CLI offers, along with
      // which of them honour effort and adaptive thinking — so the UI can grey
      // out controls a model would ignore rather than pretending they apply.
      models: (init.models ?? []).map((model) => ({
        value: model.value,
        displayName: model.displayName,
        description: model.description,
        ...(model.supportsEffort !== undefined
          ? { supportsEffort: model.supportsEffort }
          : {}),
        ...(model.supportedEffortLevels
          ? {
              supportedEffortLevels:
                model.supportedEffortLevels as EffortLevel[],
            }
          : {}),
        ...(model.supportsAdaptiveThinking !== undefined
          ? { supportsAdaptiveThinking: model.supportsAdaptiveThinking }
          : {}),
      })),
    };
  } finally {
    // Order matters: let the generator finish before closing, so the CLI sees a
    // clean end-of-input instead of a severed pipe.
    releasePrompt();
    session.close();
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Command discovery timed out after ${ms}ms`)),
      ms,
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/**
 * Handles `GET /api/commands?workingDirectory=`.
 *
 * Always answers 200. A discovery failure yields an empty list, because the
 * composer's `/` menu is an affordance: losing it should never surface as an
 * error banner over a chat the user can still use.
 */
export async function handleCommandsRequest(c: Context) {
  const { cliPath } = c.var.config;
  const workingDirectory = c.req.query("workingDirectory") || undefined;
  const cacheKey = workingDirectory ?? "";

  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return c.json<SlashCommandsResponse>({
      commands: cached.commands,
      models: cached.models,
    });
  }

  let discovery = inFlight.get(cacheKey);
  if (!discovery) {
    discovery = discoverCommands(cliPath, workingDirectory);
    inFlight.set(cacheKey, discovery);
    // The cleanup chain needs its own rejection handler. `.finally()` returns a
    // *new* promise that adopts the rejection, and nothing awaits that one — so
    // a discovery failure would surface as an unhandled rejection and, under
    // Node's default policy, take the server down. The awaited copy below is
    // what actually reports the error.
    void discovery.catch(() => {}).finally(() => inFlight.delete(cacheKey));
  }

  try {
    const discovered = await discovery;
    cache.set(cacheKey, {
      ...discovered,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });
    logger.api.debug(
      "Discovered {commands} commands and {models} models for {cwd}",
      {
        commands: discovered.commands.length,
        models: discovered.models.length,
        cwd: workingDirectory ?? "(default)",
      },
    );
    return c.json<SlashCommandsResponse>(discovered);
  } catch (error) {
    logger.api.warn("Slash command discovery failed: {error}", { error });
    return c.json<SlashCommandsResponse>({ commands: [], models: [] });
  }
}
