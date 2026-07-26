import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import {
  usePermissionMode,
  INITIAL_PERMISSION_MODE,
} from "./usePermissionMode";

describe("usePermissionMode", () => {
  it("should initialize with the configured initial permission mode", () => {
    const { result } = renderHook(() => usePermissionMode());

    expect(result.current.permissionMode).toBe(INITIAL_PERMISSION_MODE);
  });

  // Pinned deliberately: permission prompts are off unless a user opts into
  // another mode, so a change here is a security-relevant change.
  it("should default to bypassPermissions", () => {
    const { result } = renderHook(() => usePermissionMode());

    expect(result.current.permissionMode).toBe("bypassPermissions");
    expect(result.current.isBypassPermissionsMode).toBe(true);
    expect(result.current.isDefaultMode).toBe(false);
    expect(result.current.isPlanMode).toBe(false);
    expect(result.current.isAcceptEditsMode).toBe(false);
  });

  it("should update permission mode correctly", () => {
    const { result } = renderHook(() => usePermissionMode());

    act(() => {
      result.current.setPermissionMode("plan");
    });

    expect(result.current.permissionMode).toBe("plan");
    expect(result.current.isPlanMode).toBe(true);
    expect(result.current.isDefaultMode).toBe(false);
    expect(result.current.isAcceptEditsMode).toBe(false);
  });

  it("should handle acceptEdits mode correctly", () => {
    const { result } = renderHook(() => usePermissionMode());

    act(() => {
      result.current.setPermissionMode("acceptEdits");
    });

    expect(result.current.permissionMode).toBe("acceptEdits");
    expect(result.current.isAcceptEditsMode).toBe(true);
    expect(result.current.isDefaultMode).toBe(false);
    expect(result.current.isPlanMode).toBe(false);
  });

  it("should persist state across re-renders", () => {
    const { result, rerender } = renderHook(() => usePermissionMode());

    act(() => {
      result.current.setPermissionMode("plan");
    });

    rerender();

    expect(result.current.permissionMode).toBe("plan");
    expect(result.current.isPlanMode).toBe(true);
  });

  it("should reset to the initial mode on new hook instance", () => {
    const { result: result1 } = renderHook(() => usePermissionMode());

    act(() => {
      result1.current.setPermissionMode("acceptEdits");
    });

    // Create a new hook instance (simulating page reload)
    const { result: result2 } = renderHook(() => usePermissionMode());

    expect(result2.current.permissionMode).toBe(INITIAL_PERMISSION_MODE);
  });
});
