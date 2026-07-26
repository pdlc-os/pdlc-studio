export interface StructuredPatchHunk {
  lines: string[];
}

export interface EditToolUseResult {
  structuredPatch: StructuredPatchHunk[];
}

export interface BashToolUseResult {
  stdout: string;
  stderr: string;
  interrupted: boolean;
  isImage: boolean;
}

/**
 * Type guard functions for tool use results
 */
export function isValidHunk(hunk: unknown): hunk is StructuredPatchHunk {
  return (
    typeof hunk === "object" &&
    hunk !== null &&
    "lines" in hunk &&
    Array.isArray((hunk as Record<string, unknown>).lines)
  );
}

export function isValidStructuredPatch(
  patch: unknown,
): patch is StructuredPatchHunk[] {
  return Array.isArray(patch) && patch.every(isValidHunk);
}

export function isEditToolUseResult(
  result: unknown,
): result is EditToolUseResult {
  return (
    typeof result === "object" &&
    result !== null &&
    "structuredPatch" in result &&
    isValidStructuredPatch((result as Record<string, unknown>).structuredPatch)
  );
}

export function isBashToolUseResult(
  result: unknown,
): result is BashToolUseResult {
  return (
    typeof result === "object" &&
    result !== null &&
    "stdout" in result &&
    typeof (result as Record<string, unknown>).stdout === "string" &&
    "stderr" in result &&
    typeof (result as Record<string, unknown>).stderr === "string"
  );
}

/**
 * Simplified Edit result processor - replaces multiple complex functions
 *
 * Note: line-preview/truncation is no longer computed here. Astryx's CodeBlock
 * provides that natively via `isCollapsible` / `collapsibleThreshold`.
 */
export function createEditResult(
  structuredPatch: unknown,
  fallbackContent: string,
  autoExpandThreshold: number = 20,
): {
  details: string;
  summary: string;
  defaultExpanded: boolean;
} {
  if (!isValidStructuredPatch(structuredPatch)) {
    return {
      details: fallbackContent,
      summary: "",
      defaultExpanded: true,
    };
  }

  let addedLines = 0;
  let removedLines = 0;
  const allLines: string[] = [];

  // Process all lines from structured patch
  for (const hunk of structuredPatch) {
    for (const line of hunk.lines) {
      allLines.push(line);

      if (line.startsWith("+")) {
        addedLines++;
      } else if (line.startsWith("-")) {
        removedLines++;
      }
    }
  }

  const details = allLines.join("\n");
  const totalLines = allLines.length;
  const shouldExpand = totalLines <= autoExpandThreshold;

  let summary = "";
  if (addedLines > 0 && removedLines > 0) {
    summary = `+${addedLines}/-${removedLines} lines`;
  } else if (addedLines > 0) {
    summary = `+${addedLines} lines`;
  } else if (removedLines > 0) {
    summary = `-${removedLines} lines`;
  }

  return {
    details,
    summary,
    defaultExpanded: shouldExpand,
  };
}
