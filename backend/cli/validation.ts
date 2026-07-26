/**
 * Shared CLI validation utilities
 *
 * Common validation functions used across different runtime CLI entry points.
 */

import type { Runtime } from "../runtime/types.ts";
import { logger } from "../utils/logger.ts";
import { readTextFile, writeTextFile, withTempDir } from "../utils/fs.ts";
import { getEnv, exit } from "../utils/os.ts";

/**
 * Generates Unix shell wrapper script
 * @param traceFile - Path to trace output file
 * @param nodePath - Path to original node executable
 * @returns Unix shell script content
 */
function getUnixWrapperScript(traceFile: string, nodePath: string): string {
  return `#!/bin/bash\necho "$1" >> "${traceFile}"\nexec "${nodePath}" "$@"`;
}

/**
 * Detects the actual Claude script path by tracing node execution
 * Uses a temporary node wrapper to capture the actual script path being executed by Claude CLI
 * @param runtime - Runtime abstraction for system operations
 * @param claudePath - Path to the claude executable
 * @returns Promise<{scriptPath: string, versionOutput: string}> - The actual Claude script path and version output, or empty strings if detection fails
 */
export async function detectClaudeCliPath(
  runtime: Runtime,
  claudePath: string,
): Promise<{ scriptPath: string; versionOutput: string }> {
  // First try PATH wrapping method
  let pathWrappingResult: { scriptPath: string; versionOutput: string } | null =
    null;

  try {
    pathWrappingResult = await withTempDir(async (tempDir: string) => {
      const traceFile = `${tempDir}/trace.log`;

      // Find the original node executable
      const nodeExecutables = await runtime.findExecutable("node");
      if (nodeExecutables.length === 0) {
        // Silently return null - this is not a critical error
        return null;
      }

      const originalNodePath = nodeExecutables[0];

      await writeTextFile(
        `${tempDir}/node`,
        getUnixWrapperScript(traceFile, originalNodePath),
        { mode: 0o755 },
      );

      // Execute claude with modified PATH to intercept node calls
      const currentPath = getEnv("PATH") || "";
      const modifiedPath = `${tempDir}:${currentPath}`;

      const executionResult = await runtime.runCommand(
        claudePath,
        ["--version"],
        {
          env: { PATH: modifiedPath },
        },
      );

      // Verify command executed successfully
      if (!executionResult.success) {
        return null;
      }

      const versionOutput = executionResult.stdout.trim();

      // Parse trace file to extract script path
      let traceContent: string;
      try {
        traceContent = await readTextFile(traceFile);
      } catch {
        // Trace file might not exist or be readable
        return { scriptPath: "", versionOutput };
      }

      if (!traceContent.trim()) {
        // Empty trace file indicates no node execution was captured
        return { scriptPath: "", versionOutput };
      }

      const traceLines = traceContent
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

      // Find the Claude script path from traced node executions
      for (const traceLine of traceLines) {
        const scriptPath = traceLine.trim();
        if (scriptPath) {
          return { scriptPath, versionOutput };
        }
      }

      // No Claude script path found in trace
      return { scriptPath: "", versionOutput };
    });
  } catch (error) {
    // Log error for debugging but don't crash the application
    logger.cli.debug(
      `PATH wrapping detection failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    pathWrappingResult = null;
  }

  // If PATH wrapping succeeded, return the result
  if (pathWrappingResult && pathWrappingResult.scriptPath) {
    return pathWrappingResult;
  }

  // Detection failed; preserve the version output if we managed to read it.
  return {
    scriptPath: "",
    versionOutput: pathWrappingResult?.versionOutput || "",
  };
}

/**
 * Validates that the Claude CLI is available and detects the actual CLI script path
 * Uses detectClaudeCliPath for universal path detection regardless of installation method
 * Exits process if Claude CLI is not found or not working
 * @param runtime - Runtime abstraction for system operations
 * @param customPath - Optional custom path to claude executable to validate
 * @returns Promise<string> - The detected actual CLI script path or validated claude path
 */
export async function validateClaudeCli(
  runtime: Runtime,
  customPath?: string,
): Promise<string> {
  try {
    let claudePath = "";

    if (customPath) {
      // Use custom path if provided
      claudePath = customPath;
      logger.cli.info(`🔍 Validating custom Claude path: ${customPath}`);
    } else {
      // Auto-detect using runtime's findExecutable method
      logger.cli.info("🔍 Searching for Claude CLI in PATH...");
      const candidates = await runtime.findExecutable("claude");

      if (candidates.length === 0) {
        logger.cli.error("❌ Claude CLI not found in PATH");
        logger.cli.error("   Please install claude-code globally:");
        logger.cli.error(
          "   Visit: https://claude.ai/code for installation instructions",
        );
        exit(1);
      }

      // Use the first candidate (most likely to be the correct one)
      claudePath = candidates[0];
      logger.cli.debug(`Found Claude CLI candidates: ${candidates.join(", ")}`);
      logger.cli.debug(`Using Claude CLI path: ${claudePath}`);
    }

    // Detect the actual CLI script path using tracing approach
    logger.cli.info("🔍 Detecting actual Claude CLI script path...");
    const detection = await detectClaudeCliPath(runtime, claudePath);

    if (detection.scriptPath) {
      logger.cli.info(`✅ Claude CLI script detected: ${detection.scriptPath}`);
      if (detection.versionOutput) {
        logger.cli.info(`✅ Claude CLI found: ${detection.versionOutput}`);
      }
      return detection.scriptPath;
    } else {
      // Show warning but continue with fallback when detection fails
      logger.cli.warn("⚠️  Claude CLI script path detection failed");
      logger.cli.warn(
        "   Falling back to using the claude executable directly.",
      );
      logger.cli.warn("   This may not work properly, but continuing anyway.");
      logger.cli.warn("");
      logger.cli.warn(`   Using fallback path: ${claudePath}`);
      if (detection.versionOutput) {
        logger.cli.info(`✅ Claude CLI found: ${detection.versionOutput}`);
      }
      return claudePath;
    }
  } catch (error) {
    logger.cli.error("❌ Failed to validate Claude CLI");
    logger.cli.error(
      `   Error: ${error instanceof Error ? error.message : String(error)}`,
    );
    exit(1);
  }
}
