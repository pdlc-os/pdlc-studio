import { useEffect, useState } from "react";
import { Dialog } from "@astryxdesign/core/Dialog";
import { Button } from "@astryxdesign/core/Button";
import { TextInput } from "@astryxdesign/core/TextInput";
import { Heading } from "@astryxdesign/core/Heading";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { HStack } from "@astryxdesign/core/HStack";

interface RenameConversationDialogProps {
  isOpen: boolean;
  /** Title to start from — the existing one, so a rename is an edit. */
  initialTitle: string;
  onCancel: () => void;
  onConfirm: (title: string) => void;
}

/**
 * Renames a conversation.
 *
 * The backend applies this through the SDK, so it is the same operation as the
 * CLI's `/rename`: the new name is written into the session file and shows up
 * in `claude --resume` too, not just here.
 */
export function RenameConversationDialog({
  isOpen,
  initialTitle,
  onCancel,
  onConfirm,
}: RenameConversationDialogProps) {
  const [title, setTitle] = useState(initialTitle);

  // Dialog keeps its children mounted, so the field would otherwise still hold
  // the previous conversation's name when reopened on a different row.
  useEffect(() => {
    if (isOpen) setTitle(initialTitle);
  }, [isOpen, initialTitle]);

  const trimmed = title.trim();
  const canSubmit = trimmed !== "";

  const submit = () => {
    if (canSubmit) onConfirm(trimmed);
  };

  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
      width={440}
      padding={6}
      purpose="form"
    >
      <VStack gap={4}>
        <VStack gap={1}>
          <Heading level={2}>Rename conversation</Heading>
          <Text size="sm" color="secondary">
            Same as the CLI's /rename — the new name is stored with the session.
          </Text>
        </VStack>

        <TextInput
          label="Title"
          value={title}
          onChange={setTitle}
          hasAutoFocus
          placeholder="Conversation title"
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              submit();
            }
          }}
        />

        <HStack gap={2} justify="end">
          <Button variant="secondary" onClick={onCancel} label="Cancel" />
          <Button
            variant="primary"
            onClick={submit}
            isDisabled={!canSubmit}
            data-testid="rename-confirm"
            label="Rename"
          />
        </HStack>
      </VStack>
    </Dialog>
  );
}
