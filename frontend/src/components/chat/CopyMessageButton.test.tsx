import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { CopyMessageButton } from "./CopyMessageButton";
import { AstryxProvider } from "../AstryxProvider";
import { SettingsProvider } from "../../contexts/SettingsContext";

function renderButton(text: string) {
  render(
    <SettingsProvider>
      <AstryxProvider>
        <CopyMessageButton text={text} label="this message" />
      </AstryxProvider>
    </SettingsProvider>,
  );
  return screen.getByTestId("copy-message");
}

/** jsdom has no clipboard, so one is installed per test. */
function stubClipboard(writeText: () => Promise<void>) {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });
}

afterEach(() => {
  vi.useRealTimers();
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: undefined,
  });
});

describe("CopyMessageButton", () => {
  it("puts just this message on the clipboard", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    stubClipboard(writeText);

    fireEvent.click(renderButton("only this reply"));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith("only this reply");
    });
  });

  it("confirms, since nothing else on screen changes", async () => {
    stubClipboard(vi.fn().mockResolvedValue(undefined));
    const button = renderButton("x");

    fireEvent.click(button);

    await waitFor(() => {
      expect(button).toHaveAttribute("data-state", "copied");
    });
  });

  it("reports a failure rather than doing nothing visible", async () => {
    // navigator.clipboard is undefined outside a secure context, which
    // includes plain-http access from another machine — a supported setup.
    const button = renderButton("x");

    fireEvent.click(button);

    await waitFor(() => {
      expect(button).toHaveAttribute("data-state", "failed");
    });
  });

  it("reverts so the row does not stay stuck on 'Copied'", async () => {
    vi.useFakeTimers();
    stubClipboard(vi.fn().mockResolvedValue(undefined));
    const button = renderButton("x");

    fireEvent.click(button);
    await act(async () => {});
    expect(button).toHaveAttribute("data-state", "copied");

    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    expect(button).toHaveAttribute("data-state", "idle");
  });
});
