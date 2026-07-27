import { useCallback, useEffect, useState } from "react";
import {
  getHistoriesUrl,
  getSessionUrl,
  getSessionStarUrl,
  getClearHistoriesUrl,
} from "../config/api";
import type { ConversationSummary, HistoryListResponse } from "../types";

/**
 * The project's conversations, plus the mutations the sidebar offers.
 *
 * Rename and delete go through the backend, which delegates to the SDK — so
 * they are the same operations the CLI performs, not a UI-local view of the
 * history. Every mutation refetches rather than patching local state: the
 * listing is derived (sessions are grouped and de-duplicated server-side), so
 * re-deriving it is the only way to stay honest about what is on disk.
 */
export function useConversationList(
  encodedProjectName: string | null | undefined,
  searchTerm = "",
) {
  /*
   * Searching scans every message of every session, so it is debounced rather
   * than fired per keystroke — a project with a few thousand-message sessions
   * would otherwise re-scan them all on every character.
   */
  const [debouncedTerm, setDebouncedTerm] = useState(searchTerm);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedTerm(searchTerm), 250);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!encodedProjectName) {
      setConversations([]);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(
        getHistoriesUrl(encodedProjectName, debouncedTerm),
      );
      if (!response.ok) {
        throw new Error(`Failed to load conversations (${response.status})`);
      }
      const data: HistoryListResponse = await response.json();
      setConversations(data.conversations ?? []);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setConversations([]);
    } finally {
      setIsLoading(false);
    }
  }, [encodedProjectName, debouncedTerm]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const rename = useCallback(
    async (sessionId: string, title: string) => {
      if (!encodedProjectName) return;
      const response = await fetch(
        getSessionUrl(encodedProjectName, sessionId),
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title }),
        },
      );
      if (!response.ok) {
        throw new Error("Failed to rename conversation");
      }
      await refresh();
    },
    [encodedProjectName, refresh],
  );

  const remove = useCallback(
    async (sessionId: string) => {
      if (!encodedProjectName) return;
      const response = await fetch(
        getSessionUrl(encodedProjectName, sessionId),
        {
          method: "DELETE",
        },
      );
      if (!response.ok) {
        throw new Error("Failed to delete conversation");
      }
      await refresh();
    },
    [encodedProjectName, refresh],
  );

  /**
   * Stars or unstars a conversation.
   *
   * The new state is applied locally before the request settles, because the
   * star is the feedback for the click — waiting for a round trip and a
   * refetch makes the icon feel broken. The refresh afterwards reconciles
   * with the server, and a failure restores what was really there rather than
   * leaving the optimistic guess on screen.
   */
  const setStarred = useCallback(
    async (sessionId: string, isStarred: boolean) => {
      if (!encodedProjectName) return;

      setConversations((current) =>
        current.map((conversation) =>
          conversation.sessionId === sessionId
            ? { ...conversation, isStarred }
            : conversation,
        ),
      );

      try {
        const response = await fetch(
          getSessionStarUrl(encodedProjectName, sessionId),
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ isStarred }),
          },
        );
        if (!response.ok) throw new Error("Failed to update star");
      } finally {
        await refresh();
      }
    },
    [encodedProjectName, refresh],
  );

  const clearAll = useCallback(async () => {
    if (!encodedProjectName) return;
    const response = await fetch(getClearHistoriesUrl(encodedProjectName), {
      method: "DELETE",
    });
    if (!response.ok) {
      throw new Error("Failed to clear conversation history");
    }
    await refresh();
  }, [encodedProjectName, refresh]);

  return {
    conversations,
    isLoading,
    error,
    refresh,
    rename,
    remove,
    setStarred,
    clearAll,
    /** True once the typed term has been applied, for empty-state wording. */
    isSearching: debouncedTerm.trim() !== "",
  };
}
