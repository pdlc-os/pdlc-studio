import React, { useRef, useEffect, useState, useMemo, useId } from "react";
import { ChatComposer } from "@astryxdesign/core/Chat";
import { TextArea } from "@astryxdesign/core/TextArea";
import { Button } from "@astryxdesign/core/Button";
import { HStack } from "@astryxdesign/core/HStack";
import { IconButton } from "@astryxdesign/core/IconButton";
import { Icon } from "@astryxdesign/core/Icon";
import { Paperclip } from "lucide-react";
import { KEYBOARD_SHORTCUTS } from "../../utils/constants";
import { useEnterBehavior } from "../../hooks/useSettings";
import { useSlashCommands } from "../../hooks/useSlashCommands";
import { useAutoResizeTextarea } from "../../hooks/useAutoResizeTextarea";
import {
  filterCommands,
  getSlashQuery,
  slashOptionId,
} from "../../utils/slashCommands";
import type { CommandMatch } from "../../utils/slashCommands";
import { PermissionInputPanel } from "./PermissionInputPanel";
import { PlanPermissionInputPanel } from "./PlanPermissionInputPanel";
import { SlashCommandMenu } from "./SlashCommandMenu";
import { ComposerHighlight } from "./ComposerHighlight";
import { AttachmentTray } from "./AttachmentTray";
import { ModelSelector } from "./ModelSelector";
import { ContextIsland } from "./ContextIsland";
import { useSettings } from "../../hooks/useSettings";
import type { AttachmentInfo, SDKStatus } from "../../types";
import type { ContextUsage } from "../../utils/contextUsage";
import type { PermissionMode } from "../../types";

interface PermissionData {
  patterns: string[];
  onAllow: () => void;
  onAllowPermanent: () => void;
  onDeny: () => void;
  getButtonClassName?: (
    buttonType: "allow" | "allowPermanent" | "deny",
    defaultClassName: string,
  ) => string;
  onSelectionChange?: (selection: "allow" | "allowPermanent" | "deny") => void;
  externalSelectedOption?: "allow" | "allowPermanent" | "deny" | null;
}

interface PlanPermissionData {
  onAcceptWithEdits: () => void;
  onAcceptDefault: () => void;
  onKeepPlanning: () => void;
  getButtonClassName?: (
    buttonType: "acceptWithEdits" | "acceptDefault" | "keepPlanning",
    defaultClassName: string,
  ) => string;
  onSelectionChange?: (
    selection: "acceptWithEdits" | "acceptDefault" | "keepPlanning",
  ) => void;
  externalSelectedOption?:
    | "acceptWithEdits"
    | "acceptDefault"
    | "keepPlanning"
    | null;
}

interface ChatInputProps {
  input: string;
  isLoading: boolean;
  currentRequestId: string | null;
  onInputChange: (value: string) => void;
  onSubmit: () => void;
  onAbort: () => void;
  // Permission mode props
  permissionMode: PermissionMode;
  onPermissionModeChange: (mode: PermissionMode) => void;
  showPermissions?: boolean;
  permissionData?: PermissionData;
  planPermissionData?: PlanPermissionData;
  /** Scopes slash-command discovery; project-local commands depend on it. */
  workingDirectory?: string;
  /** Files staged for the next message. */
  attachments?: AttachmentInfo[];
  attachmentError?: string | null;
  isUploadingAttachments?: boolean;
  onAttachFiles?: (files: File[]) => void;
  onRemoveAttachment?: (path: string) => void;
  /** Drives the composer's status island. */
  contextUsage?: ContextUsage | null;
  cliStatus?: SDKStatus;
}

/**
 * The footer's permission-mode control.
 *
 * `tag` is what shows under the composer; `description` says what the tag
 * actually means and is only used to build the accessible name. Keeping both
 * in one table stops the label and its announcement drifting apart, which is
 * how a screen reader ends up describing a mode the screen does not show.
 *
 * The visible tag is deliberately part of the accessible name too: an
 * accessible name that shares no words with the visible label breaks
 * speech-input users, who say what they can see.
 */
const PERMISSION_MODE_LABELS: Record<
  PermissionMode,
  { tag: string; description: string }
