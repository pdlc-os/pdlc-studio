import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Theme } from "@astryxdesign/core/theme";
import { LayerProvider } from "@astryxdesign/core/Layer";
import { LinkProvider } from "@astryxdesign/core/Link";
import { neutralTheme } from "@astryxdesign/theme-neutral/built";
import { useSettings } from "../hooks/useSettings";

/**
 * Applies the Astryx neutral theme and the providers its components depend on.
 *
 * Must render inside SettingsProvider: `mode` is driven by the user's stored
 * theme preference, and <Theme> is what sets `color-scheme` (which every
 * `light-dark()` token resolves against) and mirrors `data-theme` onto <html>.
 *
 * - LayerProvider backs overlay surfaces (Dialog, Tooltip, Toast viewports).
 * - LinkProvider routes Astryx links through React Router instead of full
 *   page loads.
 */
export function AstryxProvider({ children }: { children: ReactNode }) {
  const { theme } = useSettings();

  return (
    <Theme theme={neutralTheme} mode={theme}>
      <LayerProvider>
        <LinkProvider component={Link}>{children}</LinkProvider>
      </LayerProvider>
    </Theme>
  );
}
