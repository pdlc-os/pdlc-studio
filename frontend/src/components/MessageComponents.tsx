import { ChatMessage } from "@astryxdesign/core/Chat";
import { ChatMessageBubble } from "@astryxdesign/core/Chat";
import { ChatMessageMetadata } from "@astryxdesign/core/Chat";
import { ChatToolCalls } from "@astryxdesign/core/Chat";
import type { ChatToolCallItem } from "@astryxdesign/core/Chat";
import { CodeBlock } from "@astryxdesign/core/CodeBlock";
import { languageFromPath } from "../utils/codeLanguage";
import { Markdown } from "@astryxdesign/core/Markdown";
import { Card } from "@astryxdesign/core/Card";
import { VStack } from "@astryxdesign/core/VStack";
import { HStack } from "@astryxdesign/core/HStack";
import { Text } from "@astryxdesign/core/Text";
import { Icon } from "@astryxdesign/core/Icon";
import { Spinner } from "@astryxdesign/core/Spinner";
import { List } from "@astryxdesign/core/List";
import { Item } from "@astryxdesign/core/Item";
import type {
  ChatMessage as ChatMessageType,
  SystemMessage,
  ToolMessage,
  ToolResultMessage,
  PlanMessage,
  ThinkingMessage,
  TodoMessage,
  TodoItem,
  HooksMessage,
} from "../types";
import { TimestampComponent } from "./TimestampComponent";
import { CollapsibleDetails } from "./messages/CollapsibleDetails";
import { MESSAGE_CONSTANTS } from "../utils/constants";
import {
  createEditResult,
  isEditToolUseResult,
  isBashToolUseResult,
} from "../utils/contentUtils";

// ANSI escape sequence regex for cleaning hooks messages
const ANSI_REGEX = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "g");

// Type guard to check if the message is a hooks message
function isHooksMessage(
  msg: SystemMessage,
): msg is HooksMessage & { timestamp: number } {
  return (
    msg.type === "system" &&
    "content" in msg &&
    typeof msg.content === "string" &&
    !("subtype" in msg)
  );
}

interface ChatMessageComponentProps {
  message: ChatMessageType;
}

export function ChatMessageComponent({ message }: ChatMessageComponentProps) {
  const isUser = message.role === "user";

  return (
    <ChatMessage
      sender={isUser ? "user" : "assistant"}
      name={isUser ? "User" : "Claude"}
      metadata={
        <ChatMessageMetadata
          timestamp={<TimestampComponent timestamp={message.timestamp} />}
        />
      }
    >
      {isUser ? (
        <ChatMessageBubble>{message.content}</ChatMessageBubble>
      ) : (
        // Assistant output is markdown from the SDK; render it as such rather
        // than as preformatted text.
        <Markdown>{message.content}</Markdown>
      )}
    </ChatMessage>
  );
}

interface SystemMessageComponentProps {
  message: SystemMessage;
}

export function SystemMessageComponent({
  message,
}: SystemMessageComponentProps) {
  // Generate details based on message type and subtype
  const getDetails = () => {
    if (
      message.type === "system" &&
      "subtype" in message &&
      message.subtype === "init"
    ) {
      return [
        `Model: ${message.model}`,
        `Session: ${message.session_id.substring(0, MESSAGE_CONSTANTS.SESSION_ID_DISPLAY_LENGTH)}`,
        `Tools: ${message.tools.length} available`,
        `CWD: ${message.cwd}`,
        `Permission Mode: ${message.permissionMode}`,
        `API Key Source: ${message.apiKeySource}`,
      ].join("\n");
    } else if (message.type === "result") {
      const details = [
        `Duration: ${message.duration_ms}ms`,
        `Cost: $${message.total_cost_usd.toFixed(4)}`,
        `Tokens: ${message.usage.input_tokens} in, ${message.usage.output_tokens} out`,
      ];
      return details.join("\n");
    } else if (message.type === "error") {
      return message.message;
    } else if (isHooksMessage(message)) {
      // This is a hooks message - show only the content
      // Remove ANSI escape sequences for cleaner display
      return message.content.replace(ANSI_REGEX, "");
    }
    return JSON.stringify(message, null, 2);
  };

  // Get label based on message type
  const getLabel = () => {
    if (message.type === "system") return "System";
    if (message.type === "result") return "Result";
    if (message.type === "error") return "Error";
    return "Message";
  };

  const isError = message.type === "error";

  return (
    <CollapsibleDetails
      label={getLabel()}
      details={getDetails()}
      badge={"subtype" in message ? message.subtype : undefined}
      variant={isError ? "red" : "blue"}
      icon={<Icon icon={isError ? "error" : "info"} size="sm" />}
    />
  );
}

interface ToolMessageComponentProps {
  message: ToolMessage;
}

export function ToolMessageComponent({ message }: ToolMessageComponentProps) {
  return (
    <ChatMessage sender="assistant">
      <ChatToolCalls calls={[{ name: message.content, status: "running" }]} />
    </ChatMessage>
  );
}

interface ToolResultMessageComponentProps {
  message: ToolResultMessage;
}

