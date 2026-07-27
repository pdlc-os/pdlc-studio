import React, { useState, useEffect, useCallback, useMemo } from "react";
import type { AppSettings, SettingsContextType } from "../types/settings";
import { getSettings, setSettings } from "../utils/storage";
import { SettingsContext } from "./SettingsContextTypes";

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettingsState] = useState<AppSettings>(() =>
    getSettings(),
  );
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize settings on client side (handles migration automatically)
  useEffect(() => {
    const initialSettings = getSettings();
    setSettingsState(initialSettings);
    setIsInitialized(true);
  }, []);

  // Persist settings when they change.
  //
  // Applying the theme to the document is deliberately NOT done here: the
  // Astryx <Theme> provider in AstryxProvider consumes `settings.theme` and
  // owns `color-scheme` plus the `data-theme` attribute on <html>. Setting it
  // in both places would give two sources of truth for the same attribute.
  useEffect(() => {
    if (!isInitialized) return;

    setSettings(settings);
  }, [settings, isInitialized]);

  const updateSettings = useCallback((updates: Partial<AppSettings>) => {
    setSettingsState((prev) => ({ ...prev, ...updates }));
  }, []);

  const toggleTheme = useCallback(() => {
    updateSettings({
      theme: settings.theme === "light" ? "dark" : "light",
    });
  }, [settings.theme, updateSettings]);

  const toggleEnterBehavior = useCallback(() => {
    updateSettings({
      enterBehavior: settings.enterBehavior === "send" ? "newline" : "send",
    });
  }, [settings.enterBehavior, updateSettings]);

  const value = useMemo(
    (): SettingsContextType => ({
      settings,
      theme: settings.theme,
      enterBehavior: settings.enterBehavior,
      conversationFont: settings.conversationFont,
      conversationFontSize: settings.conversationFontSize,
      model: settings.model,
      effortLevel: settings.effortLevel,
      thinking: settings.thinking,
      toggleTheme,
      toggleEnterBehavior,
      updateSettings,
    }),
    [settings, toggleTheme, toggleEnterBehavior, updateSettings],
  );

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}
