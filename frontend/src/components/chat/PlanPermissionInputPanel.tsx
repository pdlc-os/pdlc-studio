import { useState, useEffect, useCallback } from "react";
import { Card } from "@astryxdesign/core/Card";
import { VStack } from "@astryxdesign/core/VStack";
import { Text } from "@astryxdesign/core/Text";
import { Button } from "@astryxdesign/core/Button";

type PlanOption = "acceptWithEdits" | "acceptDefault" | "keepPlanning";

interface PlanPermissionInputPanelProps {
  onAcceptWithEdits: () => void;
  onAcceptDefault: () => void;
  onKeepPlanning: () => void;
  // Optional extension point for custom button styling (e.g., demo effects)
  getButtonClassName?: (
    buttonType: PlanOption,
    defaultClassName: string,
  ) => string;
  // Optional callback for demo automation to control selection state
  onSelectionChange?: (selection: PlanOption) => void;
  // Optional external control for demo automation (overrides internal state)
  externalSelectedOption?: PlanOption | null;
}

export function PlanPermissionInputPanel({
  onAcceptWithEdits,
  onAcceptDefault,
  onKeepPlanning,
  getButtonClassName = (_, defaultClassName) => defaultClassName, // Default: no modification
  onSelectionChange, // Optional callback for demo automation
  externalSelectedOption, // Optional external control for demo automation
}: PlanPermissionInputPanelProps) {
  const [selectedOption, setSelectedOption] = useState<PlanOption | null>(
    "acceptWithEdits",
  );

  // Check if component is externally controlled (for demo mode)
  const isExternallyControlled = externalSelectedOption !== undefined;

  // Use external selection if provided (for demo), otherwise use internal state
  const effectiveSelectedOption = externalSelectedOption ?? selectedOption;

  // Update selection state based on external changes (for demo automation)
  const updateSelectedOption = useCallback(
    (option: PlanOption) => {
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
    const options = [
      "acceptWithEdits",
      "acceptDefault",
      "keepPlanning",
    ] as const;

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
        if (effectiveSelectedOption === "acceptWithEdits") {
          onAcceptWithEdits();
        } else if (effectiveSelectedOption === "acceptDefault") {
          onAcceptDefault();
        } else if (effectiveSelectedOption === "keepPlanning") {
          onKeepPlanning();
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        onKeepPlanning(); // "Keep planning" option when ESC is pressed
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [
    effectiveSelectedOption,
    onAcceptDefault,
    onAcceptWithEdits,
    onKeepPlanning,
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
  const optionProps = (option: PlanOption, action: () => void) => {
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
        {/* Content */}
        <Text type="supporting" size="xsm" color="secondary">
          Choose how to proceed (Press ESC to keep planning)
        </Text>

        {/* Permission options with selection state */}
        <VStack gap={2} width="100%">
          <Button
            {...optionProps("acceptWithEdits", onAcceptWithEdits)}
            label="Yes, and auto-accept edits"
          />
          <Button
            {...optionProps("acceptDefault", onAcceptDefault)}
            label="Yes, and manually approve edits"
          />
          <Button
            {...optionProps("keepPlanning", onKeepPlanning)}
            label="No, keep planning"
          />
        </VStack>
      </VStack>
    </Card>
  );
}
