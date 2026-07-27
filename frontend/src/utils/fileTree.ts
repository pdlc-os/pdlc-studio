import type { ConversationFile } from "./conversationFiles";

export interface FileTreeNode {
  /** Segment name as shown in the tree. */
  name: string;
  /** Full path; only set on files. */
  path?: string;
  /** Present on directories. */
  children?: FileTreeNode[];
  file?: ConversationFile;
}

/**
 * Groups files into a directory tree.
 *
 * Paths are made relative to `root` when they sit inside it, so a tree of one
 * project's files is not buried under a dozen levels of `/Users/...`. Files
 * outside the root keep their absolute path and appear at the top level —
 * dropping them, or forcing them under a root they do not belong to, would
 * misrepresent where they are.
 *
 * Directories sort before files, then alphabetically, which is what a file
 * explorer does and what makes a tree scannable. That is deliberately a
 * *different* order from the list view, where sequence is the point.
 */
export function buildFileTree(
  files: ConversationFile[],
  root?: string,
): FileTreeNode[] {
  const rootPrefix = root ? `${root.replace(/\/+$/, "")}/` : undefined;
  const top: FileTreeNode[] = [];

  for (const file of files) {
    const relative =
      rootPrefix && file.path.startsWith(rootPrefix)
        ? file.path.slice(rootPrefix.length)
        : file.path;

    const segments = relative.split("/").filter((segment) => segment !== "");
    if (segments.length === 0) continue;

    let level = top;
    segments.forEach((segment, index) => {
      const isLeaf = index === segments.length - 1;

      if (isLeaf) {
        level.push({ name: segment, path: file.path, file });
        return;
      }

      let dir = level.find(
        (node) => node.name === segment && node.children !== undefined,
      );
      if (!dir) {
        dir = { name: segment, children: [] };
        level.push(dir);
      }
      level = dir.children as FileTreeNode[];
    });
  }

  const sort = (nodes: FileTreeNode[]): FileTreeNode[] => {
    nodes.sort((a, b) => {
      const aDir = a.children !== undefined;
      const bDir = b.children !== undefined;
      if (aDir !== bDir) return aDir ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    for (const node of nodes) {
      if (node.children) sort(node.children);
    }
    return nodes;
  };

  return sort(top);
}
