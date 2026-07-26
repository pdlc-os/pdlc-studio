import { useState, useCallback } from "react";
import type { PermissionMode } from "../../types";

export interface UsePermissionModeResult {
  permissionMode: PermissionMode;
  setPermissionMode: (mode: PermissionMode) => void;
  isPlanMode: boolean;
  isDefaultMode: boolean;
  isAcceptEditsMode: boolean;
  isBypassPermissionsMode: boolean;
}

/**
 * The mode a fresh session starts in.
 *
 * `bypassPermissions` runs every tool without asking, so no permission prompt
 * appears unless the user cycles to another mode. Switch this to "default" to
 * restore approval prompts.
 */
export const INITIAL_PERMISSION_MODE: PermissionMode = "bypassPermissions";

/**
 * Hook for managing PermissionMode state within a browser session.
 * State is preserved across component re-renders but resets on page reload.
 * No localStorage persistence - simple React state management.
 */
export function usePermissionMode(): UsePermissionModeResult {
  const [permissionMode, setPermissionModeState] = useState<PermissionMode>(
    INITIAL_PERMISSION_MODE,
  );

  const setPermissionMode = useCallback((mode: PermissionMode) => {
    setPermissionModeState(mode);
  }, []);

  return {
    permissionMode,
    setPermissionMode,
    isPlanMode: permissionMode === "plan",
    isDefaultMode: permissionMode === "default",
    isAcceptEditsMode: permissionMode === "acceptEdits",
    isBypassPermissionsMode: permissionMode === "bypassPermissions",
  };
}
