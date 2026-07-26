import type { AppSettings, Theme } from "../types/settings";
import { DEFAULT_SETTINGS, CURRENT_SETTINGS_VERSION } from "../types/settings";

export const STORAGE_KEYS = {
  // Unified settings for the app shell.
  SETTINGS: "pdlc-studio-settings",
  // The demo route persists its own theme. Deliberately a separate key: it is
  // written on every demo theme change, and sharing a key with SETTINGS let a
  // demo visit decide the real app's theme on a fresh profile.
  DEMO_THEME: "pdlc-studio-demo-theme",
} as const;

// Type-safe storage utilities
export function getStorageItem<T>(key: string, defaultValue: T): T {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch {
    return defaultValue;
  }
}

export function setStorageItem<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Silently fail if localStorage is not available
  }
}

export function removeStorageItem(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // Silently fail if localStorage is not available
  }
}

// Settings-specific utilities
export function getSettings(): AppSettings {
  const stored = getStorageItem<AppSettings | null>(
    STORAGE_KEYS.SETTINGS,
    null,
  );

  if (stored && stored.version === CURRENT_SETTINGS_VERSION) {
    // Layered over defaults rather than returned as-is: a build that adds a
    // setting would otherwise read `undefined` from every profile written
    // before that setting existed. Adding a field is then a non-event, and
    // only a change to an existing field's meaning needs a version bump.
    return { ...createDefaultSettings(), ...stored };
  }

  // Nothing usable stored — either a first run, or a settings version this
  // build no longer understands. Seed defaults and persist them so the next
  // read is a straight hit.
  const settings = createDefaultSettings();
  setSettings(settings);
  return settings;
}

export function setSettings(settings: AppSettings): void {
  setStorageItem(STORAGE_KEYS.SETTINGS, settings);
}

function createDefaultSettings(): AppSettings {
  // Theme follows the OS preference rather than DEFAULT_SETTINGS.theme, so a
  // first-time visitor in dark mode is not flashed a light UI.
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const theme: Theme = prefersDark ? "dark" : "light";

  return { ...DEFAULT_SETTINGS, theme };
}
