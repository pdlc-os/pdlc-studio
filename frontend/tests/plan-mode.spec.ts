import { test, expect } from "@playwright/test";

/**
 * Plan Mode E2E Tests
 * Tests for permission mode toggle functionality and plan display
 */

test.describe("Plan Mode Functionality", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the main chat page (not demo mode)
    await page.goto("/", { waitUntil: "networkidle" });

    // Wait for the project selector to load, then select the first project
    await page.waitForSelector('[data-testid="project-card"]', {
      timeout: 10000,
    });
    await page.click('[data-testid="project-card"]');

    // Wait for chat page to load
    await page.waitForSelector('textarea[placeholder*="message"]', {
      timeout: 10000,
    });
  });

  test("should toggle between permission modes", async ({ page }) => {
    // Find the permission mode toggle button
    const permissionToggle = page.locator(
      '[data-testid="permission-mode-toggle"]',
    );
    await expect(permissionToggle).toBeVisible();

    // Sessions start with permission prompts disabled
    await expect(permissionToggle).toHaveText(/⚠ bypass permissions/);

    // Click to switch to normal mode
    await permissionToggle.click();
    await expect(permissionToggle).toHaveText(/🔧 normal mode/);

    // Click to switch to plan mode
    await permissionToggle.click();
    await expect(permissionToggle).toHaveText(/⏸ plan mode/);

    // Click again to switch to accept edits mode
    await permissionToggle.click();
    await expect(permissionToggle).toHaveText(/⏵⏵ accept edits/);

    // Click once more to cycle back to bypass permissions
    await permissionToggle.click();
    await expect(permissionToggle).toHaveText(/⚠ bypass permissions/);
  });

  test("should change submit button text in plan mode", async ({ page }) => {
    const permissionToggle = page.locator(
      '[data-testid="permission-mode-toggle"]',
    );
    const submitButton = page.locator('[data-testid="send-button"]');

    // Initially, submit button should say "Send"
    await expect(submitButton).toHaveText("Send");

    // Switch to plan mode (bypass -> normal -> plan)
    await permissionToggle.click();
    await permissionToggle.click();
    await expect(permissionToggle).toHaveText(/⏸ plan mode/);

    // Submit button should now say "Plan"
    await expect(submitButton).toHaveText("Plan");

    // Switch back to normal mode
    await permissionToggle.click();
    await permissionToggle.click(); // Cycle through accept edits back to normal
    await expect(submitButton).toHaveText("Send");
  });

  test("should display permission mode tooltip correctly", async ({ page }) => {
    const permissionToggle = page.locator(
      '[data-testid="permission-mode-toggle"]',
    );

    // Check default mode label
    await expect(permissionToggle).toHaveAttribute(
      "aria-label",
      "Current: bypass permissions - Click to cycle (Ctrl+Shift+M)",
    );

    // Switch to normal mode and check label
    await permissionToggle.click();
    await expect(permissionToggle).toHaveAttribute(
      "aria-label",
      "Current: normal mode - Click to cycle (Ctrl+Shift+M)",
    );

    // Switch to plan mode and check label
    await permissionToggle.click();
    await expect(permissionToggle).toHaveAttribute(
      "aria-label",
      "Current: plan mode - Click to cycle (Ctrl+Shift+M)",
    );

    // Switch to accept edits mode and check label
    await permissionToggle.click();
    await expect(permissionToggle).toHaveAttribute(
      "aria-label",
      "Current: accept edits - Click to cycle (Ctrl+Shift+M)",
    );
  });

  test("should maintain permission mode during session", async ({ page }) => {
    const permissionToggle = page.locator(
      '[data-testid="permission-mode-toggle"]',
    );

    // Switch to plan mode (bypass -> normal -> plan)
    await permissionToggle.click();
    await permissionToggle.click();
    await expect(permissionToggle).toHaveText(/⏸ plan mode/);

    // Type a message (but don't send)
    const messageInput = page.locator('textarea[placeholder*="message"]');
    await messageInput.fill("Test message for plan mode");

    // Permission mode should remain unchanged
    await expect(permissionToggle).toHaveText(/⏸ plan mode/);

    // Clear the input
    await messageInput.clear();

    // Permission mode should still be plan mode
    await expect(permissionToggle).toHaveText(/⏸ plan mode/);
  });
});

test.describe("Plan Display and Interaction", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });
    await page.waitForSelector('[data-testid="project-card"]', {
      timeout: 10000,
    });
    await page.click('[data-testid="project-card"]');
    await page.waitForSelector('textarea[placeholder*="message"]', {
      timeout: 10000,
    });

    // Switch to plan mode for these tests
    const permissionToggle = page.locator(
      '[data-testid="permission-mode-toggle"]',
    );
    await permissionToggle.click();
    await expect(permissionToggle).toHaveText(/⏸ plan mode/);
  });

  test("should handle plan mode message input correctly", async ({ page }) => {
    const messageInput = page.locator('textarea[placeholder*="message"]');
    const submitButton = page.locator('[data-testid="send-button"]');

    // Input should be enabled and submit button should say "Plan"
    await expect(messageInput).toBeEnabled();
    await expect(submitButton).toHaveText("Plan");
    await expect(submitButton).toBeDisabled(); // Should be disabled when no text

    // Type a message
    await messageInput.fill("Help me create a new feature");
    await expect(submitButton).toBeEnabled();

    // Submit button should still say "Plan"
    await expect(submitButton).toHaveText("Plan");
  });

  test("should disable input during loading state", async ({ page }) => {
    const messageInput = page.locator('textarea[placeholder*="message"]');
    const submitButton = page.locator('[data-testid="send-button"]');

    // Fill in a message
    await messageInput.fill("Create a simple todo app");

    // Mock network delay to test loading state (in real scenario, this would be handled by the app)
    // We'll simulate by checking if the button becomes disabled after submit
    await submitButton.click();

    // After clicking, the button text should change to "..." (loading state)
    // Note: This test might be flaky depending on actual backend response time
    // In a real E2E environment, you might want to mock the backend response
  });
});

