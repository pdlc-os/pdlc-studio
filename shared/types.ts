export interface StreamResponse {
  type: "claude_json" | "error" | "done" | "aborted";
  data?: unknown; // SDKMessage object for claude_json type
  error?: string;
}

export interface ChatRequest {
  message: string;
  sessionId?: string;
  requestId: string;
  allowedTools?: string[];
  workingDirectory?: string;
  /**
   * Permission mode forwarded to the Claude CLI. Omitting it means the server
   * applies DEFAULT_PERMISSION_MODE (see backend/handlers/chat.ts).
   *
   * `bypassPermissions` runs every tool — including Bash — with no approval
   * prompt. That is this app's default, so only expose the server on a trusted
   * interface; it binds 127.0.0.1 unless --host says otherwise.
   */
  permissionMode?: "default" | "plan" | "acceptEdits" | "bypassPermissions";
  /** Model id from ModelOption.value; omit to use the CLI's default. */
  model?: string;
  /** Reasoning effort. Ignored by models that do not support it. */
  effortLevel?: EffortLevel;
  /** Extended thinking. Omit to leave the CLI's own behaviour alone. */
  thinking?: ThinkingMode;
}

export interface AbortRequest {
  requestId: string;
}

export interface ProjectInfo {
  path: string;
  encodedName: string;
}

export interface ProjectsResponse {
  projects: ProjectInfo[];
}

// Conversation history types
export interface ConversationSummary {
  sessionId: string;
  /**
   * Whether the user has starred this conversation.
   *
   * Sent with the listing rather than fetched separately, because the sidebar
   * has to know which section a row belongs to before it can draw it.
   */
  isStarred?: boolean;
  startTime: string;
  lastTime: string;
  messageCount: number;
  lastMessagePreview: string;
  /**
   * Display title, when the session has one.
   *
   * Claude writes two kinds into the JSONL: `custom-title`, set explicitly by
   * `/rename`, and `ai-title`, generated from the opening exchange. A custom
   * title wins — it is the one the user chose. Absent for sessions that have
   * neither, where the UI falls back to the message preview.
   */
  title?: string;
  /** True when `title` came from a rename rather than being generated. */
  isTitleCustom?: boolean;
}

/** Body of `PATCH /api/projects/:encodedProjectName/histories/:sessionId`. */
export interface RenameConversationRequest {
  title: string;
}

/** Result of deleting every conversation in a project. */
export interface DeleteConversationsResponse {
  deleted: number;
}

/**
 * One file uploaded for the next message.
 *
 * Claude is given the `path`, not the bytes. That is how the CLI itself works
 * with files — the model opens what it needs with its own tools — and it keeps
 * a large attachment out of the prompt entirely.
 */
export interface AttachmentInfo {
  /** Original filename, sanitised to a bare basename. */
  name: string;
  /** Absolute path on the machine running the backend. */
  path: string;
  /** Size in bytes, for display. */
  size: number;
}

/** Response of `POST /api/attachments`. */
export interface UploadAttachmentsResponse {
  attachments: AttachmentInfo[];
}

export interface HistoryListResponse {
  conversations: ConversationSummary[];
}

// Conversation history types
// Note: messages are typed as unknown[] to avoid frontend/backend dependency issues
// Frontend should cast to TimestampedSDKMessage[] (defined in frontend/src/types.ts)
export interface ConversationHistory {
  sessionId: string;
  messages: unknown[]; // TimestampedSDKMessage[] in practice, but avoiding frontend type dependency
  metadata: {
    startTime: string;
    endTime: string;
    messageCount: number;
  };
}

// Workspace / launch-screen types
//
// These back the launch screen's three actions. A browser cannot enumerate the
// filesystem, so directory browsing has to round-trip through the backend.

/** A single selectable subdirectory returned by the directory browser. */
export interface DirectoryEntryInfo {
  name: string;
  path: string;
}

export interface BrowseDirectoriesResponse {
  /** The resolved, normalised directory that was listed. */
  path: string;
  /** Parent directory, or null when `path` is the filesystem root. */
  parent: string | null;
  /** Subdirectories of `path`, name-sorted. Files are omitted. */
  entries: DirectoryEntryInfo[];
  /** True when `path` itself looks like a git working copy. */
  isGitRepository: boolean;
}

export interface CreateProjectRequest {
  /** Existing directory the new project directory is created inside. */
  parentPath: string;
  /** Single directory name; must not contain a path separator. */
  name: string;
  /** Run `git init` in the new directory. */
  initGit?: boolean;
}

export interface CloneRepositoryRequest {
  /** Git remote: https/http/ssh/git scheme, or scp-style user@host:path. */
  url: string;
  /** Existing directory the clone is created inside. */
  parentPath: string;
  /** Optional override for the directory name; defaults to the repo name. */
  name?: string;
}

/** Returned by both create and clone: the directory to open. */
export interface ProjectPathResponse {
  path: string;
}

/**
 * One entry in the composer's `/` picker.
 *
 * Mirrors the SDK's `SlashCommand`, deliberately re-declared rather than
 * re-exported: `shared/` is imported by the frontend, which must not depend on
 * the SDK's type surface just to render a list.
 */
export interface SlashCommandInfo {
  /** Command name without the leading slash, e.g. "review" or "plugin:skill". */
  name: string;
  /** One-line summary shown next to the name. */
  description: string;
  /** Argument hint such as "<file>"; empty when the command takes none. */
  argumentHint: string;
  /** Alternate names resolving to this command (e.g. /cost -> /usage). */
  aliases?: string[];
}

/** Effort levels the CLI accepts, mirroring the SDK's EffortLevel. */
export type EffortLevel = "low" | "medium" | "high" | "xhigh" | "max";

/** How much thinking to allow. `adaptive` lets Claude decide. */
export type ThinkingMode = "adaptive" | "enabled" | "disabled";

/**
 * A model the installed CLI offers.
 *
 * Re-declared rather than re-exported from the SDK for the same reason as
 * SlashCommandInfo: `shared/` is imported by the frontend, which should not
 * take on the SDK's type surface to render a menu.
 */
export interface ModelOption {
  /** Identifier passed back as `model`. */
  value: string;
  displayName: string;
  description: string;
  /** False when the model ignores effort, so the UI can disable that control. */
  supportsEffort?: boolean;
  supportedEffortLevels?: EffortLevel[];
  supportsAdaptiveThinking?: boolean;
}

/**
 * Response of `GET /api/commands`.
 *
 * Commands and models arrive together because one CLI handshake reports both —
 * splitting them across two endpoints would spawn a second process for data
 * already in hand.
 */
export interface SlashCommandsResponse {
  commands: SlashCommandInfo[];
  models: ModelOption[];
}
