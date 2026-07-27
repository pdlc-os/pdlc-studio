import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { saveTranscript } from "./saveTranscript";
import type { TranscriptMeta } from "./exportTranscript";
import type { AllMessage } from "../types";

const META: TranscriptMeta = {
  title: "Fix the parser",
  sessionId: "s1",
  workingDirectory: "/tmp/project",
  exportedAt: Date.parse("2026-07-26T14:30:00Z"),
};

const MESSAGES: AllMessage[] = [
  { type: "chat", role: "user", content: "hi", timestamp: META.exportedAt },
];

/** jsdom's Blob has no .text(), so read it the long way when it is missing. */
async function blobText(blob?: Blob): Promise<string> {
  if (!blob) return "";
  if (typeof blob.text === "function") return blob.text();

  // Not `new Response(blob).text()` — undici does not recognise jsdom's Blob
  // and stringifies it to "[object Blob]".
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}

/** Captures the blob a download would have written, and the filename. */
function captureDownload() {
  const captured: { blob?: Blob; filename?: string } = {};

  // jsdom implements neither, so these are defined rather than spied on.
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: (blob: Blob) => {
      captured.blob = blob;
      return "blob:mock";
    },
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    value: () => {},
  });
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    captured.filename = this.download;
  });

  return captured;
}

describe("saveTranscript", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("downloads markdown under a .md name", async () => {
    const captured = captureDownload();

    saveTranscript("markdown", MESSAGES, META);

    expect(captured.filename).toMatch(/\.md$/);
    expect(captured.blob?.type).toBe("text/markdown;charset=utf-8");
    expect(await blobText(captured.blob)).toContain("# Fix the parser");
  });

  it("downloads a whole html document under a .html name", async () => {
    const captured = captureDownload();

    saveTranscript("html", MESSAGES, META);

    expect(captured.filename).toMatch(/\.html$/);
    expect(captured.blob?.type).toBe("text/html;charset=utf-8");
    expect(await blobText(captured.blob)).toContain("<!doctype html>");
  });

  it("leaves no anchor behind in the document", () => {
    captureDownload();

    saveTranscript("markdown", MESSAGES, META);

    expect(document.querySelectorAll("a").length).toBe(0);
  });

  describe("pdf", () => {
    /**
     * The frame is appended before its content is set, so the test drives the
     * load event itself rather than waiting on jsdom to fire one for srcdoc.
     */
    function findPrintFrame(): HTMLIFrameElement {
      const frame = document.querySelector<HTMLIFrameElement>(
        'iframe[title="Transcript print view"]',
      );
      if (!frame) throw new Error("no print frame was created");
      return frame;
    }

    it("writes the document into a hidden frame and prints it", () => {
      saveTranscript("pdf", MESSAGES, META);

      const frame = findPrintFrame();
      expect(frame.srcdoc).toContain("<!doctype html>");
      expect(frame.srcdoc).toContain("Fix the parser");
      // Hidden, because it exists only to be printed.
      expect(frame.getAttribute("aria-hidden")).toBe("true");
      expect(frame.style.visibility).toBe("hidden");

      const print = vi.fn();
      Object.defineProperty(frame.contentWindow, "print", { value: print });
      Object.defineProperty(frame.contentWindow, "focus", { value: vi.fn() });

      frame.dispatchEvent(new Event("load"));

      expect(print).toHaveBeenCalled();
    });

    it("does not download a file — the dialog is the destination", () => {
      const captured = captureDownload();

      saveTranscript("pdf", MESSAGES, META);

      expect(captured.filename).toBeUndefined();
    });

    it("removes the frame once printing is over", () => {
      saveTranscript("pdf", MESSAGES, META);

      const frame = findPrintFrame();
      const view = frame.contentWindow!;
      Object.defineProperty(view, "print", { value: vi.fn() });
      Object.defineProperty(view, "focus", { value: vi.fn() });
      frame.dispatchEvent(new Event("load"));

      // Removing it while the dialog is open cancels the print, so cleanup
      // waits for afterprint rather than for print() to return.
      expect(document.contains(frame)).toBe(true);

      view.dispatchEvent(new Event("afterprint"));

      expect(document.contains(frame)).toBe(false);
    });

    it("still cleans up when afterprint never fires", () => {
      vi.useFakeTimers();
      try {
        saveTranscript("pdf", MESSAGES, META);

        const frame = findPrintFrame();
        Object.defineProperty(frame.contentWindow, "print", { value: vi.fn() });
        Object.defineProperty(frame.contentWindow, "focus", { value: vi.fn() });
        frame.dispatchEvent(new Event("load"));

        vi.advanceTimersByTime(60_001);

        expect(document.contains(frame)).toBe(false);
      } finally {
        vi.useRealTimers();
      }
    });
  });
});
