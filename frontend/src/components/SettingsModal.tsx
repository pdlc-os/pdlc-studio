import { Dialog } from "@astryxdesign/core/Dialog";
import { VStack } from "@astryxdesign/core/VStack";
import { HStack } from "@astryxdesign/core/HStack";
import { Heading } from "@astryxdesign/core/Heading";
import { IconButton } from "@astryxdesign/core/IconButton";
import { Icon } from "@astryxdesign/core/Icon";
import { GeneralSettings } from "./settings/GeneralSettings";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Settings modal.
 *
 * Built on Astryx's Dialog, which uses the native <dialog> element and so
 * already provides the focus trap, ESC-to-close, backdrop click, and body
 * scroll locking that this component previously implemented by hand.
 */
export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      width={560}
      maxHeight="90vh"
      padding={6}
      purpose="form"
    >
      <VStack gap={4}>
        <HStack justify="between" vAlign="center">
          <Heading level={2}>Settings</Heading>
          <IconButton
            onClick={onClose}
            label="Close settings"
            variant="ghost"
            icon={<Icon icon="close" />}
          />
        </HStack>
        {/*
         * Dialog keeps its children mounted (it renders a native <dialog>), so
         * gate the body on `isOpen`. Otherwise the settings form renders on
         * every page that mounts this modal, which also forces those pages to
         * provide the settings context even when the modal is never opened.
         */}
        {isOpen && <GeneralSettings />}
      </VStack>
    </Dialog>
  );
}
