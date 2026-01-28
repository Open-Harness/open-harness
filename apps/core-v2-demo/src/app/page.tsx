"use client";

/**
 * Core V2 Demo - Main Page
 *
 * Demonstrates the core-v2 package's React integration with:
 * - Session management via SessionList (landing view)
 * - Live Mode: Recording new sessions with LiveChat
 * - Replay Mode: Time-travel debugging of recorded sessions (TODO)
 *
 * Architecture:
 * - "list" mode: SessionList showing all recorded sessions
 * - "live" mode: LiveChat for recording new sessions (no tape controls)
 * - "replay" mode: ReplayViewer for time-travel debugging (pending implementation)
 *
 * @module apps/core-v2-demo/src/app/page
 */

import { useCallback, useState } from "react";
import { LiveChat } from "@/components/LiveChat";
import { ReplayViewer } from "@/components/ReplayViewer";
import { SessionList } from "@/components/SessionList";

/**
 * Application mode type.
 * - list: Landing view showing all recorded sessions
 * - live: Recording a new session
 * - replay: Viewing a recorded session with time-travel controls
 */
type AppMode = "list" | "live" | "replay";

/**
 * Back button component for returning to session list.
 */
function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mb-4 flex items-center gap-2 text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
      data-testid="back-button"
    >
      <svg
        className="h-4 w-4"
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
  );
}

/**
 * Recording indicator shown during live sessions.
 */
function RecordingIndicator() {
  return (
    <div
      className="mb-4 flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 dark:border-red-800 dark:bg-red-900/20"
      data-testid="recording-indicator"
    >
      <span className="relative flex h-3 w-3">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
        <span className="relative inline-flex h-3 w-3 rounded-full bg-red-500" />
      </span>
      <span className="text-sm font-medium text-red-700 dark:text-red-400">
        Recording Session
      </span>
    </div>
  );
}

export default function Home() {
  const [mode, setMode] = useState<AppMode>("list");
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    null,
  );

  // Handle "New Session" button click - enter Live Mode
  const handleNewSession = useCallback(() => {
    setMode("live");
    setSelectedSessionId(null);
  }, []);

  // Handle session row click - enter Replay Mode
  const handleSelectSession = useCallback((sessionId: string) => {
    setSelectedSessionId(sessionId);
    setMode("replay");
  }, []);

  // Handle back button - return to List Mode
  const handleBackToList = useCallback(() => {
    setMode("list");
    setSelectedSessionId(null);
  }, []);

  return (
    <main className="flex min-h-screen flex-col items-center bg-zinc-50 px-6 py-12 dark:bg-zinc-900">
      <div className="w-full max-w-3xl">
        <h1 className="mb-4 text-center text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          Core V2 Demo
        </h1>
        <p className="mb-8 text-center text-lg text-zinc-600 dark:text-zinc-400">
          Event-sourced workflow system with time-travel debugging.
        </p>

        {/* List Mode - Landing View */}
        {mode === "list" && (
          <SessionList
            onNewSession={handleNewSession}
            onSelectSession={handleSelectSession}
          />
        )}

        {/* Live Mode - Recording New Session */}
        {mode === "live" && (
          <>
            <BackButton onClick={handleBackToList} />
            <RecordingIndicator />
            <LiveChat api="/api/workflow" onSessionEnd={handleBackToList} />
          </>
        )}

        {/* Replay Mode - Time-Travel Debugging */}
        {mode === "replay" && selectedSessionId && (
          <ReplayViewer
            sessionId={selectedSessionId}
            onBack={handleBackToList}
          />
        )}
      </div>
    </main>
  );
}
