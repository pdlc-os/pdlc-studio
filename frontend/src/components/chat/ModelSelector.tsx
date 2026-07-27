import { useState, useMemo } from "react";
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

  /*
   * The CLI lists the same model twice.
   *
   * `default` and `opus[1m]` arrive as separate options with identical
   * descriptions — "Default (recommended)" *is* the other entry, so the list
   * offered two ways to pick one thing. The description names the actual
   * model, so it identifies them; the first occurrence wins, which is the
   * default entry.
   */
  const uniqueModels = useMemo(() => {
    const seen = new Set<string>();
    return models.filter((option) => {
      const identity = option.description.trim().toLowerCase();
      if (identity === "") return true;
      if (seen.has(identity)) return false;
      seen.add(identity);
      return true;
    });
  }, [models]);

  /*
   * The default entry is shown as the model it resolves to, not as "Default
   * (recommended)".
   *
   * That label said nothing about what would actually answer, and appending
   * the real name to it made the trigger wide enough to crowd the composer.
   * Substituting is both shorter and more informative. Resolved by matching
   * descriptions, since the payload carries no field naming the default.
   */
  const labelFor = useMemo(() => {
    const named = new Map<string, string>();
    for (const option of models) {
      const identity = option.description.trim().toLowerCase();
      // A concrete entry names the model; the default entry does not.
      if (identity && !named.has(identity) && option.value !== "default") {
        named.set(identity, option.displayName);
      }
    }

    return (option: ModelOption) => {
      const resolved = named.get(option.description.trim().toLowerCase());
      return resolved ?? option.displayName;
    };
  }, [models]);

  const triggerLabel = selected ? labelFor(selected) : "Model";

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
                options={uniqueModels.map((option) => ({
                  value: option.value,
                  label: labelFor(option),
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
