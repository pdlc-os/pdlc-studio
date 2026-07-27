import { useState } from "react";
import { Popover } from "@astryxdesign/core/Popover";
import { Button } from "@astryxdesign/core/Button";
import { Selector } from "@astryxdesign/core/Selector";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { EFFORT_LEVELS, THINKING_MODES } from "../../utils/modelOptions";
import type { EffortLevel, ModelOption, ThinkingMode } from "../../types";

interface ModelSelectorProps {
  models: ModelOption[];
  model: string;
  effortLevel: EffortLevel;
  thinking: ThinkingMode;
  onModelChange: (model: string) => void;
  onEffortChange: (effort: EffortLevel) => void;
  onThinkingChange: (thinking: ThinkingMode) => void;
  isDisabled?: boolean;
}

/**
 * Model, effort and thinking for the next message.
 *
 * The model list comes from the installed CLI rather than a hardcoded table,
 * so a model added by an upgrade appears without a change here — and each
 * model reports whether it honours effort, which is why that control can be
 * disabled rather than silently ignored.
 *
 * All three are omitted from the request unless set, so the CLI's own
 * configured defaults stand when the user has not chosen.
 */
export function ModelSelector({
  models,
  model,
  effortLevel,
  thinking,
  onModelChange,
  onEffortChange,
  onThinkingChange,
  isDisabled = false,
}: ModelSelectorProps) {
  const selected = models.find((option) => option.value === model);

  // Only an explicit `false` disables: the CLI reports the flag as undefined
  // for some models, and greying out a control that would have worked is worse
  // than offering one the model quietly ignores.
  const supportsEffort = selected?.supportsEffort !== false;
  const effortOptions = selected?.supportedEffortLevels
    ? EFFORT_LEVELS.filter((level) =>
        selected.supportedEffortLevels?.includes(level.value),
      )
    : EFFORT_LEVELS;

  const triggerLabel = selected?.displayName ?? "Model";

  /*
   * Open state is controlled so the content can be mounted only while open.
   * Popover keeps its content in the DOM otherwise, and these three Selectors
   * put four comboboxes and thirteen options into the accessibility tree —
   * all invisible, all reachable by a screen reader, for a panel that is shut.
   */
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Popover
      label="Model settings"
      isOpen={isOpen}
      onOpenChange={setIsOpen}
      content={
        !isOpen ? null : (
          <VStack gap={4} padding={4} width={280}>
            <VStack gap={1}>
              <Selector
                label="Model"
                options={models.map((option) => ({
                  value: option.value,
                  label: option.displayName,
                }))}
                value={model}
                onChange={onModelChange}
                size="sm"
              />
              {selected?.description ? (
                <Text size="xsm" color="secondary">
                  {selected.description}
                </Text>
              ) : null}
            </VStack>

            <Selector
              label="Effort"
              description={
                supportsEffort
                  ? "How much reasoning to apply."
                  : "This model does not use effort levels."
              }
              options={effortOptions.map((level) => ({
                value: level.value,
                label: level.label,
              }))}
              value={effortLevel}
              onChange={(value) => onEffortChange(value as EffortLevel)}
              isDisabled={!supportsEffort}
              size="sm"
            />

            <Selector
              label="Thinking"
              description={
                THINKING_MODES.find((mode) => mode.value === thinking)
                  ?.description
              }
              options={THINKING_MODES.map((mode) => ({
                value: mode.value,
                label: mode.label,
              }))}
              value={thinking}
              onChange={(value) => onThinkingChange(value as ThinkingMode)}
              size="sm"
            />
          </VStack>
        )
      }
    >
      <Button
        variant="ghost"
        size="sm"
        label={triggerLabel}
        data-testid="model-selector"
        isDisabled={isDisabled || models.length === 0}
        aria-label={`Model ${triggerLabel}, effort ${effortLevel}, thinking ${thinking}. Change model settings`}
      />
    </Popover>
  );
}