export function ToolResultMessageComponent({
  message,
}: ToolResultMessageComponentProps) {
  const toolUseResult = message.toolUseResult;

  let displayContent = message.content;
  let stats: string | undefined;
  let defaultExpanded = false;
  let status: ChatToolCallItem["status"] = "complete";
  let errorMessage: string | undefined;
  let language: string | undefined;

  // Edit results carry a structured patch; surface it as a diff.
  if (message.toolName === "Edit" && isEditToolUseResult(toolUseResult)) {
    const editResult = createEditResult(
      toolUseResult.structuredPatch,
      message.content,
      20, // autoExpandThreshold: auto-expand if 20 lines or fewer
    );
    displayContent = editResult.details;
    stats = editResult.summary;
    defaultExpanded = editResult.defaultExpanded;
    language = "diff";
  }

  // Bash results split stdout/stderr; a non-empty stderr means the call failed.
  else if (message.toolName === "Bash" && isBashToolUseResult(toolUseResult)) {
    const stderr = toolUseResult.stderr?.trim();
    if (stderr) {
      status = "error";
      errorMessage = stderr;
    }
    displayContent = toolUseResult.stdout || message.content;
    language = "bash";
  }

  /*
   * Everything else — a Read of a source file, a Write's echo — falls back to
   * the file's own extension. Without this those blocks render as plaintext,
   * which is most of the code this app shows.
   */
  if (!language) {
    language = languageFromPath(message.filePath);
  }

  const call: ChatToolCallItem = {
    name: message.toolName,
    status,
    target: message.toolName === "Edit" ? undefined : message.summary,
    stats,
    errorMessage,
    resultDetail: displayContent.trim() ? (
      <CodeBlock
        code={displayContent}
        language={language}
        size="sm"
        isWrapped
        isCollapsible
        collapsibleThreshold={message.toolName === "Edit" ? 20 : 5}
        maxHeight="50vh"
        hasCopyButton
      />
    ) : undefined,
  };

  return (
    <ChatMessage sender="assistant">
      <ChatToolCalls calls={[call]} defaultIsExpanded={defaultExpanded} />
    </ChatMessage>
  );
}

interface PlanMessageComponentProps {
  message: PlanMessage;
}

export function PlanMessageComponent({ message }: PlanMessageComponentProps) {
  return (
    <ChatMessage
      sender="assistant"
      metadata={
        <ChatMessageMetadata
          timestamp={<TimestampComponent timestamp={message.timestamp} />}
        />
      }
    >
      <Card variant="blue" padding={4}>
        <VStack gap={3}>
          <HStack gap={2} vAlign="center">
            <Icon icon="check" size="sm" color="accent" />
            <Text type="label" size="sm" weight="semibold">
              Ready to code?
            </Text>
          </HStack>
          <Text type="body" size="sm" color="secondary">
            Here is Claude's plan:
          </Text>
          <Markdown>{message.plan}</Markdown>
        </VStack>
      </Card>
    </ChatMessage>
  );
}

interface ThinkingMessageComponentProps {
  message: ThinkingMessage;
}

export function ThinkingMessageComponent({
  message,
}: ThinkingMessageComponentProps) {
  return (
    <CollapsibleDetails
      label="Claude's Reasoning"
      details={message.content}
      badge="thinking"
      variant="purple"
      icon={<Icon icon="info" size="sm" />}
      defaultExpanded={true}
      collapsibleThreshold={20}
    />
  );
}

interface TodoMessageComponentProps {
  message: TodoMessage;
}

const TODO_STATUS: Record<
  TodoItem["status"],
  { icon: "success" | "clock" | "check"; label: string }
> = {
  completed: { icon: "success", label: "Completed" },
  in_progress: { icon: "clock", label: "In progress" },
  pending: { icon: "check", label: "Pending" },
};

export function TodoMessageComponent({ message }: TodoMessageComponentProps) {
  const completedCount = message.todos.filter(
    (t) => t.status === "completed",
  ).length;

  return (
    <ChatMessage
      sender="assistant"
      metadata={
        <ChatMessageMetadata
          timestamp={<TimestampComponent timestamp={message.timestamp} />}
        />
      }
    >
      <Card variant="yellow" padding={4}>
        <VStack gap={3}>
          <Text type="label" size="sm" weight="semibold">
            Todo List Updated
          </Text>
          <List density="compact">
            {message.todos.map((todo, index) => {
              const status = TODO_STATUS[todo.status] ?? TODO_STATUS.pending;
              return (
                <Item
                  as="li"
                  key={index}
                  startContent={
                    <Icon icon={status.icon} size="sm" label={status.label} />
                  }
                  label={todo.content}
                  description={
                    todo.status === "in_progress" ? todo.activeForm : undefined
                  }
                  density="compact"
                />
              );
            })}
          </List>
          <Text type="supporting" size="xsm" color="secondary">
            {completedCount} of {message.todos.length} completed
          </Text>
        </VStack>
      </Card>
    </ChatMessage>
  );
}

export function LoadingComponent() {
  return (
    <ChatMessage sender="assistant" name="Claude">
      <ChatMessageBubble variant="ghost">
        <HStack gap={2} vAlign="center">
          <Spinner size="sm" />
          <Text type="body" size="sm" color="secondary">
            Thinking...
          </Text>
        </HStack>
      </ChatMessageBubble>
    </ChatMessage>
  );
}
