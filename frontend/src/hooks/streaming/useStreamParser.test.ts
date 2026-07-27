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
});
