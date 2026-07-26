import { VStack } from "@astryxdesign/core/VStack";
import { Heading } from "@astryxdesign/core/Heading";
import { Switch } from "@astryxdesign/core/Switch";
import { VisuallyHidden } from "@astryxdesign/core/VisuallyHidden";
import { Moon, TerminalSquare } from "lucide-react";
import { useSettings } from "../../hooks/useSettings";

export function GeneralSettings() {
  const { theme, enterBehavior, toggleTheme, toggleEnterBehavior } =
    useSettings();

  return (
    <VStack gap={5}>
      {/* Live region for screen reader announcements */}
      <VisuallyHidden>
        <div aria-live="polite" id="settings-announcements">
          {theme === "light" ? "Light mode enabled" : "Dark mode enabled"}.{" "}
          {enterBehavior === "send"
            ? "Enter key sends messages"
            : "Enter key creates newlines"}
          .
        </div>
      </VisuallyHidden>

      <Heading level={3}>General Settings</Heading>

      {/*
       * labelPosition="start" puts the label before the control; Switch
       * defaults to "end", which reads backwards for a settings list. Paired
       * with labelSpacing="spread" it gives the conventional layout: label on
       * the left, toggle pushed to the right edge.
       */}
      <VStack gap={4}>
        <Switch
          label="Dark mode"
          description="Switch between the light and dark colour scheme."
          labelIcon={<Moon />}
          labelPosition="start"
          labelSpacing="spread"
          value={theme === "dark"}
          onChange={toggleTheme}
        />

        <Switch
          label="Enter sends message"
          description={
            enterBehavior === "send"
              ? "Enter sends message, Shift+Enter for newline"
              : "Enter adds newline, Shift+Enter sends message"
          }
          labelIcon={<TerminalSquare />}
          labelPosition="start"
          labelSpacing="spread"
          value={enterBehavior === "send"}
          onChange={toggleEnterBehavior}
        />
      </VStack>
    </VStack>
  );
}
