import { ContextMenu } from "@astryxdesign/core/ContextMenu";
import { Button } from "@astryxdesign/core/Button";
import { IconButton } from "@astryxdesign/core/IconButton";
import { Icon } from "@astryxdesign/core/Icon";
import { Text } from "@astryxdesign/core/Text";
import { Spinner } from "@astryxdesign/core/Spinner";
import { TextInput } from "@astryxdesign/core/TextInput";
import { VStack } from "@astryxdesign/core/VStack";
import { HStack } from "@astryxdesign/core/HStack";
import {
  MessageSquare,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { getProjectName } from "../../utils/projectPath";
import { formatRelativeTime } from "../../utils/time";
import type { ConversationSummary } from "../../types";

interface ConversationSidebarProps {
  projectPath: string;
  conversations: ConversationSummary[];
  isLoading: boolean;
  error: string | null;
  /** Session currently open, or null when nothing is selected. */
  activeSessionId: string | null;
  onSelect: (sessionId: string) => void;
  onNewSession: () => void;
  onRefresh: () => void;
  onRename: (conversation: ConversationSummary) => void;
  onDelete: (conversation: ConversationSummary) => void;
  /** Closes the open conversation without deleting it. */
  onClose: () => void;
  searchTerm: string;
  onSearchChange: (term: string) => void;
  /** True when the list reflects a search rather than the whole project. */
  isSearching: boolean;
  onClearAll: () => void;
}

/**
 * The label a conversation is listed under.
 *
 * A renamed session shows its title; otherwise the generated one; otherwise the
 * first line of the last reply, which is all a never-titled session has.
 */
function conversationLabel(conversation: ConversationSummary): string {
  if (conversation.title) return conversation.title;

  const preview = conversation.lastMessagePreview.trim();
  if (preview === "" || preview === "No preview available") {
    return "Untitled conversation";
  }
  return preview.split("\n")[0];
}

/**
 * Past conversations for the open project, with the actions that operate on
 * them.
 *
 * Selection is owned by the URL rather than this component, so a conversation
 * survives a reload and the back button steps through the ones visited.
 */
export function ConversationSidebar({
  projectPath,
  conversations,
  isLoading,
  error,
  activeSessionId,
  onSelect,
  onNewSession,
  onRefresh,
  onRename,
  onDelete,
  onClose,
  onClearAll,
  searchTerm,
  onSearchChange,
  isSearching,
}: ConversationSidebarProps) {
  return (
    <aside className="conversation-sidebar" aria-label="Conversations">
      <div className="conversation-sidebar-header">
        <HStack justify="between" vAlign="center" gap={2}>
          <div className="conversation-sidebar-identity">
            <Text weight="semibold">{getProjectName(projectPath)}</Text>
            {/*
             * The full path, directly under the name it belongs to. It used to
             * sit under the app name in the page header, which read as though
             * it described the app rather than the open project.
             */}
            <span className="conversation-sidebar-path" title={projectPath}>
              {projectPath}
            </span>
          </div>
          {/*
           * Conversations are files on disk. A `claude` session started in a
           * terminal writes into the same project directory, so the list can
           * be stale through no fault of this page — this reloads it without a
           * full refresh.
           */}
          <IconButton
            onClick={onRefresh}
            label="Refresh conversations"
            variant="secondary"
            size="sm"
            isDisabled={isLoading}
            icon={<Icon icon={RefreshCw} />}
          />
        </HStack>
      </div>

      {/*
       * Right-clicking the project itself is the only route to clearing the
       * whole history; it is deliberately not a button, since it is
       * irreversible and should not sit under the pointer during normal use.
       */}
      <ContextMenu
        label="Project actions"
        items={[
          {
            label: "Clear all conversation history",
            icon: <Icon icon={Trash2} />,
            onClick: onClearAll,
            isDisabled: conversations.length === 0,
          },
        ]}
      >
        <div
          className="conversation-sidebar-project"
          data-testid="sidebar-project"
        >
          <Icon icon={MessageSquare} color="secondary" size="sm" />
          <Text size="sm" color="secondary">
            {conversations.length}{" "}
            {conversations.length === 1 ? "conversation" : "conversations"}
          </Text>
        </div>
      </ContextMenu>

      <div className="conversation-sidebar-scroll">
        {isLoading && conversations.length === 0 ? (
          <VStack gap={2} hAlign="center" justify="center" padding={5}>
            <Spinner size="sm" label="Loading conversations..." />
          </VStack>
        ) : error ? (
          <VStack gap={1} padding={4}>
            <Text size="sm" color="secondary">
              Could not load conversations.
            </Text>
            <Button
              variant="ghost"
              size="sm"
              onClick={onRefresh}
              label="Try again"
            />
          </VStack>
        ) : conversations.length === 0 ? (
          <VStack gap={1} padding={4}>
            <Text size="sm" color="secondary">
              {isSearching
                ? "No matching conversations."
                : "No conversations yet."}
            </Text>
            <Text size="xsm" color="secondary">
              {isSearching
                ? "Search looks inside every message, not just titles."
                : "Start a new session to begin."}
            </Text>
          </VStack>
        ) : (
          <ul className="conversation-list">
            {conversations.map((conversation) => (
              <ContextMenu
                key={conversation.sessionId}
                label={`Actions for ${conversationLabel(conversation)}`}
                items={[
                  {
                    label: "Rename",
                    icon: <Icon icon={Pencil} />,
                    onClick: () => onRename(conversation),
                  },
                  {
                    label: "Close",
                    icon: <Icon icon={X} />,
                    // Only meaningful for the conversation actually open.
                    isDisabled: conversation.sessionId !== activeSessionId,
                    onClick: onClose,
                  },
                  { type: "divider" },
                  {
                    label: "Delete",
                    icon: <Icon icon={Trash2} />,
                    onClick: () => onDelete(conversation),
                  },
                ]}
              >
                <li
                  className="conversation-item"
                  data-testid="conversation-item"
                  data-selected={
                    conversation.sessionId === activeSessionId
                      ? "true"
                      : undefined
                  }
                >
                  <button
                    type="button"
                    className="conversation-item-button"
                    onClick={() => onSelect(conversation.sessionId)}
                    aria-current={
                      conversation.sessionId === activeSessionId
                        ? "true"
                        : undefined
                    }
                  >
                    <span className="conversation-item-title">
                      {conversationLabel(conversation)}
                    </span>
                    <span className="conversation-item-meta">
                      {/* Summaries carry ISO strings; the formatter wants epoch ms. */}
                      <span>
                        {formatRelativeTime(
                          new Date(conversation.lastTime).getTime(),
                        )}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{conversation.messageCount}</span>
                    </span>
                  </button>
                </li>
              </ContextMenu>
            ))}
          </ul>
        )}
      </div>

      <div className="conversation-sidebar-footer">
        <TextInput
          label="Search conversations"
          isLabelHidden
          value={searchTerm}
          onChange={onSearchChange}
          placeholder="Search conversations"
          size="sm"
          hasClear
          startIcon={Search}
        />
        <Button
          variant="primary"
          size="sm"
          onClick={onNewSession}
          data-testid="new-session"
          label="New Session"
          icon={<Icon icon={Plus} />}
        />
      </div>
    </aside>
  );
}
