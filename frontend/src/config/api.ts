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

// Helper function to get histories URL
export const getHistoriesUrl = (projectPath: string) => {
  const encodedPath = encodeURIComponent(projectPath);
  return `${API_CONFIG.ENDPOINTS.HISTORIES}/${encodedPath}/histories`;
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

// Helper function to list slash commands available in a working directory.
// The directory matters: project-local commands and skills are resolved
// relative to it, so the same installation can offer different lists.
export const getCommandsUrl = (workingDirectory?: string) => {
  if (!workingDirectory) {
    return API_CONFIG.ENDPOINTS.COMMANDS;
  }
  return `${API_CONFIG.ENDPOINTS.COMMANDS}?workingDirectory=${encodeURIComponent(workingDirectory)}`;
};
