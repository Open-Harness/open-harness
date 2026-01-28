"use client";

/**
 * ReplayViewer Component
 *
 * THE KILLER FEATURE: Time-travel debugging for recorded workflow sessions.
 *
 * This component loads a recorded session by ID and provides full tape controls
 * for stepping through events, rewinding, and jumping to any position.
 *
 * Key features:
 * - Load session via API (fetches events from /api/sessions/[id])
 * - Full tape controls: stepBack, step, rewind, stepTo slider
 * - Position indicator showing current event position
 * - Messages projected from events at current tape position
 * - NO live workflow execution - purely for viewing recorded sessions
 *
 * @module apps/core-v2-demo/src/components/ReplayViewer
 */

import { type AnyEvent, projectEventsToMessages } from "@open-harness/core-v2";
import type { Message } from "@open-harness/core-v2/react";
import { useCallback, useEffect, useMemo, useState } from "react";

/**
 * Props for the ReplayViewer component.
 */
interface ReplayViewerProps {
  /**
   * Session ID to load and replay.
   */
  sessionId: string;

  /**
   * API base URL for fetching session data.
   * Defaults to "/api/sessions".
   */
  apiBase?: string;

  /**
   * Callback when user clicks "Back to Sessions" button.
   */
  onBack: () => void;
}

/**
 * Session data returned from the API.
 */
interface SessionData {
  id: string;
  events: AnyEvent[];
  createdAt: string;
  lastEventAt?: string;
  workflowName?: string;
}

/**
 * Local tape state for navigation.
 */
interface TapeState {
  events: readonly AnyEvent[];
  position: number;
  status: "idle" | "playing" | "paused";
}

/**
 * Tool invocation badge component.
 */
