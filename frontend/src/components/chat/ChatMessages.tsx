import { ChatMessageList } from "@astryxdesign/core/Chat";
import { AskUserQuestionCard } from "./AskUserQuestionCard";
import type { AllMessage } from "../../types";
import {
  isAskQuestionMessage,
  isChatMessage,
  isSystemMessage,
  isToolMessage,
  isToolResultMessage,
  isPlanMessage,
  isThinkingMessage,
  isTodoMessage,
} from "../../types";
import {
  ChatMessageComponent,
  SystemMessageComponent,
  ToolMessageComponent,
  ToolResultMessageComponent,
  PlanMessageComponent,
  ThinkingMessageComponent,
  TodoMessageComponent,
  LoadingComponent,
} from "../MessageComponents";

interface ChatMessagesProps {
  messages: AllMessage[];
  isLoading: boolean;
  /** Answers already given, keyed by questionId; freezes those cards. */
  answeredQuestions?: Record<string, Record<string, string>>;
  onAnswerQuestion?: (
    questionId: string,
    answers: Record<string, string>,
  ) => void;
}

/**
 * Renders the message stream.
 *
 * Scrolling, the scroll-to-bottom affordance, and the empty state are owned by
 * the surrounding <ChatLayout>, so this component only maps messages to their
 * presentational component.
 */
export function ChatMessages({
  messages,
  isLoading,
  answeredQuestions,
  onAnswerQuestion,
}: ChatMessagesProps) {
  const renderMessage = (message: AllMessage, index: number) => {
    // Use timestamp as key for stable rendering, fallback to index if needed
    const key = `${message.timestamp}-${index}`;

    if (isSystemMessage(message)) {
      return <SystemMessageComponent key={key} message={message} />;
    } else if (isToolMessage(message)) {
      return (
        <ToolMessageComponent
          key={key}
          message={message}
          isLatest={index === messages.length - 1}
          isStreaming={isLoading}
        />
      );
    } else if (isToolResultMessage(message)) {
      return <ToolResultMessageComponent key={key} message={message} />;
    } else if (isPlanMessage(message)) {
      return <PlanMessageComponent key={key} message={message} />;
    } else if (isThinkingMessage(message)) {
      return <ThinkingMessageComponent key={key} message={message} />;
    } else if (isTodoMessage(message)) {
      return <TodoMessageComponent key={key} message={message} />;
    } else if (isAskQuestionMessage(message)) {
      // Rendered here so it keeps its place between the turn that asked and
      // the turn that used the answer.
      return (
        <AskUserQuestionCard
          key={key}
          pending={message.pending}
          answered={answeredQuestions?.[message.pending.questionId]}
          onAnswer={
            answeredQuestions?.[message.pending.questionId] || !onAnswerQuestion
              ? undefined
              : (answers) =>
                  onAnswerQuestion(message.pending.questionId, answers)
          }
        />
      );
    } else if (isChatMessage(message)) {
      return <ChatMessageComponent key={key} message={message} />;
    }
    return null;
  };

  return (
    <ChatMessageList>
      {messages.map(renderMessage)}
      {isLoading && <LoadingComponent />}
    </ChatMessageList>
  );
}
