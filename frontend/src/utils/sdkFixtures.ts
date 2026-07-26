/**
 * Factories for SDK-shaped objects used by demo mode and tests.
 *
 * The Agent SDK models assistant payloads with the Anthropic API's `Beta*`
 * types, which carry a lot of required bookkeeping (`cache_creation`,
 * `iterations`, `citations`, `stop_details`, …). Demo and test fixtures only
 * care about a handful of fields, so these factories supply complete, valid
 * objects and let callers override just the parts under test.
 *
 * Types are derived from the SDK's own message types rather than imported from
 * `@anthropic-ai/sdk` directly, so the frontend keeps a single SDK dependency
 * and these fixtures track whatever shape the Agent SDK actually expects.
 */

import type {
  NonNullableUsage,
  SDKAssistantMessage,
  SDKSystemMessage,
  SDKUserMessage,
} from "@anthropic-ai/claude-agent-sdk";

/** The API-level assistant message carried on an `SDKAssistantMessage`. */
export type APIAssistantMessage = SDKAssistantMessage["message"];

/** Token accounting on an assistant message (nullable variants allowed). */
export type APIUsage = APIAssistantMessage["usage"];

/** A single content block of an assistant message. */
export type APIContentBlock = APIAssistantMessage["content"][number];

export type APITextBlock = Extract<APIContentBlock, { type: "text" }>;
export type APIToolUseBlock = Extract<APIContentBlock, { type: "tool_use" }>;

/**
 * Usage for an assistant message. Every field the API can leave unset is
 * `null` here, which is what a request without caching or fallbacks reports.
 */
export function makeUsage(overrides: Partial<APIUsage> = {}): APIUsage {
  return {
    input_tokens: 0,
    output_tokens: 0,
    cache_creation: null,
    cache_creation_input_tokens: null,
    cache_read_input_tokens: null,
    fallback_credit: null,
    inference_geo: null,
    iterations: null,
    output_tokens_details: null,
    server_tool_use: null,
    service_tier: null,
    speed: null,
    ...overrides,
  };
}

/**
 * Usage for a `result` message. `NonNullableUsage` forbids the nulls that
 * `makeUsage` uses, so every field needs a concrete zero value.
 */
export function makeResultUsage(
  overrides: Partial<NonNullableUsage> = {},
): NonNullableUsage {
  return {
    input_tokens: 0,
    output_tokens: 0,
    cache_creation: {
      ephemeral_1h_input_tokens: 0,
      ephemeral_5m_input_tokens: 0,
    },
    cache_creation_input_tokens: 0,
    cache_read_input_tokens: 0,
    fallback_credit: { status: { type: "redeemed" } },
    inference_geo: "",
    iterations: [],
    output_tokens_details: { thinking_tokens: 0 },
    server_tool_use: { web_fetch_requests: 0, web_search_requests: 0 },
    service_tier: "standard",
    speed: "standard",
    ...overrides,
  };
}

/** A text content block. `citations` is required and is null when unused. */
export function makeTextBlock(text: string): APITextBlock {
  return { type: "text", text, citations: null };
}

/** A tool_use content block. */
export function makeToolUseBlock(
  id: string,
  name: string,
  input: unknown = {},
): APIToolUseBlock {
  return { type: "tool_use", id, name, input };
}

/** An API-level assistant message wrapping the given content blocks. */
export function makeAPIAssistantMessage(
  content: APIContentBlock[],
  overrides: Partial<APIAssistantMessage> = {},
): APIAssistantMessage {
  return {
    id: "msg_fixture",
    type: "message",
    role: "assistant",
    model: "claude-sonnet-4-5",
    content,
    container: null,
    context_management: null,
    diagnostics: null,
    stop_details: null,
    stop_reason: null,
    stop_sequence: null,
    usage: makeUsage(),
    ...overrides,
  };
}

/**
 * Reads the first content block of a user message.
 *
 * `MessageParam.content` is `string | ContentBlockParam[]`, so indexing it
 * directly is not type-safe. Assertions that reach into a `tool_result` block
 * go through this instead of casting at each call site. Throws rather than
 * returning undefined so a fixture that stopped carrying blocks fails loudly.
 */
export function firstContentBlock(
  message: SDKUserMessage["message"],
): Record<string, unknown> {
  const { content } = message;
  if (typeof content === "string") {
    throw new Error("expected message.content to be an array of blocks");
  }
  if (content.length === 0) {
    throw new Error("expected message.content to have at least one block");
  }
  return content[0] as unknown as Record<string, unknown>;
}

/** A `system`/`init` message, the one the UI renders as the session banner. */
export function makeSystemInitMessage(
  overrides: Partial<SDKSystemMessage> = {},
): SDKSystemMessage {
  return {
    type: "system",
    subtype: "init",
    apiKeySource: "user",
    claude_code_version: "2.1.220",
    cwd: "/tmp",
    session_id: "fixture-session",
    uuid: "00000000-0000-0000-0000-000000000000",
    tools: [],
    mcp_servers: [],
    model: "claude-sonnet-4-5",
    permissionMode: "default",
    slash_commands: [],
    output_style: "default",
    skills: [],
    plugins: [],
    ...overrides,
  };
}
