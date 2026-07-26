import { render, screen, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { ProjectSelector } from "./components/ProjectSelector";
import { ChatPage } from "./components/ChatPage";
import { SettingsProvider } from "./contexts/SettingsContext";

// Mock fetch globally
global.fetch = vi.fn();

describe("App Routing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock projects API response
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ projects: [] }),
    });
  });

  it("renders the launch window at root path", async () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route path="/" element={<ProjectSelector />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("launch-panel")).toBeInTheDocument();
    });

    // Identity, version, and all three actions — the Xcode-style layout.
    expect(
      screen.getByRole("heading", { level: 1, name: "PDLC Studio" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/^Version /)).toBeInTheDocument();

    for (const action of [
      "Create New Project...",
      "Clone Git Repository...",
      "Open Existing Project...",
    ]) {
      expect(screen.getByRole("button", { name: action })).toBeInTheDocument();
    }

    // Recent Projects panel, empty here because the mock returns none.
    expect(
      screen.getByRole("heading", { level: 2, name: "Recent Projects" }),
    ).toBeInTheDocument();
    expect(screen.getByText("No Recent Projects")).toBeInTheDocument();
  });

  it("renders chat page when navigating to projects path", async () => {
    await act(async () => {
      render(
        <SettingsProvider>
          <MemoryRouter initialEntries={["/projects/test-path"]}>
            <Routes>
              <Route path="/projects/*" element={<ChatPage />} />
            </Routes>
          </MemoryRouter>
        </SettingsProvider>,
      );
    });

    await waitFor(() => {
      expect(screen.getByText("PDLC Studio")).toBeInTheDocument();
      expect(screen.getByText("/test-path")).toBeInTheDocument();
    });
  });
});
