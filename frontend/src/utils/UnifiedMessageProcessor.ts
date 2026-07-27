import type {
  AllMessage,
  ChatMessage,
  ThinkingMessage,
  ModelUsage,
  SDKMessage,
  SDKStatus,
  TimestampedSDKMessage,
} from "../types";
import { readContextUsage, type ContextUsage } from "./contextUsage";
import { readLocalCommandTurn } from "./localCommandTurns";
import type { AgentEvent } from "./agentActivity";
import { AGENT_TASK_SUBTYPES, toAgentEvent } from "./agentEvents";
import {
  convertSystemMessage,
  convertResultMessage,
  createToolMessage,
  createToolResultMessage,
  createThinkingMessage,
  createTodoMessageFromInput,
} from "./messageConversion";
import { isThinkingContentItem } from "./messageTypes";
import { extractToolInfo, generateToolPatterns } from "./toolUtils";

/**
 * `type: "system"` subtypes that are never shown in the transcript.
 *
 * The Agent SDK routes a great deal of telemetry and internal bookkeeping
 * through `type: "system"` — there are ~40 subtypes, and the UI has dedicated
 * rendering for almost none of them. Anything not filtered here falls through
 * to `SystemMessageComponent`'s raw-JSON fallback and clutters the conversation.
 *
 * `init` is suppressed for *display only*; its session-state side effects still
 * run in `processSystemMessage`.
 *
 * This is a blocklist, so a future SDK version can introduce a new noisy
 * subtype that shows up in the UI until it is added here. Add subtypes as they
 * surface, or switch to an allowlist of the subtypes the UI actually renders.
 */
export const NON_DISPLAYED_SYSTEM_SUBTYPES: readonly string[] = [
  "init",
  "hook_started",
  "hook_progress",
  "hook_response",
  "thinking_tokens",
  // Observed in live sessions after the five above: emitted whenever Claude
  // runs a background task, e.g. a long bash command.
  "background_tasks_changed",
  "task_started",
  // Fire-and-forget push of the full slash-command list when it changes
  // mid-session (e.g. a skill discovered as the agent moves into a
  // subdirectory). Carries a whole command array, so leaving it unlisted dumps
  // the entire catalogue into the transcript as JSON.
  "commands_changed",
  // Marks where a compaction happened. Its numbers drive the context island,
  // which is a better place for them than a JSON blob mid-conversation.
  "compact_boundary",
  // Live status ('requesting' / 'compacting'). It drives the composer's
  // context island; rendering it in the transcript would add a JSON dump per
  // turn.
  "status",
  /*
   * Task telemetry, which drives the Agents panel.
   *
   * `task_progress`, `task_updated` and `task_notification` were never listed,
   * so running a workflow dumped a JSON blob into the transcript for every
   * frame — several per second per agent. They are folded into the panel's
   * state before this filter runs, so nothing is lost by hiding them.
   */
  ...AGENT_TASK_SUBTYPES,
];

const NON_DISPLAYED_SYSTEM_SUBTYPE_SET: ReadonlySet<string> = new Set(
  NON_DISPLAYED_SYSTEM_SUBTYPES,
);

/** True when a `type: "system"` subtype should be kept out of the transcript. */
export function isNonDisplayedSystemSubtype(subtype: string): boolean {
  return NON_DISPLAYED_SYSTEM_SUBTYPE_SET.has(subtype);
}

/**
 * Tokens left after a compaction, from either spelling of the metadata.
 *
 * The SDK's type declares `compact_metadata.post_tokens`, but the same record
 * is written into the session file as `compactMetadata.postTokens` — so a
 * replayed conversation and a live stream do not necessarily agree, and reading
 * only one spelling silently never fires for the other.
 *
 * Returns null rather than 0 when absent, which is the common case: an observed
 * manual `/compact` reports `preTokens` and a duration but no post-count at all.
 * A 0 there would paint a reassuring empty meter that nothing measured.
 */
export function readCompactedTokens(message: unknown): number | null {
  const record = message as {
    compact_metadata?: { post_tokens?: number };
    compactMetadata?: { postTokens?: number };
  };

  const postTokens =
    record.compact_metadata?.post_tokens ?? record.compactMetadata?.postTokens;

  return typeof postTokens === "number" ? postTokens : null;
}

/**
 * Tool cache interface for tracking tool_use information
 */
interface ToolCache {
  name: string;
  input: Record<string, unknown>;
}

/**
 * Processing context interface for streaming use case
 */
