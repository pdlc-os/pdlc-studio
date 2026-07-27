import { useEffect, useCallback, useMemo, useReducer, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { ChatLayout } from "@astryxdesign/core/Chat";
import { VStack } from "@astryxdesign/core/VStack";
import { HStack } from "@astryxdesign/core/HStack";
import { Button } from "@astryxdesign/core/Button";
import { Spinner } from "@astryxdesign/core/Spinner";
import { Banner } from "@astryxdesign/core/Banner";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { Breadcrumbs, BreadcrumbItem } from "@astryxdesign/core/Breadcrumbs";
import { ContextMenu } from "@astryxdesign/core/ContextMenu";
import { IconButton } from "@astryxdesign/core/IconButton";
import { Icon } from "@astryxdesign/core/Icon";
import { Star } from "lucide-react";
import {
  SegmentedControl,
  SegmentedControlItem,
} from "@astryxdesign/core/SegmentedControl";
import type {
  ChatRequest,
  ChatMessage,
  ProjectInfo,
  PermissionMode,
} from "../types";
import { useClaudeStreaming } from "../hooks/useClaudeStreaming";
import { useChatState } from "../hooks/chat/useChatState";
import { usePermissions } from "../hooks/chat/usePermissions";
import { usePermissionMode } from "../hooks/chat/usePermissionMode";
import { useAbortController } from "../hooks/chat/useAbortController";
import { useAutoHistoryLoader } from "../hooks/useHistoryLoader";
import { useSettings } from "../hooks/useSettings";
import { useConversationList } from "../hooks/useConversationList";
import { useSessionTeam } from "../hooks/useSessionTeam";
import { useAttachments, withAttachments } from "../hooks/useAttachments";
import { ConversationSidebar } from "./chat/ConversationSidebar";
import { RenameConversationDialog } from "./chat/RenameConversationDialog";
import { FilesPanel } from "./chat/FilesPanel";
import { AgentsPanel } from "./chat/AgentsPanel";
import {
  EMPTY_ACTIVITY,
  reduceAgentActivity,
  runningTasks,
} from "../utils/agentActivity";
import { ExportMenu } from "./chat/ExportMenu";
import { saveTranscript } from "../utils/saveTranscript";
import type { ExportFormat } from "../utils/exportTranscript";
import { collectConversationFiles } from "../utils/conversationFiles";
import type {
  ConversationSummary,
  PendingQuestionPayload,
  SDKStatus,
} from "../types";
import { usageFromTokens, type ContextUsage } from "../utils/contextUsage";
import { SlashCommandsProvider } from "../contexts/SlashCommandsContext";
import { SettingsButton } from "./SettingsButton";
import { SettingsModal } from "./SettingsModal";
import { ChatInput } from "./chat/ChatInput";
import { ChatMessages } from "./chat/ChatMessages";
import { AppIcon } from "./AppIcon";
import {
  getChatUrl,
  getProjectsUrl,
  getQuestionAnswerUrl,
} from "../config/api";
import { KEYBOARD_SHORTCUTS } from "../utils/constants";
import type { StreamingContext } from "../hooks/streaming/useMessageProcessor";

export function ChatPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const {
    conversationFont,
    conversationFontSize,
    model,
    effortLevel,
    thinking,
  } = useSettings();

  // Extract and normalize working directory from URL
  const workingDirectory = (() => {
    const rawPath = location.pathname.replace("/projects", "");
    if (!rawPath) return undefined;

    return decodeURIComponent(rawPath);
  })();

  // Get current view and sessionId from query parameters
  const sessionId = searchParams.get("sessionId");
  const isLoadedConversation = !!sessionId;

  /*
   * Opening a project no longer opens a conversation.
   *
   * A chat is active only when the URL says so — either a resumed `sessionId`
   * or an explicit `new=1` from the New Session button. Landing on the bare
   * project route shows the sidebar and an empty state instead, so arriving
   * from the launch screen does not silently start a session the user has to
   * abandon. Keeping it in the URL means reload and the back button behave.
   */
  const tabParam = searchParams.get("tab");
  const activeTab =
    tabParam === "files" || tabParam === "agents" ? tabParam : "chat";
  const isNewSession = searchParams.get("new") === "1";
  const hasActiveConversation = isNewSession || isLoadedConversation;

  const { processStreamLine } = useClaudeStreaming();
  const { abortRequest, createAbortHandler } = useAbortController();

  // Permission mode state management
  const { permissionMode, setPermissionMode } = usePermissionMode();

  // Get encoded name for current working directory
  const getEncodedName = useCallback(() => {
    if (!workingDirectory || !projects.length) {
      return null;
    }

    const project = projects.find((p) => p.path === workingDirectory);

    return project?.encodedName || null;
  }, [workingDirectory, projects]);

  const [conversationSearch, setConversationSearch] = useState("");
  // Reported by the CLI, not derived here: usage arrives with each turn's
  // result, status while a turn is in flight.
  const [contextUsage, setContextUsage] = useState<ContextUsage | null>(null);
  const [cliStatus, setCliStatus] = useState<SDKStatus>(null);
  /*
   * Questions Claude is blocked on. Answered ones are kept, not removed: the
   * card is a record of a decision the conversation turned on, and the
   * transcript would otherwise lose it.
   */
  const [questions, setQuestions] = useState<PendingQuestionPayload[]>([]);
  const [questionAnswers, setQuestionAnswers] = useState<
    Record<string, Record<string, string>>
  >({});

  /*
   * The agents and workflows this conversation has spawned.
   *
   * A reducer rather than a pile of setState: the CLI reports task lifecycle
   * as a stream of small events with real ordering rules — a late progress
   * frame must not resurrect a finished task — and those rules belong in one
   * tested place rather than in a callback here.
   */
  const [agentActivity, dispatchAgentEvent] = useReducer(
    reduceAgentActivity,
    EMPTY_ACTIVITY,
  );

  const {
    conversations,
    isLoading: conversationsLoading,
    error: conversationsError,
    refresh: refreshConversations,
    rename: renameConversation,
    remove: removeConversation,
    setStarred: setConversationStarred,
    clearAll: clearAllConversations,
    isSearching: isSearchingConversations,
  } = useConversationList(getEncodedName(), conversationSearch);

  const [renameTarget, setRenameTarget] = useState<ConversationSummary | null>(
    null,
  );

  const {
    attachments,
    isUploading: isUploadingAttachments,
    error: attachmentError,
    add: addAttachments,
    remove: removeAttachment,
    clear: clearAttachments,
  } = useAttachments();

  // Load conversation history if sessionId is provided
  const {
    messages: historyMessages,
    loading: historyLoading,
    error: historyError,
    sessionId: loadedSessionId,
  } = useAutoHistoryLoader(
    getEncodedName() || undefined,
    sessionId || undefined,
  );

  // Initialize chat state with loaded history
  const {
    messages,
    input,
    isLoading,
    currentSessionId,
    currentRequestId,
    hasShownInitMessage,
    currentAssistantMessage,
    setInput,
    setCurrentSessionId,
    setHasShownInitMessage,
    setHasReceivedInit,
    setCurrentAssistantMessage,
    addMessage,
    updateLastMessage,
    clearInput,
    generateRequestId,
    resetRequestState,
    startRequest,
  } = useChatState({
    initialMessages: historyMessages,
    initialSessionId: loadedSessionId || undefined,
  });

  /**
   * The session actually on screen.
   *
   * A new conversation has no id in the URL until the SDK's init message
   * reports one, so the live id is needed to name it at all.
   *
   * The live id also *wins* over the URL's. Resuming can continue under a new
   * session id, and the CLI writes the title under that one — so a header
   * keyed on the stale URL id looks up a row the listing no longer contains
   * and falls back to "Untitled conversation" while the sidebar shows the real
   * name. Preferring the live id keeps the two in agreement.
   */
  const activeSessionKey = currentSessionId ?? sessionId ?? null;

  // The agent team behind this conversation, if it spawned one.
  const sessionTeam = useSessionTeam(getEncodedName(), activeSessionKey);

  const answerQuestion = useCallback(
    (questionId: string, answers: Record<string, string>) => {
      // Recorded locally first: the card freezes on the user's click rather
      // than after a round trip, and the turn resumes either way.
      setQuestionAnswers((current) => ({ ...current, [questionId]: answers }));
      void fetch(getQuestionAnswerUrl(questionId), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      }).catch((error: unknown) => {
        console.error("Failed to send answer", error);
      });
    },
    [],
  );

  const unansweredQuestion = questions.find(
    (question) => !questionAnswers[question.questionId],
  );

  /*
   * Agents still working. Drives two indicators that must agree: the island's
   * count and the dot on the Agents tab. Deriving both from one value is what
   * stops them disagreeing — a dot left on after the island has gone quiet
   * would say work is in flight when none is.
   */
  const runningAgentCount = runningTasks(agentActivity).length;

  const {
    allowedTools,
    permissionRequest,
    showPermissionRequest,
    closePermissionRequest,
    allowToolTemporary,
    allowToolPermanent,
    isPermissionMode,
    planModeRequest,
    showPlanModeRequest,
    closePlanModeRequest,
    updatePermissionMode,
  } = usePermissions({
    onPermissionModeChange: setPermissionMode,
  });

  const handlePermissionError = useCallback(
    (toolName: string, patterns: string[], toolUseId: string) => {
      // Check if this is an ExitPlanMode permission error
      if (patterns.includes("ExitPlanMode")) {
        // For ExitPlanMode, show plan permission interface instead of regular permission
        showPlanModeRequest(""); // Empty plan content since it was already displayed
      } else {
        showPermissionRequest(toolName, patterns, toolUseId);
      }
    },
    [showPermissionRequest, showPlanModeRequest],
  );

  const sendMessage = useCallback(
    async (
      messageContent?: string,
      tools?: string[],
      hideUserMessage = false,
      overridePermissionMode?: PermissionMode,
    ) => {
      const typed = messageContent || input.trim();
      // Attachments belong to the message that names them: an empty box with a
      // file staged is still a real message, so allow sending on either.
      if ((!typed && attachments.length === 0) || isLoading) return;

      const content = withAttachments(typed, attachments);

      const requestId = generateRequestId();

      // Only add user message to chat if not hidden
      if (!hideUserMessage) {
        const userMessage: ChatMessage = {
          type: "chat",
          role: "user",
          content: content,
          timestamp: Date.now(),
        };
        addMessage(userMessage);
      }

      if (!messageContent) clearInput();
      clearAttachments();
      startRequest();

      try {
        const response = await fetch(getChatUrl(), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: content,
            requestId,
            ...(currentSessionId ? { sessionId: currentSessionId } : {}),
            allowedTools: tools || allowedTools,
            ...(workingDirectory ? { workingDirectory } : {}),
            permissionMode: overridePermissionMode || permissionMode,
            // Omitted when unset so the CLI's own configured defaults stand.
            ...(model && model !== "default" ? { model } : {}),
            ...(effortLevel ? { effortLevel } : {}),
            ...(thinking ? { thinking } : {}),
          } as ChatRequest),
        });

        if (!response.body) throw new Error("No response body");

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        // Local state for this streaming session
        let localHasReceivedInit = false;
        let shouldAbort = false;

        const streamingContext: StreamingContext = {
          currentAssistantMessage,
          setCurrentAssistantMessage,
          addMessage,
          updateLastMessage,
          onSessionId: setCurrentSessionId,
          onContextUsage: setContextUsage,
          // Compaction reports what it left behind but not the window it left
          // it in, so the window carries over from the last reading. Nothing to
          // show if there has not been one — the island stays hidden rather
          // than inventing a denominator.
          onContextCompacted: (postTokens: number) =>
            setContextUsage((previous) =>
              previous
                ? (usageFromTokens(postTokens, previous.contextWindow) ??
                  previous)
                : null,
            ),
          onStatusChange: setCliStatus,
          onAgentEvent: dispatchAgentEvent,
          onAskQuestion: (question) =>
            setQuestions((current) =>
              current.some((q) => q.questionId === question.questionId)
                ? current
                : [...current, question],
            ),
          shouldShowInitMessage: () => !hasShownInitMessage,
          onInitMessageShown: () => setHasShownInitMessage(true),
          get hasReceivedInit() {
            return localHasReceivedInit;
          },
          setHasReceivedInit: (received: boolean) => {
            localHasReceivedInit = received;
            setHasReceivedInit(received);
          },
          onPermissionError: handlePermissionError,
          onAbortRequest: async () => {
            shouldAbort = true;
            await createAbortHandler(requestId)();
          },
        };

        while (true) {
          const { done, value } = await reader.read();
          if (done || shouldAbort) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split("\n").filter((line) => line.trim());

          for (const line of lines) {
            if (shouldAbort) break;
            processStreamLine(line, streamingContext);
          }

          if (shouldAbort) break;
        }
      } catch (error) {
        console.error("Failed to send message:", error);
        addMessage({
          type: "chat",
          role: "assistant",
          content: "Error: Failed to get response",
          timestamp: Date.now(),
        });
      } finally {
        resetRequestState();
      }
    },
    [
      input,
      isLoading,
      currentSessionId,
      allowedTools,
      hasShownInitMessage,
      currentAssistantMessage,
      workingDirectory,
      permissionMode,
      generateRequestId,
      clearInput,
      startRequest,
      addMessage,
      updateLastMessage,
      setCurrentSessionId,
      setHasShownInitMessage,
      setHasReceivedInit,
      setCurrentAssistantMessage,
      resetRequestState,
      processStreamLine,
      handlePermissionError,
      createAbortHandler,
      attachments,
      clearAttachments,
      model,
      effortLevel,
      thinking,
    ],
  );

  const handleAbort = useCallback(() => {
    abortRequest(currentRequestId, isLoading, resetRequestState);
  }, [abortRequest, currentRequestId, isLoading, resetRequestState]);

  // Permission request handlers
  const handlePermissionAllow = useCallback(() => {
    if (!permissionRequest) return;

    // Add all patterns temporarily
    let updatedAllowedTools = allowedTools;
    permissionRequest.patterns.forEach((pattern) => {
      updatedAllowedTools = allowToolTemporary(pattern, updatedAllowedTools);
    });

    closePermissionRequest();

    if (currentSessionId) {
      sendMessage("continue", updatedAllowedTools, true);
    }
  }, [
    permissionRequest,
    currentSessionId,
    sendMessage,
    allowedTools,
    allowToolTemporary,
    closePermissionRequest,
  ]);

  const handlePermissionAllowPermanent = useCallback(() => {
    if (!permissionRequest) return;

    // Add all patterns permanently
    let updatedAllowedTools = allowedTools;
    permissionRequest.patterns.forEach((pattern) => {
      updatedAllowedTools = allowToolPermanent(pattern, updatedAllowedTools);
    });

    closePermissionRequest();

    if (currentSessionId) {
      sendMessage("continue", updatedAllowedTools, true);
    }
  }, [
    permissionRequest,
    currentSessionId,
    sendMessage,
    allowedTools,
    allowToolPermanent,
    closePermissionRequest,
  ]);

  const handlePermissionDeny = useCallback(() => {
    closePermissionRequest();
  }, [closePermissionRequest]);

  // Plan mode request handlers
  const handlePlanAcceptWithEdits = useCallback(() => {
    updatePermissionMode("acceptEdits");
    closePlanModeRequest();
    if (currentSessionId) {
      sendMessage("accept", allowedTools, true, "acceptEdits");
    }
  }, [
    updatePermissionMode,
    closePlanModeRequest,
    currentSessionId,
    sendMessage,
    allowedTools,
  ]);

  const handlePlanAcceptDefault = useCallback(() => {
    updatePermissionMode("default");
    closePlanModeRequest();
    if (currentSessionId) {
      sendMessage("accept", allowedTools, true, "default");
    }
  }, [
    updatePermissionMode,
    closePlanModeRequest,
    currentSessionId,
    sendMessage,
    allowedTools,
  ]);

  const handlePlanKeepPlanning = useCallback(() => {
    updatePermissionMode("plan");
    closePlanModeRequest();
  }, [updatePermissionMode, closePlanModeRequest]);

  // Create permission data for inline permission interface
  const permissionData = permissionRequest
    ? {
        patterns: permissionRequest.patterns,
        onAllow: handlePermissionAllow,
        onAllowPermanent: handlePermissionAllowPermanent,
        onDeny: handlePermissionDeny,
      }
    : undefined;

  // Create plan permission data for plan mode interface
  const planPermissionData = planModeRequest
    ? {
        onAcceptWithEdits: handlePlanAcceptWithEdits,
        onAcceptDefault: handlePlanAcceptDefault,
        onKeepPlanning: handlePlanKeepPlanning,
      }
    : undefined;

  const handleSettingsClick = useCallback(() => {
    setIsSettingsOpen(true);
  }, []);

  const conversationFiles = useMemo(
    () => collectConversationFiles(messages, workingDirectory),
    [messages, workingDirectory],
  );

  const handleTabChange = useCallback(
    (tab: string) => {
      const next = new URLSearchParams(searchParams);
      // "chat" is the default, so it stays out of the URL.
      if (tab === "files" || tab === "agents") next.set("tab", tab);
      else next.delete("tab");
      navigate({ search: next.toString() });
    },
    [navigate, searchParams],
  );

  const handleSelectConversation = useCallback(
    (selectedSessionId: string) => {
      navigate({
        search: `?sessionId=${encodeURIComponent(selectedSessionId)}`,
      });
    },
    [navigate],
  );

  const handleNewSession = useCallback(() => {
    navigate({ search: "?new=1" });
  }, [navigate]);

  const handleRenameConfirm = useCallback(
    async (title: string) => {
      if (!renameTarget) return;
      const target = renameTarget;
      setRenameTarget(null);
      try {
        await renameConversation(target.sessionId, title);
      } catch (error) {
        console.error("Failed to rename conversation", error);
      }
    },
    [renameTarget, renameConversation],
  );

  const handleDeleteConversation = useCallback(
    async (conversation: ConversationSummary) => {
      // Deleting the session that is currently open would leave the transcript
      // showing a conversation that no longer exists, so step back to the
      // empty state first.
      // Compared against the live session, not just a URL-carried one, so
      // deleting a conversation started in this tab also closes it.
      const wasOpen = conversation.sessionId === activeSessionKey;
      try {
        await removeConversation(conversation.sessionId);
        if (wasOpen) navigate({ search: "" });
      } catch (error) {
        console.error("Failed to delete conversation", error);
      }
    },
    [removeConversation, activeSessionKey, navigate],
  );

  const handleCloseConversation = useCallback(() => {
    navigate({ search: "" });
  }, [navigate]);

  const handleClearAllConversations = useCallback(async () => {
    try {
      await clearAllConversations();
      navigate({ search: "" });
    } catch (error) {
      console.error("Failed to clear conversation history", error);
    }
  }, [clearAllConversations, navigate]);

  /** The open conversation's summary, for the header's rename action. */
  const activeConversation =
    conversations.find(
      (conversation) => conversation.sessionId === activeSessionKey,
    ) ?? null;

  const handleToggleStar = useCallback(
    (conversation: ConversationSummary) => {
      void setConversationStarred(
        conversation.sessionId,
        conversation.isStarred !== true,
      ).catch((error: unknown) => {
        console.error("Failed to update star", error);
      });
    },
    [setConversationStarred],
  );

  const handleExport = useCallback(
    (format: ExportFormat) => {
      saveTranscript(format, messages, {
        title: activeConversation?.title ?? "Untitled conversation",
        sessionId: activeSessionKey,
        workingDirectory: workingDirectory ?? null,
        // Stamped at the moment of export rather than inside the serializer,
        // which stays pure so the same messages always produce the same file.
        exportedAt: Date.now(),
      });
    },
    [messages, activeConversation, activeSessionKey, workingDirectory],
  );

  /*
   * Keep the sidebar in step with the conversation being had.
   *
   * Two moments matter: the session becoming real (it should appear in the
   * list), and a turn finishing (the CLI writes an `ai-title` around then, so
   * the row's name changes from "Untitled conversation").
   *
   * The title is written asynchronously, and not reliably before the result
   * message lands — so a single refetch on completion often reads the file
   * just too early. A second pass a few seconds later catches it without
   * polling indefinitely.
   */
  const TITLE_SETTLE_MS = 3000;

  useEffect(() => {
    if (!currentSessionId) return;
    void refreshConversations();
  }, [currentSessionId, refreshConversations]);

  useEffect(() => {
    if (isLoading || !currentSessionId) return;

    void refreshConversations();
    const timer = setTimeout(
      () => void refreshConversations(),
      TITLE_SETTLE_MS,
    );
    return () => clearTimeout(timer);
  }, [isLoading, currentSessionId, refreshConversations]);

  const handleSettingsClose = useCallback(() => {
    setIsSettingsOpen(false);
  }, []);

  // Load projects to get encodedName mapping
  useEffect(() => {
    const loadProjects = async () => {
      try {
        const response = await fetch(getProjectsUrl());
        if (response.ok) {
          const data = await response.json();
          setProjects(data.projects || []);
        }
      } catch (error) {
        console.error("Failed to load projects:", error);
      }
    };
    loadProjects();
  }, []);

  const handleBackToProjects = useCallback(() => {
    navigate("/");
  }, [navigate]);

  // Handle global keyboard shortcuts
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === KEYBOARD_SHORTCUTS.ABORT && isLoading && currentRequestId) {
        e.preventDefault();
        handleAbort();
      }
    };

    document.addEventListener("keydown", handleGlobalKeyDown);
    return () => document.removeEventListener("keydown", handleGlobalKeyDown);
  }, [isLoading, currentRequestId, handleAbort]);

  return (
    /*
     * Discovery happens once here rather than in each consumer: it spawns a CLI
     * process, and both the composer's picker and the transcript's command
     * colouring need the same answer.
     */
    <SlashCommandsProvider workingDirectory={workingDirectory}>
      <div className="app-shell">
        {/* Header */}
        <HStack justify="between" vAlign="center" gap={4}>
          {/*
           * vAlign="start", not "center": the text beside the mark is a VStack
           * that grows a second row once a working directory is open, and
           * centring against that two-row block drops the mark ~16px below the
           * app name it is supposed to sit next to.
           */}
          <HStack gap={3} vAlign="start">
            {/*
             * The mark sits outside Breadcrumbs rather than inside the first
             * item: BreadcrumbItem renders a link, and burying an image in it
             * would make the click target and its accessible name inconsistent
             * with the other crumbs.
             */}
            <button
              type="button"
              className="app-mark-button"
              onClick={handleBackToProjects}
              aria-label="PDLC Studio home"
              title="PDLC Studio home"
            >
              <AppIcon size={40} variant="mark" />
            </button>
            <VStack gap={1}>
              {/*
               * Right-clicking the header renames the open conversation, the
               * same action the sidebar row offers — the header is where the
               * name is showing, so it is where people reach for it.
               */}
              <Breadcrumbs label="Breadcrumb">
                <BreadcrumbItem onClick={handleBackToProjects}>
                  <span className="app-name">PDLC Studio</span>
                </BreadcrumbItem>
              </Breadcrumbs>
            </VStack>
          </HStack>
          <HStack gap={3} vAlign="center">
            <SettingsButton onClick={handleSettingsClick} />
          </HStack>
        </HStack>

        {/* Main Content */}
        {historyError ? (
          /* Error loading conversation history */
          <div className="app-scroll">
            <Banner
              status="error"
              title="Error loading conversation"
              description={historyError}
              endContent={
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => navigate({ search: "" })}
                  label="Start new conversation"
                />
              }
            />
          </div>
        ) : (
          <div className="chat-shell">
            {workingDirectory && (
              <ConversationSidebar
                projectPath={workingDirectory}
                conversations={conversations}
                isLoading={conversationsLoading}
                error={conversationsError}
                activeSessionId={activeSessionKey}
                onSelect={handleSelectConversation}
                onNewSession={handleNewSession}
                onRefresh={() => void refreshConversations()}
                onRename={setRenameTarget}
                onDelete={(conversation) =>
                  void handleDeleteConversation(conversation)
                }
                onClose={handleCloseConversation}
                onToggleStar={handleToggleStar}
                searchTerm={conversationSearch}
                onSearchChange={setConversationSearch}
                isSearching={isSearchingConversations}
                onClearAll={() => void handleClearAllConversations()}
              />
            )}

            {!hasActiveConversation ? (
              /*
               * Nothing is open. Deliberately not an empty chat: arriving from
               * the launch screen should not start a session the user then has
               * to abandon.
               */
              <div className="app-chat-region" data-testid="no-conversation">
                <VStack justify="center" hAlign="center" height="100%" gap={3}>
                  <EmptyState
                    title="No conversation open"
                    description="Pick a conversation on the left to carry on where you left off, or start a new session."
                  />
                  <Button
                    variant="primary"
                    onClick={handleNewSession}
                    label="New Session"
                  />
                </VStack>
              </div>
            ) : historyLoading ? (
              /*
               * Scoped to the transcript pane. This used to replace the whole
               * shell, so clicking a conversation made the sidebar and the
               * conversation header vanish until the messages arrived.
               */
              <div className="app-chat-region">
                <VStack justify="center" hAlign="center" height="100%">
                  <Spinner size="lg" label="Loading conversation history..." />
                </VStack>
              </div>
            ) : (
              <div className="app-chat-region">
                {/*
                 * (3) The conversation's own header, inside the pane it belongs
                 * to. It used to sit in the page header, where it started at the
                 * far left of the window and so read as a sibling of the app
                 * name rather than as the title of what is on the right.
                 *
                 * Right-clicking it renames, the same action the sidebar row
                 * offers — this is where the name is showing.
                 */}
                {hasActiveConversation ? (
                  <ContextMenu
                    label="Conversation actions"
                    isDisabled={activeConversation === null}
                    items={[
                      {
                        label:
                          activeConversation?.isStarred === true
                            ? "Remove star"
                            : "Star conversation",
                        onClick: () =>
                          activeConversation &&
                          handleToggleStar(activeConversation),
                      },
                      {
                        label: "Rename conversation",
                        onClick: () => setRenameTarget(activeConversation),
                      },
                      {
                        label: "Close conversation",
                        onClick: handleCloseConversation,
                      },
                      { type: "divider" },
                      {
                        label: "Export as Markdown",
                        onClick: () => handleExport("markdown"),
                      },
                      {
                        label: "Export as HTML",
                        onClick: () => handleExport("html"),
                      },
                      {
                        label: "Export as PDF",
                        onClick: () => handleExport("pdf"),
                      },
                    ]}
                  >
                    <div className="conversation-header">
                      <div className="conversation-header-row">
                        <span className="conversation-header-title">
                          {activeConversation?.title ?? "Untitled conversation"}
                        </span>
                        <HStack gap={2} vAlign="center">
                          {/*
                           * Stars the conversation being read, without having
                           * to find its row in the sidebar first.
                           */}
                          {activeConversation ? (
                            <IconButton
                              onClick={() =>
                                handleToggleStar(activeConversation)
                              }
                              label={
                                activeConversation.isStarred
                                  ? "Remove star"
                                  : "Star conversation"
                              }
                              variant="ghost"
                              size="md"
                              data-testid="header-star"
                              aria-pressed={
                                activeConversation.isStarred === true
                              }
                              tooltip={
                                activeConversation.isStarred
                                  ? "Remove star"
                                  : "Star conversation"
                              }
                              icon={
                                <Icon
                                  icon={Star}
                                  color={
                                    activeConversation.isStarred
                                      ? "orange"
                                      : undefined
                                  }
                                />
                              }
                            />
                          ) : null}
                          <SegmentedControl
                            label="Conversation view"
                            size="sm"
                            value={activeTab}
                            onChange={handleTabChange}
                          >
                            <SegmentedControlItem value="chat" label="Chat" />
                            <SegmentedControlItem value="files" label="Files" />
                            <SegmentedControlItem
                              value="agents"
                              label="Agents"
                              /*
                               * `label` is a string, so the dot rides in on
                               * `icon` — the only ReactNode slot the segment
                               * offers. It marks the tab as having something
                               * live to show, and disappears with the last
                               * running agent.
                               */
                              icon={
                                runningAgentCount > 0 ? (
                                  <span
                                    className="tab-activity-dot"
                                    data-testid="agents-tab-dot"
                                    aria-hidden="true"
                                  />
                                ) : undefined
                              }
                            />
                          </SegmentedControl>
                          {/* Nothing to write out until the conversation has content. */}
                          <ExportMenu
                            onExport={handleExport}
                            isDisabled={messages.length === 0}
                          />
                        </HStack>
                      </div>
                      {/*
                       * In full: a truncated UUID cannot be matched against
                       * `claude --resume` output or a log line, which is the
                       * only reason to show it.
                       */}
                      {/* Absent until the SDK reports the id for a new session. */}
                      {activeSessionKey ? (
                        <span className="conversation-header-session">
                          {activeSessionKey}
                        </span>
                      ) : null}
                    </div>
                  </ContextMenu>
                ) : null}
                {/*
                 * Only the *content* switches per tab; the header above always
                 * renders. It carries the view toggle, so scoping it to the
                 * chat branch left Files and Agents with no way back — the
                 * control that switches tabs vanished the moment it was used.
                 */}
                {activeTab === "agents" ? (
                  <div className="app-scroll">
                    <AgentsPanel
                      activity={agentActivity}
                      workingDirectory={workingDirectory}
                      team={sessionTeam}
                      onOpenSession={handleSelectConversation}
                    />
                  </div>
                ) : activeTab === "files" ? (
                  <FilesPanel files={conversationFiles} />
                ) : (
                  <ChatLayout
                    emptyState={
                      <EmptyState
                        title="Start a conversation with Claude"
                        description="Type your message below to begin."
                      />
                    }
                    composer={
                      <>
                        {/*
                         * A long transcript can scroll a pending question out
                         * of view, and the turn cannot proceed until it is
                         * answered — so say so where the user is looking,
                         * beside the input they cannot use yet.
                         */}
                        {unansweredQuestion ? (
                          <button
                            type="button"
                            className="ask-pinned"
                            data-testid="ask-pinned"
                            onClick={() =>
                              document
                                .querySelector(
                                  '[data-testid="ask-user-question"]',
                                )
                                ?.scrollIntoView({ block: "center" })
                            }
                          >
                            Claude is waiting on your answer — show the question
                          </button>
                        ) : null}
                        <ChatInput
                          input={input}
                          isLoading={isLoading}
                          currentRequestId={currentRequestId}
                          onInputChange={setInput}
                          onSubmit={() => sendMessage()}
                          onAbort={handleAbort}
                          permissionMode={permissionMode}
                          onPermissionModeChange={setPermissionMode}
                          showPermissions={isPermissionMode}
                          permissionData={permissionData}
                          planPermissionData={planPermissionData}
                          attachments={attachments}
                          attachmentError={attachmentError}
                          isUploadingAttachments={isUploadingAttachments}
                          onAttachFiles={(files) => void addAttachments(files)}
                          onRemoveAttachment={removeAttachment}
                          contextUsage={contextUsage}
                          cliStatus={cliStatus}
                          runningAgents={runningAgentCount}
                          onShowAgents={() => handleTabChange("agents")}
                        />
                      </>
                    }
                  >
                    {messages.length > 0 || isLoading ? (
                      /*
                       * Conversation typography is scoped to the transcript, not
                       * the whole chat region: the composer is an input control and
                       * stays on the UI font, so changing the reading face never
                       * disturbs the thing you type into.
                       */
                      <div
                        className="conversation-typography"
                        data-font={conversationFont}
                        data-size={conversationFontSize}
                      >
                        <ChatMessages
                          messages={messages}
                          isLoading={isLoading}
                          answeredQuestions={questionAnswers}
                          onAnswerQuestion={answerQuestion}
                        />
                      </div>
                    ) : null}
                  </ChatLayout>
                )}
              </div>
            )}
          </div>
        )}

        {/* Settings Modal */}
        <SettingsModal isOpen={isSettingsOpen} onClose={handleSettingsClose} />

        <RenameConversationDialog
          isOpen={renameTarget !== null}
          initialTitle={renameTarget?.title ?? ""}
          onCancel={() => setRenameTarget(null)}
          onConfirm={(title) => void handleRenameConfirm(title)}
        />
      </div>
    </SlashCommandsProvider>
  );
}
