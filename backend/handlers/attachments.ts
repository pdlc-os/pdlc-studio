import { Context } from "hono";
import { basename, resolve } from "node:path";
import type {
  AttachmentInfo,
  UploadAttachmentsResponse,
} from "../../shared/types.ts";
import { logger } from "../utils/logger.ts";
import {
  makeTempDir,
  writeBinaryFile,
  readBinaryFile,
  stat,
  getTempRoot,
} from "../utils/fs.ts";

/** Per-file ceiling. Large enough for a design or a PDF, small enough that a
 * mis-drop of a video does not fill the disk. */
const MAX_FILE_BYTES = 25 * 1024 * 1024;

/** Ceiling on one upload, so many medium files cannot bypass the per-file cap. */
const MAX_TOTAL_BYTES = 100 * 1024 * 1024;

const MAX_FILES = 20;

const TEMP_PREFIX = "pdlc-studio-attachments-";

/**
 * Reduces a browser-supplied filename to a bare, safe basename.
 *
 * The name arrives from the client and is used to build a path, so it is
 * treated as hostile: directory components are dropped, and anything outside a
 * conservative set is replaced. A name that reduces to nothing gets a
 * placeholder rather than producing a dotfile or an empty path segment.
 */
export function sanitiseFileName(name: string): string {
  const bare = basename(name).replace(/[/\\]/g, "");
  const cleaned = bare.replace(/[^A-Za-z0-9._ -]/g, "_").replace(/^\.+/, "");
  const trimmed = cleaned.trim().slice(0, 120);
  return trimmed === "" ? "attachment" : trimmed;
}

/**
 * Handles `POST /api/attachments`.
 *
 * Files land in a fresh temp directory per upload, and the response carries
 * their absolute paths. The composer then names those paths in the message, so
 * Claude reads them with its own tools.
 *
 * They are deliberately not written into the project: an attachment is
 * something the user is showing Claude, not a change to their repository, and
 * dropping files into a working tree would show up as untracked git noise.
 */
export async function handleUploadAttachmentsRequest(c: Context) {
  let form: FormData;
  try {
    form = await c.req.formData();
  } catch {
    return c.json({ error: "Expected multipart form data" }, 400);
  }

  const uploaded = form
    .getAll("files")
    .filter((item): item is File => item instanceof File);

  if (uploaded.length === 0) {
    return c.json({ error: "No files provided" }, 400);
  }
  if (uploaded.length > MAX_FILES) {
    return c.json({ error: `At most ${MAX_FILES} files per upload` }, 400);
  }

  let total = 0;
  for (const file of uploaded) {
    if (file.size > MAX_FILE_BYTES) {
      return c.json(
        {
          error: `"${file.name}" exceeds the ${Math.round(MAX_FILE_BYTES / 1024 / 1024)}MB limit`,
        },
        413,
      );
    }
    total += file.size;
  }
  if (total > MAX_TOTAL_BYTES) {
    return c.json({ error: "Upload is too large" }, 413);
  }

  try {
    const dir = await makeTempDir(TEMP_PREFIX);
    const attachments: AttachmentInfo[] = [];

    for (const file of uploaded) {
      const name = sanitiseFileName(file.name);
      const path = `${dir}/${name}`;
      const bytes = new Uint8Array(await file.arrayBuffer());
      await writeBinaryFile(path, bytes);
      attachments.push({ name, path, size: bytes.byteLength });
    }

    logger.api.debug("Stored {count} attachment(s) in {dir}", {
      count: attachments.length,
      dir,
    });
    return c.json<UploadAttachmentsResponse>({ attachments });
  } catch (error) {
    logger.api.error("Failed to store attachments: {error}", { error });
    return c.json({ error: "Failed to store attachments" }, 500);
  }
}

/**
 * True when `candidate` is inside `root`.
 *
 * Compared on resolved paths with a trailing separator, so `/tmp/a-evil` does
 * not count as being inside `/tmp/a`.
 */
export function isWithin(root: string, candidate: string): boolean {
  const resolvedRoot = resolve(root);
  const resolvedCandidate = resolve(candidate);
  if (resolvedCandidate === resolvedRoot) return true;
  return resolvedCandidate.startsWith(
    resolvedRoot.endsWith("/") ? resolvedRoot : `${resolvedRoot}/`,
  );
}

/**
 * Handles `GET /api/files?path=&download=`.
 *
 * Backs the Files tab's open and download actions.
 *
 * **This endpoint reads files off the machine and the server has no
 * authentication**, so it is confined to two roots: the working directory the
 * request names, and the temp root attachments are written under. Anything
 * else is refused, which keeps a stray or crafted path from turning the Files
 * tab into arbitrary file disclosure. Confinement is checked after resolving,
 * so `..` cannot climb out.
 */
export async function handleFileContentRequest(c: Context) {
  const path = c.req.query("path");
  const workingDirectory = c.req.query("workingDirectory");

  if (!path) {
    return c.json({ error: "path is required" }, 400);
  }

  const allowedRoots = [
    getTempRoot(),
    ...(workingDirectory ? [workingDirectory] : []),
  ];
  if (!allowedRoots.some((root) => isWithin(root, path))) {
    logger.api.warn("Refused file read outside allowed roots: {path}", {
      path,
    });
    return c.json({ error: "Path is outside the project" }, 403);
  }

  try {
    const info = await stat(path);
    if (!info.isFile) {
      return c.json({ error: "Not a file" }, 400);
    }

    const bytes = await readBinaryFile(path);
    const name = basename(path);
    const disposition =
      c.req.query("download") === "1" ? "attachment" : "inline";

    return new Response(bytes as unknown as BodyInit, {
      headers: {
        // Deliberately generic: the bytes are user-supplied, and serving them
        // as a guessed type invites the browser to execute markup as script.
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `${disposition}; filename="${name.replace(/"/g, "")}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    logger.api.warn("Failed to read file: {error}", { error });
    return c.json({ error: "File not found" }, 404);
  }
}
