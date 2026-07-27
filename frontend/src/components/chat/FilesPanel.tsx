import { useState } from "react";
import { Button } from "@astryxdesign/core/Button";
import { Icon } from "@astryxdesign/core/Icon";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { HStack } from "@astryxdesign/core/HStack";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import {
  SegmentedControl,
  SegmentedControlItem,
} from "@astryxdesign/core/SegmentedControl";
import {
  ChevronDown,
  ChevronRight,
  Download,
  ExternalLink,
  FileText,
  Folder,
  Paperclip,
} from "lucide-react";
import { getFileContentUrl } from "../../config/api";
import { buildFileTree, type FileTreeNode } from "../../utils/fileTree";
import type { ConversationFile } from "../../utils/conversationFiles";

interface FilesPanelProps {
  files: ConversationFile[];
  /** Required for project files: reads are confined to it server-side. */
  workingDirectory?: string;
}

/** Open and download, both served by the backend rather than the browser. */
function FileActions({
  path,
  workingDirectory,
}: {
  path: string;
  workingDirectory?: string;
}) {
  return (
    <span className="files-item-actions">
      <Button
        variant="ghost"
        size="sm"
        label="Open"
        icon={<Icon icon={ExternalLink} />}
        href={getFileContentUrl(path, { workingDirectory })}
        target="_blank"
      />
      <Button
        variant="ghost"
        size="sm"
        label="Download"
        icon={<Icon icon={Download} />}
        href={getFileContentUrl(path, { workingDirectory, download: true })}
      />
    </span>
  );
}

/** One file: name above, full path beneath in smaller, quieter type. */
function FileRow({
  file,
  workingDirectory,
  icon,
}: {
  file: ConversationFile;
  workingDirectory?: string;
  icon: typeof FileText;
}) {
  return (
    <li className="files-item" data-testid="files-item">
      <Icon icon={icon} color="secondary" size="sm" />
      <span className="files-item-text">
        <span className="files-item-name">{file.name}</span>
        <span className="files-item-path" title={file.path}>
          {file.path}
        </span>
      </span>
      <FileActions path={file.path} workingDirectory={workingDirectory} />
    </li>
  );
}

/**
 * One tree level.
 *
 * Directories start expanded: the tree exists to show where files landed, and
 * opening it to a collapsed root would hide exactly that.
 */
function TreeLevel({
  nodes,
  workingDirectory,
  depth = 0,
}: {
  nodes: FileTreeNode[];
  workingDirectory?: string;
  depth?: number;
}) {
  return (
    <ul className="files-tree-level">
      {nodes.map((node) =>
        node.children ? (
          <TreeDirectory
            key={`${node.name}-${depth}`}
            node={node}
            workingDirectory={workingDirectory}
            depth={depth}
          />
        ) : (
          <li
            key={node.path}
            className="files-tree-file"
            style={{ paddingInlineStart: `${depth * 0.9}rem` }}
            data-testid="files-item"
          >
            <Icon icon={FileText} color="secondary" size="sm" />
            <span className="files-item-text">
              <span className="files-item-name">{node.name}</span>
              <span className="files-item-path" title={node.path}>
                {node.path}
              </span>
            </span>
            <FileActions
              path={node.path as string}
              workingDirectory={workingDirectory}
            />
          </li>
        ),
      )}
    </ul>
  );
}

function TreeDirectory({
  node,
  workingDirectory,
  depth,
}: {
  node: FileTreeNode;
  workingDirectory?: string;
  depth: number;
}) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <li>
      <button
        type="button"
        className="files-tree-dir"
        style={{ paddingInlineStart: `${depth * 0.9}rem` }}
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
      >
        <Icon icon={isOpen ? ChevronDown : ChevronRight} size="sm" />
        <Icon icon={Folder} color="secondary" size="sm" />
        <span>{node.name}</span>
      </button>
      {isOpen ? (
        <TreeLevel
          nodes={node.children ?? []}
          workingDirectory={workingDirectory}
          depth={depth + 1}
        />
      ) : null}
    </li>
  );
}

/**
 * Files that passed through the conversation, split by who put them there.
 *
 * Attachments are always a flat list — they have no meaningful structure,
 * being whatever the user dropped on the composer. Generated files can be read
 * two ways, so they offer both: sequence (what Claude did, in order) or tree
 * (where it landed in the project).
 */
export function FilesPanel({ files, workingDirectory }: FilesPanelProps) {
  const [generatedView, setGeneratedView] = useState<"list" | "tree">("list");

  const uploaded = files.filter((file) => file.origin === "attached");
  const generated = files.filter((file) => file.origin === "generated");

  if (files.length === 0) {
    return (
      <div className="app-scroll" data-testid="files-panel">
        <VStack justify="center" hAlign="center" height="100%" padding={6}>
          <EmptyState
            title="No files yet"
            description="Files you attach and files Claude writes will be listed here."
          />
        </VStack>
      </div>
    );
  }

  return (
    <div className="app-scroll" data-testid="files-panel">
      <VStack gap={5} padding={3}>
        <section className="files-section" data-testid="files-uploaded">
          <Text weight="semibold">Uploaded by me</Text>
          {uploaded.length === 0 ? (
            <Text size="sm" color="secondary">
              Nothing attached in this conversation.
            </Text>
          ) : (
            <ul className="files-list">
              {uploaded.map((file) => (
                <FileRow
                  key={file.path}
                  file={file}
                  workingDirectory={workingDirectory}
                  icon={Paperclip}
                />
              ))}
            </ul>
          )}
        </section>

        <section className="files-section" data-testid="files-generated">
          <HStack justify="between" vAlign="center" gap={3}>
            <Text weight="semibold">Generated by PDLC</Text>
            {generated.length > 0 ? (
              <SegmentedControl
                label="Generated files view"
                size="sm"
                value={generatedView}
                onChange={(value) =>
                  setGeneratedView(value === "tree" ? "tree" : "list")
                }
              >
                <SegmentedControlItem value="list" label="List" />
                <SegmentedControlItem value="tree" label="Tree" />
              </SegmentedControl>
            ) : null}
          </HStack>

          {generated.length === 0 ? (
            <Text size="sm" color="secondary">
              Claude has not written any files in this conversation.
            </Text>
          ) : generatedView === "tree" ? (
            <div className="files-tree" data-testid="files-tree">
              <TreeLevel
                nodes={buildFileTree(generated, workingDirectory)}
                workingDirectory={workingDirectory}
              />
            </div>
          ) : (
            // List order is the order they were written, which the tree
            // deliberately discards in favour of location.
            <ul className="files-list" data-testid="files-generated-list">
              {generated.map((file) => (
                <FileRow
                  key={file.path}
                  file={file}
                  workingDirectory={workingDirectory}
                  icon={FileText}
                />
              ))}
            </ul>
          )}
        </section>
      </VStack>
    </div>
  );
}
