import { VStack } from "@astryxdesign/core/VStack";
import { Heading } from "@astryxdesign/core/Heading";
import { Text } from "@astryxdesign/core/Text";
import { Switch } from "@astryxdesign/core/Switch";
import { Selector } from "@astryxdesign/core/Selector";
import {
  SegmentedControl,
  SegmentedControlItem,
} from "@astryxdesign/core/SegmentedControl";
import { VisuallyHidden } from "@astryxdesign/core/VisuallyHidden";
import { Moon, TerminalSquare } from "lucide-react";
import { useSettings } from "../../hooks/useSettings";
import {
  CONVERSATION_FONTS,
  CONVERSATION_FONT_SIZES,
  type ConversationFont,
  type ConversationFontSize,
} from "../../types/settings";

export function GeneralSettings() {
  const {
    theme,
    enterBehavior,
    conversationFont,
    conversationFontSize,
    toggleTheme,
    toggleEnterBehavior,
    updateSettings,
  } = useSettings();

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

      <Heading level={3}>Conversation</Heading>

      <VStack gap={4}>
        <Selector
          label="Font"
          description="Applies to the message transcript only. Code and command output stay monospace."
          options={CONVERSATION_FONTS.map(({ value, label }) => ({
            value,
            label,
          }))}
          value={conversationFont}
          onChange={(value) =>
            updateSettings({ conversationFont: value as ConversationFont })
          }
          /*
           * Four of these names are proprietary and ship as a bundled OFL
           * substitute. Surfacing that in the row keeps the fallback honest —
           * picking "Helvetica" on a machine without it should not look like a
           * bug. SelectorOptionData carries no field for it, so the note is
           * looked up by value.
           */
          renderOption={(option) => {
            const note = CONVERSATION_FONTS.find(
              (font) => font.value === option.value,
            )?.note;
            return (
              <VStack gap={0}>
                <span>{option.label}</span>
                {note ? (
                  <Text size="xsm" color="secondary">
                    {note}
                  </Text>
                ) : null}
              </VStack>
            );
          }}
        />

        <VStack gap={2}>
          <Text size="sm">Text size</Text>
          <SegmentedControl
            label="Conversation text size"
            layout="fill"
            value={conversationFontSize}
            onChange={(value) =>
              updateSettings({
                conversationFontSize: value as ConversationFontSize,
              })
            }
          >
            {CONVERSATION_FONT_SIZES.map(({ value, label }) => (
              <SegmentedControlItem key={value} value={value} label={label} />
            ))}
          </SegmentedControl>
        </VStack>

        {/*
         * Rendered with the same classes as the transcript, so the preview is
         * the actual result rather than an approximation of it.
         */}
        <VStack gap={1}>
          <Text size="sm" color="secondary">
            Preview
          </Text>
          <div
            className="conversation-typography settings-font-preview"
            data-font={conversationFont}
            data-size={conversationFontSize}
          >
            The quick brown fox jumps over the lazy dog.
            <div>
              <code>const answer = 42;</code>
            </div>
          </div>
        </VStack>
      </VStack>
    </VStack>
  );
}
