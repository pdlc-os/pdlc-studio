import { Context } from "hono";
import {
  AbortError,
  query,
  type PermissionMode,
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

    for await (const sdkMessage of query({
      prompt: processedMessage,
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
    })) {
      // Debug logging of raw SDK messages with detailed content
      logger.chat.debug("Claude SDK Message: {sdkMessage}", { sdkMessage });

      yield {
        type: "claude_json",
        data: sdkMessage,
      };
    }

    yield { type: "done" };
  } catch (error) {
    // The Agent SDK exports AbortError as a real runtime value, so an aborted
    // request can finally be reported as such instead of as a failure.
    if (error instanceof AbortError) {
      yield { type: "aborted" };
    } else {
      logger.chat.error("Claude Code execution failed: {error}", { error });
      yield {
        type: "error",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  } finally {
    // Clean up AbortController from map
    if (requestAbortControllers.has(requestId)) {
      requestAbortControllers.delete(requestId);
    }
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
