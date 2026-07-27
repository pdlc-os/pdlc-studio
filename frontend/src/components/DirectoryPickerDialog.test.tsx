import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { DirectoryPickerDialog } from "./DirectoryPickerDialog";
import type { BrowseDirectoriesResponse } from "../types";

global.fetch = vi.fn();

/** Queues one response per expected browse call, in order. */
function mockBrowseSequence(...listings: BrowseDirectoriesResponse[]) {
  const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
  fetchMock.mockReset();
  for (const listing of listings) {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(listing),
    });
  }
}

const HOME: BrowseDirectoriesResponse = {
  path: "/Users/dev",
  parent: "/Users",
  entries: [
    { name: "Projects", path: "/Users/dev/Projects" },
    { name: "Documents", path: "/Users/dev/Documents" },
  ],
  isGitRepository: false,
};

const PROJECTS: BrowseDirectoriesResponse = {
  path: "/Users/dev/Projects",
  parent: "/Users/dev",
  entries: [{ name: "my-app", path: "/Users/dev/Projects/my-app" }],
  isGitRepository: false,
};

describe("DirectoryPickerDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists the starting directory and confirms it", async () => {
    mockBrowseSequence(HOME);
    const onConfirm = vi.fn();

    render(
      <DirectoryPickerDialog
        isOpen
        title="Open Existing Project"
        confirmLabel="Open"
        onCancel={vi.fn()}
        onConfirm={onConfirm}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("picker-current-path")).toHaveTextContent(
        "/Users/dev",
      );
    });
    expect(screen.getAllByTestId("picker-entry")).toHaveLength(2);

    fireEvent.click(screen.getByRole("button", { name: "Open" }));

    // The confirmed path is the directory being browsed, not a highlighted row.
    expect(onConfirm).toHaveBeenCalledWith("/Users/dev");
  });

  it("navigates into a subdirectory and confirms that instead", async () => {
    mockBrowseSequence(HOME, PROJECTS);
    const onConfirm = vi.fn();

    render(
      <DirectoryPickerDialog
        isOpen
        title="Open Existing Project"
        confirmLabel="Open"
        onCancel={vi.fn()}
        onConfirm={onConfirm}
      />,
    );

    await waitFor(() =>
      expect(screen.getByText("Projects")).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByText("Projects"));

    await waitFor(() => {
      expect(screen.getByTestId("picker-current-path")).toHaveTextContent(
        "/Users/dev/Projects",
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    expect(onConfirm).toHaveBeenCalledWith("/Users/dev/Projects");
  });

  it("surfaces the backend's reason when browsing fails", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockReset();
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: () => Promise.resolve({ error: "Permission denied: /root" }),
    });

    render(
      <DirectoryPickerDialog
        isOpen
        title="Open Existing Project"
        confirmLabel="Open"
        initialPath="/root"
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    // A permission error is normal while browsing, so the message has to be
    // the specific one rather than a generic failure.
    await waitFor(() => {
      expect(screen.getByText("Permission denied: /root")).toBeInTheDocument();
    });
  });

  it("disables the parent button at the filesystem root", async () => {
    mockBrowseSequence({
      path: "/",
      parent: null,
      entries: [],
      isGitRepository: false,
    });

    render(
      <DirectoryPickerDialog
        isOpen
        title="Open Existing Project"
        confirmLabel="Open"
        initialPath="/"
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    /*
     * A button carrying a tooltip reports aria-disabled rather than the
     * disabled attribute, so it can still receive the hover that shows the
     * tooltip. Assert it is genuinely inert as well as marked.
     */
    const parentButton = await waitFor(() => {
      const button = screen.getByRole("button", {
        name: "Go to parent directory",
      });
      expect(button).toHaveAttribute("aria-disabled", "true");
      return button;
    });

    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    const callsBefore = fetchMock.mock.calls.length;
    fireEvent.click(parentButton);
    expect(fetchMock.mock.calls.length).toBe(callsBefore);
  });
});
