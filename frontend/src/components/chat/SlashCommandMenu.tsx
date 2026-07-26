import { useEffect, useRef } from "react";
import { slashOptionId } from "../../utils/slashCommands";
import type { CommandMatch } from "../../utils/slashCommands";

interface SlashCommandMenuProps {
  matches: CommandMatch[];
  selectedIndex: number;
  onSelect: (match: CommandMatch) => void;
  onHoverIndex: (index: number) => void;
  /** Ties the listbox to the composer textarea for assistive tech. */
  listboxId: string;
}

/**
 * Renders a command name with a rainbow sweep across its characters.
 *
 * The gradient lives on the wrapper and is clipped to the glyphs, so it runs
 * across the whole name rather than restarting per character. Matched
 * characters are emphasised with weight instead of colour, because the name is
 * already spending its entire colour budget on the rainbow.
 */
function RainbowName({
  name,
  matchedIndices,
}: {
  name: string;
  matchedIndices: number[];
}) {
  const matched = new Set(matchedIndices);

  return (
    <span className="slash-menu-name">
      <span aria-hidden="true">/</span>
      {Array.from(name).map((char, index) => (
        <span
          key={index}
          className={matched.has(index) ? "slash-menu-char-match" : undefined}
        >
          {char}
        </span>
      ))}
    </span>
  );
}

export function SlashCommandMenu({
  matches,
  selectedIndex,
  onSelect,
  onHoverIndex,
  listboxId,
}: SlashCommandMenuProps) {
  const selectedRef = useRef<HTMLLIElement>(null);

  // Keep the active option in view when arrowing past the visible window.
  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  if (matches.length === 0) {
    return null;
  }

  return (
    <div className="slash-menu" data-testid="slash-command-menu">
      <ul className="slash-menu-list" id={listboxId} role="listbox">
        {matches.map((match, index) => {
          const isSelected = index === selectedIndex;
          const { command } = match;
          const isAliasMatch = match.matchedName !== command.name;

          return (
            <li
              key={command.name}
              ref={isSelected ? selectedRef : undefined}
              id={slashOptionId(listboxId, index)}
              role="option"
              aria-selected={isSelected}
              data-selected={isSelected ? "true" : undefined}
              className="slash-menu-item"
              // Mouse down would move focus out of the textarea before the
              // click landed, closing the menu and losing the selection.
              onMouseDown={(event) => {
                event.preventDefault();
                onSelect(match);
              }}
              onMouseEnter={() => onHoverIndex(index)}
            >
              <span className="slash-menu-row">
                <RainbowName
                  name={command.name}
                  // Alias matches highlight nothing: the indices refer to the
                  // alias, and applying them to the canonical name would bold
                  // arbitrary characters.
                  matchedIndices={isAliasMatch ? [] : match.matchedIndices}
                />
                {command.argumentHint ? (
                  <span className="slash-menu-args">
                    {command.argumentHint}
                  </span>
                ) : null}
                {isAliasMatch ? (
                  <span className="slash-menu-alias">
                    via /{match.matchedName}
                  </span>
                ) : null}
              </span>
              {command.description ? (
                <span className="slash-menu-description">
                  {command.description}
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
