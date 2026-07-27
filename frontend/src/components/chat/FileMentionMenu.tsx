import { useEffect, useRef } from "react";
import { attachmentName } from "../../utils/fileMentions";
import { slashOptionId } from "../../utils/slashCommands";
import type { AttachmentInfo } from "../../types";

interface FileMentionMenuProps {
  matches: AttachmentInfo[];
  selectedIndex: number;
  onSelect: (attachment: AttachmentInfo) => void;
  onHoverIndex: (index: number) => void;
  /** Ties the listbox to the composer textarea for assistive tech. */
  listboxId: string;
}

/**
 * The attachments a typed `@` can refer to.
 *
 * Deliberately the same shape and keyboard model as the `/` picker: both are
 * completion menus over the composer, and two menus that behaved differently
 * in the same text box would be a worse surprise than either is a feature.
 */
export function FileMentionMenu({
  matches,
  selectedIndex,
  onSelect,
  onHoverIndex,
  listboxId,
}: FileMentionMenuProps) {
  const listRef = useRef<HTMLUListElement>(null);

  // Keyboard selection can move out of view in a scrolled list.
  useEffect(() => {
    const option = listRef.current?.children[selectedIndex];
    option?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  return (
    <ul
      ref={listRef}
      className="slash-menu"
      id={listboxId}
      role="listbox"
      aria-label="Attached files"
    >
      {matches.map((attachment, index) => (
        <li
          key={attachment.path}
          id={slashOptionId(listboxId, index)}
          role="option"
          aria-selected={index === selectedIndex}
          className="slash-menu-option"
          data-selected={index === selectedIndex ? "true" : undefined}
          // Pointer down rather than click: the textarea must not lose focus
          // before the selection is applied.
          onMouseDown={(event) => {
            event.preventDefault();
            onSelect(attachment);
          }}
          onMouseEnter={() => onHoverIndex(index)}
        >
          <span className="mention-menu-name">
            <span aria-hidden="true">@</span>
            {attachmentName(attachment)}
          </span>
          {/*
           * The directory, so two files with the same name are still tellable
           * apart in the list itself.
           */}
          <span className="slash-menu-description">
            {attachment.path.slice(0, attachment.path.lastIndexOf("/")) || "/"}
          </span>
        </li>
      ))}
    </ul>
  );
}
