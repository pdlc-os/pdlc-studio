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
  startTime: string;
  lastTime: string;
  messageCount: number;
  lastMessagePreview: string;
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
