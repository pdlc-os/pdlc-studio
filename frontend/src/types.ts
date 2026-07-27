import type {
  SDKMessage,
  SDKUserMessage,
  SDKAssistantMessage,
  SDKSystemMessage,
  SDKResultMessage,
  PermissionMode as SDKPermissionMode,
} from "@anthropic-ai/claude-agent-sdk";

/**
 * Every SDK message that arrives with `type: "system"`.
 *
 * The Agent SDK routes far more than the session banner through this type —
 * compaction boundaries, status updates, hook progress, task notifications and
 * more all share `type: "system"` and are told apart by `subtype`. Consumers
 * must narrow on `subtype` before touching `init`-only fields such as `tools`
 * or `cwd`.
 */
export type SDKSystemLikeMessage = Extract<SDKMessage, { type: "system" }>;

// Chat message for user/assistant interactions (not part of SDKMessage)
export interface ChatMessage {
  type: "chat";
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

// Error message for streaming errors
export type ErrorMessage = {
  type: "error";
  subtype: "stream_error";
  message: string;
  timestamp: number;
};

// Abort message for aborted operations
export type AbortMessage = {
  type: "system";
  subtype: "abort";
  message: string;
  timestamp: number;
};

// Hooks message for hook execution notifications
export type HooksMessage = {
  type: "system";
  content: string;
  level?: string;
  toolUseID?: string;
};

// System message extending SDK types with timestamp
export type SystemMessage = (
  | SDKSystemLikeMessage
  | SDKResultMessage
  | ErrorMessage
  | AbortMessage
  | HooksMessage
) & {
  timestamp: number;
};

// Tool message for tool usage display
export type ToolMessage = {
  type: "tool";
  content: string;
  timestamp: number;
  /**
   * Structured copy of what the display string was built from.
   *
   * `content` is formatted for reading ("Write(file_path: ...)"), and the
   * Files tab needs the path itself. Captured here at creation, where the tool
   * input is still structured, rather than parsed back out of prose.
   */
  toolName?: string;
  /** Path this tool wrote, for the file-producing tools only. */
  filePath?: string;
  /**
   * Files a shell command redirects stdout into.
   *
   * Separate from `filePath` because it is *inferred* from a command string
   * rather than read from a structured input, and one command can write
   * several files. Relative targets are stored as written and resolved later,
   * where the working directory is known.
   */
  redirectPaths?: string[];
};

// Tool result message for tool result display
export type ToolResultMessage = {
  type: "tool_result";
  toolName: string;
  content: string;
  summary: string;
  timestamp: number;
  toolUseResult?: unknown; // Contains structured data like structuredPatch, stdout, stderr etc.
  /**
   * Path the originating tool acted on, when it named one.
   *
   * Taken from the cached tool_use input, which is the only place it exists —
   * the result itself carries content, not the file it came from. Used to pick
   * a syntax-highlighting language for the result body.
   */
  filePath?: string;
};

// Plan approval dialog state
export interface PlanApprovalDialog {
  isOpen: boolean;
  plan: string;
  toolUseId: string;
}

// Plan message type for UI display
export interface PlanMessage {
  type: "plan";
  plan: string;
  toolUseId: string;
  timestamp: number;
}

// Thinking message for Claude's reasoning process
export interface ThinkingMessage {
  type: "thinking";
  content: string;
  timestamp: number;
}

// Todo item structure for TodoWrite tool results
export interface TodoItem {
  content: string;
  status: "pending" | "in_progress" | "completed";
  activeForm: string;
}

// Todo message for TodoWrite tool result display
export interface TodoMessage {
  type: "todo";
  todos: TodoItem[];
  timestamp: number;
}

// Thinking content item from Claude SDK
export interface ThinkingContentItem {
  type: "thinking";
  thinking: string;
}

// TimestampedSDKMessage types for conversation history API
// These extend Claude SDK types with timestamp information
type WithTimestamp<T> = T & { timestamp: string };

export type TimestampedSDKUserMessage = WithTimestamp<SDKUserMessage>;
export type TimestampedSDKAssistantMessage = WithTimestamp<SDKAssistantMessage>;
export type TimestampedSDKSystemMessage = WithTimestamp<SDKSystemMessage>;
export type TimestampedSDKResultMessage = WithTimestamp<SDKResultMessage>;

export type TimestampedSDKMessage =
  | TimestampedSDKUserMessage
  | TimestampedSDKAssistantMessage
  | TimestampedSDKSystemMessage
  | TimestampedSDKResultMessage;

export type AllMessage =
  | ChatMessage
  | SystemMessage
  | ToolMessage
  | ToolResultMessage
  | PlanMessage
  | ThinkingMessage
  | TodoMessage;

// Type guard functions
export function isChatMessage(message: AllMessage): message is ChatMessage {
  return message.type === "chat";
}

export function isSystemMessage(message: AllMessage): message is SystemMessage {
  return (
    message.type === "system" ||
    message.type === "result" ||
    message.type === "error"
  );
}

export function isToolMessage(message: AllMessage): message is ToolMessage {
  return message.type === "tool";
}

export function isToolResultMessage(
  message: AllMessage,
): message is ToolResultMessage {
  return message.type === "tool_result";
}

export function isPlanMessage(message: AllMessage): message is PlanMessage {
  return message.type === "plan";
}

export function isThinkingMessage(
  message: AllMessage,
): message is ThinkingMessage {
  return message.type === "thinking";
}

export function isTodoMessage(message: AllMessage): message is TodoMessage {
  return message.type === "todo";
}

// Permission mode types — now the full SDK PermissionMode set, since
// bypassPermissions is the app's default and must be representable in the UI.
export type PermissionMode =
  | "default"
  | "plan"
  | "acceptEdits"
  | "bypassPermissions";

// SDK type integration utilities
export function toSDKPermissionMode(uiMode: PermissionMode): SDKPermissionMode {
  return uiMode;
}

/**
 * Narrows an SDK permission mode to one the UI can display.
 *
 * The Agent SDK's set is a superset of the four modes this app cycles through —
 * it also has `dontAsk` and `auto`. Those have no UI representation, and
 * reporting them as a mode the user did pick would be worse than admitting we
 * don't know, so they collapse to `default`. Add them to `PermissionMode` and
 * to the UI's cycle order if the app should ever offer them.
 */
export function fromSDKPermissionMode(
  sdkMode: SDKPermissionMode,
): PermissionMode {
  switch (sdkMode) {
    case "default":
    case "plan":
    case "acceptEdits":
    case "bypassPermissions":
      return sdkMode;
    default:
      return "default";
  }
}

// Chat state extensions for permission mode
export interface ChatStatePermissions {
  permissionMode: PermissionMode;
  planApprovalDialog: PlanApprovalDialog | null;
  setPermissionMode: (mode: PermissionMode) => void;
  showPlanApprovalDialog: (plan: string, toolUseId: string) => void;
  closePlanApprovalDialog: () => void;
  approvePlan: () => void;
  rejectPlan: () => void;
}

// Permission mode preference type
export interface PermissionModePreference {
  mode: PermissionMode;
  timestamp: number;
}

// Plan approval error types (simplified, realistic)
export interface PlanApprovalError {
  type: "user_rejected" | "network_error";
  message: string;
  canRetry: boolean;
}

export type PlanApprovalResult =
  | { success: true; sessionId: string }
  | { success: false; error: PlanApprovalError };

// Re-export shared types
export type {
  StreamResponse,
  ChatRequest,
  ProjectsResponse,
  ProjectInfo,
  BrowseDirectoriesResponse,
  DirectoryEntryInfo,
  CreateProjectRequest,
  CloneRepositoryRequest,
  ProjectPathResponse,
  SlashCommandInfo,
  SlashCommandsResponse,
  ConversationSummary,
  HistoryListResponse,
  RenameConversationRequest,
  DeleteConversationsResponse,
  AttachmentInfo,
  UploadAttachmentsResponse,
  ModelOption,
  EffortLevel,
  ThinkingMode,
} from "../../shared/types";

// Re-export SDK types
export type {
  SDKMessage,
  SDKSystemMessage,
  SDKResultMessage,
  SDKAssistantMessage,
  SDKUserMessage,
} from "@anthropic-ai/claude-agent-sdk";
