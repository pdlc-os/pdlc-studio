/**
 * The directory name a project is known by — the last segment of its path.
 *
 * Recent Projects lists working directories, which are almost always a
 * checkout, so the leaf is the repository name and is what a person actually
 * recognises. The full path stays alongside it, because several checkouts of
 * the same repo share a leaf and only the path tells them apart.
 *
 * Falls back to the path itself when there is no meaningful leaf (the
 * filesystem root, or an empty string), so the caller never has to render a
 * blank label.
 */
export function getProjectName(path: string): string {
  // Trailing separators carry no meaning here and would otherwise yield an
  // empty final segment.
  const trimmed = path.replace(/\/+$/, "");
  if (trimmed === "") return path;

  const leaf = trimmed.slice(trimmed.lastIndexOf("/") + 1);
  return leaf === "" ? path : leaf;
}
