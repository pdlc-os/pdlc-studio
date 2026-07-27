import { describe, it, expect } from "vitest";
import { buildFileTree } from "./fileTree";
import type { ConversationFile } from "./conversationFiles";

function file(path: string, timestamp = 0): ConversationFile {
  return {
    path,
    name: path.split("/").pop() ?? path,
    origin: "generated",
    timestamp,
  };
}

const ROOT = "/Users/dev/proj";

describe("buildFileTree", () => {
  it("nests files under their directories", () => {
    const tree = buildFileTree(
      [file(`${ROOT}/src/utils/a.ts`), file(`${ROOT}/src/b.ts`)],
      ROOT,
    );

    expect(tree.map((n) => n.name)).toEqual(["src"]);
    const src = tree[0].children!;
    // Directory before file.
    expect(src.map((n) => n.name)).toEqual(["utils", "b.ts"]);
    expect(src[0].children!.map((n) => n.name)).toEqual(["a.ts"]);
  });

  it("strips the project root so the tree starts at the project", () => {
    const tree = buildFileTree([file(`${ROOT}/README.md`)], ROOT);
    expect(tree.map((n) => n.name)).toEqual(["README.md"]);
  });

  it("keeps files outside the root at their absolute path", () => {
    // An attachment lives in a temp directory. Forcing it under the project
    // root would claim it is somewhere it is not.
    const tree = buildFileTree([file("/tmp/upload/spec.md")], ROOT);
    const names = tree.map((n) => n.name);
    expect(names).toEqual(["tmp"]);
    expect(tree[0].children![0].children![0].path).toBe("/tmp/upload/spec.md");
  });

  it("merges files that share a directory", () => {
    const tree = buildFileTree(
      [file(`${ROOT}/src/a.ts`), file(`${ROOT}/src/b.ts`)],
      ROOT,
    );
    expect(tree).toHaveLength(1);
    expect(tree[0].children).toHaveLength(2);
  });

  it("sorts directories first, then alphabetically", () => {
    const tree = buildFileTree(
      [file(`${ROOT}/z.ts`), file(`${ROOT}/a.ts`), file(`${ROOT}/lib/c.ts`)],
      ROOT,
    );
    expect(tree.map((n) => n.name)).toEqual(["lib", "a.ts", "z.ts"]);
  });

  it("carries the file through so rows keep their actions", () => {
    const tree = buildFileTree([file(`${ROOT}/a.ts`, 42)], ROOT);
    expect(tree[0].file?.timestamp).toBe(42);
    expect(tree[0].path).toBe(`${ROOT}/a.ts`);
  });

  it("returns nothing for no files", () => {
    expect(buildFileTree([], ROOT)).toEqual([]);
  });
});