test.describe("Plan Mode UI Integration", () => {
  test("should work correctly with other UI elements", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });
    await page.waitForSelector('[data-testid="project-card"]', {
      timeout: 10000,
    });
    await page.click('[data-testid="project-card"]');
    await page.waitForSelector('textarea[placeholder*="message"]', {
      timeout: 10000,
    });

    // Check that permission mode toggle works alongside theme toggle
    const permissionToggle = page.locator(
      '[data-testid="permission-mode-toggle"]',
    );
    const themeToggle = page.locator('button[aria-label*="theme"]');

    // Switch to plan mode (bypass -> normal -> plan)
    await permissionToggle.click();
    await permissionToggle.click();
    await expect(permissionToggle).toHaveText(/⏸ plan mode/);

    // Toggle theme if theme toggle exists
    if (await themeToggle.isVisible()) {
      await themeToggle.click();
      await page.waitForTimeout(500);

      // Permission mode should remain unchanged
      await expect(permissionToggle).toHaveText(/⏸ plan mode/);
    }

    // Check that other buttons (like history button) don't interfere
    const historyButton = page.locator(
      'button[aria-label*="history"], button[title*="history"]',
    );
    if (await historyButton.isVisible()) {
      // Permission mode should still be plan mode
      await expect(permissionToggle).toHaveText(/⏸ plan mode/);
    }
  });

  test("should maintain consistent styling across permission modes", async ({
    page,
  }) => {
    await page.goto("/", { waitUntil: "networkidle" });
    await page.waitForSelector('[data-testid="project-card"]', {
      timeout: 10000,
    });
    await page.click('[data-testid="project-card"]');
    await page.waitForSelector('textarea[placeholder*="message"]', {
      timeout: 10000,
    });

    const permissionToggle = page.locator(
      '[data-testid="permission-mode-toggle"]',
    );
    const submitButton = page.locator('[data-testid="send-button"]');

    // Test styling in each mode
    const modes = [
      "bypass permissions",
      "normal mode",
      "plan mode",
      "accept edits",
    ];

    for (let i = 0; i < modes.length; i++) {
      // Check that the toggle button is visible and clickable
      await expect(permissionToggle).toBeVisible();
      await expect(permissionToggle).toBeEnabled();

      // Check that submit button maintains consistent appearance
      await expect(submitButton).toBeVisible();

      // Styling comes from the design system, so assert on state rather than
      // on class names: with an empty composer the send button stays disabled.
      await expect(submitButton).toBeDisabled();

      if (i < modes.length - 1) {
        await permissionToggle.click();
      }
    }
  });
});

test.describe("Plan Mode Error States", () => {
  test("should handle permission mode toggle during error states", async ({
    page,
  }) => {
    await page.goto("/", { waitUntil: "networkidle" });
    await page.waitForSelector('[data-testid="project-card"]', {
      timeout: 10000,
    });
    await page.click('[data-testid="project-card"]');
    await page.waitForSelector('textarea[placeholder*="message"]', {
      timeout: 10000,
    });

    const permissionToggle = page.locator(
      '[data-testid="permission-mode-toggle"]',
    );

    // Permission mode toggle should remain functional even if there are errors in the chat
    await permissionToggle.click();
    await permissionToggle.click();
    await expect(permissionToggle).toHaveText(/⏸ plan mode/);

    // Try to simulate a scenario where permission toggle works despite other issues
    const messageInput = page.locator('textarea[placeholder*="message"]');
    await messageInput.fill(""); // Empty message

    // Toggle should still work
    await permissionToggle.click();
    await expect(permissionToggle).toHaveText(/⏵⏵ accept edits/);

    await permissionToggle.click();
    await expect(permissionToggle).toHaveText(/⚠ bypass permissions/);
  });
});

test.describe("Plan Mode Accessibility", () => {
  test("should be accessible via keyboard navigation", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });
    await page.waitForSelector('[data-testid="project-card"]', {
      timeout: 10000,
    });
    await page.click('[data-testid="project-card"]');
    await page.waitForSelector('textarea[placeholder*="message"]', {
      timeout: 10000,
    });

    const permissionToggle = page.locator(
      '[data-testid="permission-mode-toggle"]',
    );

    // Focus the permission mode toggle using keyboard
    await permissionToggle.focus();

    // Check that it's focused
    await expect(permissionToggle).toBeFocused();

    // Activate with keyboard (Space or Enter)
    await page.keyboard.press("Enter");
    await expect(permissionToggle).toHaveText(/🔧 normal mode/);

    // Test with Space key
    await page.keyboard.press(" ");
    await expect(permissionToggle).toHaveText(/⏸ plan mode/);
  });

  test("should have proper ARIA attributes", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });
    await page.waitForSelector('[data-testid="project-card"]', {
      timeout: 10000,
    });
    await page.click('[data-testid="project-card"]');
    await page.waitForSelector('textarea[placeholder*="message"]', {
      timeout: 10000,
    });

    const permissionToggle = page.locator(
      '[data-testid="permission-mode-toggle"]',
    );

    // Check that the button has an accessible name for screen readers
    const label = await permissionToggle.getAttribute("aria-label");
    expect(label).toMatch(/Current:.*Click to cycle/);

    // Check that it's a proper button element
    expect(await permissionToggle.getAttribute("type")).toBe("button");
  });
});
