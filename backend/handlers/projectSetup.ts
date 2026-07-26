/**
 * Creating and cloning project directories from the launch screen.
 *
 * Both endpoints return the directory the frontend should open, so the UI can
 * navigate straight into a chat afterwards.
 *
 * `git` is invoked through `runtime.runCommand`, which takes an argv array and
 * never a shell string, so command injection is not reachable. Argument
 * injection is handled by `validateGitUrl` — see `utils/paths.ts` for why the
 * URL shape is restricted.
 */

import { Context } from "hono";
import { join } from "node:path";
import type {
  CloneRepositoryRequest,
  CreateProjectRequest,
  ProjectPathResponse,
} from "../../shared/types.ts";
import { exists, mkdir, stat } from "../utils/fs.ts";
import {
  deriveRepositoryName,
  isValidProjectName,
  resolveBrowsePath,
  validateGitUrl,
} from "../utils/paths.ts";
import { logger } from "../utils/logger.ts";

/**
 * Validates the parent directory shared by both flows.
 *
 * Returns the resolved path, or an error message describing what was wrong.
 */
async function resolveParentDirectory(
  parentPath: unknown,
): Promise<{ path: string } | { error: string; status: 400 | 404 }> {
  if (typeof parentPath !== "string") {
    return { error: "parentPath is required.", status: 400 };
  }

  const resolved = resolveBrowsePath(parentPath);
  if (resolved === null) {
    return {
      error: "parentPath must be an absolute path, or start with '~'.",
      status: 400,
    };
  }

  if (!(await exists(resolved))) {
    return { error: `Parent directory not found: ${resolved}`, status: 404 };
  }
  if (!(await stat(resolved)).isDirectory) {
    return { error: `Not a directory: ${resolved}`, status: 400 };
  }

  return { path: resolved };
}

/**
 * Handles POST /api/projects/create
 *
 * Creates a single directory inside an existing parent and optionally runs
 * `git init`. Deliberately does not scaffold any files: this is a Claude Code
 * front end, not a project generator, so an empty directory is the honest
 * result and Claude can populate it on request.
 */
export async function handleCreateProjectRequest(c: Context) {
  let body: CreateProjectRequest;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body." }, 400);
  }

  const parent = await resolveParentDirectory(body.parentPath);
  if ("error" in parent) {
    return c.json({ error: parent.error }, parent.status);
  }

  if (typeof body.name !== "string" || !isValidProjectName(body.name)) {
    return c.json(
      {
        error:
          "name must be a single directory name: no path separators, and not '.' or '..'.",
      },
      400,
    );
  }

  const name = body.name.trim();
  const target = join(parent.path, name);

  if (await exists(target)) {
    // Refuse rather than adopt an existing directory: the user asked to create
    // one, and silently opening whatever is already there could be a surprise.
    return c.json({ error: `Already exists: ${target}` }, 409);
  }

  try {
    await mkdir(target);
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === "EACCES" || code === "EPERM") {
      return c.json({ error: `Permission denied: ${target}` }, 403);
    }
    logger.api.error("Error creating project {path}: {error}", {
      path: target,
      error,
    });
    return c.json({ error: "Failed to create project directory" }, 500);
  }

  if (body.initGit) {
    const { runtime } = c.var.config;
    const result = await runtime.runCommand("git", ["init", target]);
    if (!result.success) {
      // The directory exists and is usable, so this is reported as a warning
      // rather than failing the whole request.
      logger.api.warn("git init failed in {path}: {stderr}", {
        path: target,
        stderr: result.stderr,
      });
    }
  }

  const response: ProjectPathResponse = { path: target };
  return c.json(response, 201);
}

/**
 * Handles POST /api/projects/clone
 *
 * Runs `git clone <url> <target>` and returns the clone directory.
 */
export async function handleCloneRepositoryRequest(c: Context) {
  let body: CloneRepositoryRequest;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body." }, 400);
  }

  const parent = await resolveParentDirectory(body.parentPath);
  if ("error" in parent) {
    return c.json({ error: parent.error }, parent.status);
  }

  if (typeof body.url !== "string") {
    return c.json({ error: "url is required." }, 400);
  }

  const url = validateGitUrl(body.url);
  if (url === null) {
    return c.json(
      {
        error:
          "url must be a git remote using https, http, ssh or git, or the scp-style user@host:path form.",
      },
      400,
    );
  }

  // An explicit name wins; otherwise mirror what git would have chosen.
  const name =
    typeof body.name === "string" && body.name.trim() !== ""
      ? body.name.trim()
      : deriveRepositoryName(url);

  if (name === null) {
    return c.json(
      { error: "Could not derive a directory name from the URL; provide one." },
      400,
    );
  }
  if (!isValidProjectName(name)) {
    return c.json(
      {
        error:
          "name must be a single directory name: no path separators, and not '.' or '..'.",
      },
      400,
    );
  }

  const target = join(parent.path, name);
  if (await exists(target)) {
    return c.json({ error: `Already exists: ${target}` }, 409);
  }

  const { runtime } = c.var.config;
  // `--` separates options from operands, so neither value can be read as a
  // flag even if validation is ever loosened.
  const result = await runtime.runCommand("git", ["clone", "--", url, target]);

  if (!result.success) {
    logger.api.error("git clone failed for {url}: {stderr}", {
      url,
      stderr: result.stderr,
    });
    // git's own stderr is the most useful thing to show the user here.
    const detail = result.stderr.trim() || "git clone failed.";
    return c.json({ error: detail }, 502);
  }

  const response: ProjectPathResponse = { path: target };
  return c.json(response, 201);
}
