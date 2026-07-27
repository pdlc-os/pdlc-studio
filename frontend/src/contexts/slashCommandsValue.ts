import { createContext } from "react";
import type { ModelOption, SlashCommandInfo } from "../types";

export interface SlashCommandsValue {
  commands: SlashCommandInfo[];
  models: ModelOption[];
  isLoading: boolean;
}

/**
 * Empty by default, so a subtree without a provider — the demo route, a test
 * rendering one component — degrades to "no command is known" rather than
 * throwing. Nothing here is load-bearing: an uncoloured command still reads
 * fine.
 *
 * Separate from the provider module so that file exports only components and
 * stays eligible for fast refresh.
 */
export const SlashCommandsContext = createContext<SlashCommandsValue>({
  commands: [],
  models: [],
  isLoading: false,
});
