import { Context } from "hono";
import {
  AbortError,
  query,
  type PermissionMode,
  type Query,
  type SDKUserMessage,
} from "@anthropic-ai/claude-agent-sdk";
import type {
  ChatRequest,
  EffortLevel,
  StreamResponse,
  ThinkingMode,
} from "../../shared/types.ts";
import { logger } from "../utils/logger.ts";
import {
  resolvePermissionMode,
  VALID_PERMISSION_MODES,
} from "../utils/permissions.ts";

/**
 * Turns currently in flight, so control requests can reach them.
 *
 * Keyed by requestId, the same key the abort map uses. An entry exists only
 * while the turn is running: it is removed in the `finally` below, so a
 * control request naming a finished turn gets a clean 404 rather than acting
 * on a dead session.
 *
 * Module-level rather than threaded through the handler because control
 * requests arrive on their own HTTP requests, with nothing else in common.
 */
const activeSessions = new Map<string, Query>();

/** The live turn for a request, if there is one. */
export function getActiveSession(requestId: string): Query | undefined {
  return activeSessions.get(requestId);
}

/**
 * Requests the user deliberately stopped with interrupt().
 *
 * A successful interrupt does not end the query quietly: the SDK raises
 * "Claude Code returned an error result: [ede_diagnostic] result_type=user",
 * which is indistinguishable from a genuine failure at the catch site. Without
 * this the user presses Stop and the transcript shows an error, which is worse
 * than the kill path it replaced.
 *
 * Set by the abort handler, read once by the turn, cleared in its `finally`.
 */
const interruptedRequests = new Set<string>();

export function markInterrupted(requestId: string): void {
  interruptedRequests.add(requestId);
}

/**
 * Executes a Claude command and yields streaming responses
 * @param message - User message or command
 * @param requestId - Unique request identifier for abort functionality
 * @param requestAbortControllers - Shared map of abort controllers
 * @param cliPath - Path to actual CLI script (detected by validateClaudeCli)
 * @param sessionId - Optional session ID for conversation continuity
 * @param allowedTools - Optional array of allowed tool names
 * @param workingDirectory - Optional working directory for Claude execution
 * @param permissionMode - Optional permission mode for Claude execution
 * @returns AsyncGenerator yielding StreamResponse objects
 */
