/**
 * Shared OS utilities using Node.js os and process modules
 *
 * Provides cross-platform OS and process operations that work in both
 * Deno and Node.js environments using the standard Node.js APIs.
 */

import { homedir } from "node:os";
import process from "node:process";

/**
 * Get environment variable
 */
export function getEnv(key: string): string | undefined {
  return process.env[key];
}

/**
 * Get command line arguments (excluding node/deno and script path)
 */
export function getArgs(): string[] {
  // process.argv.slice(2) works correctly in both Node.js and Deno (via node:process)
  // Node.js: ['node', 'script.js', ...args] -> [...args]
  // Deno: ['deno', 'run', 'script.ts', ...args] -> [...args] (when using node:process)
  return process.argv.slice(2);
}

/**
 * Get platform identifier.
 *
 * Windows is not supported: no Windows binary is released and the codebase
 * assumes POSIX conventions (`which`, `$PATH` separators, executables without
 * an extension). Anything that is not macOS is treated as Linux.
 */
export function getPlatform(): "darwin" | "linux" {
  return process.platform === "darwin" ? "darwin" : "linux";
}

/**
 * Get home directory path
 */
export function getHomeDir(): string | undefined {
  try {
    return homedir();
  } catch {
    // Fallback to undefined if os.homedir() fails
    return undefined;
  }
}

/**
 * Exit the process with given code
 */
export function exit(code: number): never {
  process.exit(code);
}