export interface ProcessingContext {
  // Core message handling
  addMessage: (message: AllMessage) => void;
  updateLastMessage?: (content: string) => void;

  // Current assistant message state (for streaming)
  currentAssistantMessage?: ChatMessage | null;
  setCurrentAssistantMessage?: (message: ChatMessage | null) => void;

  // Composer status island
  /** Context-window fill, reported once a turn's result arrives. */
  onContextUsage?: (usage: ContextUsage) => void;
  /** Tokens left after a compaction, for an immediate island refresh. */
  onContextCompacted?: (postTokens: number) => void;
  /** Live CLI status; `compacting` is what drives the island's animation. */
  onStatusChange?: (status: SDKStatus) => void;
  /** Task lifecycle, folded into the Agents panel's state. */
  onAgentEvent?: (event: AgentEvent) => void;

  // Session handling
  onSessionId?: (sessionId: string) => void;
  hasReceivedInit?: boolean;
  setHasReceivedInit?: (received: boolean) => void;

  // Init message handling
  shouldShowInitMessage?: () => boolean;
  onInitMessageShown?: () => void;

  // Permission/Error handling
  onPermissionError?: (
    toolName: string,
    patterns: string[],
    toolUseId: string,
  ) => void;
  onAbortRequest?: () => void;
}

/**
 * Processing options for different use cases
 */
export interface ProcessingOptions {
  /** Whether this is streaming mode (vs batch history processing) */
  isStreaming?: boolean;
  /** Override timestamp for batch processing */
  timestamp?: number;
}

/**
 * Helper function to detect tool use errors that should be displayed as regular results
 */
function isToolUseError(content: string): boolean {
  return content.includes("tool_use_error");
}

/**
 * Unified Message Processor
 *
 * This class provides consistent message processing logic for both
 * streaming and history loading scenarios, ensuring identical output
 * regardless of the data source.
 */
export class UnifiedMessageProcessor {
  private toolUseCache = new Map<string, ToolCache>();

  /**
   * Clear the tool use cache
   */
  public clearCache(): void {
    this.toolUseCache.clear();
  }

  /**
   * Store tool_use information for later correlation with tool_result
   */
  private cacheToolUse(
    id: string,
    name: string,
    input: Record<string, unknown>,
  ): void {
    this.toolUseCache.set(id, { name, input });
  }

  /**
   * Retrieve cached tool_use information
   */
  private getCachedToolInfo(id: string): ToolCache | undefined {
    return this.toolUseCache.get(id);
  }

  /**
   * Handle permission errors during streaming
   */
  private handlePermissionError(
    contentItem: { tool_use_id?: string; content: string },
    context: ProcessingContext,
  ): void {
    // Immediately abort the current request
    if (context.onAbortRequest) {
      context.onAbortRequest();
    }

    // Get cached tool_use information
    const toolUseId = contentItem.tool_use_id || "";
    const cachedToolInfo = this.getCachedToolInfo(toolUseId);

    // Extract tool information for permission handling
    const { toolName, commands } = extractToolInfo(
      cachedToolInfo?.name,
      cachedToolInfo?.input,
    );

    // Compute patterns based on tool type
    const patterns = generateToolPatterns(toolName, commands);

    // Notify parent component about permission error
    if (context.onPermissionError) {
      context.onPermissionError(toolName, patterns, toolUseId);
    }
  }

  /**
   * Process tool_result content item
   */
  private processToolResult(
    // `content` is declared loosely on purpose: a tool_result block may carry a
    // string, an array of content blocks, or nothing at all. The body already
    // serialises the non-string cases.
    contentItem: {
      tool_use_id?: string;
      content?: unknown;
      is_error?: boolean;
    },
    context: ProcessingContext,
    options: ProcessingOptions,
    toolUseResult?: unknown,
  ): void {
    const content =
      typeof contentItem.content === "string"
        ? contentItem.content
        : // JSON.stringify(undefined) is undefined, not "undefined"
          (JSON.stringify(contentItem.content) ?? "");

    // Check for permission errors - but skip tool use errors which should be displayed as regular results
    if (
      options.isStreaming &&
      contentItem.is_error &&
      !isToolUseError(content)
    ) {
      this.handlePermissionError({ ...contentItem, content }, context);
      return;
    }

    // Get cached tool_use information to determine tool name
    const toolUseId = contentItem.tool_use_id || "";
    const cachedToolInfo = this.getCachedToolInfo(toolUseId);
    const toolName = cachedToolInfo?.name || "Tool";

    // Don't show tool_result for TodoWrite since we already show TodoMessage from tool_use
    if (toolName === "TodoWrite") {
      return;
    }

    /*
     * The path comes from the *request*, not the result: a Read returns file
     * contents with no indication of which file. Any tool naming a path counts
     * here — unlike the Files tab, which lists only tools that write — because
     * the language of what is displayed depends on the file either way.
     */
    const toolInput = cachedToolInfo?.input as
      | Record<string, unknown>
      | undefined;
    const pathCandidate = toolInput?.file_path ?? toolInput?.notebook_path;
    const filePath =
      typeof pathCandidate === "string" ? pathCandidate : undefined;

    // This is a regular tool result - create a ToolResultMessage
    const toolResultMessage = createToolResultMessage(
      toolName,
      content,
      options.timestamp,
      toolUseResult,
      filePath,
    );
    context.addMessage(toolResultMessage);
  }

