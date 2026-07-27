import { Context } from "hono";
import { logger } from "../utils/logger.ts";
import { getActiveSession, markInterrupted } from "./chat.ts";

/**
 * How long to wait for a graceful interrupt before killing the process.
 *
 * interrupt() is a control request that has to round-trip to the CLI, so it
 * can hang if the CLI is wedged — which is exactly when a user reaches for
 * Stop. The timeout keeps Stop unconditional: it always stops something.
 */
const INTERRUPT_TIMEOUT_MS = 3000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("interrupt timed out")), ms),
    ),
  ]);
}

/**
 * Handles POST /api/abort/:requestId requests
 * Aborts an ongoing chat request by request ID
 * @param c - Hono context object with config variables
 * @param requestAbortControllers - Map of request IDs to AbortControllers
 * @returns JSON response indicating success or failure
 */
export async function handleAbortRequest(
  c: Context,
  requestAbortControllers: Map<string, AbortController>,
) {
  const requestId = c.req.param("requestId");

  if (!requestId) {
    return c.json({ error: "Request ID is required" }, 400);
  }

  logger.api.debug(`Abort attempt for request: ${requestId}`);
  logger.api.debug(
    `Active requests: ${Array.from(requestAbortControllers.keys())}`,
  );

  const abortController = requestAbortControllers.get(requestId);
  const session = getActiveSession(requestId);

  if (!abortController && !session) {
    return c.json({ error: "Request not found or already completed" }, 404);
  }

  /*
   * Interrupt first, kill second.
   *
   * Killing the process through the AbortController throws away the turn:
   * the SDK raises AbortError and whatever the model had already done is
   * lost. interrupt() ends the turn instead, so the partial work stays in the
   * session and the conversation remains resumable. It is only reachable
   * because the prompt is now streaming input.
   *
   * The fallback is not optional. If the CLI is wedged the control request
   * never returns, and that is precisely when someone presses Stop.
   */
  if (session) {
    try {
      // Marked *before* awaiting: the turn can raise its diagnostic error the
      // moment the interrupt lands, and it must already know the stop was
      // deliberate by then.
      markInterrupted(requestId);
      await withTimeout(session.interrupt(), INTERRUPT_TIMEOUT_MS);
      logger.api.debug(`Interrupted request: ${requestId}`);
      return c.json({
        success: true,
        message: "Request interrupted",
        method: "interrupt",
      });
    } catch (error) {
      logger.api.warn(
        "Interrupt failed for {requestId}, killing instead: {error}",
        { requestId, error },
      );
    }
  }

  if (abortController) {
    abortController.abort();
    requestAbortControllers.delete(requestId);

    logger.api.debug(`Aborted request: ${requestId}`);

    return c.json({
      success: true,
      message: "Request aborted",
      method: "abort",
    });
  }

  return c.json({ error: "Request could not be stopped" }, 500);
}
