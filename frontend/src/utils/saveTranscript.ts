import {
  transcriptToHtml,
  transcriptToMarkdown,
  transcriptFilename,
  type ExportFormat,
  type TranscriptMeta,
} from "./exportTranscript";
import type { AllMessage } from "../types";

function download(content: string, filename: string, mime: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();

  // Revoked on the next task, not synchronously: some browsers cancel a
  // download whose blob URL is released before they have started reading it.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/**
 * Prints the document through a hidden iframe, which is where "Save as PDF"
 * lives.
 *
 * There is no browser API that writes a PDF, and the alternatives — bundling a
 * PDF library, or rendering server-side with a headless browser — both mean
 * shipping a second rendering engine to reproduce a page this one already
 * lays out correctly. The print dialog is the seam the platform provides, and
 * every desktop browser offers "Save as PDF" there.
 *
 * An iframe rather than a popup: a new window trips popup blockers even from a
 * click handler in some configurations, and leaves a stray tab behind.
 */
function printDocument(html: string): void {
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.setAttribute("title", "Transcript print view");
  frame.style.cssText =
    "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;";

  frame.addEventListener("load", () => {
    const view = frame.contentWindow;
    if (!view) {
      frame.remove();
      return;
    }

    // Removing the frame while the dialog is open cancels the print, and
    // print() does not reliably block until the dialog closes. `afterprint`
    // is the signal; the timer is a floor for browsers that do not fire it.
    let removed = false;
    const cleanUp = () => {
      if (removed) return;
      removed = true;
      frame.remove();
    };

    view.addEventListener("afterprint", cleanUp);
    setTimeout(cleanUp, 60_000);

    view.focus();
    view.print();
  });

  document.body.appendChild(frame);

  // srcdoc rather than document.write, which is deprecated and blocked in
  // some contexts. The load event above fires once the content is parsed.
  frame.srcdoc = html;
}

/**
 * Writes the transcript out in the format the user picked.
 *
 * PDF and HTML share a document — the PDF is that page printed — so the two
 * cannot disagree about what the conversation contained.
 */
export function saveTranscript(
  format: ExportFormat,
  messages: AllMessage[],
  meta: TranscriptMeta,
): void {
  if (format === "markdown") {
    download(
      transcriptToMarkdown(messages, meta),
      transcriptFilename(meta, "md"),
      "text/markdown;charset=utf-8",
    );
    return;
  }

  const html = transcriptToHtml(messages, meta);

  if (format === "html") {
    download(html, transcriptFilename(meta, "html"), "text/html;charset=utf-8");
    return;
  }

  printDocument(html);
}