  /**
   * Handle assistant text content during streaming
   */
  private handleAssistantText(
    contentItem: { text?: string },
    context: ProcessingContext,
    options: ProcessingOptions,
  ): void {
    if (!options.isStreaming) {
      // For history processing, text will be handled at the message level
      return;
    }

    let messageToUpdate = context.currentAssistantMessage;

    if (!messageToUpdate) {
      messageToUpdate = {
        type: "chat",
        role: "assistant",
        content: "",
        timestamp: options.timestamp || Date.now(),
      };
      context.setCurrentAssistantMessage?.(messageToUpdate);
      context.addMessage(messageToUpdate);
    }

    const updatedContent =
      (messageToUpdate.content || "") + (contentItem.text || "");

    // Update the current assistant message state
    const updatedMessage = {
      ...messageToUpdate,
      content: updatedContent,
    };
    context.setCurrentAssistantMessage?.(updatedMessage);
    context.updateLastMessage?.(updatedContent);
  }

  /**
   * Handle tool_use content item
   */
  private handleToolUse(
    // A tool_use block's `input` is typed `unknown` by the SDK — its shape is
    // whatever the invoked tool declared — so it is narrowed below rather than
    // assumed to be an object.
    contentItem: {
      id?: string;
      name?: string;
      input?: unknown;
    },
    context: ProcessingContext,
    options: ProcessingOptions,
  ): void {
    const input: Record<string, unknown> =
      typeof contentItem.input === "object" &&
      contentItem.input !== null &&
      !Array.isArray(contentItem.input)
        ? (contentItem.input as Record<string, unknown>)
        : {};

    // Cache tool_use information for later permission error handling and tool_result correlation
    if (contentItem.id && contentItem.name) {
      this.cacheToolUse(contentItem.id, contentItem.name, input);
    }

    // Special handling for ExitPlanMode - create plan message instead of tool message
    if (contentItem.name === "ExitPlanMode") {
      const planContent = (input.plan as string) || "";
      const planMessage = {
        type: "plan" as const,
        plan: planContent,
        toolUseId: contentItem.id || "",
        timestamp: options.timestamp || Date.now(),
      };
      context.addMessage(planMessage);
    } else if (contentItem.name === "TodoWrite") {
      // Special handling for TodoWrite - create todo message from input
      const todoMessage = createTodoMessageFromInput(input, options.timestamp);
      if (todoMessage) {
        context.addMessage(todoMessage);
      } else {
        // Fallback to regular tool message if todo parsing fails
        const toolMessage = createToolMessage(
          { ...contentItem, input },
          options.timestamp,
        );
        context.addMessage(toolMessage);
      }
    } else {
      const toolMessage = createToolMessage(
        { ...contentItem, input },
        options.timestamp,
      );
      context.addMessage(toolMessage);
    }
  }

