/**
 * Runtime-agnostic Hono application
 *
 * This module creates the Hono application with all routes and middleware,
 * but doesn't include runtime-specific code like CLI parsing or server startup.
 */

import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Runtime } from "./runtime/types.ts";
import {
  type ConfigContext,
  createConfigMiddleware,
} from "./middleware/config.ts";
import { handleProjectsRequest } from "./handlers/projects.ts";
import { handleBrowseDirectoriesRequest } from "./handlers/directories.ts";
import {
  handleCloneRepositoryRequest,
  handleCreateProjectRequest,
} from "./handlers/projectSetup.ts";
import { handleHistoriesRequest } from "./handlers/histories.ts";
import { handleConversationRequest } from "./handlers/conversations.ts";
import { handleChatRequest } from "./handlers/chat.ts";
import { handleCommandsRequest } from "./handlers/commands.ts";
import {
  handleClearConversationsRequest,
  handleDeleteConversationRequest,
  handleRenameConversationRequest,
} from "./handlers/sessions.ts";
import {
  handleFileContentRequest,
  handleUploadAttachmentsRequest,
} from "./handlers/attachments.ts";
import { handleAbortRequest } from "./handlers/abort.ts";
import { logger } from "./utils/logger.ts";
import { readBinaryFile } from "./utils/fs.ts";

export interface AppConfig {
  debugMode: boolean;
  staticPath: string;
  cliPath: string; // Actual CLI script path detected by validateClaudeCli
}

export function createApp(
  runtime: Runtime,
  config: AppConfig,
): Hono<ConfigContext> {
  const app = new Hono<ConfigContext>();

  // Store AbortControllers for each request (shared with chat handler)
  const requestAbortControllers = new Map<string, AbortController>();

  // CORS middleware
  app.use(
    "*",
    cors({
      origin: "*",
      // PATCH and DELETE back the session rename/delete routes; without them
      // the preflight fails and those routes are unreachable cross-origin.
      allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
      allowHeaders: ["Content-Type"],
    }),
  );

  // Configuration middleware - makes app settings available to all handlers
  app.use(
    "*",
    createConfigMiddleware({
      debugMode: config.debugMode,
      runtime,
      cliPath: config.cliPath,
    }),
  );

  // API routes
  app.get("/api/projects", (c) => handleProjectsRequest(c));

  // Launch-screen workspace routes. Registered before the parameterised
  // /api/projects/:encodedProjectName routes so "create" and "clone" are not
  // captured as project names.
  app.get("/api/directories", (c) => handleBrowseDirectoriesRequest(c));
  app.post("/api/projects/create", (c) => handleCreateProjectRequest(c));
  app.post("/api/projects/clone", (c) => handleCloneRepositoryRequest(c));

  app.get("/api/projects/:encodedProjectName/histories", (c) =>
    handleHistoriesRequest(c),
  );

  app.get("/api/projects/:encodedProjectName/histories/:sessionId", (c) =>
    handleConversationRequest(c),
  );

  // Session mutations, backed by the SDK so a rename here is the same
  // operation as the CLI's /rename.
  app.patch("/api/projects/:encodedProjectName/histories/:sessionId", (c) =>
    handleRenameConversationRequest(c),
  );

  app.delete("/api/projects/:encodedProjectName/histories/:sessionId", (c) =>
    handleDeleteConversationRequest(c),
  );

  app.delete("/api/projects/:encodedProjectName/histories", (c) =>
    handleClearConversationsRequest(c),
  );

  app.post("/api/abort/:requestId", (c) =>
    handleAbortRequest(c, requestAbortControllers),
  );

  app.post("/api/chat", (c) => handleChatRequest(c, requestAbortControllers));

  // Slash commands available to the composer's "/" picker.
  app.get("/api/commands", (c) => handleCommandsRequest(c));

  // Attachments: upload for the next message, and read back for the Files tab.
  app.post("/api/attachments", (c) => handleUploadAttachmentsRequest(c));
  app.get("/api/files", (c) => handleFileContentRequest(c));

  // Static file serving with SPA fallback
  const serveStatic = runtime.createStaticFileMiddleware({
    root: config.staticPath,
  });

  // Hashed build output.
  app.use("/assets/*", serveStatic);

  // Files Vite copies from `public/` land at the dist root, not under
  // /assets — the favicon and apple-touch-icon. Without this mount they fall
  // straight through to the SPA handler below, which answers *every* unmatched
  // path with index.html and a 200. That failure is invisible to a status-code
  // check: the icon request "succeeds" and silently returns HTML, so the tab
  // just shows no icon.
  //
  // Matched on "one path segment containing a dot" so it only claims
  // file-looking requests; client-side routes have no extension and still
  // reach the fallback. serveStatic calls next() on a miss, so a genuinely
  // absent file falls through too.
  app.use("/:file{[^/]+\\.[A-Za-z0-9]+}", serveStatic);

  // SPA fallback - serve index.html for all unmatched routes (except API routes)
  app.get("*", async (c) => {
    const path = c.req.path;

    // Skip API routes
    if (path.startsWith("/api/")) {
      return c.text("Not found", 404);
    }

    try {
      const indexPath = `${config.staticPath}/index.html`;
      const indexFile = await readBinaryFile(indexPath);
      return c.html(new TextDecoder().decode(indexFile));
    } catch (error) {
      logger.app.error("Error serving index.html: {error}", { error });
      return c.text("Internal server error", 500);
    }
  });

  return app;
}