> = {
  bypassPermissions: { tag: "#YOLO", description: "bypass permissions" },
  default: { tag: "#Classic", description: "normal mode" },
  plan: { tag: "#Plan", description: "plan mode" },
  acceptEdits: { tag: "#Auto", description: "accept edits" },
};

const getPermissionModeIndicator = (mode: PermissionMode): string =>
  PERMISSION_MODE_LABELS[mode].tag;

const getPermissionModeName = (mode: PermissionMode): string =>
  PERMISSION_MODE_LABELS[mode].description;

// Get next permission mode for cycling.
// bypassPermissions is included so a user who cycles away from the default can
// get back to it without reloading the page.
const getNextPermissionMode = (current: PermissionMode): PermissionMode => {
  const modes: PermissionMode[] = [
    "default",
    "plan",
    "acceptEdits",
    "bypassPermissions",
  ];
  const currentIndex = modes.indexOf(current);
  return modes[(currentIndex + 1) % modes.length];
};

export function ChatInput({
  input,
  isLoading,
  currentRequestId,
  onInputChange,
  onSubmit,
  onAbort,
  permissionMode,
  onPermissionModeChange,
  showPermissions = false,
  permissionData,
  planPermissionData,
  workingDirectory,
  attachments = [],
  attachmentError = null,
  isUploadingAttachments = false,
  onAttachFiles,
  onRemoveAttachment,
  contextUsage = null,
  cliStatus = null,
}: ChatInputProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [isComposing, setIsComposing] = useState(false);
  const { enterBehavior } = useEnterBehavior();

  const { commands, models } = useSlashCommands(workingDirectory);
  const { model, effortLevel, thinking, updateSettings } = useSettings();
  const listboxId = useId();
  const [selectedIndex, setSelectedIndex] = useState(0);
  // Escape hides the menu without clearing the text. Keyed on the query it was
  // dismissed for, so typing another character brings it straight back rather
  // than requiring the user to clear the line.
  const [dismissedQuery, setDismissedQuery] = useState<string | null>(null);

  useAutoResizeTextarea(inputRef, input);

  const slashQuery = getSlashQuery(input);
  const matches = useMemo(
    () => (slashQuery === null ? [] : filterCommands(commands, slashQuery)),
    [commands, slashQuery],
  );

  const isMenuOpen =
    slashQuery !== null &&
    slashQuery !== dismissedQuery &&
    matches.length > 0 &&
    !isComposing &&
    !isLoading &&
    !showPermissions;

  // Ranking changes as the query narrows, so an index held over from the
  // previous keystroke could point at an unrelated command.
  useEffect(() => {
    setSelectedIndex(0);
  }, [slashQuery]);

  // Focus input when not loading and not in permission mode
  useEffect(() => {
    if (!isLoading && !showPermissions && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isLoading, showPermissions]);

  const handleInputChange = (value: string) => {
    // Any edit is a fresh intent to see the menu again.
    setDismissedQuery(null);
    onInputChange(value);
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  // dragenter/dragleave fire for every child element the pointer crosses, so a
  // boolean flickers as the cursor moves over the textarea. Counting entries
  // against leaves is what makes the highlight stable.
  const dragDepth = useRef(0);

  const canAttach = typeof onAttachFiles === "function";

  const handleDragEnter = (e: React.DragEvent) => {
    if (!canAttach || !e.dataTransfer.types.includes("Files")) return;
    e.preventDefault();
    dragDepth.current += 1;
    setIsDraggingFiles(true);
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (!canAttach || !e.dataTransfer.types.includes("Files")) return;
    // Without this the browser navigates to the dropped file instead.
    e.preventDefault();
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (!canAttach) return;
    e.preventDefault();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setIsDraggingFiles(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    if (!canAttach) return;
    e.preventDefault();
    dragDepth.current = 0;
    setIsDraggingFiles(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) onAttachFiles?.(files);
  };

  const applyCommand = (match: CommandMatch) => {
    // Trailing space both readies the line for arguments and closes the menu,
    // since the open-condition requires an unbroken /token.
    onInputChange(`/${match.command.name} `);
    setDismissedQuery(null);
    inputRef.current?.focus();
  };

  const handleMenuKeyDown = (
    e: React.KeyboardEvent<HTMLTextAreaElement>,
  ): boolean => {
    if (!isMenuOpen) return false;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((current) => (current + 1) % matches.length);
        return true;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex(
          (current) => (current - 1 + matches.length) % matches.length,
        );
        return true;
      case "Tab":
      case KEYBOARD_SHORTCUTS.SUBMIT:
        // Enter commits the highlighted command instead of sending the raw
        // text, matching every other completion menu.
        e.preventDefault();
        applyCommand(matches[selectedIndex]);
        return true;
      case KEYBOARD_SHORTCUTS.ABORT:
        // Close the menu without letting Escape reach the abort handler.
        e.preventDefault();
        e.stopPropagation();
        setDismissedQuery(slashQuery);
        return true;
      default:
        return false;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (handleMenuKeyDown(e)) {
      return;
    }

    // Permission mode toggle: Ctrl+Shift+M (all platforms)
    if (
      e.key === KEYBOARD_SHORTCUTS.PERMISSION_MODE_TOGGLE &&
      e.shiftKey &&
      e.ctrlKey &&
      !e.metaKey && // Avoid conflicts with browser shortcuts on macOS
      !isComposing
    ) {
      e.preventDefault();
      onPermissionModeChange(getNextPermissionMode(permissionMode));
      return;
    }

    if (e.key === KEYBOARD_SHORTCUTS.SUBMIT && !isComposing) {
      if (enterBehavior === "newline") {
        handleNewlineModeKeyDown(e);
      } else {
        handleSendModeKeyDown(e);
      }
    }
  };

  const handleNewlineModeKeyDown = (
    e: React.KeyboardEvent<HTMLTextAreaElement>,
  ) => {
    // Newline mode: Enter adds newline, Shift+Enter sends
    if (e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
    // Enter is handled naturally by textarea (adds newline)
  };

  const handleSendModeKeyDown = (
    e: React.KeyboardEvent<HTMLTextAreaElement>,
  ) => {
    // Send mode: Enter sends, Shift+Enter adds newline
    if (!e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
    // Shift+Enter is handled naturally by textarea (adds newline)
  };

  const handleCompositionStart = () => {
    setIsComposing(true);
  };

  const handleCompositionEnd = () => {
    // Add small delay to handle race condition between composition and keydown events
    setTimeout(() => setIsComposing(false), 0);
  };

  // If we're in plan permission mode, show the plan permission panel instead
  if (showPermissions && planPermissionData) {
    return (
      <PlanPermissionInputPanel
        onAcceptWithEdits={planPermissionData.onAcceptWithEdits}
        onAcceptDefault={planPermissionData.onAcceptDefault}
        onKeepPlanning={planPermissionData.onKeepPlanning}
        getButtonClassName={planPermissionData.getButtonClassName}
        onSelectionChange={planPermissionData.onSelectionChange}
        externalSelectedOption={planPermissionData.externalSelectedOption}
      />
    );
  }

  // If we're in regular permission mode, show the permission panel instead
  if (showPermissions && permissionData) {
    return (
      <PermissionInputPanel
        patterns={permissionData.patterns}
        onAllow={permissionData.onAllow}
        onAllowPermanent={permissionData.onAllowPermanent}
        onDeny={permissionData.onDeny}
        getButtonClassName={permissionData.getButtonClassName}
        onSelectionChange={permissionData.onSelectionChange}
        externalSelectedOption={permissionData.externalSelectedOption}
      />
    );
  }

  const isStopShown = Boolean(isLoading && currentRequestId);

  return (
    <div
      className="chat-composer-anchor"
      data-dragging={isDraggingFiles ? "true" : undefined}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {canAttach ? (
        <>
          <AttachmentTray
            attachments={attachments}
            error={attachmentError}
            onRemove={(path) => onRemoveAttachment?.(path)}
          />
          {/* The picker itself; the visible control is the footer button. */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            hidden
            data-testid="attach-input"
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              if (files.length > 0) onAttachFiles?.(files);
              // Reset so picking the same file twice still fires a change.
              e.target.value = "";
            }}
          />
        </>
      ) : null}
      {isDraggingFiles ? (
        <div className="composer-drop-hint" aria-hidden="true">
          Drop files to attach
        </div>
      ) : null}
      {isMenuOpen ? (
        <SlashCommandMenu
          matches={matches}
          selectedIndex={selectedIndex}
          onSelect={applyCommand}
          onHoverIndex={setSelectedIndex}
          listboxId={listboxId}
        />
      ) : null}
      <ChatComposer
        value={input}
        onChange={handleInputChange}
        onSubmit={onSubmit}
        onStop={onAbort}
        isStopShown={isStopShown}
        isDisabled={isLoading}
        // The default composer textarea submits on Enter unconditionally. Supply
        // our own so the configurable Enter behaviour and the Ctrl+Shift+M mode
        // shortcut keep working, and so IME composition never submits early.
        input={
          // The shell stacks the textarea and its highlight overlay; see
          // ComposerHighlight for why colouring the textarea directly is not
          // an option.
          <div className="composer-input-shell">
            <TextArea
              ref={inputRef}
              label="Message"
              isLabelHidden
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onCompositionStart={handleCompositionStart}
              onCompositionEnd={handleCompositionEnd}
              placeholder={
                isLoading && currentRequestId
                  ? "Processing..."
                  : "Type message..."
              }
              rows={1}
              isDisabled={isLoading}
              width="100%"
              // Expose the picker as a combobox so screen readers announce the
              // highlighted command as the user arrows through it.
              role="combobox"
              aria-expanded={isMenuOpen}
              aria-controls={isMenuOpen ? listboxId : undefined}
              aria-activedescendant={
                isMenuOpen ? slashOptionId(listboxId, selectedIndex) : undefined
              }
              aria-autocomplete="list"
            />
            <ComposerHighlight
              textareaRef={inputRef}
              value={input}
              commands={commands}
            />
          </div>
        }
        // Keep an explicit textual send affordance: the label doubles as the
        // active-mode indicator ("Plan" vs "Send"), which the default icon-only
        // send button cannot convey.
        sendButton={
          <HStack gap={2} vAlign="center">
            {/*
             * Outside the send/stop swap on purpose. The island reports what is
             * happening *during* a turn — compaction only ever runs mid-turn —
             * so putting it in the idle branch made that state unreachable: the
             * whole group was replaced by Stop for exactly the window the
             * island had something to say.
             */}
            <ContextIsland usage={contextUsage} status={cliStatus} />
            {isStopShown ? (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={onAbort}
                label="Stop"
                aria-label="Stop generating (ESC)"
              />
            ) : (
              <>
                <ModelSelector
                  models={models}
                  model={model}
                  effortLevel={effortLevel}
                  thinking={thinking}
                  onModelChange={(value) => updateSettings({ model: value })}
                  onEffortChange={(value) =>
                    updateSettings({ effortLevel: value })
                  }
                  onThinkingChange={(value) =>
                    updateSettings({ thinking: value })
                  }
                  isDisabled={isLoading}
                />
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={onSubmit}
                  isDisabled={!input.trim() || isLoading}
                  data-testid="send-button"
                  label={
                    isLoading
                      ? "..."
                      : permissionMode === "plan"
                        ? "Plan"
                        : "Send"
                  }
                />
              </>
            )}
          </HStack>
        }
        footerActions={
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                onPermissionModeChange(getNextPermissionMode(permissionMode))
              }
              data-testid="permission-mode-toggle"
              label={getPermissionModeIndicator(permissionMode)}
              aria-label={`${getPermissionModeIndicator(permissionMode)} — ${getPermissionModeName(permissionMode)}. Click to cycle (Ctrl+Shift+M)`}
            />
            {canAttach ? (
              <IconButton
                onClick={() => fileInputRef.current?.click()}
                label="Attach files"
                variant="ghost"
                size="sm"
                isDisabled={isLoading || isUploadingAttachments}
                data-testid="attach-files"
                icon={<Icon icon={Paperclip} />}
              />
            ) : null}
          </>
        }
      />
    </div>
  );
}
