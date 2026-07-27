import { useCallback, useMemo } from "react";
import type {
  StreamResponse,
  SDKMessage,
  SystemMessage,
  AbortMessage,
} from "../../types";
import {
  isSystemMessage,
  isAssistantMessage,
  isResultMessage,
  isUserMessage,
} from "../../utils/messageTypes";
import type { StreamingContext } from "./useMessageProcessor";
import {
  UnifiedMessageProcessor,
  type ProcessingContext,
} from "../../utils/UnifiedMessageProcessor";

/**
 * Top-level SDK message types the UI deliberately does not render.
 *
 * The Agent SDK's message union is far wider than the four types this app
 * displays, and some of the rest arrive on essentially every request —
 * `rate_limit_event` is emitted once per turn. Treating those as "unknown"
 * logged a line to the browser console per request, which buried anything
 * worth reading.
 *
 * Distinct from `NON_DISPLAYED_SYSTEM_SUBTYPES` in UnifiedMessageProcessor:
 * that filters `subtype` within `type: "system"`, this filters the top-level
 * `type`.
 */
const IGNORED_SDK_MESSAGE_TYPES: ReadonlySet<string> = new Set([
  "rate_limit_event",
]);

/**
 * Types already reported as unknown, so each is logged once per page load
 * rather than once per occurrence.
 *
 * Module-level on purpose: the dedupe should span every consumer of this hook,
 * and it is diagnostics only — nothing reads it back.
 */
const reportedUnknownTypes = new Set<string>();

export function useStreamParser() {
  // Create a single unified processor instance
  const processor = useMemo(() => new UnifiedMessageProcessor(), []);

  // Convert StreamingContext to ProcessingContext
  const adaptContext = useCallback(
    (context: StreamingContext): ProcessingContext => {
      return {
        // Core message handling
        addMessage: context.addMessage,
        updateLastMessage: context.updateLastMessage,

        // Current assistant message state
        currentAssistantMessage: context.currentAssistantMessage,
        setCurrentAssistantMessage: context.setCurrentAssistantMessage,

        // Session handling
        onSessionId: context.onSessionId,
        hasReceivedInit: context.hasReceivedInit,
        setHasReceivedInit: context.setHasReceivedInit,

        // Init message handling
        shouldShowInitMessage: context.shouldShowInitMessage,
        onInitMessageShown: context.onInitMessageShown,

        // Permission/Error handling
        onPermissionError: context.onPermissionError,
        onAbortRequest: context.onAbortRequest,

        // Composer status surface. Note this adapter copies field by field and
        // every field is optional, so a callback missing here is silently
        // dropped rather than caught by the type checker — add new ones in both
        // places.
        onContextUsage: context.onContextUsage,
        onContextCompacted: context.onContextCompacted,
        onStatusChange: context.onStatusChange,
      };
    },
    [],
  );

  const processClaudeData = useCallback(
    (claudeData: SDKMessage, context: StreamingContext) => {
      const processingContext = adaptContext(context);

      // Validate message types before processing
      switch (claudeData.type) {
        case "system":
          if (!isSystemMessage(claudeData)) {
            console.warn("Invalid system message:", claudeData);
            return;
          }
          break;
        case "assistant":
          if (!isAssistantMessage(claudeData)) {
            console.warn("Invalid assistant message:", claudeData);
            return;
          }
          break;
        case "result":
          if (!isResultMessage(claudeData)) {
            console.warn("Invalid result message:", claudeData);
            return;
          }
          break;
        case "user":
          if (!isUserMessage(claudeData)) {
            console.warn("Invalid user message:", claudeData);
            return;
          }
          break;
        default: {
          const { type } = claudeData as { type: string };
          // Expected traffic the UI has no rendering for — stay quiet.
          if (IGNORED_SDK_MESSAGE_TYPES.has(type)) {
            return;
          }
          // Genuinely unrecognised: the UI is dropping a message, which is
          // worth surfacing — but once per type, not once per occurrence.
          if (!reportedUnknownTypes.has(type)) {
            reportedUnknownTypes.add(type);
            console.warn(
              `Unhandled Claude message type "${type}" — dropping it. Add it to IGNORED_SDK_MESSAGE_TYPES if that is expected.`,
              claudeData,
            );
          }
          return;
        }
      }

      // Process the message using the unified processor
      processor.processMessage(claudeData, processingContext, {
        isStreaming: true,
      });
    },
    [processor, adaptContext],
  );

  const processStreamLine = useCallback(
    (line: string, context: StreamingContext) => {
      try {
        const data: StreamResponse = JSON.parse(line);

        if (data.type === "claude_json" && data.data) {
          // data.data is already an SDKMessage object, no need to parse
          const claudeData = data.data as SDKMessage;
          processClaudeData(claudeData, context);
        } else if (data.type === "error") {
          const errorMessage: SystemMessage = {
            type: "error",
            subtype: "stream_error",
            message: data.error || "Unknown error",
            timestamp: Date.now(),
          };
          context.addMessage(errorMessage);
        } else if (data.type === "aborted") {
          const abortedMessage: AbortMessage = {
            type: "system",
            subtype: "abort",
            message: "Operation was aborted by user",
            timestamp: Date.now(),
          };
          context.addMessage(abortedMessage);
          context.setCurrentAssistantMessage(null);
        }
      } catch (parseError) {
        console.error("Failed to parse stream line:", parseError);
      }
    },
    [processClaudeData],
  );

  return {
    processStreamLine,
  };
}
