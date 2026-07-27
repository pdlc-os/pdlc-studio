import { useCallback, useEffect, useState } from "react";
import { Dialog } from "@astryxdesign/core/Dialog";
import { VStack } from "@astryxdesign/core/VStack";
import { HStack } from "@astryxdesign/core/HStack";
import { Heading } from "@astryxdesign/core/Heading";
import { Text } from "@astryxdesign/core/Text";
import { List } from "@astryxdesign/core/List";
import { Item } from "@astryxdesign/core/Item";
import { Icon } from "@astryxdesign/core/Icon";
import { Button } from "@astryxdesign/core/Button";
import { IconButton } from "@astryxdesign/core/IconButton";
import { Spinner } from "@astryxdesign/core/Spinner";
import { Banner } from "@astryxdesign/core/Banner";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { ArrowUp, Folder } from "lucide-react";
import type { BrowseDirectoriesResponse } from "../types";
import { getDirectoriesUrl } from "../config/api";

interface DirectoryPickerDialogProps {
  isOpen: boolean;
  /** Dialog title, e.g. "Open Existing Project". */
  title: string;
  /** Label for the confirm button, e.g. "Open". */
  confirmLabel: string;
  /** Directory to start in. Omit to start at the user's home directory. */
  initialPath?: string;
  onCancel: () => void;
  /** Called with the directory currently being browsed. */
  onConfirm: (path: string) => void;
}

/**
 * Directory browser.
 *
 * A browser cannot enumerate the filesystem, so this walks the tree through
 * `GET /api/directories`. The selection is always *the directory currently being
 * browsed*, which is how the native "choose a folder" dialogs behave: navigate
 * into the folder you want, then confirm. That avoids needing a separate
 * selected-vs-open state for each row.
 *
 * Shared by all three launch actions — opening a project, and picking the parent
 * directory for a new project or a clone.
 */
export function DirectoryPickerDialog({
  isOpen,
  title,
  confirmLabel,
  initialPath,
  onCancel,
  onConfirm,
}: DirectoryPickerDialogProps) {
  const [listing, setListing] = useState<BrowseDirectoriesResponse | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const browse = useCallback(async (path?: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(getDirectoriesUrl(path));
      const body = await response.json();
      if (!response.ok) {
        // The backend sends a human-readable reason for 400/403/404.
        throw new Error(body?.error ?? `Failed to browse (${response.status})`);
      }
      setListing(body as BrowseDirectoriesResponse);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to browse directory",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  // Reset to the starting directory each time the dialog opens, so a previous
  // session's location doesn't leak into the next one.
  useEffect(() => {
    if (isOpen) {
      setListing(null);
      setError(null);
      void browse(initialPath);
    }
  }, [isOpen, initialPath, browse]);

  const currentPath = listing?.path ?? initialPath ?? "";

  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
      width={620}
      maxHeight="80vh"
      padding={6}
      purpose="form"
    >
      <VStack gap={4}>
        <HStack justify="between" vAlign="center">
          <Heading level={2}>{title}</Heading>
          <IconButton
            onClick={onCancel}
            label="Close"
            variant="ghost"
            icon={<Icon icon="close" />}
            tooltip="Close"
          />
        </HStack>

        <HStack gap={2} vAlign="center">
          <IconButton
            onClick={() => {
              if (listing?.parent) void browse(listing.parent);
            }}
            label="Go to parent directory"
            variant="secondary"
            icon={<Icon icon={ArrowUp} />}
            isDisabled={!listing?.parent || loading}
            tooltip="Go to parent directory"
          />
          <Text type="code" size="sm" data-testid="picker-current-path">
            {currentPath}
          </Text>
        </HStack>

        <div
          style={{ minHeight: "16rem", maxHeight: "22rem", overflowY: "auto" }}
        >
          {loading ? (
            <VStack gap={3} hAlign="center" justify="center" height="100%">
              <Spinner size="lg" label="Loading directories..." />
            </VStack>
          ) : error ? (
            <Banner status="error" title="Cannot browse" description={error} />
          ) : listing && listing.entries.length === 0 ? (
            <EmptyState
              title="No subfolders"
              description="This folder has no subfolders. You can still choose it."
              icon={<Icon icon={Folder} size="lg" />}
            />
          ) : (
            <List hasDividers>
              {listing?.entries.map((entry) => (
                <Item
                  as="li"
                  key={entry.path}
                  data-testid="picker-entry"
                  onClick={() => void browse(entry.path)}
                  startContent={<Icon icon={Folder} color="secondary" />}
                  label={entry.name}
                  endContent={<Icon icon="chevronRight" color="secondary" />}
                />
              ))}
            </List>
          )}
        </div>

        <HStack justify="between" vAlign="center">
          <Text size="sm" color="secondary">
            {listing?.isGitRepository ? "Contains a git repository" : ""}
          </Text>
          <HStack gap={2}>
            <Button label="Cancel" variant="ghost" onClick={onCancel} />
            <Button
              label={confirmLabel}
              variant="primary"
              isDisabled={!currentPath || loading}
              onClick={() => onConfirm(currentPath)}
            />
          </HStack>
        </HStack>
      </VStack>
    </Dialog>
  );
}
