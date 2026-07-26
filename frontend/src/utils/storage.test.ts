import { describe, it, expect, beforeEach, vi } from "vitest";
import { getSettings, setSettings, STORAGE_KEYS } from "./storage";
import { DEFAULT_SETTINGS } from "../types/settings";
import type { AppSettings } from "../types/settings";

/**
 * test-setup.ts installs a no-op localStorage stub, which would make every
 * read return null. Swap in a real in-memory store for these tests, since the
 * whole point is what happens to previously-stored values.
 */
function installMemoryStorage(seed?: Record<string, string>) {
  const store = new Map(Object.entries(seed ?? {}));
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
      removeItem: (key: string) => void store.delete(key),
      clear: () => store.clear(),
      key: (index: number) => [...store.keys()][index] ?? null,
      get length() {
        return store.size;
      },
    },
  });
  return store;
}

describe("getSettings", () => {
  beforeEach(() => {
    installMemoryStorage();
  });

  it("seeds defaults on a fresh profile", () => {
    const settings = getSettings();

    expect(settings.conversationFont).toBe(DEFAULT_SETTINGS.conversationFont);
    expect(settings.conversationFontSize).toBe(
      DEFAULT_SETTINGS.conversationFontSize,
    );
    expect(settings.enterBehavior).toBe(DEFAULT_SETTINGS.enterBehavior);
  });

  it("defaults the conversation to sans at the middle step", () => {
    const settings = getSettings();
    expect(settings.conversationFont).toBe("sans");
    expect(settings.conversationFontSize).toBe("md");
  });

  it("does not impose a changed default on an existing profile", () => {
    // Stored values win, so shipping a new default never overwrites a choice
    // the user already made — it only affects fresh profiles.
    installMemoryStorage({
      [STORAGE_KEYS.SETTINGS]: JSON.stringify({
        ...DEFAULT_SETTINGS,
        conversationFont: "mono",
        conversationFontSize: "sm",
      }),
    });

    const settings = getSettings();
    expect(settings.conversationFont).toBe("mono");
    expect(settings.conversationFontSize).toBe("sm");
  });

  it("follows the OS colour scheme on a fresh profile", () => {
    vi.spyOn(window, "matchMedia").mockReturnValue({
      matches: true,
    } as MediaQueryList);

    expect(getSettings().theme).toBe("dark");
  });

  it("keeps stored values over defaults", () => {
    setSettings({
      ...DEFAULT_SETTINGS,
      theme: "dark",
      conversationFont: "mono",
      conversationFontSize: "xl",
    });

    const settings = getSettings();
    expect(settings.theme).toBe("dark");
    expect(settings.conversationFont).toBe("mono");
    expect(settings.conversationFontSize).toBe("xl");
  });

  it("fills in settings a stored profile predates, without losing it", () => {
    // A profile written before the conversation settings existed. Returning it
    // as-is would hand the UI `undefined` for both new fields; discarding it
    // would throw away the user's theme. Neither is acceptable.
    const legacy = {
      theme: "dark",
      enterBehavior: "newline",
      version: 1,
    } as unknown as AppSettings;
    installMemoryStorage({
      [STORAGE_KEYS.SETTINGS]: JSON.stringify(legacy),
    });

    const settings = getSettings();

    expect(settings.theme).toBe("dark");
    expect(settings.enterBehavior).toBe("newline");
    expect(settings.conversationFont).toBe(DEFAULT_SETTINGS.conversationFont);
    expect(settings.conversationFontSize).toBe(
      DEFAULT_SETTINGS.conversationFontSize,
    );
  });

  it("falls back to defaults when the stored version is not understood", () => {
    installMemoryStorage({
      [STORAGE_KEYS.SETTINGS]: JSON.stringify({
        theme: "dark",
        version: 99,
      }),
    });

    expect(getSettings().conversationFont).toBe(
      DEFAULT_SETTINGS.conversationFont,
    );
  });

  it("survives a corrupt stored value", () => {
    installMemoryStorage({ [STORAGE_KEYS.SETTINGS]: "not json{" });

    expect(getSettings().conversationFont).toBe(
      DEFAULT_SETTINGS.conversationFont,
    );
  });
});