async function* executeClaudeCommand(
  message: string,
  requestId: string,
  requestAbortControllers: Map<string, AbortController>,
  cliPath: string,
  sessionId?: string,
  allowedTools?: string[],
  workingDirectory?: string,
  permissionMode?: PermissionMode,
  model?: string,
  effortLevel?: EffortLevel,
  thinking?: ThinkingMode,
): AsyncGenerator<StreamResponse> {
  let abortController: AbortController;
  /** Releases the parked input stream; see userInput below. */
  let closeInput: () => void = () => {};

  try {
    /*
     * The message goes to the SDK exactly as typed.
     *
     * This used to strip a leading "/", inherited from a time when the command
     * was passed as a CLI argument. Under the Agent SDK the slash is not
     * decoration — it is what marks the prompt as a command. Stripping it
     * turned "/compact" into the word "compact", which Claude answered in
     * prose ("it's `/compact` (with the slash)") while no compaction ran, and
     * did the same to every command the composer's `/` picker offers.
     */
    const processedMessage = message;

    // Create and store AbortController for this request
    abortController = new AbortController();
    requestAbortControllers.set(requestId, abortController);

    // Held open for the life of the turn; see userInput below.
    const inputClosed = new Promise<void>((resolve) => {
      closeInput = resolve;
    });

    /*
     * Streaming input, not a plain string.
     *
     * The SDK's control requests — interrupt(), setModel(),
     * setPermissionMode() — are documented as "only supported when streaming
     * input/output is used", and a string prompt is not. With a string the
     * only way to stop a turn was to kill the process through the
     * AbortController, which loses the turn instead of ending it.
     *
     * The generator yields the message and then *parks* rather than returning.
     * Returning ends the input stream, and the CLI treats end-of-input as the
     * end of the session — which closes the control channel with it. Measured:
     * with an exhausted stream, interrupt() never resolves and times out.
     * `commands.ts` parks for the same reason, so that
     * `initializationResult()` — also a control request — can be answered.
     *
     * The park is released when the turn's `result` arrives, and
     * unconditionally in the `finally`, so the query can never be left waiting
     * on input that is not coming.
     *
     * `origin` must be stamped explicitly. The SDK treats an absent origin as
     * unattributed and fails closed at strict isHuman() trust gates, and this
     * really is keyboard input the user typed.
     */
    async function* userInput(): AsyncGenerator<SDKUserMessage> {
      yield {
        type: "user",
        message: { role: "user", content: processedMessage },
        parent_tool_use_id: null,
        origin: { kind: "human" },
      };
      await inputClosed;
    }

    const session = query({
      prompt: userInput(),
      options: {
        abortController,
        executable: "node" as const,
        executableArgs: [],
        pathToClaudeCodeExecutable: cliPath,
        // The Agent SDK sends an *empty* system prompt when this is omitted —
        // it is a generic agent harness, not Claude Code, by default. This app
        // is a front end for Claude Code, so ask for the CLI's own prompt
        // explicitly. Dropping this line silently removes tool guidance,
        // CLAUDE.md handling, and every other Claude Code behaviour.
        systemPrompt: {
          type: "preset" as const,
          preset: "claude_code" as const,
        },
        ...(sessionId ? { resume: sessionId } : {}),
        ...(allowedTools ? { allowedTools } : {}),
        ...(workingDirectory ? { cwd: workingDirectory } : {}),
        ...(permissionMode ? { permissionMode } : {}),
        /*
         * All three are omitted unless chosen, so the CLI's own defaults stand.
         * Sending an explicit value for every request would override whatever
         * the user configured in their settings.json.
         */
        ...(model ? { model } : {}),
        ...(effortLevel ? { effortLevel } : {}),
        ...(thinking
          ? {
              // `enabled` needs a budget; the SDK treats adaptive as
              // "Claude decides", which is the sensible default when on.
              thinking:
                thinking === "enabled"
                  ? ({ type: "enabled" } as const)
                  : thinking === "disabled"
                    ? ({ type: "disabled" } as const)
                    : ({ type: "adaptive" } as const),
            }
          : {}),
      },
    });

    // Held so control requests can reach this turn while it runs; dropped in
    // the finally below, so a finished turn is never addressable.
    activeSessions.set(requestId, session);

    for await (const sdkMessage of session) {
      // Debug logging of raw SDK messages with detailed content
      logger.chat.debug("Claude SDK Message: {sdkMessage}", { sdkMessage });

      yield {
        type: "claude_json",
        data: sdkMessage,
      };

      /*
       * The turn is over, so stop holding the input stream open. Without this
       * the CLI waits for more input and the query — and the HTTP response
       * with it — never ends.
       */
      if (sdkMessage.type === "result") {
        closeInput();
      }
    }

    yield { type: "done" };
  } catch (error) {
    // The Agent SDK exports AbortError as a real runtime value, so an aborted
    // request can finally be reported as such instead of as a failure.
    if (error instanceof AbortError || interruptedRequests.has(requestId)) {
      // An interrupt the user asked for is a stop, not a failure — see
      // interruptedRequests above for why it arrives as an error at all.
      yield { type: "aborted" };
    } else {
      logger.chat.error("Claude Code execution failed: {error}", { error });
      yield {
        type: "error",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  } finally {
    // Belt and braces: an error before the result message would otherwise
    // leave the generator parked forever.
    closeInput();
    interruptedRequests.delete(requestId);

    // Clean up AbortController from map
    if (requestAbortControllers.has(requestId)) {
      requestAbortControllers.delete(requestId);
    }
    // Must happen on every exit path — a leaked entry would let a later
    // control request act on a session that has already finished.
    activeSessions.delete(requestId);
  }
}

/**
 * Handles POST /api/chat requests with streaming responses
 * @param c - Hono context object with config variables
 * @param requestAbortControllers - Shared map of abort controllers
 * @returns Response with streaming NDJSON
 */
export async function handleChatRequest(
  c: Context,
  requestAbortControllers: Map<string, AbortController>,
) {
  const chatRequest: ChatRequest = await c.req.json();
  const { cliPath } = c.var.config;

  logger.chat.debug(
    "Received chat request {*}",
    chatRequest as unknown as Record<string, unknown>,
  );

  const permissionMode = resolvePermissionMode(chatRequest.permissionMode);
  if (permissionMode === null) {
    logger.chat.warn("Rejected unknown permission mode: {mode}", {
      mode: chatRequest.permissionMode,
    });
    return c.json(
      {
        error: `Invalid permissionMode: ${String(chatRequest.permissionMode)}. Expected one of ${VALID_PERMISSION_MODES.join(", ")}.`,
      },
      400,
    );
  }

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of executeClaudeCommand(
          chatRequest.message,
          chatRequest.requestId,
          requestAbortControllers,
          cliPath, // Use detected CLI path from validateClaudeCli
          chatRequest.sessionId,
          chatRequest.allowedTools,
          chatRequest.workingDirectory,
          permissionMode,
          chatRequest.model,
          chatRequest.effortLevel,
          chatRequest.thinking,
        )) {
          const data = JSON.stringify(chunk) + "\n";
          controller.enqueue(new TextEncoder().encode(data));
        }
        controller.close();
      } catch (error) {
        const errorResponse: StreamResponse = {
          type: "error",
          error: error instanceof Error ? error.message : String(error),
        };
        controller.enqueue(
          new TextEncoder().encode(JSON.stringify(errorResponse) + "\n"),
        );
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
