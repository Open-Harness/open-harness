"use client";

/**
 * SessionList Component
 *
 * Displays all recorded workflow sessions from SqliteStore.
 * Provides UI for:
 * - Viewing existing sessions with metadata (date, event count, duration)
 * - Starting a new recording session (enters Live Mode)
 * - Loading a session for replay (enters Replay Mode)
 *
 * @module apps/core-v2-demo/src/components/SessionList
 */

import { useCallback, useEffect, useState } from "react";

/**
 * Session metadata returned from the API.
 * Matches the SessionMetadata type from @open-harness/core-v2.
 */
export interface SessionInfo {
  id: string;
  createdAt: string;
  lastEventAt?: string;
  eventCount: number;
  workflowName?: string;
}

/**
 * Props for the SessionList component.
 */
interface SessionListProps {
  /**
   * API base URL for fetching sessions.
   * Defaults to "/api/sessions".
   */
  apiBase?: string;

  /**
   * Callback when user clicks "New Session" button.
   * Parent component should enter Live Mode.
   */
  onNewSession: () => void;

  /**
   * Callback when user clicks on a session row.
   * Parent component should enter Replay Mode with this session.
   *
   * @param sessionId - The ID of the session to replay
   */
  onSelectSession: (sessionId: string) => void;
}

/**
 * Format a date string for display.
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Calculate duration between two date strings.
 * Returns a human-readable string like "2m 30s" or "< 1s".
 */
function formatDuration(startString: string, endString?: string): string {
  if (!endString) return "—";

  const start = new Date(startString);
  const end = new Date(endString);
  const durationMs = end.getTime() - start.getTime();

  if (durationMs < 1000) return "< 1s";

  const seconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes === 0) return `${remainingSeconds}s`;
  return `${minutes}m ${remainingSeconds}s`;
}

/**
 * Loading skeleton for session rows.
 */
function SessionSkeleton() {
  return (
    <div className="animate-pulse">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="flex items-center justify-between border-b border-zinc-200 px-4 py-4 dark:border-zinc-700"
        >
          <div className="flex-1 space-y-2">
            <div className="h-4 w-48 rounded bg-zinc-200 dark:bg-zinc-700" />
            <div className="h-3 w-32 rounded bg-zinc-200 dark:bg-zinc-700" />
          </div>
          <div className="flex gap-4">
            <div className="h-4 w-16 rounded bg-zinc-200 dark:bg-zinc-700" />
            <div className="h-4 w-16 rounded bg-zinc-200 dark:bg-zinc-700" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Empty state when no sessions exist.
 */
function EmptyState({ onNewSession }: { onNewSession: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-4 rounded-full bg-zinc-100 p-4 dark:bg-zinc-800">
        <svg
          className="h-8 w-8 text-zinc-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="1.5"
          role="img"
          aria-label="No sessions"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
          />
        </svg>
      </div>
      <h3 className="mb-2 text-lg font-medium text-zinc-900 dark:text-zinc-100">
        No sessions yet
      </h3>
      <p className="mb-6 max-w-sm text-sm text-zinc-500 dark:text-zinc-400">
        Start your first recording session to see it here. Sessions are
        persisted and can be replayed with time-travel debugging.
      </p>
      <button
        type="button"
        onClick={onNewSession}
        className="inline-flex items-center gap-2 rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-zinc-900"
      >
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="2"
          role="img"
          aria-label="Add"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 4.5v15m7.5-7.5h-15"
          />
        </svg>
        Start First Session
      </button>
    </div>
  );
}

/**
 * SessionList component showing all recorded sessions from SqliteStore.
 *
 * Features:
 * - Fetches sessions from API on mount
 * - Displays session metadata (date, event count, duration)
 * - "New Session" button for starting a recording
 * - Click on session row to load for replay
 */
export function SessionList({
  apiBase = "/api/sessions",
  onNewSession,
  onSelectSession,
}: SessionListProps) {
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch sessions from API
  const fetchSessions = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(apiBase);

      if (!response.ok) {
        throw new Error(`Failed to fetch sessions: ${response.statusText}`);
      }

      const data = (await response.json()) as SessionInfo[];
      // Sort by createdAt descending (newest first)
      data.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
      setSessions(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load sessions");
    } finally {
      setIsLoading(false);
    }
  }, [apiBase]);

  // Fetch on mount
  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  return (
    <div
      className="flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
      data-testid="session-list"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-700">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Recorded Sessions
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {sessions.length > 0
              ? `${sessions.length} session${sessions.length === 1 ? "" : "s"}`
              : "No sessions recorded"}
          </p>
        </div>
        <button
          type="button"
          onClick={onNewSession}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-zinc-900"
          data-testid="new-session-button"
        >
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
          </span>
          New Session
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <SessionSkeleton />
        ) : error ? (
          <div className="flex items-center justify-center gap-2 px-4 py-8 text-red-600 dark:text-red-400">
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
              role="img"
              aria-label="Error"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
              />
            </svg>
            <span>{error}</span>
            <button
              type="button"
              onClick={fetchSessions}
              className="ml-2 text-sm font-medium underline hover:no-underline"
            >
              Retry
            </button>
          </div>
        ) : sessions.length === 0 ? (
          <EmptyState onNewSession={onNewSession} />
        ) : (
          <div className="divide-y divide-zinc-200 dark:divide-zinc-700">
            {sessions.map((session) => (
              <button
                type="button"
                key={session.id}
                onClick={() => onSelectSession(session.id)}
                className="flex w-full cursor-pointer items-center justify-between px-4 py-4 text-left transition-colors hover:bg-zinc-50 focus:bg-zinc-50 focus:outline-none dark:hover:bg-zinc-800 dark:focus:bg-zinc-800"
                data-testid={`session-row-${session.id}`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-mono text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {session.id.slice(0, 8)}...
                    </span>
                    {session.workflowName && (
                      <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700 dark:bg-violet-900/30 dark:text-violet-400">
                        {session.workflowName}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                    {formatDate(session.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-6 text-sm">
                  <div className="text-right">
                    <span className="block font-medium tabular-nums text-zinc-700 dark:text-zinc-300">
                      {session.eventCount}
                    </span>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">
                      events
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="block font-medium tabular-nums text-zinc-700 dark:text-zinc-300">
                      {formatDuration(session.createdAt, session.lastEventAt)}
                    </span>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">
                      duration
                    </span>
                  </div>
                  <svg
                    className="h-5 w-5 text-zinc-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth="2"
                    role="img"
                    aria-label="View session"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M8.25 4.5l7.5 7.5-7.5 7.5"
                    />
                  </svg>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Footer with refresh button */}
      {!isLoading && sessions.length > 0 && (
        <div className="border-t border-zinc-200 px-4 py-2 dark:border-zinc-700">
          <button
            type="button"
            onClick={fetchSessions}
            className="flex items-center gap-1.5 text-sm text-zinc-500 transition-colors hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
              role="img"
              aria-label="Refresh"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
              />
            </svg>
            Refresh list
          </button>
        </div>
      )}
    </div>
  );
}
