import { useEffect, useState } from "react";
import { Dialog } from "@astryxdesign/core/Dialog";
import { VStack } from "@astryxdesign/core/VStack";
import { HStack } from "@astryxdesign/core/HStack";
import { Heading } from "@astryxdesign/core/Heading";
import { Text } from "@astryxdesign/core/Text";
import { Icon } from "@astryxdesign/core/Icon";
import { Button } from "@astryxdesign/core/Button";
import { IconButton } from "@astryxdesign/core/IconButton";
import { TextInput } from "@astryxdesign/core/TextInput";
import { Banner } from "@astryxdesign/core/Banner";
import type { ProjectPathResponse } from "../types";
import { getCloneRepositoryUrl } from "../config/api";
import { DirectoryPickerDialog } from "./DirectoryPickerDialog";

interface CloneRepositoryDialogProps {
  isOpen: boolean;
  onCancel: () => void;
  /** Called with the clone directory so the caller can open it. */
  onCloned: (path: string) => void;
}

/**
 * Clone a git repository.
 *
 * The clone runs on the backend via `git clone`; git's own stderr is surfaced
 * verbatim on failure, since "Repository not found" or an auth prompt failure is
 * far more useful to the user than a generic message.
 *
 * Cloning is synchronous from the UI's point of view — there is no progress
 * stream — so a large repository will simply sit on the spinner until git
 * finishes.
 */
export function CloneRepositoryDialog({
  isOpen,
  onCancel,
  onCloned,
}: CloneRepositoryDialogProps) {
  const [url, setUrl] = useState("");
  const [parentPath, setParentPath] = useState("");
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setUrl("");
      setParentPath("");
      setError(null);
      setSubmitting(false);
    }
  }, [isOpen]);

  const canSubmit = url.trim() !== "" && parentPath !== "" && !submitting;

  const handleClone = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(getCloneRepositoryUrl(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), parentPath }),
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body?.error ?? `Failed to clone (${response.status})`);
      }
      onCloned((body as ProjectPathResponse).path);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to clone");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Dialog
        isOpen={isOpen && !isPickerOpen}
        onOpenChange={(open) => {
          if (!open) onCancel();
        }}
        width={560}
        padding={6}
        purpose="form"
      >
        <VStack gap={4}>
          <HStack justify="between" vAlign="center">
            <Heading level={2}>Clone Git Repository</Heading>
            <IconButton
              onClick={onCancel}
              label="Close"
              variant="ghost"
              icon={<Icon icon="close" />}
            />
          </HStack>

          {error && (
            <Banner
              status="error"
              title="Could not clone repository"
              description={error}
            />
          )}

          <TextInput
            label="Repository URL"
            value={url}
            onChange={setUrl}
            placeholder="https://github.com/owner/repo.git"
            description="https, ssh, or git@host:owner/repo form."
            isRequired
            hasAutoFocus
          />

          <VStack gap={2}>
            <Text size="sm" color="secondary">
              Clone into
            </Text>
            <HStack gap={2} vAlign="center">
              <Text type="code" size="sm" data-testid="clone-parent">
                {parentPath || "No folder chosen"}
              </Text>
              <Button
                label="Choose..."
                variant="secondary"
                size="sm"
                onClick={() => setIsPickerOpen(true)}
              />
            </HStack>
          </VStack>

          <HStack justify="end" gap={2}>
            <Button label="Cancel" variant="ghost" onClick={onCancel} />
            <Button
              label="Clone"
              variant="primary"
              isDisabled={!canSubmit}
              isLoading={submitting}
              onClick={handleClone}
            />
          </HStack>
        </VStack>
      </Dialog>

      <DirectoryPickerDialog
        isOpen={isPickerOpen}
        title="Choose a Location"
        confirmLabel="Choose"
        initialPath={parentPath || undefined}
        onCancel={() => setIsPickerOpen(false)}
        onConfirm={(path) => {
          setParentPath(path);
          setIsPickerOpen(false);
        }}
      />
    </>
  );
}
