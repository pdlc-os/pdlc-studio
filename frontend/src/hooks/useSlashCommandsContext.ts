import { useContext } from "react";
import {
  SlashCommandsContext,
  type SlashCommandsValue,
} from "../contexts/slashCommandsValue";

/** The commands discovered once for the chat view. */
export function useSlashCommandsContext(): SlashCommandsValue {
  return useContext(SlashCommandsContext);
}
