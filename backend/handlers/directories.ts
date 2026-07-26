/**
 * Directory browsing for the launch screen.
 *
 * The launch screen lets the user pick any directory to open as a project. A
 * browser cannot enumerate the filesystem, so the listing has to come from
 * here.
 *
 * This endpoint is read-only and deliberately unconfined — the whole point is
 * choosing an arbitrary directory. It is not an escalation of what the API can
 * already do: `/api/chat` defaults to `bypassPermissions` and can run arbitrary
 * shell commands, so anything that can reach this port can already read the
 * filesystem. The server binds to loopback unless `--host` says otherwise, and
 * `warnIfPermissionsExposed()` warns on a non-loopback bind.
 */

import { Context } from "hono";
import { dirname } from "node:path";
import type {
  BrowseDirectoriesResponse,
  DirectoryEntryInfo,
} from "../../shared/types.ts";
import { exists, readDir, stat } from "../utils/fs.ts";
import { resolveBrowsePath } from "../utils/paths.ts";
import { logger } from "../utils/logger.ts";

/**
 * Handles GET /api/directories?path=<absolute path>
 *
 * Omitting `path` lists the home directory. Returns subdirectories only, since
 * the caller is choosing a project root.
 */
export async function handleBrowseDirectoriesRequest(c: Context) {
  const requested = c.req.query("path");
  const target = resolveBrowsePath(requested);

  if (target === null) {
    return c.json(
      {
        error:
          "Invalid path. Provide an absolute path, or a path starting with '~'.",
      },
      400,
    );
  }

  try {
    if (!(await exists(target))) {
      return c.json({ error: `Directory not found: ${target}` }, 404);
    }

    const targetStat = await stat(target);
    if (!targetStat.isDirectory) {
      return c.json({ error: `Not a directory: ${target}` }, 400);
    }

    const entries: DirectoryEntryInfo[] = [];
    for await (const entry of readDir(target)) {
      // Files are not selectable as a project root.
      if (!entry.isDirectory) {
        continue;
      }
      // Dot-directories are hidden by default, matching how native file
      // pickers behave. `~/.claude` and friends are rarely the target here and
      // would otherwise dominate the home listing.
      if (entry.name.startsWith(".")) {
        continue;
      }
      entries.push({
        name: entry.name,
        path: target.endsWith("/")
          ? `${target}${entry.name}`
          : `${target}/${entry.name}`,
      });
    }

    entries.sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
    );

    const parent = dirname(target);
    const response: BrowseDirectoriesResponse = {
      path: target,
      // dirname("/") is "/", which is how the filesystem root is detected.
      parent: parent === target ? null : parent,
      entries,
      isGitRepository: await exists(`${target}/.git`),
    };
    return c.json(response);
  } catch (error) {
    // A permission error is expected while browsing and should not read as a
    // server fault.
    const code = (error as { code?: string }).code;
    if (code === "EACCES" || code === "EPERM") {
      return c.json({ error: `Permission denied: ${target}` }, 403);
    }

    logger.api.error("Error browsing directory {path}: {error}", {
      path: target,
      error,
    });
    return c.json({ error: "Failed to browse directory" }, 500);
  }
}
