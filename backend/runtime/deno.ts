/**
 * Deno runtime implementation
 *
 * Simplified implementation focusing only on platform-specific operations.
 */

import type { CommandResult, Runtime } from "./types.ts";
import type { MiddlewareHandler } from "hono";
import { serveStatic } from "hono/deno";

export class DenoRuntime implements Runtime {
  async findExecutable(name: string): Promise<string[]> {
    const candidates: string[] = [];

    const result = await this.runCommand("which", [name]);
    if (result.success && result.stdout.trim()) {
      candidates.push(result.stdout.trim());
    }

    return candidates;
  }

  async runCommand(
    command: string,
    args: string[],
    options?: { env?: Record<string, string> },
  ): Promise<CommandResult> {
    const cmd = new Deno.Command(command, {
      args,
      stdout: "piped",
      stderr: "piped",
      env: options?.env,
    });

    const result = await cmd.output();

    return {
      success: result.success,
      code: result.code,
      stdout: new TextDecoder().decode(result.stdout),
      stderr: new TextDecoder().decode(result.stderr),
    };
  }

  serve(
    port: number,
    hostname: string,
    handler: (req: Request) => Response | Promise<Response>,
  ): void {
    Deno.serve({ port, hostname }, handler);
  }

  createStaticFileMiddleware(options: { root: string }): MiddlewareHandler {
    return serveStatic(options);
  }
}
