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
import { CheckboxInput } from "@astryxdesign/core/CheckboxInput";
import { Banner } from "@astryxdesign/core/Banner";
import type { ProjectPathResponse } from "../types";
import { getCreateProjectUrl } from "../config/api";
import { DirectoryPickerDialog } from "./DirectoryPickerDialog";

interface NewProjectDialogProps {
  isOpen: boolean;
  onCancel: () => void;
  /** Called with the created directory so the caller can open it. */
  onCreated: (path: string) => void;
}

/**
 * Create a new project directory.
 *
 * Deliberately does not offer templates or language choices: this is a Claude
 * Code front end, not a project generator. It creates an empty directory
 * (optionally a git repo) and opens it — Claude can scaffold whatever is needed
 * from there, which is more flexible than a fixed template list.
 */
export function NewProjectDialog({
  isOpen,
  onCancel,
  onCreated,
}: NewProjectDialogProps) {
  const [parentPath, setParentPath] = useState("");
  const [name, setName] = useState("");
  const [initGit, setInitGit] = useState(true);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Start from a clean form each time, so a failed attempt isn't re-submitted.
  useEffect(() => {
    if (isOpen) {
      setParentPath("");
      setName("");
      setInitGit(true);
      setError(null);
      setSubmitting(false);
    }
  }, [isOpen]);

  const canSubmit = parentPath !== "" && name.trim() !== "" && !submitting;

  const handleCreate = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(getCreateProjectUrl(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parentPath, name: name.trim(), initGit }),
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body?.error ?? `Failed to create (${response.status})`);
      }
      onCreated((body as ProjectPathResponse).path);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create project");
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
        width={520}
        padding={6}
        purpose="form"
      >
        <VStack gap={4}>
          <HStack justify="between" vAlign="center">
            <Heading level={2}>Create New Project</Heading>
            <IconButton
              onClick={onCancel}
              label="Close"
              variant="ghost"
              icon={<Icon icon="close" />}
              tooltip="Close"
            />
          </HStack>

          {error && (
            <Banner
              status="error"
              title="Could not create project"
              description={error}
            />
          )}

          <VStack gap={2}>
            <Text size="sm" color="secondary">
              Location
            </Text>
            <HStack gap={2} vAlign="center">
              <Text type="code" size="sm" data-testid="new-project-parent">
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

          <TextInput
            label="Project name"
            value={name}
            onChange={setName}
            placeholder="my-project"
            isRequired
            hasAutoFocus
          />

          <CheckboxInput
            label="Initialize a git repository"
            value={initGit}
            onChange={setInitGit}
          />

          <HStack justify="end" gap={2}>
            <Button label="Cancel" variant="ghost" onClick={onCancel} />
            <Button
              label="Create"
              variant="primary"
              isDisabled={!canSubmit}
              isLoading={submitting}
              onClick={handleCreate}
            />
          </HStack>
        </VStack>
      </Dialog>

      {/*
       * Rendered as a sibling rather than nested: Astryx advises against
       * dialog-in-dialog, and the parent is hidden while the picker is open.
       */}
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