function ToolBadge({
  name,
  state,
}: {
  name: string;
  state: "pending" | "result" | "error";
}) {
  const stateStyles = {
    pending:
      "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800",
    result:
      "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800",
    error:
      "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800",
  };

  const stateIcons = {
    pending: (
      <svg
        className="h-3 w-3 animate-spin"
        viewBox="0 0 24 24"
        fill="none"
        role="img"
        aria-label="Loading"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
    ),
    result: (
      <svg
        className="h-3 w-3"
        viewBox="0 0 24 24"
        fill="currentColor"
        role="img"
        aria-label="Completed"
      >
        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
      </svg>
    ),
    error: (
      <svg
        className="h-3 w-3"
        viewBox="0 0 24 24"
        fill="currentColor"
        role="img"
        aria-label="Error"
      >
        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
      </svg>
    ),
  };

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${stateStyles[state]}`}
    >
      {stateIcons[state]}
      {name}
    </span>
  );
}

/**
 * Loading skeleton for the replay viewer.
 */
function LoadingSkeleton() {
  return (
    <div className="flex h-[600px] animate-pulse flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
      <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-700">
        <div className="h-5 w-48 rounded bg-zinc-200 dark:bg-zinc-700" />
        <div className="mt-2 h-4 w-32 rounded bg-zinc-200 dark:bg-zinc-700" />
      </div>
      <div className="flex-1 space-y-4 p-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex flex-col gap-2">
            <div className="h-12 w-3/4 rounded-lg bg-zinc-200 dark:bg-zinc-700" />
          </div>
        ))}
      </div>
      <div className="border-t border-zinc-200 px-4 py-3 dark:border-zinc-700">
        <div className="h-10 w-full rounded bg-zinc-200 dark:bg-zinc-700" />
      </div>
    </div>
  );
}

/**
 * Error display component.
 */
function ErrorDisplay({
  error,
  onRetry,
}: {
  error: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex h-[600px] flex-col items-center justify-center rounded-xl border border-zinc-200 bg-white p-8 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
      <div className="mb-4 rounded-full bg-red-100 p-4 dark:bg-red-900/30">
        <svg
          className="h-8 w-8 text-red-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="1.5"
          role="img"
          aria-label="Error"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
          />
        </svg>
      </div>
      <h3 className="mb-2 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
        Failed to Load Session
      </h3>
      <p className="mb-4 max-w-sm text-center text-sm text-zinc-500 dark:text-zinc-400">
        {error}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center gap-2 rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-600"
      >
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="2"
          role="img"
          aria-label="Retry"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
          />
        </svg>
        Retry
      </button>
    </div>
  );
}

/**
 * ReplayViewer component for viewing recorded sessions with time-travel controls.
 *
 * THE KILLER FEATURE: Step backward through history, jump to any position,
 * and see the workflow state at any point in time.
 */
export function ReplayViewer({
  sessionId,
  apiBase = "/api/sessions",
  onBack,
}: ReplayViewerProps) {
  // Loading and error state
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Session data
  const [sessionData, setSessionData] = useState<SessionData | null>(null);

  // Tape state for navigation
  const [tape, setTape] = useState<TapeState>({
    events: [],
    position: 0,
    status: "idle",
  });

  // Playback interval ref for play/pause
  const [playIntervalId, setPlayIntervalId] = useState<ReturnType<
    typeof setInterval
  > | null>(null);

  // Fetch session data from API
  const fetchSession = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${apiBase}/${sessionId}`);

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("Session not found");
        }
        throw new Error(`Failed to fetch session: ${response.statusText}`);
      }

      const data = (await response.json()) as SessionData;
      setSessionData(data);

      // Initialize tape at the last position (end of recording)
      const maxPos = Math.max(0, data.events.length - 1);
      setTape({
        events: data.events,
        position: maxPos,
        status: "idle",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load session");
    } finally {
      setIsLoading(false);
    }
  }, [apiBase, sessionId]);

  // Fetch on mount
  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  // Cleanup playback on unmount
  useEffect(() => {
    return () => {
      if (playIntervalId) {
        clearInterval(playIntervalId);
      }
    };
  }, [playIntervalId]);

  // Tape control functions
  const rewind = useCallback(() => {
    if (playIntervalId) {
      clearInterval(playIntervalId);
      setPlayIntervalId(null);
    }
    setTape((prev) => ({ ...prev, position: 0, status: "idle" }));
  }, [playIntervalId]);

  const step = useCallback(() => {
    setTape((prev) => {
      const maxPos = Math.max(0, prev.events.length - 1);
      return {
        ...prev,
        position: Math.min(prev.position + 1, maxPos),
      };
    });
  }, []);

  const stepBack = useCallback(() => {
    setTape((prev) => ({
      ...prev,
      position: Math.max(0, prev.position - 1),
    }));
  }, []);

  const stepTo = useCallback((position: number) => {
    setTape((prev) => {
      const maxPos = Math.max(0, prev.events.length - 1);
      return {
        ...prev,
        position: Math.max(0, Math.min(position, maxPos)),
      };
    });
  }, []);

  const play = useCallback(() => {
    if (playIntervalId) {
      // Already playing - pause
      clearInterval(playIntervalId);
      setPlayIntervalId(null);
      setTape((prev) => ({ ...prev, status: "paused" }));
      return;
    }

    // Start playing
    setTape((prev) => ({ ...prev, status: "playing" }));

    const intervalId = setInterval(() => {
      setTape((prev) => {
        const maxPos = Math.max(0, prev.events.length - 1);
        if (prev.position >= maxPos) {
          // Reached end - stop playing
          clearInterval(intervalId);
          setPlayIntervalId(null);
          return { ...prev, status: "paused" };
        }
        return { ...prev, position: prev.position + 1 };
      });
    }, 200); // 200ms between events

    setPlayIntervalId(intervalId);
  }, [playIntervalId]);

  // Project events to messages up to current position
  const messages = useMemo<readonly Message[]>(() => {
    if (tape.events.length === 0) {
      return [];
    }
    const eventsUpToPosition = tape.events.slice(0, tape.position + 1);
    return projectEventsToMessages(eventsUpToPosition);
  }, [tape.events, tape.position]);

  // Get current event for display
  const currentEvent = tape.events[tape.position];

  // Loading state
  if (isLoading) {
    return <LoadingSkeleton />;
  }

  // Error state
  if (error) {
    return <ErrorDisplay error={error} onRetry={fetchSession} />;
  }

  // No data state (shouldn't happen but handle gracefully)
  if (!sessionData) {
    return <ErrorDisplay error="No session data" onRetry={fetchSession} />;
  }

  return (
    <div
      className="flex h-[600px] flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
      data-testid="replay-viewer"
    >
      {/* Header */}
      <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-700">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700 dark:bg-violet-900/30 dark:text-violet-400">
                Replay Mode
              </span>
              <span className="font-mono text-sm font-medium text-zinc-700 dark:text-zinc-300">
                {sessionId.slice(0, 8)}...
              </span>
            </div>
            {sessionData.workflowName && (
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                {sessionData.workflowName}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1.5 rounded-lg bg-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-600"
            data-testid="back-to-sessions-button"
          >
            <svg
              className="h-3.5 w-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
              role="img"
              aria-label="Back"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"
              />
            </svg>
            Back to Sessions
          </button>
        </div>
      </div>

      {/* Messages container */}
      <div
        className="flex flex-1 flex-col gap-4 overflow-y-auto bg-gradient-to-b from-zinc-50 to-white p-4 dark:from-zinc-900 dark:to-zinc-800"
        data-testid="messages-container"
      >
        {messages.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
            <div className="rounded-full bg-zinc-100 p-4 dark:bg-zinc-800">
              <svg
                className="h-8 w-8 text-zinc-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="1.5"
                role="img"
                aria-label="Empty"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155"
                />
              </svg>
            </div>
            <div className="space-y-1">
              <p className="font-medium text-zinc-700 dark:text-zinc-300">
                No messages yet
              </p>
              <p className="max-w-sm text-sm text-zinc-500 dark:text-zinc-400">
                Use the tape controls below to step through the recorded events.
              </p>
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
              data-role={message.role}
              data-testid={`message-${message.role}`}
            >
              <div
                className={`max-w-[80%] ${
                  message.role === "user"
                    ? "rounded-2xl rounded-tr-sm bg-gradient-to-br from-blue-500 to-blue-600 px-4 py-3 text-white shadow-md"
                    : "rounded-2xl rounded-tl-sm border border-zinc-200 bg-white px-4 py-3 text-zinc-900 shadow-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                }`}
              >
                {/* Agent name badge if present */}
                {message.name && (
                  <div className="mb-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700 dark:bg-violet-900/30 dark:text-violet-400">
                      <svg
                        className="h-3 w-3"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        role="img"
                        aria-label="Agent"
                      >
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z" />
                      </svg>
                      {message.name}
                    </span>
                  </div>
                )}

                {/* Message content */}
                <div className="whitespace-pre-wrap leading-relaxed">
                  {message.content}
                </div>

                {/* Tool invocations with status badges */}
                {message.toolInvocations &&
                  message.toolInvocations.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5 border-t border-zinc-200/50 pt-2 dark:border-zinc-700/50">
                      {message.toolInvocations.map((tool) => (
                        <ToolBadge
                          key={tool.toolCallId}
                          name={tool.toolName}
                          state={tool.state}
                        />
                      ))}
                    </div>
                  )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Current event info */}
      <div className="border-t border-zinc-200 bg-zinc-50 px-4 py-2 dark:border-zinc-700 dark:bg-zinc-800/50">
        <div className="flex items-center justify-between text-xs">
          <span className="text-zinc-500 dark:text-zinc-400">
            Current Event:
          </span>
          {currentEvent ? (
            <span className="font-mono font-medium text-zinc-700 dark:text-zinc-300">
              {currentEvent.name}
            </span>
          ) : (
            <span className="text-zinc-400 dark:text-zinc-500">—</span>
          )}
        </div>
      </div>

      {/* Tape Controls - THE KILLER FEATURE */}
      <div
        className="border-t border-zinc-200 bg-white px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900"
        data-testid="tape-controls"
      >
        <div className="flex items-center gap-3">
          {/* Rewind button */}
          <button
            type="button"
            onClick={rewind}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-100 text-zinc-600 transition-colors hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
            title="Rewind to start"
            data-testid="rewind-button"
          >
            <svg
              className="h-4 w-4"
              fill="currentColor"
              viewBox="0 0 24 24"
              role="img"
              aria-label="Rewind"
            >
              <path d="M11 18V6l-8.5 6 8.5 6zm.5-6l8.5 6V6l-8.5 6z" />
            </svg>
          </button>

          {/* Step back button */}
          <button
            type="button"
            onClick={stepBack}
            disabled={tape.position === 0}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-100 text-zinc-600 transition-colors hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
            title="Step back"
            data-testid="step-back-button"
          >
            <svg
              className="h-4 w-4"
              fill="currentColor"
              viewBox="0 0 24 24"
              role="img"
              aria-label="Step back"
            >
              <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
            </svg>
          </button>

          {/* Play/Pause button */}
          <button
            type="button"
            onClick={play}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500 text-white transition-colors hover:bg-blue-600"
            title={tape.status === "playing" ? "Pause" : "Play"}
            data-testid="play-button"
          >
            {tape.status === "playing" ? (
              <svg
                className="h-4 w-4"
                fill="currentColor"
                viewBox="0 0 24 24"
                role="img"
                aria-label="Pause"
              >
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
              </svg>
            ) : (
              <svg
                className="h-4 w-4"
                fill="currentColor"
                viewBox="0 0 24 24"
                role="img"
                aria-label="Play"
              >
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>

          {/* Step forward button */}
          <button
            type="button"
            onClick={step}
            disabled={tape.position >= tape.events.length - 1}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-100 text-zinc-600 transition-colors hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
            title="Step forward"
            data-testid="step-button"
          >
            <svg
              className="h-4 w-4"
              fill="currentColor"
              viewBox="0 0 24 24"
              role="img"
              aria-label="Step forward"
            >
              <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
            </svg>
          </button>

          {/* Position slider */}
          <div className="flex flex-1 items-center gap-3">
            <input
              type="range"
              min={0}
              max={Math.max(0, tape.events.length - 1)}
              value={tape.position}
              onChange={(e) => stepTo(parseInt(e.target.value, 10))}
              className="h-2 flex-1 cursor-pointer appearance-none rounded-full bg-zinc-200 accent-blue-500 dark:bg-zinc-700"
              data-testid="position-slider"
            />
          </div>

          {/* Position indicator */}
          <div
            className="min-w-[80px] text-right font-mono text-sm tabular-nums text-zinc-600 dark:text-zinc-400"
            data-testid="position-indicator"
          >
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">
              {tape.position + 1}
            </span>
            <span className="mx-1">/</span>
            <span>{tape.events.length}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
