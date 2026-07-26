import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { VStack } from "@astryxdesign/core/VStack";
import { Text } from "@astryxdesign/core/Text";
import { List } from "@astryxdesign/core/List";
import { Item } from "@astryxdesign/core/Item";
import { Icon } from "@astryxdesign/core/Icon";
import { Spinner } from "@astryxdesign/core/Spinner";
import { Banner } from "@astryxdesign/core/Banner";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import type { ConversationSummary } from "../../../shared/types";
import { getHistoriesUrl } from "../config/api";
import { MESSAGE_CONSTANTS } from "../utils/constants";

interface HistoryViewProps {
  workingDirectory: string;
  encodedName: string | null;
  onBack: () => void;
}

export function HistoryView({ encodedName }: HistoryViewProps) {
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadConversations = async () => {
      if (!encodedName) {
        // Keep loading state when encodedName is not available yet
        return;
      }

      try {
        setLoading(true);
        const response = await fetch(getHistoriesUrl(encodedName));

        if (!response.ok) {
          throw new Error(
            `Failed to load conversations: ${response.statusText}`,
          );
        }
        const data = await response.json();
        setConversations(data.conversations || []);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load conversations",
        );
      } finally {
        setLoading(false);
      }
    };

    loadConversations();
  }, [encodedName]);

  const handleConversationSelect = (sessionId: string) => {
    const searchParams = new URLSearchParams();
    searchParams.set("sessionId", sessionId);
    navigate({ search: searchParams.toString() });
  };

  if (loading || !encodedName) {
    return (
      <VStack
        className="app-scroll"
        gap={3}
        hAlign="center"
        justify="center"
        height="100%"
      >
        <Spinner
          size="lg"
          label={
            !encodedName ? "Loading project..." : "Loading conversations..."
          }
        />
      </VStack>
    );
  }

  if (error) {
    return (
      <div className="app-scroll">
        <Banner
          status="error"
          title="Error loading history"
          description={error}
        />
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="app-scroll">
        <EmptyState
          title="No conversations yet"
          description="Start chatting to see your conversation history here."
          icon={<Icon icon="clock" size="lg" />}
        />
      </div>
    );
  }

  return (
    <div className="app-scroll">
      <List hasDividers>
        {conversations.map((conversation) => (
          <Item
            as="li"
            key={conversation.sessionId}
            onClick={() => handleConversationSelect(conversation.sessionId)}
            align="start"
            label={`Session: ${conversation.sessionId.substring(
              0,
              MESSAGE_CONSTANTS.SESSION_ID_DISPLAY_LENGTH,
            )}...`}
            description={
              <VStack gap={1}>
                <Text type="supporting" size="xsm" color="secondary">
                  {new Date(conversation.startTime).toLocaleString()} •{" "}
                  {conversation.messageCount} messages
                </Text>
                <Text type="body" size="sm" color="secondary" maxLines={2}>
                  {conversation.lastMessagePreview}
                </Text>
              </VStack>
            }
            endContent={<Icon icon="chevronRight" color="secondary" />}
          />
        ))}
      </List>
    </div>
  );
}
