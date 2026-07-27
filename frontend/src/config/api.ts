// API configuration - uses relative paths with Vite proxy in development
export const API_CONFIG = {
  ENDPOINTS: {
    CHAT: "/api/chat",
    ABORT: "/api/abort",
    PROJECTS: "/api/projects",
    HISTORIES: "/api/projects",
    CONVERSATIONS: "/api/projects",
    DIRECTORIES: "/api/directories",
    CREATE_PROJECT: "/api/projects/create",
    CLONE_REPOSITORY: "/api/projects/clone",
    COMMANDS: "/api/commands",
    ATTACHMENTS: "/api/attachments",
    FILES: "/api/files",
  },
} as const;

// Helper function to get full API URL
export const getApiUrl = (endpoint: string) => {
  return endpoint;
};

// Helper function to get abort URL
export const getAbortUrl = (requestId: string) => {
  return `${API_CONFIG.ENDPOINTS.ABORT}/${requestId}`;
};

// Helper function to get chat URL
export const getChatUrl = () => {
  return API_CONFIG.ENDPOINTS.CHAT;
};

// Helper function to get projects URL
export const getProjectsUrl = () => {
  return API_CONFIG.ENDPOINTS.PROJECTS;
};

// Helper function to get histories URL.
//
// Takes the Claude-encoded directory name ("-Users-me-my-project"), not a
// filesystem path: that is what the route matches, and it is what every caller
// passes. The parameter was previously named `projectPath`, which read as if a
// raw path would work.
export const getHistoriesUrl = (
  encodedProjectName: string,
  searchTerm?: string,
) => {
  const base = `${API_CONFIG.ENDPOINTS.HISTORIES}/${encodeURIComponent(encodedProjectName)}/histories`;
  // `q` filters on conversation *content*, not just titles, so it is applied
  // server-side where the message text already is.
  return searchTerm && searchTerm.trim() !== ""
    ? `${base}?q=${encodeURIComponent(searchTerm)}`
    : base;
};

// Helper function to get conversation URL
export const getConversationUrl = (
  encodedProjectName: string,
  sessionId: string,
) => {
  return `${API_CONFIG.ENDPOINTS.CONVERSATIONS}/${encodedProjectName}/histories/${sessionId}`;
};

// Helper function to browse directories. Omit `path` to start at the home
// directory; the backend resolves that and returns the path it actually listed.
export const getDirectoriesUrl = (path?: string) => {
  if (!path) {
    return API_CONFIG.ENDPOINTS.DIRECTORIES;
  }
  return `${API_CONFIG.ENDPOINTS.DIRECTORIES}?path=${encodeURIComponent(path)}`;
};

// Helper function to create a new project directory
export const getCreateProjectUrl = () => {
  return API_CONFIG.ENDPOINTS.CREATE_PROJECT;
};

// Helper function to clone a git repository
export const getCloneRepositoryUrl = () => {
  return API_CONFIG.ENDPOINTS.CLONE_REPOSITORY;
};

// Session mutations (rename, delete, clear). These target the same resources
// as the read helpers above and so take the *encoded* project name too.
export const getSessionUrl = (
  encodedProjectName: string,
  sessionId: string,
): string =>
  `${API_CONFIG.ENDPOINTS.HISTORIES}/${encodedProjectName}/histories/${encodeURIComponent(sessionId)}`;

export const getSessionStarUrl = (
  encodedProjectName: string,
  sessionId: string,
): string => `${getSessionUrl(encodedProjectName, sessionId)}/star`;

export const getClearHistoriesUrl = (encodedProjectName: string): string =>
  `${API_CONFIG.ENDPOINTS.HISTORIES}/${encodedProjectName}/histories`;

// Helper function to list slash commands available in a working directory.
// The directory matters: project-local commands and skills are resolved
// relative to it, so the same installation can offer different lists.
export const getCommandsUrl = (workingDirectory?: string) => {
  if (!workingDirectory) {
    return API_CONFIG.ENDPOINTS.COMMANDS;
  }
  return `${API_CONFIG.ENDPOINTS.COMMANDS}?workingDirectory=${encodeURIComponent(workingDirectory)}`;
};

// Upload target for composer attachments.
export const getAttachmentsUrl = () => API_CONFIG.ENDPOINTS.ATTACHMENTS;

/**
 * Reads a file back for the Files tab.
 *
 * `workingDirectory` is required for anything inside the project: the backend
 * confines reads to that directory plus the attachments temp root, so omitting
 * it means only attachments are reachable.
 */
export const getFileContentUrl = (
  path: string,
  options?: { workingDirectory?: string; download?: boolean },
) => {
  const params = new URLSearchParams({ path });
  if (options?.workingDirectory) {
    params.set("workingDirectory", options.workingDirectory);
  }
  if (options?.download) {
    params.set("download", "1");
  }
  return `${API_CONFIG.ENDPOINTS.FILES}?${params.toString()}`;
};