  /**
   * Process a system message
   */
  private processSystemMessage(
    message: Extract<SDKMessage | TimestampedSDKMessage, { type: "system" }>,
    context: ProcessingContext,
    options: ProcessingOptions,
  ): void {
    const timestamp = options.timestamp || Date.now();

    // Runs regardless of whether the init banner is rendered: `hasReceivedInit`
    // is what allows session_id to be picked up from later assistant messages,
    // so suppressing the *display* of init must not skip this.
    if (options.isStreaming && message.subtype === "init") {
      context.setHasReceivedInit?.(true);
    }

    // Reported before the display filter below, for the same reason `init` is:
    // suppressing a subtype from the transcript must not suppress its effects.
    if (message.subtype === "status") {
      const status = (message as { status?: SDKStatus }).status ?? null;
      context.onStatusChange?.(status);
    }

    // Reported before the display filter, for the same reason as `init`: these
    // subtypes are hidden from the transcript but are the only source the
    // Agents panel has.
    if (context.onAgentEvent) {
      const agentEvent = toAgentEvent(message, timestamp);
      if (agentEvent) context.onAgentEvent(agentEvent);
    }

    // Compaction is the one event that makes the context reading fall rather
    // than rise, and the boundary is the only message that says by how much.
    // Waiting for the next turn's result would leave the island showing the
    // pre-compaction number at exactly the moment it is being read.
    if (message.subtype === "compact_boundary") {
      const postTokens = readCompactedTokens(message);

      if (postTokens !== null) {
        context.onContextCompacted?.(postTokens);
      }
    }

    if (isNonDisplayedSystemSubtype(message.subtype)) {
      return;
    }

    context.addMessage(convertSystemMessage(message, timestamp));
  }

  /**
   * Process an assistant message
   */
  private processAssistantMessage(
    message: Extract<SDKMessage | TimestampedSDKMessage, { type: "assistant" }>,
    context: ProcessingContext,
    options: ProcessingOptions,
  ): AllMessage[] {
    const timestamp = options.timestamp || Date.now();
    const messages: AllMessage[] = [];

    // Update sessionId only for the first assistant message after init (streaming only)
    if (
      options.isStreaming &&
      context.hasReceivedInit &&
      message.session_id &&
      context.onSessionId
    ) {
      context.onSessionId(message.session_id);
    }

    // For batch processing, collect messages to return
    // For streaming, messages are added directly via context
    const localContext = options.isStreaming
      ? context
      : {
          ...context,
          addMessage: (msg: AllMessage) => messages.push(msg),
        };

    let assistantContent = "";
    const thinkingMessages: ThinkingMessage[] = [];

    // Check if message.content exists and is an array
    if (message.message?.content && Array.isArray(message.message.content)) {
      for (const item of message.message.content) {
        if (item.type === "text") {
          if (options.isStreaming) {
            this.handleAssistantText(item, context, options);
          } else {
            assistantContent += (item as { text: string }).text;
          }
        } else if (item.type === "tool_use") {
          this.handleToolUse(item, localContext, options);
        } else if (isThinkingContentItem(item)) {
          const thinkingMessage = createThinkingMessage(
            item.thinking,
            timestamp,
          );
          if (options.isStreaming) {
            context.addMessage(thinkingMessage);
          } else {
            thinkingMessages.push(thinkingMessage);
          }
        }
      }
    }

    // For batch processing, assemble the messages in proper order
    if (!options.isStreaming) {
      const orderedMessages: AllMessage[] = [];

      // Add thinking messages first (reasoning comes before action)
      orderedMessages.push(...thinkingMessages);

      // Add tool messages second (actions)
      orderedMessages.push(...messages);

      // Add assistant text message last if there is text content
      if (assistantContent.trim()) {
        const assistantMessage: ChatMessage = {
          type: "chat",
          role: "assistant",
          content: assistantContent.trim(),
          timestamp,
        };
        orderedMessages.push(assistantMessage);
      }

      return orderedMessages;
    }

    return messages;
  }

  /**
   * Process a result message
   */
  private processResultMessage(
    message: Extract<SDKMessage | TimestampedSDKMessage, { type: "result" }>,
    context: ProcessingContext,
    options: ProcessingOptions,
  ): void {
    const timestamp = options.timestamp || Date.now();
    const resultMessage = convertResultMessage(message, timestamp);
    context.addMessage(resultMessage);

    // The result is where per-model token usage lands, so it is the only point
    // the context-window figure can be refreshed from.
    const usage = readContextUsage(
      (message as { modelUsage?: Record<string, ModelUsage> }).modelUsage,
    );
    if (usage) context.onContextUsage?.(usage);

    // A turn ending means nothing is in flight, whatever the last status said.
    context.onStatusChange?.(null);

    // Clear current assistant message (streaming only)
    if (options.isStreaming) {
      context.setCurrentAssistantMessage?.(null);
    }
  }

