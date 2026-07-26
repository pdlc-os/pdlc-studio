/**
 * Validation for the workspace endpoints.
 *
 * `/api/directories`, `/api/projects/create` and `/api/projects/clone` all take
 * filesystem paths straight from the request body, so normalisation and
 * checking happen here rather than being repeated at each call site.
 *
 * A note on scope: these helpers are not a sandbox. There is no attempt to
 * confine browsing to a subtree, because the point of the feature is to let the
 * user pick any directory on their machine. The API already exposes
 * `/api/chat` with a `bypassPermissions` default, which can run arbitrary shell
 * commands, so a read-only directory listing is strictly less powerful than
 * what is already reachable. What these helpers do prevent is malformed input
 * reaching the filesystem or `git` argument list.
 */

import { basename, isAbsolute, join, normalize } from "node:path";
import { getHomeDir } from "./os.ts";

/** Characters that have no business in a path or URL we are about to act on. */
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

/**
 * Resolves a browse target to an absolute, normalised path.
 *
 * Accepts an absolute path or one starting with `~`. Returns null for relative
 * or malformed input so the caller can answer 400 rather than guessing at a
 * directory. Omitting the path entirely is valid and means "start at home".
 */
export function resolveBrowsePath(input?: string | null): string | null {
  const raw = (input ?? "").trim();

  if (raw === "") {
    return getHomeDir() ?? "/";
  }

  if (CONTROL_CHARS.test(raw)) {
    return null;
  }

  let candidate = raw;
  if (candidate === "~" || candidate.startsWith("~/")) {
    const home = getHomeDir();
    if (!home) {
      return null;
    }
    candidate = candidate === "~" ? home : join(home, candidate.slice(2));
  }

  if (!isAbsolute(candidate)) {
    return null;
  }

  // Collapses any `..` segments. Not a containment check — see the module note.
  return normalize(candidate);
}

/**
 * Checks a single directory name, as typed for a new project.
 *
 * Rejects anything containing a separator so the name cannot silently create or
 * target a nested path, and rejects the relative aliases outright.
 */
export function isValidProjectName(name: string): boolean {
  const trimmed = name.trim();

  if (trimmed === "" || trimmed.length > 255) {
    return false;
  }
  if (trimmed === "." || trimmed === "..") {
    return false;
  }
  if (trimmed.includes("/") || trimmed.includes("\\")) {
    return false;
  }
  return !CONTROL_CHARS.test(trimmed);
}

/**
 * Accepted git remote forms.
 *
 * `runCommand` takes an argv array and never a shell string, so classic command
 * injection is not reachable. The risk that remains is *argument* injection: a
 * "URL" such as `--upload-pack=...` would be read by git as a flag. Requiring a
 * recognised scheme, or the scp-style `user@host:path`, rules that out — as does
 * the explicit leading-dash rejection below.
 */
const GIT_URL_SCHEMES = ["https://", "http://", "ssh://", "git://"];
const SCP_STYLE_REMOTE = /^[A-Za-z0-9._-]+@[A-Za-z0-9._-]+:[^\s]+$/;

/** Returns the trimmed URL when it is a usable git remote, else null. */
export function validateGitUrl(url: string): string | null {
  const trimmed = url.trim();

  if (trimmed === "" || CONTROL_CHARS.test(trimmed) || /\s/.test(trimmed)) {
    return null;
  }
  // Would otherwise be parsed by git as an option rather than a remote.
  if (trimmed.startsWith("-")) {
    return null;
  }

  const hasKnownScheme = GIT_URL_SCHEMES.some((scheme) =>
    trimmed.toLowerCase().startsWith(scheme),
  );
  if (hasKnownScheme || SCP_STYLE_REMOTE.test(trimmed)) {
    return trimmed;
  }
  return null;
}

/**
 * Derives the directory name `git clone` would pick for a remote.
 *
 * Mirrors git's own behaviour of dropping a trailing `.git` and any trailing
 * slash. Returns null when nothing usable is left, so the caller can ask for an
 * explicit name instead of creating something surprising.
 */
export function deriveRepositoryName(url: string): string | null {
  let candidate = url.trim().replace(/\/+$/, "");

  // scp-style remotes have no parseable path component for basename().
  const colonIndex = candidate.lastIndexOf(":");
  const slashIndex = candidate.lastIndexOf("/");
  if (colonIndex > slashIndex) {
    candidate = candidate.slice(colonIndex + 1);
  }

  candidate = basename(candidate);
  if (candidate.toLowerCase().endsWith(".git")) {
    candidate = candidate.slice(0, -4);
  }

  return isValidProjectName(candidate) ? candidate : null;
}
