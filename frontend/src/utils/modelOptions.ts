import type { EffortLevel, ThinkingMode } from "../types";

/**
 * Labels for the composer's generation controls.
 *
 * Kept out of the component file so it exports only a component — exporting
 * constants alongside one breaks fast refresh.
 *
 * The effort ladder mirrors the SDK's EffortLevel. Which of these a given
 * model actually honours comes from the CLI at runtime
 * (`ModelOption.supportedEffortLevels`), not from this list.
 */
export const EFFORT_LEVELS: ReadonlyArray<{
  value: EffortLevel;
  label: string;
}> = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "xhigh", label: "Extra high" },
  { value: "max", label: "Max" },
];

export const THINKING_MODES: ReadonlyArray<{
  value: ThinkingMode;
  label: string;
  description: string;
}> = [
  {
    value: "adaptive",
    label: "Adaptive",
    description: "Claude decides how much to think",
  },
  {
    value: "enabled",
    label: "On",
    description: "Always think before replying",
  },
  { value: "disabled", label: "Off", description: "No extended thinking" },
];
