import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useStreamParser } from "./useStreamParser";
import type { StreamingContext } from "./useMessageProcessor";
import type { SDKMessage } from "../../types";
import { generateId } from "../../utils/id";
import {
  makeAPIAssistantMessage,
  makeResultUsage,
  makeTextBlock,
  type APIContentBlock,
} from "../../utils/sdkFixtures";

// Mock dependencies

describe("useStreamParser", () => {
  let mockContext: StreamingContext;

  beforeEach(() => {
    mockContext = {
      addMessage: vi.fn(),
      updateLastMessage: vi.fn(),
      setCurrentAssistantMessage: vi.fn(),
      currentAssistantMessage: null,
      onSessionId: vi.fn(),
      hasReceivedInit: false,
      setHasReceivedInit: vi.fn(),
      shouldShowInitMessage: vi.fn(() => true),
      onInitMessageShown: vi.fn(),
    };

    vi.clearAllMocks();
  });

  describe("ExitPlanMode Detection and Plan Message Creation", () => {
    it("should detect ExitPlanMode tool use and create plan message", () => {
      const { result } = renderHook(() => useStreamParser());

      const assistantMessage: Extract<SDKMessage, { type: "assistant" }> = {
        type: "assistant",
        session_id: "test-session",
        uuid: generateId(),
        parent_tool_use_id: null,
        message: makeAPIAssistantMessage([
          {
            type: "tool_use",
            id: "plan-123",
            name: "ExitPlanMode",
            input: {
              plan: "Let's implement a new feature:\n\n1. Add UI component\n2. Connect to API\n3. Write tests",
            },
          },
        ]),
      };

      result.current.processStreamLine(
        JSON.stringify({
          type: "claude_json",
          data: assistantMessage,
        }),
        mockContext,
      );

      expect(mockContext.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "plan",
          plan: "Let's implement a new feature:\n\n1. Add UI component\n2. Connect to API\n3. Write tests",
          toolUseId: "plan-123",
          timestamp: expect.any(Number),
        }),
      );
    });

    it("should handle ExitPlanMode with empty plan content", () => {
      const { result } = renderHook(() => useStreamParser());

      const assistantMessage: Extract<SDKMessage, { type: "assistant" }> = {
        type: "assistant",
        session_id: "test-session",
        uuid: generateId(),
        parent_tool_use_id: null,
        message: makeAPIAssistantMessage([
          {
            type: "tool_use",
            id: "plan-456",
            name: "ExitPlanMode",
            input: {},
          },
        ]),
      };

      result.current.processStreamLine(
        JSON.stringify({
          type: "claude_json",
          data: assistantMessage,
        }),
        mockContext,
      );

      expect(mockContext.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "plan",
          plan: "",
          toolUseId: "plan-456",
          timestamp: expect.any(Number),
        }),
      );
    });

    it("should handle ExitPlanMode with missing input field", () => {
      const { result } = renderHook(() => useStreamParser());

      const assistantMessage: Extract<SDKMessage, { type: "assistant" }> = {
        type: "assistant",
        session_id: "test-session",
        uuid: generateId(),
        parent_tool_use_id: null,
        // Deliberately malformed: `input` is missing, which the SDK's types
        // forbid. The cast is what lets this test exercise the parser's
        // handling of a block the SDK says cannot happen.
        message: makeAPIAssistantMessage([
          {
            type: "tool_use",
            id: "plan-789",
            name: "ExitPlanMode",
            // input field is intentionally missing
          } as unknown as APIContentBlock,
        ]),
      };

      result.current.processStreamLine(
        JSON.stringify({
          type: "claude_json",
          data: assistantMessage,
        }),
        mockContext,
      );

      expect(mockContext.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "plan",
          plan: "",
          toolUseId: "plan-789",
          timestamp: expect.any(Number),
        }),
      );
    });

    it("should handle ExitPlanMode with missing toolUseId", () => {
      const { result } = renderHook(() => useStreamParser());

      const assistantMessage: Extract<SDKMessage, { type: "assistant" }> = {
        type: "assistant",
        session_id: "test-session",
        uuid: generateId(),
        parent_tool_use_id: null,
        // Deliberately malformed: `id` is missing, which the SDK's types
        // forbid. The cast is what lets this test exercise the parser's
        // handling of a block the SDK says cannot happen.
        message: makeAPIAssistantMessage([
          {
            type: "tool_use",
            // id field is intentionally missing
            name: "ExitPlanMode",
            input: {
              plan: "Test plan content",
            },
          } as unknown as APIContentBlock,
        ]),
      };

      result.current.processStreamLine(
        JSON.stringify({
          type: "claude_json",
          data: assistantMessage,
        }),
        mockContext,
      );

      expect(mockContext.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "plan",
          plan: "Test plan content",
          toolUseId: "",
          timestamp: expect.any(Number),
        }),
      );
    });

    it("should handle non-string plan content gracefully", () => {
      const { result } = renderHook(() => useStreamParser());

      const assistantMessage: Extract<SDKMessage, { type: "assistant" }> = {
        type: "assistant",
        session_id: "test-session",
        uuid: generateId(),
        parent_tool_use_id: null,
        message: makeAPIAssistantMessage([
          {
            type: "tool_use",
            id: "plan-invalid",
            name: "ExitPlanMode",
            input: {
              plan: { invalid: "object" }, // Non-string content
            },
          },
        ]),
      };

      result.current.processStreamLine(
        JSON.stringify({
          type: "claude_json",
          data: assistantMessage,
        }),
        mockContext,
      );

      expect(mockContext.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "plan",
          plan: { invalid: "object" },
          toolUseId: "plan-invalid",
          timestamp: expect.any(Number),
        }),
      );
    });

    it("should not create plan message for non-ExitPlanMode tools", () => {
      const { result } = renderHook(() => useStreamParser());

      const assistantMessage: Extract<SDKMessage, { type: "assistant" }> = {
        type: "assistant",
        session_id: "test-session",
        uuid: generateId(),
        parent_tool_use_id: null,
        message: makeAPIAssistantMessage([
          {
            type: "tool_use",
            id: "bash-123",
            name: "Bash",
            input: {
              command: "ls -la",
            },
          },
        ]),
      };

      result.current.processStreamLine(
        JSON.stringify({
          type: "claude_json",
          data: assistantMessage,
        }),
        mockContext,
      );

      // Should create a regular tool message, not a plan message
      expect(mockContext.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          timestamp: expect.any(Number),
        }),
      );

      // Verify it's not a plan message
      const addedMessage = (
        mockContext.addMessage as unknown as { mock: { calls: unknown[][] } }
      ).mock.calls[0][0] as { type: string };
      expect(addedMessage.type).not.toBe("plan");
    });
  });

  describe("Stream Line Processing and Error Handling", () => {
    it("should handle malformed JSON gracefully", () => {
      const { result } = renderHook(() => useStreamParser());
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      result.current.processStreamLine("invalid json", mockContext);

      expect(consoleSpy).toHaveBeenCalledWith(
        "Failed to parse stream line:",
        expect.any(Error),
      );
      expect(mockContext.addMessage).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it("should handle missing data field in claude_json", () => {
      const { result } = renderHook(() => useStreamParser());

      result.current.processStreamLine(
        JSON.stringify({
          type: "claude_json",
          // data field is missing
        }),
        mockContext,
      );

      expect(mockContext.addMessage).not.toHaveBeenCalled();
    });

    it("should handle error stream responses", () => {
      const { result } = renderHook(() => useStreamParser());

      result.current.processStreamLine(
        JSON.stringify({
          type: "error",
          error: "Claude execution failed",
        }),
        mockContext,
      );

      expect(mockContext.addMessage).toHaveBeenCalledWith({
        type: "error",
        subtype: "stream_error",
        message: "Claude execution failed",
        timestamp: expect.any(Number),
      });
    });

    it("should handle error stream responses with missing error message", () => {
      const { result } = renderHook(() => useStreamParser());

      result.current.processStreamLine(
        JSON.stringify({
          type: "error",
          // error field is missing
        }),
        mockContext,
      );

      expect(mockContext.addMessage).toHaveBeenCalledWith({
        type: "error",
        subtype: "stream_error",
        message: "Unknown error",
        timestamp: expect.any(Number),
      });
    });

    it("should handle aborted stream responses", () => {
      const { result } = renderHook(() => useStreamParser());

      result.current.processStreamLine(
        JSON.stringify({
          type: "aborted",
        }),
        mockContext,
      );

      expect(mockContext.addMessage).toHaveBeenCalledWith({
        type: "system",
        subtype: "abort",
        message: "Operation was aborted by user",
        timestamp: expect.any(Number),
      });
      expect(mockContext.setCurrentAssistantMessage).toHaveBeenCalledWith(null);
    });
  });

  describe("Mixed Content Handling", () => {
    it("should handle assistant message with both text and ExitPlanMode tool use", () => {
      const { result } = renderHook(() => useStreamParser());

      const assistantMessage: Extract<SDKMessage, { type: "assistant" }> = {
        type: "assistant",
        session_id: "test-session",
        uuid: generateId(),
        parent_tool_use_id: null,
        message: makeAPIAssistantMessage([
          makeTextBlock("I'll help you with that. Here's my plan:"),
          {
            type: "tool_use",
            id: "plan-mixed",
            name: "ExitPlanMode",
            input: {
              plan: "1. Analyze requirements\n2. Design solution\n3. Implement",
            },
          },
        ]),
      };

      result.current.processStreamLine(
        JSON.stringify({
          type: "claude_json",
          data: assistantMessage,
        }),
        mockContext,
      );

      // Should create/update assistant text message and add plan message
      expect(mockContext.addMessage).toHaveBeenCalledTimes(2);
      expect(mockContext.updateLastMessage).toHaveBeenCalledWith(
        "I'll help you with that. Here's my plan:",
      );
      expect(mockContext.addMessage).toHaveBeenLastCalledWith(
        expect.objectContaining({
          type: "plan",
          plan: "1. Analyze requirements\n2. Design solution\n3. Implement",
          toolUseId: "plan-mixed",
        }),
      );
    });

    it("should handle multiple tool uses including ExitPlanMode", () => {
      const { result } = renderHook(() => useStreamParser());

      const assistantMessage: Extract<SDKMessage, { type: "assistant" }> = {
        type: "assistant",
        session_id: "test-session",
        uuid: generateId(),
        parent_tool_use_id: null,
        message: makeAPIAssistantMessage([
          {
            type: "tool_use",
            id: "bash-123",
            name: "Bash",
            input: { command: "ls" },
          },
          {
            type: "tool_use",
            id: "plan-multi",
            name: "ExitPlanMode",
            input: { plan: "Multi-tool plan" },
          },
        ]),
      };

      result.current.processStreamLine(
        JSON.stringify({
          type: "claude_json",
          data: assistantMessage,
        }),
        mockContext,
      );

      expect(mockContext.addMessage).toHaveBeenCalledTimes(2);

      // First call should be the regular tool
      expect(mockContext.addMessage).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          timestamp: expect.any(Number),
        }),
      );

      // Second call should be the plan
      expect(mockContext.addMessage).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          type: "plan",
          plan: "Multi-tool plan",
          toolUseId: "plan-multi",
        }),
      );
    });
  });

  describe("Session ID Handling with Plan Mode", () => {
    it("should update session ID when processing assistant message with ExitPlanMode", () => {
      const { result } = renderHook(() => useStreamParser());
      mockContext.hasReceivedInit = true;

      const assistantMessage: Extract<SDKMessage, { type: "assistant" }> = {
        type: "assistant",
        session_id: "session-with-plan",
        uuid: generateId(),
        parent_tool_use_id: null,
        message: makeAPIAssistantMessage([
          {
            type: "tool_use",
            id: "plan-session",
            name: "ExitPlanMode",
            input: { plan: "Plan with session tracking" },
          },
        ]),
      };

      result.current.processStreamLine(
        JSON.stringify({
          type: "claude_json",
          data: assistantMessage,
        }),
        mockContext,
      );

      expect(mockContext.onSessionId).toHaveBeenCalledWith("session-with-plan");
      expect(mockContext.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "plan",
          plan: "Plan with session tracking",
        }),
      );
    });
  });

  describe("Unrendered message types", () => {
    it("ignores rate_limit_event silently", () => {
      const { result } = renderHook(() => useStreamParser());
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const log = vi.spyOn(console, "log").mockImplementation(() => {});

      // Arrives once per turn in real sessions, so logging it per occurrence
      // buried everything else in the console.
      result.current.processStreamLine(
        JSON.stringify({
          type: "claude_json",
          data: {
            type: "rate_limit_event",
            rate_limit_info: { status: "allowed" },
            uuid: generateId(),
            session_id: "s1",
          },
        }),
        mockContext,
      );

      expect(warn).not.toHaveBeenCalled();
      expect(log).not.toHaveBeenCalled();
      expect(mockContext.addMessage).not.toHaveBeenCalled();

      warn.mockRestore();
      log.mockRestore();
    });

    it("warns once per genuinely unknown type, not once per occurrence", () => {
      const { result } = renderHook(() => useStreamParser());
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

      // Deliberately not a real SDK type, and unique per run so the
      // module-level dedupe set cannot be polluted by another test.
      const noveltype = `totally_new_type_${Math.random().toString(36).slice(2)}`;
      const line = JSON.stringify({
        type: "claude_json",
        data: { type: noveltype, uuid: generateId(), session_id: "s1" },
      });

      result.current.processStreamLine(line, mockContext);
      result.current.processStreamLine(line, mockContext);
      result.current.processStreamLine(line, mockContext);

      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0][0]).toContain(noveltype);
      expect(mockContext.addMessage).not.toHaveBeenCalled();

      warn.mockRestore();
    });
  });

  /**
   * These two callbacks reach the processor through `adaptContext`, which
   * copies StreamingContext field by field. Every field is optional, so
   * forgetting one there compiles cleanly and simply never fires — which is
   * exactly how the context island shipped inert the first time. Assert the
   * hand-off end to end rather than trusting the types.
   */
  describe("composer status surface", () => {
    it("reports context usage from a result message", () => {
      const { result } = renderHook(() => useStreamParser());
      const onContextUsage = vi.fn();

      const resultMessage: SDKMessage = {
        type: "result",
        subtype: "success",
        duration_ms: 1000,
        duration_api_ms: 800,
        is_error: false,
        num_turns: 1,
        result: "done",
        stop_reason: "end_turn",
        modelUsage: {
          "claude-opus-5": {
            inputTokens: 500,
            outputTokens: 100,
            cacheReadInputTokens: 1500,
            cacheCreationInputTokens: 0,
            webSearchRequests: 0,
            costUSD: 0.01,
            contextWindow: 10000,
            maxOutputTokens: 64000,
          },
        },
        session_id: "s1",
        uuid: generateId(),
        total_cost_usd: 0.01,
        usage: makeResultUsage(),
        permission_denials: [],
      };

      result.current.processStreamLine(
        JSON.stringify({ type: "claude_json", data: resultMessage }),
        { ...mockContext, onContextUsage },
      );

      // 500 input + 1500 cache read against a 10k window.
      expect(onContextUsage).toHaveBeenCalledWith(
        expect.objectContaining({ percent: 20, contextWindow: 10000 }),
      );
    });

    it("reports compaction status, then clears it when the turn ends", () => {
      const { result } = renderHook(() => useStreamParser());
      const onStatusChange = vi.fn();
      const context = { ...mockContext, onStatusChange };

      result.current.processStreamLine(
        JSON.stringify({
          type: "claude_json",
          data: {
            type: "system",
            subtype: "status",
            status: "compacting",
            session_id: "s1",
            uuid: generateId(),
          },
        }),
        context,
      );

      expect(onStatusChange).toHaveBeenCalledWith("compacting");
      // Purely internal telemetry: it drives the island, it is not transcript.
      expect(context.addMessage).not.toHaveBeenCalled();

      result.current.processStreamLine(
        JSON.stringify({
          type: "claude_json",
          data: {
            type: "result",
            subtype: "success",
            duration_ms: 1,
            duration_api_ms: 1,
            is_error: false,
            num_turns: 1,
            result: "done",
            stop_reason: "end_turn",
            modelUsage: {},
            session_id: "s1",
            uuid: generateId(),
            total_cost_usd: 0,
            usage: makeResultUsage(),
            permission_denials: [],
          },
        }),
        context,
      );

      expect(onStatusChange).toHaveBeenLastCalledWith(null);
    });
  });

  describe("compaction", () => {
    function compactBoundary(postTokens?: number) {
      return JSON.stringify({
        type: "claude_json",
        data: {
          type: "system",
          subtype: "compact_boundary",
          compact_metadata: {
            trigger: "manual",
            pre_tokens: 120_000,
            ...(postTokens === undefined ? {} : { post_tokens: postTokens }),
          },
          session_id: "s1",
          uuid: generateId(),
        },
      });
    }

    it("reports what compaction left behind, and stays out of the transcript", () => {
      const { result } = renderHook(() => useStreamParser());
      const onContextCompacted = vi.fn();

      result.current.processStreamLine(compactBoundary(9_000), {
        ...mockContext,
        onContextCompacted,
      });

      expect(onContextCompacted).toHaveBeenCalledWith(9_000);
      // The island is where these numbers belong; the boundary itself would
      // render as a JSON dump mid-conversation.
      expect(mockContext.addMessage).not.toHaveBeenCalled();
    });

    it("reads the session file's camelCase spelling too", () => {
      // The SDK type says compact_metadata.post_tokens, but the record written
      // to the session file is compactMetadata.postTokens — a replayed
      // conversation would otherwise never report anything.
      const { result } = renderHook(() => useStreamParser());
      const onContextCompacted = vi.fn();

      result.current.processStreamLine(
        JSON.stringify({
          type: "claude_json",
          data: {
            type: "system",
            subtype: "compact_boundary",
            compactMetadata: {
              trigger: "auto",
              preTokens: 1_001_762,
              postTokens: 14_365,
            },
            session_id: "s1",
            uuid: generateId(),
          },
        }),
        { ...mockContext, onContextCompacted },
      );

      expect(onContextCompacted).toHaveBeenCalledWith(14_365);
    });

    it("says nothing when the boundary carries no post-compaction count", () => {
      const { result } = renderHook(() => useStreamParser());
      const onContextCompacted = vi.fn();

      result.current.processStreamLine(compactBoundary(), {
        ...mockContext,
        onContextCompacted,
      });

      // post_tokens is optional in the SDK type. Reporting a 0 here would
      // show a reassuring 0% that nothing measured.
      expect(onContextCompacted).not.toHaveBeenCalled();
    });

    it("drops the CLI's 'Compacted' acknowledgement", () => {
      const { result } = renderHook(() => useStreamParser());

      result.current.processStreamLine(
        JSON.stringify({
          type: "claude_json",
          data: {
            type: "user",
            message: {
              role: "user",
              content:
                "<local-command-stdout>Compacted </local-command-stdout>",
            },
            session_id: "s1",
            uuid: generateId(),
            parent_tool_use_id: null,
          },
        }),
        mockContext,
      );

      expect(mockContext.addMessage).not.toHaveBeenCalled();
    });

    it("drops the summary the CLI feeds back after compacting", () => {
      // Several thousand words the user did not write, restating the
      // conversation they are already looking at.
      const { result } = renderHook(() => useStreamParser());

      result.current.processStreamLine(
        JSON.stringify({
          type: "claude_json",
          data: {
            type: "user",
            isCompactSummary: true,
            message: {
              role: "user",
              content:
                "This session is being continued from a previous conversation...",
            },
            session_id: "s1",
            uuid: generateId(),
            parent_tool_use_id: null,
          },
        }),
        mockContext,
      );

      expect(mockContext.addMessage).not.toHaveBeenCalled();
    });

    it("drops the resume prompt even when the flag is absent", () => {
      /*
       * The flag was the only signal at first, on the reasoning that it beats
       * matching English. It turned out not to be carried on the live stream —
       * a compaction watched in the browser still put thousands of words in
       * the transcript attributed to the user — so the CLI's fixed opening
       * line is matched as well.
       */
      const { result } = renderHook(() => useStreamParser());

      result.current.processStreamLine(
        JSON.stringify({
          type: "claude_json",
          data: {
            type: "user",
            message: {
              role: "user",
              content:
                "This session is being continued from a previous conversation that ran out of context...",
            },
            session_id: "s1",
            uuid: generateId(),
            parent_tool_use_id: null,
          },
        }),
        mockContext,
      );

      expect(mockContext.addMessage).not.toHaveBeenCalled();
    });

    it("keeps a message that only mentions the phrase mid-sentence", () => {
      // Anchored to the start, so quoting it in conversation still shows.
      const { result } = renderHook(() => useStreamParser());

      result.current.processStreamLine(
        JSON.stringify({
          type: "claude_json",
          data: {
            type: "user",
            message: {
              role: "user",
              content:
                'why does "This session is being continued from a previous conversation" appear?',
            },
            session_id: "s1",
            uuid: generateId(),
            parent_tool_use_id: null,
          },
        }),
        mockContext,
      );

      expect(mockContext.addMessage).toHaveBeenCalled();
    });

    it("keeps command output that says something, without its wrapper", () => {
      const { result } = renderHook(() => useStreamParser());

      result.current.processStreamLine(
        JSON.stringify({
          type: "claude_json",
          data: {
            type: "user",
            message: {
              role: "user",
              content:
                "<local-command-stdout>Total cost: $0.42</local-command-stdout>",
            },
            session_id: "s1",
            uuid: generateId(),
            parent_tool_use_id: null,
          },
        }),
        mockContext,
      );

      expect(mockContext.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({ role: "user", content: "Total cost: $0.42" }),
      );
    });
  });

  /**
   * Task telemetry drives the Agents panel. These subtypes used to fall
   * through to the raw-JSON fallback, so a running workflow put a blob in the
   * transcript for every frame — several per second per agent.
   */
  describe("agent task telemetry", () => {
    function send(
      result: ReturnType<
        typeof renderHook<ReturnType<typeof useStreamParser>, unknown>
      >,
      data: unknown,
      ctx: unknown,
    ) {
      result.result.current.processStreamLine(
        JSON.stringify({ type: "claude_json", data }),
        ctx as never,
      );
    }

    it("reports a started task and keeps it out of the transcript", () => {
      const hook = renderHook(() => useStreamParser());
      const onAgentEvent = vi.fn();

      send(
        hook,
        {
          type: "system",
          subtype: "task_started",
          task_id: "t1",
          description: "Review the parser",
          subagent_type: "code-reviewer",
          task_type: "local_workflow",
          workflow_name: "review-changes",
          session_id: "s1",
          uuid: generateId(),
        },
        { ...mockContext, onAgentEvent },
      );

      expect(onAgentEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: "started",
          taskId: "t1",
          workflowName: "review-changes",
          subagentType: "code-reviewer",
        }),
      );
      expect(mockContext.addMessage).not.toHaveBeenCalled();
    });

    it("reports progress and a terminal notification", () => {
      const hook = renderHook(() => useStreamParser());
      const onAgentEvent = vi.fn();
      const ctx = { ...mockContext, onAgentEvent };

      send(
        hook,
        {
          type: "system",
          subtype: "task_progress",
          task_id: "t1",
          description: "Reviewing",
          last_tool_name: "Grep",
          usage: { total_tokens: 1200, tool_uses: 3, duration_ms: 4500 },
          session_id: "s1",
          uuid: generateId(),
        },
        ctx,
      );
      send(
        hook,
        {
          type: "system",
          subtype: "task_notification",
          task_id: "t1",
          status: "completed",
          output_file: "/tmp/out.md",
          summary: "No issues found",
          session_id: "s1",
          uuid: generateId(),
        },
        ctx,
      );

      expect(onAgentEvent).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          kind: "progress",
          lastToolName: "Grep",
          usage: { totalTokens: 1200, toolUses: 3, durationMs: 4500 },
        }),
      );
      expect(onAgentEvent).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          kind: "finished",
          status: "completed",
          outputFile: "/tmp/out.md",
        }),
      );
      expect(mockContext.addMessage).not.toHaveBeenCalled();
    });

    it("maps the CLI's 'stopped' onto a killed task", () => {
      const hook = renderHook(() => useStreamParser());
      const onAgentEvent = vi.fn();

      send(
        hook,
        {
          type: "system",
          subtype: "task_notification",
          task_id: "t1",
          status: "stopped",
          session_id: "s1",
          uuid: generateId(),
        },
        { ...mockContext, onAgentEvent },
      );

      expect(onAgentEvent).toHaveBeenCalledWith(
        expect.objectContaining({ kind: "finished", status: "killed" }),
      );
    });

    it("reports tool progress for a task, and ignores main-thread tools", () => {
      const hook = renderHook(() => useStreamParser());
      const onAgentEvent = vi.fn();
      const ctx = { ...mockContext, onAgentEvent };

      send(
        hook,
        {
          type: "tool_progress",
          tool_use_id: "u1",
          tool_name: "WebFetch",
          parent_tool_use_id: null,
          elapsed_time_seconds: 3,
          task_id: "t1",
          subagent_retry: { agent_id: "a1", attempt: 2, max_retries: 3 },
          session_id: "s1",
          uuid: generateId(),
        },
        ctx,
      );
      // No task_id: this is the main thread's own tool, not an agent's.
      send(
        hook,
        {
          type: "tool_progress",
          tool_use_id: "u2",
          tool_name: "Read",
          parent_tool_use_id: null,
          elapsed_time_seconds: 1,
          session_id: "s1",
          uuid: generateId(),
        },
        ctx,
      );

      expect(onAgentEvent).toHaveBeenCalledTimes(1);
      expect(onAgentEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: "tool",
          toolName: "WebFetch",
          retry: { attempt: 2, maxRetries: 3 },
        }),
      );
    });

    it("does not warn about tool_progress as an unknown type", () => {
      const hook = renderHook(() => useStreamParser());
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

      send(
        hook,
        {
          type: "tool_progress",
          tool_use_id: "u1",
          tool_name: "Read",
          parent_tool_use_id: null,
          elapsed_time_seconds: 1,
          session_id: "s1",
          uuid: generateId(),
        },
        mockContext,
      );

      expect(warn).not.toHaveBeenCalled();
      warn.mockRestore();
    });
  });
});