  /**
   * Process a user message
   */
  private processUserMessage(
    message: Extract<SDKMessage | TimestampedSDKMessage, { type: "user" }>,
    context: ProcessingContext,
    options: ProcessingOptions,
  ): AllMessage[] {
    /*
     * After compaction the CLI feeds the summary back in as a user turn, so
     * the model has the history it just discarded. It is machinery, not
     * speech: the user did not write several thousand words about their own
     * conversation, and showing it puts the summary in the transcript twice
     * over — once as the wall of text, once as the conversation it summarises.
     *
     * `isCompactSummary` is the CLI's own flag for exactly this, which is
     * worth far more than matching the English it happens to open with.
     */
    if ((message as { isCompactSummary?: boolean }).isCompactSummary === true) {
      return [];
    }

    const timestamp = options.timestamp || Date.now();
    const messages: AllMessage[] = [];

    // For batch processing, collect messages to return
    // For streaming, messages are added directly via context
    const localContext = options.isStreaming
      ? context
      : {
          ...context,
          addMessage: (msg: AllMessage) => messages.push(msg),
        };

    const messageContent = message.message.content;

    if (Array.isArray(messageContent)) {
      for (const contentItem of messageContent) {
        if (contentItem.type === "tool_result") {
          // Extract toolUseResult from message if it exists
          const toolUseResult = (message as { toolUseResult?: unknown })
            .toolUseResult;
          this.processToolResult(
            contentItem,
            localContext,
            options,
            toolUseResult,
          );
        } else if (contentItem.type === "text") {
          this.addUserText(
            (contentItem as { text: string }).text,
            timestamp,
            localContext,
          );
        }
      }
    } else if (typeof messageContent === "string") {
      this.addUserText(messageContent, timestamp, localContext);
    }

    return messages;
  }

  /**
   * Adds a user-role text turn, after unwrapping the CLI's command plumbing.
   *
   * Running a slash command emits several user turns of XML that the user
   * never typed. An invocation becomes the command as typed, so it reads —
   * and highlights — like one; the caveat aimed at the model is dropped, as
   * is output that only acknowledges what the transcript already shows.
   * Output carrying a real answer (/cost and friends) is kept, unwrapped.
   */
  private addUserText(
    text: string,
    timestamp: number,
    context: ProcessingContext,
  ): void {
    const turn = readLocalCommandTurn(text);

    // Guidance for the model, and acknowledgements of something the
    // transcript already shows.
    if (turn?.kind === "caveat") return;
    if (turn?.kind === "output" && turn.isRedundant) return;

    context.addMessage({
      type: "chat",
      role: "user",
      content: turn ? turn.text : text,
      timestamp,
    } satisfies ChatMessage);
  }

  /**
   * Process a single SDK message
   *
   * @param message - The SDK message to process
   * @param context - Processing context for callbacks and state management
   * @param options - Processing options (streaming vs batch, timestamp override)
   * @returns Array of messages for batch processing (empty for streaming)
   */
  public processMessage(
    message: SDKMessage | TimestampedSDKMessage,
    context: ProcessingContext,
    options: ProcessingOptions = {},
  ): AllMessage[] {
    // `timestamp` is required on TimestampedSDKMessage but optional on plain SDK
    // messages, so presence of the key isn't enough — check for a real value.
    const timestamp =
      options.timestamp ||
      ("timestamp" in message && typeof message.timestamp === "string"
        ? new Date(message.timestamp).getTime()
        : Date.now());

    const finalOptions = { ...options, timestamp };

    switch (message.type) {
      case "system":
        this.processSystemMessage(message, context, finalOptions);
        return [];

      case "assistant":
        return this.processAssistantMessage(message, context, finalOptions);

      case "result":
        this.processResultMessage(message, context, finalOptions);
        return [];

      case "user":
        return this.processUserMessage(message, context, finalOptions);

      default:
        console.warn(
          "Unknown message type:",
          (message as { type: string }).type,
        );
        return [];
    }
  }

  /**
   * Process multiple messages in batch (for history loading)
   *
   * @param messages - Array of timestamped SDK messages
   * @param context - Processing context
   * @returns Array of processed messages
   */
  public processMessagesBatch(
    messages: TimestampedSDKMessage[],
    context?: Partial<ProcessingContext>,
  ): AllMessage[] {
    const allMessages: AllMessage[] = [];

    // Create a batch context that collects messages
    const batchContext: ProcessingContext = {
      addMessage: (msg: AllMessage) => allMessages.push(msg),
      ...context,
    };

    // Clear cache before processing batch
    this.clearCache();

    for (const message of messages) {
      const processedMessages = this.processMessage(message, batchContext, {
        isStreaming: false,
        timestamp: new Date(message.timestamp).getTime(),
      });
      allMessages.push(...processedMessages);
    }

    return allMessages;
  }
}
