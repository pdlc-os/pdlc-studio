/**
 * Permission mode policy for Claude CLI invocations.
 *
 * Kept separate from the HTTP handler so the request path and the startup
 * warning can't drift apart on what the default actually is.
 */

import type { PermissionMode } from "@anthropic-ai/claude-code";
import { logger } from "./logger.ts";

/**
 * Permission mode used when a request doesn't specify one.
 *
 * `bypassPermissions` tells the Claude CLI to run every tool — including Bash —
 * without asking for approval. This is deliberate: the app is meant to drive
 * Claude unattended against a working directory the user picked.
 *
 * Two things to keep in mind:
 * - Nothing prompts before a file write or a shell command.
 * - The CLI can decline to honour it. A `permissions.disableBypassPermissionsMode`
 *   setting — including one pushed via managed policy settings — wins over this,
 *   in which case the CLI prompts as usual and the UI's permission panel takes
 *   over as before.
 *
 * Set this to "default" to restore approval prompts for API clients that omit
 * the field. The UI's own starting mode is INITIAL_PERMISSION_MODE in
 * frontend/src/hooks/chat/usePermissionMode.ts — change both to fully revert.
 */
export const DEFAULT_PERMISSION_MODE: PermissionMode = "bypassPermissions";

export const VALID_PERMISSION_MODES: readonly PermissionMode[] = [
  "default",
  "plan",
  "acceptEdits",
  "bypassPermissions",
];

/**
 * Resolves the permission mode for a request.
 *
 * The wire type is erased at runtime, so an untrusted body could otherwise put
 * an arbitrary string on the CLI's `--permission-mode` flag. Returns null for a
 * value that was supplied but isn't a real mode, so the caller can reject it
 * rather than guess at intent.
 */
export function resolvePermissionMode(
  requested: string | undefined,
): PermissionMode | null {
  if (requested === undefined) {
    return DEFAULT_PERMISSION_MODE;
  }
  return VALID_PERMISSION_MODES.includes(requested as PermissionMode)
    ? (requested as PermissionMode)
    : null;
}

/**
 * Warns at startup when a permissive default is paired with a non-loopback bind.
 *
 * There is no authentication on the API, so with bypassPermissions as the
 * default, anything that can reach the port can run shell commands on this
 * machine. Binding to loopback is what keeps that local.
 */
export function warnIfPermissionsExposed(host: string): void {
  if (DEFAULT_PERMISSION_MODE !== "bypassPermissions") {
    return;
  }

  const isLoopback =
    host === "127.0.0.1" || host === "localhost" || host === "::1";

  if (!isLoopback) {
    logger.cli.warn(
      `⚠ Permission prompts are disabled by default (${DEFAULT_PERMISSION_MODE}) and the server is bound to ${host}, which is not loopback. The API has no authentication, so anyone who can reach this port can run shell commands as you. Bind to 127.0.0.1 or put an authenticating proxy in front of it.`,
    );
  }
}
