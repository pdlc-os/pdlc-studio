import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useClaudeStreaming } from "./useClaudeStreaming";
import type { SDKMessage } from "../types";
import { generateId } from "../utils/id";
import {
  makeResultUsage,
  makeSystemInitMessage,
  makeTextBlock,
  makeUsage,
} from "../utils/sdkFixtures";
import { NON_DISPLAYED_SYSTEM_SUBTYPES } from "../utils/UnifiedMessageProcessor";

describe("useClaudeStreaming", () => {
  it("does not extract session_id from system messages", () => {
    const { result } = renderHook(() => useClaudeStreaming());
    const onSessionId = vi.fn();

    const mockContext = {
      currentAssistantMessage: null,
      setCurrentAssistantMessage: vi.fn(),
      addMessage: vi.fn(),
      updateLastMessage: vi.fn(),
      onSessionId,
      hasReceivedInit: false,
      setHasReceivedInit: vi.fn(),
    };

    const systemMessage: SDKMessage = makeSystemInitMessage({
      cwd: "/test",
      session_id: "test-session-123",
      uuid: generateId(),
      tools: ["Bash"],
      model: "claude-3-sonnet",
    });

    const streamLine = JSON.stringify({
      type: "claude_json",
      data: systemMessage,
    });

    result.current.processStreamLine(streamLine, mockContext);

    // sessionId should NOT be extracted from system messages
    expect(onSessionId).not.toHaveBeenCalled();
    // init is not rendered in the transcript...
    expect(mockContext.addMessage).not.toHaveBeenCalled();
    // ...but it must still flip hasReceivedInit, which is what allows
    // session_id to be picked up from later assistant messages.
    expect(mockContext.setHasReceivedInit).toHaveBeenCalledWith(true);
  });

  it.each(NON_DISPLAYED_SYSTEM_SUBTYPES)(
    "does not display the '%s' system subtype",
    (subtype) => {
      const { result } = renderHook(() => useClaudeStreaming());

      const mockContext = {
        currentAssistantMessage: null,
        setCurrentAssistantMessage: vi.fn(),
        addMessage: vi.fn(),
        updateLastMessage: vi.fn(),
        hasReceivedInit: false,
        setHasReceivedInit: vi.fn(),
      };

      result.current.processStreamLine(
        JSON.stringify({
          type: "claude_json",
          data: { ...makeSystemInitMessage({ uuid: generateId() }), subtype },
        }),
        mockContext,
      );

      expect(mockContext.addMessage).not.toHaveBeenCalled();
    },
  );

  it("still displays system subtypes it has no dedicated rendering for", () => {
    const { result } = renderHook(() => useClaudeStreaming());

    const mockContext = {
      currentAssistantMessage: null,
      setCurrentAssistantMessage: vi.fn(),
      addMessage: vi.fn(),
      updateLastMessage: vi.fn(),
      hasReceivedInit: false,
      setHasReceivedInit: vi.fn(),
    };

    result.current.processStreamLine(
      JSON.stringify({
        type: "claude_json",
        data: {
          ...makeSystemInitMessage({ uuid: generateId() }),
          subtype: "compact_boundary",
        },
      }),
      mockContext,
    );

    expect(mockContext.addMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "system",
        subtype: "compact_boundary",
        timestamp: expect.any(Number),
      }),
    );
  });

  it("extracts session_id from assistant messages when hasReceivedInit is true", () => {
    const { result } = renderHook(() => useClaudeStreaming());
    const onSessionId = vi.fn();

    const mockContext = {
      currentAssistantMessage: null,
      setCurrentAssistantMessage: vi.fn(),
      addMessage: vi.fn(),
      updateLastMessage: vi.fn(),
      onSessionId,
      hasReceivedInit: true, // This is key - init has been received
    };

    const assistantMessage: SDKMessage = {
      type: "assistant",
      message: {
        id: "msg_123",
        type: "message",
        role: "assistant",
        content: [makeTextBlock("Hello world")],
        model: "claude-3-sonnet",
        stop_reason: "end_turn",
        stop_sequence: null,
        container: null,
        context_management: null,
        diagnostics: null,
        stop_details: null,
        usage: makeUsage({ input_tokens: 10, output_tokens: 5 }),
      },
      parent_tool_use_id: null,
      session_id: "test-session-456",
      uuid: generateId(),
    };

    const streamLine = JSON.stringify({
      type: "claude_json",
      data: assistantMessage,
    });

    result.current.processStreamLine(streamLine, mockContext);

    expect(onSessionId).toHaveBeenCalledWith("test-session-456");
  });

  it("does not extract session_id from assistant messages when hasReceivedInit is false", () => {
    const { result } = renderHook(() => useClaudeStreaming());
    const onSessionId = vi.fn();

    const mockContext = {
      currentAssistantMessage: null,
      setCurrentAssistantMessage: vi.fn(),
      addMessage: vi.fn(),
      updateLastMessage: vi.fn(),
      onSessionId,
      hasReceivedInit: false, // Init has NOT been received
    };

    const assistantMessage: SDKMessage = {
      type: "assistant",
      message: {
        id: "msg_123",
        type: "message",
        role: "assistant",
        content: [makeTextBlock("Hello world")],
        model: "claude-3-sonnet",
        stop_reason: "end_turn",
        stop_sequence: null,
        container: null,
        context_management: null,
        diagnostics: null,
        stop_details: null,
        usage: makeUsage({ input_tokens: 10, output_tokens: 5 }),
      },
      parent_tool_use_id: null,
      session_id: "test-session-456",
      uuid: generateId(),
    };

    const streamLine = JSON.stringify({
      type: "claude_json",
      data: assistantMessage,
    });

    result.current.processStreamLine(streamLine, mockContext);

    // sessionId should NOT be extracted when hasReceivedInit is false
    expect(onSessionId).not.toHaveBeenCalled();
  });

  it("does not extract session_id from result messages", () => {
    const { result } = renderHook(() => useClaudeStreaming());
    const onSessionId = vi.fn();

    const mockContext = {
      currentAssistantMessage: null,
      setCurrentAssistantMessage: vi.fn(),
      addMessage: vi.fn(),
      updateLastMessage: vi.fn(),
      onSessionId,
    };

    const resultMessage: SDKMessage = {
      type: "result",
      subtype: "success",
      duration_ms: 1000,
      duration_api_ms: 800,
      is_error: false,
      num_turns: 1,
      result: "Task completed",
      stop_reason: "end_turn",
      modelUsage: {},
      session_id: "test-session-789",
      uuid: generateId(),
      total_cost_usd: 0.001,
      usage: makeResultUsage({ input_tokens: 10, output_tokens: 5 }),
      permission_denials: [],
    };

    const streamLine = JSON.stringify({
      type: "claude_json",
      data: resultMessage,
    });

    result.current.processStreamLine(streamLine, mockContext);

    // sessionId should NOT be extracted from result messages
    expect(onSessionId).not.toHaveBeenCalled();
  });

  it("handles missing onSessionId callback gracefully", () => {
    const { result } = renderHook(() => useClaudeStreaming());

    const mockContext = {
      currentAssistantMessage: null,
      setCurrentAssistantMessage: vi.fn(),
      addMessage: vi.fn(),
      updateLastMessage: vi.fn(),
      hasReceivedInit: false,
      setHasReceivedInit: vi.fn(),
      // onSessionId is missing
    };

    const systemMessage: SDKMessage = makeSystemInitMessage({
      cwd: "/test",
      session_id: "test-session-123",
      uuid: generateId(),
      tools: ["Bash"],
      model: "claude-3-sonnet",
    });

    const streamLine = JSON.stringify({
      type: "claude_json",
      data: systemMessage,
    });

    // Should not throw when onSessionId is missing
    expect(() => {
      result.current.processStreamLine(streamLine, mockContext);
    }).not.toThrow();
  });

  it("handles tool_use messages with simplified format", () => {
    const { result } = renderHook(() => useClaudeStreaming());

    const mockContext = {
      currentAssistantMessage: null,
      setCurrentAssistantMessage: vi.fn(),
      addMessage: vi.fn(),
      updateLastMessage: vi.fn(),
    };

    const assistantMessage: SDKMessage = {
      type: "assistant",
      message: {
        id: "msg_123",
        type: "message",
        role: "assistant",
        content: [
          {
            type: "tool_use",
            id: "tool_123",
            name: "LS",
            input: { path: "/home/user/documents" },
          },
        ],
        model: "claude-3-sonnet",
        stop_reason: "tool_use",
        stop_sequence: null,
        container: null,
        context_management: null,
        diagnostics: null,
        stop_details: null,
        usage: makeUsage({ input_tokens: 10, output_tokens: 5 }),
      },
      parent_tool_use_id: null,
      session_id: "test-session-123",
      uuid: generateId(),
    };

    const streamLine = JSON.stringify({
      type: "claude_json",
      data: assistantMessage,
    });

    result.current.processStreamLine(streamLine, mockContext);

    expect(mockContext.addMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "tool",
        content: "LS(/home/user/documents)",
        timestamp: expect.any(Number),
      }),
    );
  });

  it("handles user messages with tool_result content", () => {
    const { result } = renderHook(() => useClaudeStreaming());

    const mockContext = {
      currentAssistantMessage: null,
      setCurrentAssistantMessage: vi.fn(),
      addMessage: vi.fn(),
      updateLastMessage: vi.fn(),
    };

    const userMessage: SDKMessage = {
      type: "user",
      message: {
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: "tool_123",
            content: "file1.txt\nfile2.txt\nfile3.txt",
          },
        ],
      },
      parent_tool_use_id: null,
      session_id: "test-session-123",
      uuid: generateId(),
    };

    const streamLine = JSON.stringify({
      type: "claude_json",
      data: userMessage,
    });

    result.current.processStreamLine(streamLine, mockContext);

    expect(mockContext.addMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "tool_result",
        toolName: "Tool",
        content: "file1.txt\nfile2.txt\nfile3.txt",
        summary: "3 lines",
        timestamp: expect.any(Number),
      }),
    );
  });

  it("handles tool_use messages with different argument types", () => {
    const { result } = renderHook(() => useClaudeStreaming());

    const mockContext = {
      currentAssistantMessage: null,
      setCurrentAssistantMessage: vi.fn(),
      addMessage: vi.fn(),
      updateLastMessage: vi.fn(),
    };

    const assistantMessage: SDKMessage = {
      type: "assistant",
      message: {
        id: "msg_123",
        type: "message",
        role: "assistant",
        content: [
          {
            type: "tool_use",
            id: "tool_123",
            name: "Bash",
            input: { command: "ls -la" },
          },
        ],
        model: "claude-3-sonnet",
        stop_reason: "tool_use",
        stop_sequence: null,
        container: null,
        context_management: null,
        diagnostics: null,
        stop_details: null,
        usage: makeUsage({ input_tokens: 10, output_tokens: 5 }),
      },
      parent_tool_use_id: null,
      session_id: "test-session-123",
      uuid: generateId(),
    };

    const streamLine = JSON.stringify({
      type: "claude_json",
      data: assistantMessage,
    });

    result.current.processStreamLine(streamLine, mockContext);

    expect(mockContext.addMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "tool",
        content: "Bash(ls -la)",
        timestamp: expect.any(Number),
      }),
    );
  });
});
