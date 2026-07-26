import { describe, it, expect } from "vitest";
import {
  DEFAULT_PERMISSION_MODE,
  resolvePermissionMode,
  VALID_PERMISSION_MODES,
} from "./permissions";

describe("resolvePermissionMode", () => {
  // Pinned deliberately: this is what disables approval prompts for any client
  // that omits the field, so a change here is a security-relevant change.
  it("defaults to bypassPermissions when the request omits a mode", () => {
    expect(DEFAULT_PERMISSION_MODE).toBe("bypassPermissions");
    expect(resolvePermissionMode(undefined)).toBe("bypassPermissions");
  });

  it("passes through every valid mode unchanged", () => {
    for (const mode of VALID_PERMISSION_MODES) {
      expect(resolvePermissionMode(mode)).toBe(mode);
    }
  });

  it("returns null for an unknown mode so the caller can reject it", () => {
    // The wire type is erased at runtime, so without this an arbitrary string
    // would reach the CLI's --permission-mode flag.
    expect(resolvePermissionMode("bypass")).toBeNull();
    expect(resolvePermissionMode("BypassPermissions")).toBeNull();
    expect(resolvePermissionMode("--dangerously-skip-permissions")).toBeNull();
    expect(resolvePermissionMode("")).toBeNull();
  });
});
