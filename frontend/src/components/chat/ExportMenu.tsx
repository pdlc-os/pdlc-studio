import { DropdownMenu } from "@astryxdesign/core/DropdownMenu";
import { Icon } from "@astryxdesign/core/Icon";
import { Download } from "lucide-react";
import type { ExportFormat } from "../../utils/exportTranscript";

interface ExportMenuProps {
  onExport: (format: ExportFormat) => void;
  /** Nothing to write out before the conversation has any content. */
  isDisabled?: boolean;
}

/**
 * Format picker for exporting the conversation.
 *
 * PDF is labelled as going through the print dialog because it does: there is
 * no browser API that writes a PDF, and a menu item that silently opened a
 * print sheet would look like the wrong thing happened.
 */
export function ExportMenu({ onExport, isDisabled = false }: ExportMenuProps) {
  return (
    <DropdownMenu
      button={{
        variant: "ghost",
        size: "sm",
        // `icon` takes an element, not a component reference.
        icon: <Icon icon={Download} size="sm" />,
        label: "Export",
        isDisabled,
      }}
      menuWidth={220}
      items={[
        {
          label: "Markdown (.md)",
          onClick: () => onExport("markdown"),
        },
        {
          label: "HTML (.html)",
          onClick: () => onExport("html"),
        },
        {
          label: "PDF (via print)",
          onClick: () => onExport("pdf"),
        },
      ]}
    />
  );
}
