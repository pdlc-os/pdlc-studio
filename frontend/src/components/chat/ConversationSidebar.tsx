import { useId } from "react";
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
  Star,
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
  onToggleStar: (conversation: ConversationSummary) => void;
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

interface ConversationRowProps {
  conversation: ConversationSummary;
  activeSessionId: string | null;
  onSelect: (sessionId: string) => void;
  onRename: (conversation: ConversationSummary) => void;
  onDelete: (conversation: ConversationSummary) => void;
  onClose: () => void;
  onToggleStar: (conversation: ConversationSummary) => void;
}

/**
 * One conversation, with every action that operates on it.
 *
 * The star is offered three ways — the icon here, the right-click menu, and
 * the conversation header — because the row you want to star is not always the
 * one that is open, and the icon is easy to miss on a narrow sidebar.
 */
function ConversationRow({
  conversation,
  activeSessionId,
  onSelect,
  onRename,
  onDelete,
  onClose,
  onToggleStar,
}: ConversationRowProps) {
  const isActive = conversation.sessionId === activeSessionId;
  const isStarred = conversation.isStarred === true;
  const label = conversationLabel(conversation);

  return (
    <ContextMenu
      label={`Actions for ${label}`}
      items={[
        {
          label: isStarred ? "Remove star" : "Star conversation",
          icon: <Icon icon={Star} />,
          onClick: () => onToggleStar(conversation),
        },
        {
          label: "Rename",
          icon: <Icon icon={Pencil} />,
          onClick: () => onRename(conversation),
        },
        {
          label: "Close",
          icon: <Icon icon={X} />,
          // Only meaningful for the conversation actually open.
          isDisabled: !isActive,
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
        data-selected={isActive ? "true" : undefined}
        data-starred={isStarred ? "true" : undefined}
      >
        <button
          type="button"
          className="conversation-item-button"
          onClick={() => onSelect(conversation.sessionId)}
          aria-current={isActive ? "true" : undefined}
        >
          <span className="conversation-item-title">{label}</span>
          <span className="conversation-item-meta">
            {/* Summaries carry ISO strings; the formatter wants epoch ms. */}
            <span>
              {formatRelativeTime(new Date(conversation.lastTime).getTime())}
            </span>
            <span aria-hidden="true">·</span>
            <span>{conversation.messageCount}</span>
          </span>
        </button>
        {/*
         * A sibling of the row button, not a child: a button inside a button
         * is invalid, and the browser would give the star's clicks to the row.
         */}
        <button
          type="button"
          className="conversation-item-star"
          data-testid="conversation-star"
          aria-pressed={isStarred}
          title={isStarred ? "Remove star" : "Star conversation"}
          onClick={() => onToggleStar(conversation)}
        >
          <Icon icon={Star} size="sm" />
          <span className="sr-only">
            {isStarred ? `Unstar ${label}` : `Star ${label}`}
          </span>
        </button>
      </li>
    </ContextMenu>
  );
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
  onToggleStar,
  onClearAll,
  searchTerm,
  onSearchChange,
  isSearching,
}: ConversationSidebarProps) {
  const starredHeadingId = useId();
  const restHeadingId = useId();

  // Partitioned rather than sorted, so a conversation is in exactly one
  // section and the server's ordering survives within each.
  const starred = conversations.filter(
    (conversation) => conversation.isStarred === true,
  );
  const rest = conversations.filter(
    (conversation) => conversation.isStarred !== true,
  );

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
          <>
            {/*
             * Starred first, and only when there are any — an empty heading
             * would be a permanent reminder of a feature the user has not used.
             * A conversation appears in exactly one section, so the same row is
             * never on screen twice.
             */}
            {starred.length > 0 ? (
              <section aria-labelledby={starredHeadingId}>
                <h2
                  className="conversation-section-heading"
                  id={starredHeadingId}
                >
                  Starred
                </h2>
                <ul className="conversation-list">
                  {starred.map((conversation) => (
                    <ConversationRow
                      key={conversation.sessionId}
                      conversation={conversation}
                      activeSessionId={activeSessionId}
                      onSelect={onSelect}
                      onRename={onRename}
                      onDelete={onDelete}
                      onClose={onClose}
                      onToggleStar={onToggleStar}
                    />
                  ))}
                </ul>
              </section>
            ) : null}

            {rest.length > 0 ? (
              <section
                aria-labelledby={starred.length > 0 ? restHeadingId : undefined}
                aria-label={starred.length > 0 ? undefined : "Conversations"}
              >
                {/* Only worth a heading once there is another section to
                    distinguish it from. */}
                {starred.length > 0 ? (
                  <h2
                    className="conversation-section-heading"
                    id={restHeadingId}
                  >
                    All conversations
                  </h2>
                ) : null}
                <ul className="conversation-list">
                  {rest.map((conversation) => (
                    <ConversationRow
                      key={conversation.sessionId}
                      conversation={conversation}
                      activeSessionId={activeSessionId}
                      onSelect={onSelect}
                      onRename={onRename}
                      onDelete={onDelete}
                      onClose={onClose}
                      onToggleStar={onToggleStar}
                    />
                  ))}
                </ul>
              </section>
            ) : null}
          </>
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
