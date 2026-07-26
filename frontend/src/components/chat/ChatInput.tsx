import React, { useRef, useEffect, useState } from "react";
import { ChatComposer } from "@astryxdesign/core/Chat";
import { TextArea } from "@astryxdesign/core/TextArea";
import { Button } from "@astryxdesign/core/Button";
import { KEYBOARD_SHORTCUTS } from "../../utils/constants";
import { useEnterBehavior } from "../../hooks/useSettings";
import { PermissionInputPanel } from "./PermissionInputPanel";
import { PlanPermissionInputPanel } from "./PlanPermissionInputPanel";
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
}

// Get permission mode status indicator (CLI-style)
const getPermissionModeIndicator = (mode: PermissionMode): string => {
  switch (mode) {
    case "default":
      return "🔧 normal mode";
    case "plan":
      return "⏸ plan mode";
    case "acceptEdits":
      return "⏵⏵ accept edits";
    case "bypassPermissions":
      return "⚠ bypass permissions";
  }
};

// Get clean permission mode name (without emoji)
const getPermissionModeName = (mode: PermissionMode): string => {
  switch (mode) {
    case "default":
      return "normal mode";
    case "plan":
      return "plan mode";
    case "acceptEdits":
      return "accept edits";
    case "bypassPermissions":
      return "bypass permissions";
  }
};

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
}: ChatInputProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [isComposing, setIsComposing] = useState(false);
  const { enterBehavior } = useEnterBehavior();

  // Focus input when not loading and not in permission mode
  useEffect(() => {
    if (!isLoading && !showPermissions && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isLoading, showPermissions]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
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
    <ChatComposer
      value={input}
      onChange={onInputChange}
      onSubmit={onSubmit}
      onStop={onAbort}
      isStopShown={isStopShown}
      isDisabled={isLoading}
      // The default composer textarea submits on Enter unconditionally. Supply
      // our own so the configurable Enter behaviour and the Ctrl+Shift+M mode
      // shortcut keep working, and so IME composition never submits early.
      input={
        <TextArea
          ref={inputRef}
          label="Message"
          isLabelHidden
          value={input}
          onChange={onInputChange}
          onKeyDown={handleKeyDown}
          onCompositionStart={handleCompositionStart}
          onCompositionEnd={handleCompositionEnd}
          placeholder={
            isLoading && currentRequestId ? "Processing..." : "Type message..."
          }
          rows={1}
          isDisabled={isLoading}
          width="100%"
        />
      }
      // Keep an explicit textual send affordance: the label doubles as the
      // active-mode indicator ("Plan" vs "Send"), which the default icon-only
      // send button cannot convey.
      sendButton={
        isStopShown ? (
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={onAbort}
            label="Stop"
            aria-label="Stop generating (ESC)"
          />
        ) : (
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={onSubmit}
            isDisabled={!input.trim() || isLoading}
            data-testid="send-button"
            label={
              isLoading ? "..." : permissionMode === "plan" ? "Plan" : "Send"
            }
          />
        )
      }
      footerActions={
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            onPermissionModeChange(getNextPermissionMode(permissionMode))
          }
          data-testid="permission-mode-toggle"
          label={getPermissionModeIndicator(permissionMode)}
          aria-label={`Current: ${getPermissionModeName(permissionMode)} - Click to cycle (Ctrl+Shift+M)`}
        />
      }
    />
  );
}
