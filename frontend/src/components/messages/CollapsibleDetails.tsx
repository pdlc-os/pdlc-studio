import type { ReactNode } from "react";
import { Card } from "@astryxdesign/core/Card";
import type { CardVariant } from "@astryxdesign/core/Card";
import { Collapsible } from "@astryxdesign/core/Collapsible";
import { CodeBlock } from "@astryxdesign/core/CodeBlock";
import { HStack } from "@astryxdesign/core/HStack";
import { Text } from "@astryxdesign/core/Text";
import { Badge } from "@astryxdesign/core/Badge";

interface CollapsibleDetailsProps {
  label: string;
  details: string;
  /** Card tint used to distinguish message kinds (system, thinking, ...). */
  variant?: CardVariant;
  icon?: ReactNode;
  badge?: string;
  /** Supporting text shown beside the label, e.g. "+12/-3 lines". */
  summary?: string;
  defaultExpanded?: boolean;
  /** Language hint for syntax highlighting of the details body. */
  language?: string;
  /**
   * Lines to show before CodeBlock offers its own "show more" affordance.
   * Truncation is handled by CodeBlock rather than computed by hand.
   */
  collapsibleThreshold?: number;
}

export function CollapsibleDetails({
  label,
  details,
  variant = "gray",
  icon,
  badge,
  summary,
  defaultExpanded = false,
  language,
  collapsibleThreshold = 5,
}: CollapsibleDetailsProps) {
  const hasDetails = details.trim().length > 0;

  const trigger = (
    <HStack gap={2} vAlign="center">
      {icon}
      <Text type="label" size="xsm" weight="medium">
        {label}
      </Text>
      {badge && <Badge label={badge} variant="neutral" />}
      {summary && (
        <Text type="supporting" size="xsm" color="secondary">
          {summary}
        </Text>
      )}
    </HStack>
  );

  return (
    <Card variant={variant} padding={3}>
      {hasDetails ? (
        <Collapsible trigger={trigger} defaultIsOpen={defaultExpanded}>
          <CodeBlock
            code={details}
            language={language}
            size="sm"
            isWrapped
            isCollapsible
            collapsibleThreshold={collapsibleThreshold}
            hasCopyButton
          />
        </Collapsible>
      ) : (
        trigger
      )}
    </Card>
  );
}
