import type { EffortLevel, ThinkingMode } from "../types";

export type Theme = "light" | "dark";
export type EnterBehavior = "send" | "newline";

/**
 * Typeface for the message transcript. Chrome and the composer are unaffected.
 *
 * Each value needs a matching `[data-font="…"]` rule in `index.css`;
 * `conversationTypography.test.ts` fails if one is missing.
 */
export type ConversationFont =
  | "serif"
  | "sans"
  | "mono"
  | "inter"
  | "helvetica"
  | "montserrat"
  | "proxima"
  | "georgia"
  | "garamond"
  | "bookman"
  | "dyslexic";

/** Transcript text scale. Maps to a multiplier in `index.css`. */
export type ConversationFontSize = "sm" | "md" | "lg" | "xl";

/**
 * Picker entries, grouped loosely sans → serif → accessibility.
 *
 * Four names are proprietary and cannot be bundled, so their stacks name the
 * real font first and fall back to a bundled OFL face. The label stays the
 * name the user asked for; `note` says what actually renders when the licensed
 * font is absent, so the substitution is visible rather than silent.
 */
export const CONVERSATION_FONTS: ReadonlyArray<{
  value: ConversationFont;
  label: string;
  note?: string;
}> = [
  { value: "sans", label: "Sans serif", note: "App default" },
  { value: "inter", label: "Inter" },
  { value: "helvetica", label: "Helvetica", note: "Arimo if unavailable" },
  { value: "montserrat", label: "Montserrat" },
  {
    value: "proxima",
    label: "Proxima Nova",
    note: "Nunito Sans if unavailable",
  },
  { value: "serif", label: "Serif" },
  { value: "georgia", label: "Georgia", note: "Gelasio if unavailable" },
  { value: "garamond", label: "Garamond", note: "EB Garamond" },
  { value: "bookman", label: "Bookman", note: "Bitter if unavailable" },
  { value: "dyslexic", label: "Dyslexic friendly", note: "OpenDyslexic" },
  { value: "mono", label: "Monospace" },
];

export const CONVERSATION_FONT_SIZES: ReadonlyArray<{
  value: ConversationFontSize;
  label: string;
}> = [
  { value: "sm", label: "Small" },
  { value: "md", label: "Medium" },
  { value: "lg", label: "Large" },
  { value: "xl", label: "Extra large" },
];

export interface AppSettings {
  theme: Theme;
  enterBehavior: EnterBehavior;
  /**
   * Generation controls for the composer.
   *
   * `model` is an id from the CLI's own list, so it can name a model a later
   * upgrade removes; the selector falls back to the default when the stored id
   * is not in the fetched list rather than sending something the CLI rejects.
   */
  model: string;
  effortLevel: EffortLevel;
  thinking: ThinkingMode;
  conversationFont: ConversationFont;
  conversationFontSize: ConversationFontSize;
  version: number;
}

export interface SettingsContextType {
  settings: AppSettings;
  theme: Theme;
  enterBehavior: EnterBehavior;
  toggleTheme: () => void;
  toggleEnterBehavior: () => void;
  conversationFont: ConversationFont;
  conversationFontSize: ConversationFontSize;
  model: string;
  effortLevel: EffortLevel;
  thinking: ThinkingMode;
  updateSettings: (updates: Partial<AppSettings>) => void;
}

// Default settings
export const DEFAULT_SETTINGS: AppSettings = {
  theme: "light",
  enterBehavior: "send",
  // "default" is a real entry in the CLI's model list — the recommended one —
  // so this is a selectable value, not a sentinel.
  model: "default",
  effortLevel: "medium",
  thinking: "adaptive",
  conversationFont: "sans",
  // Medium sits in the middle of the ladder, so the control has room in both
  // directions. The ladder itself was shifted up a step in index.css rather
  // than the default being moved off centre — the size this renders at is the
  // one that used to be Large.
  conversationFontSize: "md",
  version: 1,
};

// Current settings version for migration
export const CURRENT_SETTINGS_VERSION = 1;
