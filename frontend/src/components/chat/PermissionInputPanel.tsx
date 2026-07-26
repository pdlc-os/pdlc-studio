import type { JSX } from "react";
import { useState, useEffect, useCallback } from "react";
import { Card } from "@astryxdesign/core/Card";
import { VStack } from "@astryxdesign/core/VStack";
import { HStack } from "@astryxdesign/core/HStack";
import { Heading } from "@astryxdesign/core/Heading";
import { Text } from "@astryxdesign/core/Text";
import { Icon } from "@astryxdesign/core/Icon";
import { Code } from "@astryxdesign/core/Code";
import { Button } from "@astryxdesign/core/Button";

type PermissionOption = "allow" | "allowPermanent" | "deny";

// Helper function to extract command name from pattern like "Bash(ls:*)" -> "ls"
function extractCommandName(pattern: string): string {
  if (!pattern) return "Unknown";
  const match = pattern.match(/Bash\(([^:]+):/);
  return match ? match[1] : pattern;
}

// Helper function to render permission content based on patterns
function renderPermissionContent(patterns: string[]): JSX.Element {
  // Handle empty patterns array
  if (patterns.length === 0) {
    return (
      <Text type="body" size="sm" color="secondary">
        Claude wants to use bash commands, but the specific commands could not
        be determined.
      </Text>
    );
  }

  const isMultipleCommands = patterns.length > 1;

  if (isMultipleCommands) {
    // Extract command names from patterns like "Bash(ls:*)" -> "ls"
    const commandNames = patterns.map(extractCommandName);

    return (
      <VStack gap={2}>
        <Text type="body" size="sm" color="secondary">
          Claude wants to use the following commands:
        </Text>
        <HStack gap={2} wrap="wrap">
          {commandNames.map((cmd, index) => (
            <Code key={index}>{cmd}</Code>
          ))}
        </HStack>
      </VStack>
    );
  } else {
    const commandName = extractCommandName(patterns[0]);
    return (
      <Text type="body" size="sm" color="secondary">
        Claude wants to use the <Code>{commandName}</Code> command.
      </Text>
    );
  }
}

// Helper function to render button text for permanent permission
function renderPermanentButtonText(patterns: string[]): string {
  // Handle empty patterns array
  if (patterns.length === 0) {
    return "Yes, and don't ask again for bash commands";
  }

  const isMultipleCommands = patterns.length > 1;
  const commandNames = patterns.map(extractCommandName);

  if (isMultipleCommands) {
    return `Yes, and don't ask again for ${commandNames.join(" and ")} commands`;
  } else {
    return `Yes, and don't ask again for ${commandNames[0]} command`;
  }
}

interface PermissionInputPanelProps {
  patterns: string[];
  onAllow: () => void;
  onAllowPermanent: () => void;
  onDeny: () => void;
  // Optional extension point for custom button styling (e.g., demo effects)
  getButtonClassName?: (
    buttonType: PermissionOption,
    defaultClassName: string,
  ) => string;
  // Optional callback for demo automation to control selection state
  onSelectionChange?: (selection: PermissionOption) => void;
  // Optional external control for demo automation (overrides internal state)
  externalSelectedOption?: PermissionOption | null;
}

export function PermissionInputPanel({
  patterns,
  onAllow,
  onAllowPermanent,
  onDeny,
  getButtonClassName = (_, defaultClassName) => defaultClassName, // Default: no modification
  onSelectionChange, // Optional callback for demo automation
  externalSelectedOption, // Optional external control for demo automation
}: PermissionInputPanelProps) {
  const [selectedOption, setSelectedOption] = useState<PermissionOption | null>(
    "allow",
  );

  // Check if component is externally controlled (for demo mode)
  const isExternallyControlled = externalSelectedOption !== undefined;

  // Use external selection if provided (for demo), otherwise use internal state
  const effectiveSelectedOption = externalSelectedOption ?? selectedOption;

  // Update selection state based on external changes (for demo automation)
  const updateSelectedOption = useCallback(
    (option: PermissionOption) => {
      // Only update internal state if not controlled externally
      if (externalSelectedOption === undefined) {
        setSelectedOption(option);
      }
      onSelectionChange?.(option);
    },
    [onSelectionChange, externalSelectedOption],
  );

  // Handle keyboard navigation
  useEffect(() => {
    // Skip keyboard navigation if controlled externally (demo mode)
    if (externalSelectedOption !== undefined) return;

    // Define options array inside useEffect to avoid unnecessary re-renders
    const options = ["allow", "allowPermanent", "deny"] as const;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        const currentIndex = options.indexOf(effectiveSelectedOption!);
        const nextIndex = (currentIndex + 1) % options.length;
        updateSelectedOption(options[nextIndex]);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const currentIndex = options.indexOf(effectiveSelectedOption!);
        const prevIndex = (currentIndex - 1 + options.length) % options.length;
        updateSelectedOption(options[prevIndex]);
      } else if (e.key === "Enter" && effectiveSelectedOption) {
        e.preventDefault();
        // Execute the currently selected option
        if (effectiveSelectedOption === "allow") {
          onAllow();
        } else if (effectiveSelectedOption === "allowPermanent") {
          onAllowPermanent();
        } else if (effectiveSelectedOption === "deny") {
          onDeny();
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        onDeny(); // "Deny" option when ESC is pressed
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [
    effectiveSelectedOption,
    onAllow,
    onAllowPermanent,
    onDeny,
    updateSelectedOption,
    externalSelectedOption,
  ]);

  const clearSelectionOnLeave = () => {
    if (!isExternallyControlled) {
      setSelectedOption(null);
    }
  };

  // Selection is reflected via `variant` and `data-selected` rather than ad-hoc
  // class names, so tests and the demo harness can assert on state directly.
  const optionProps = (option: PermissionOption, action: () => void) => {
    const isSelected = effectiveSelectedOption === option;
    return {
      variant: isSelected ? ("primary" as const) : ("secondary" as const),
      "data-selected": isSelected ? "true" : "false",
      className: getButtonClassName(option, ""),
      onClick: () => {
        updateSelectedOption(option);
        action();
      },
      onFocus: () => updateSelectedOption(option),
      onBlur: clearSelectionOnLeave,
      onMouseEnter: () => updateSelectedOption(option),
      onMouseLeave: clearSelectionOnLeave,
    };
  };

  return (
    <Card padding={4}>
      <VStack gap={4}>
        {/* Header */}
        <HStack gap={2} vAlign="center">
          <Icon icon="warning" color="warning" />
          <Heading level={3}>Permission Required</Heading>
        </HStack>

        {/* Content */}
        <VStack gap={2}>
          {renderPermissionContent(patterns)}
          <Text type="supporting" size="xsm" color="secondary">
            Do you want to proceed? (Press ESC to deny)
          </Text>
        </VStack>

        {/* Direct-click permission options with selection state */}
        <VStack gap={2} width="100%">
          <Button {...optionProps("allow", onAllow)} label="Yes" />
          <Button
            {...optionProps("allowPermanent", onAllowPermanent)}
            label={renderPermanentButtonText(patterns)}
          />
          <Button {...optionProps("deny", onDeny)} label="No" />
        </VStack>
      </VStack>
    </Card>
  );
}
