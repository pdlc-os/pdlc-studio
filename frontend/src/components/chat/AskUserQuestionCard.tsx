import { useMemo, useState } from "react";
import { Button } from "@astryxdesign/core/Button";
import { Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import type { AskQuestionPayload, PendingQuestionPayload } from "../../types";

interface AskUserQuestionCardProps {
  pending: PendingQuestionPayload;
  /** Absent once answered, which is what freezes the card. */
  onAnswer?: (answers: Record<string, string>) => void;
  /** The choice already made, when this is a historical card. */
  answered?: Record<string, string>;
}

/** The free-text escape hatch, which Claude never authors and always gets. */
const OTHER = "__other__";

/**
 * One question: its options, plus "Other".
 *
 * `multiSelect` changes the control from radio to checkbox rather than
 * rendering a different component, so the two cannot drift apart.
 */
function QuestionBlock({
  question,
  selection,
  otherText,
  onSelect,
  onOtherText,
  isFrozen,
}: {
  question: AskQuestionPayload;
  selection: string[];
  otherText: string;
  onSelect: (labels: string[]) => void;
  onOtherText: (text: string) => void;
  isFrozen: boolean;
}) {
  /*
   * A preview switches the layout to two columns, and only for single-select:
   * previews exist to compare one artifact against another, which a checkbox
   * list does not express.
   */
  const previewFor = question.multiSelect
    ? undefined
    : question.options.find(
        (option) => option.preview && selection.includes(option.label),
      )?.preview;
  const hasPreviews =
    !question.multiSelect && question.options.some((option) => option.preview);

  const toggle = (label: string) => {
    if (isFrozen) return;
    if (question.multiSelect) {
      onSelect(
        selection.includes(label)
          ? selection.filter((item) => item !== label)
          : [...selection, label],
      );
    } else {
      onSelect([label]);
    }
  };

  return (
    <div className="ask-question">
      <div className="ask-question-heading">
        <span className="ask-question-chip">{question.header}</span>
        <Text size="sm" weight="semibold">
          {question.question}
        </Text>
      </div>

      <div
        className="ask-question-body"
        data-layout={hasPreviews ? "split" : "stack"}
      >
        <ul className="ask-option-list">
          {question.options.map((option) => (
            <li key={option.label}>
              <button
                type="button"
                className="ask-option"
                data-selected={
                  selection.includes(option.label) ? "true" : undefined
                }
                aria-pressed={selection.includes(option.label)}
                disabled={isFrozen}
                onClick={() => toggle(option.label)}
              >
                <span className="ask-option-label">{option.label}</span>
                <span className="ask-option-description">
                  {option.description}
                </span>
              </button>
            </li>
          ))}

          {/*
           * Always present, never authored by Claude. A question whose four
           * options all miss would otherwise be a dead end.
           */}
          <li>
            <button
              type="button"
              className="ask-option"
              data-selected={selection.includes(OTHER) ? "true" : undefined}
              aria-pressed={selection.includes(OTHER)}
              disabled={isFrozen}
              onClick={() => toggle(OTHER)}
            >
              <span className="ask-option-label">Other</span>
              <span className="ask-option-description">
                Answer in your own words
              </span>
            </button>
          </li>
        </ul>

        {hasPreviews ? (
          <pre className="ask-question-preview">
            {previewFor ?? "Select an option to preview it."}
          </pre>
        ) : null}
      </div>

      {selection.includes(OTHER) && !isFrozen ? (
        <TextInput
          label="Your answer"
          value={otherText}
          onChange={onOtherText}
          placeholder="Type your answer"
        />
      ) : null}
    </div>
  );
}

/**
 * Claude's question, rendered where it was asked.
 *
 * The turn is blocked in a suspended tool handler while this is on screen, so
 * this card is the only thing that can move the conversation forward — which
 * is why an answered card stays visible showing what was chosen rather than
 * disappearing.
 */
export function AskUserQuestionCard({
  pending,
  onAnswer,
  answered,
}: AskUserQuestionCardProps) {
  const [selections, setSelections] = useState<Record<string, string[]>>({});
  const [otherText, setOtherText] = useState<Record<string, string>>({});
  const isFrozen = !onAnswer;

  const answers = useMemo(() => {
    const result: Record<string, string> = {};
    for (const question of pending.questions) {
      const chosen = selections[question.question] ?? [];
      const labels = chosen
        .map((label) =>
          label === OTHER ? otherText[question.question]?.trim() : label,
        )
        .filter((label): label is string => Boolean(label));
      if (labels.length > 0) result[question.question] = labels.join(", ");
    }
    return result;
  }, [pending.questions, selections, otherText]);

  // Every question needs an answer: Claude asked them together and gets them
  // back together.
  const canSubmit =
    Object.keys(answers).length === pending.questions.length && !isFrozen;

  return (
    <section
      className="ask-card"
      data-testid="ask-user-question"
      data-answered={answered ? "true" : undefined}
      aria-label="Claude is asking a question"
    >
      {pending.questions.map((question) => (
        <QuestionBlock
          key={question.question}
          question={question}
          selection={
            answered
              ? [answered[question.question] ?? ""]
              : (selections[question.question] ?? [])
          }
          otherText={otherText[question.question] ?? ""}
          isFrozen={isFrozen}
          onSelect={(labels) =>
            setSelections((current) => ({
              ...current,
              [question.question]: labels,
            }))
          }
          onOtherText={(text) =>
            setOtherText((current) => ({
              ...current,
              [question.question]: text,
            }))
          }
        />
      ))}

      {isFrozen ? (
        <Text size="xsm" color="secondary">
          Answered
        </Text>
      ) : (
        <Button
          variant="primary"
          size="sm"
          label="Submit"
          isDisabled={!canSubmit}
          data-testid="ask-submit"
          onClick={() => onAnswer?.(answers)}
        />
      )}
    </section>
  );
}
