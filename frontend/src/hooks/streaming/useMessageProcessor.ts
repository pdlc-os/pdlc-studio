import type { ContextUsage } from "../../utils/contextUsage";
import type { AgentEvent } from "../../utils/agentActivity";
import type { PendingQuestionPayload } from "../../types";
import type { SDKStatus } from "../../types";
import type { AllMessage, ChatMessage } from "../../types";
import { useMessageConverter } from "../useMessageConverter";

export interface StreamingContext {
  currentAssistantMessage: ChatMessage | null;
  setCurrentAssistantMessage: (msg: ChatMessage | null) => void;
  addMessage: (msg: AllMessage) => void;
  updateLastMessage: (content: string) => void;
  onSessionId?: (sessionId: string) => void;
  shouldShowInitMessage?: () => boolean;
  onInitMessageShown?: () => void;
  hasReceivedInit?: boolean;
  setHasReceivedInit?: (received: boolean) => void;
  onPermissionError?: (
    toolName: string,
    patterns: string[],
    toolUseId: string,
  ) => void;
  onAbortRequest?: () => void;
  /** Context-window fill, reported once a turn's result arrives. */
  onContextUsage?: (usage: ContextUsage) => void;
  /** Tokens left after a compaction, for an immediate island refresh. */
  onContextCompacted?: (postTokens: number) => void;
  /** Live CLI status; `compacting` is what drives the island's animation. */
  onStatusChange?: (status: SDKStatus) => void;
  /** Task lifecycle, folded into the Agents panel's state. */
  onAgentEvent?: (event: AgentEvent) => void;
  /** A question Claude is blocked on, awaiting the user's answer. */
  onAskQuestion?: (question: PendingQuestionPayload) => void;
}

/**
 * Hook that provides message processing functions for streaming context.
 * Now delegates to the unified message converter for consistency.
 */
export function useMessageProcessor() {
  const converter = useMessageConverter();

  return {
    // Delegate to unified converter
    createSystemMessage: converter.createSystemMessage,
    createToolMessage: converter.createToolMessage,
    createResultMessage: converter.createResultMessage,
    createToolResultMessage: converter.createToolResultMessage,
    createThinkingMessage: converter.createThinkingMessage,
    convertTimestampedSDKMessage: converter.convertTimestampedSDKMessage,
    convertConversationHistory: converter.convertConversationHistory,
  };
}
