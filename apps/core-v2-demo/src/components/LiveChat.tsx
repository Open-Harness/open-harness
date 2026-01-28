"use client";

/**
 * LiveChat Component
 *
 * A specialized chat component for recording NEW workflow sessions.
 * This component is used during Live Mode when the user starts a new session.
 *
 * Key differences from ChatUI:
 * - NO tape controls (they don't work during live streaming!)
 * - Configured for recording (record: true, sessionId generation)
 * - "End Session" button to complete recording
 * - Focus on clean UX without time-travel debugging controls
 *
 * For replay mode with tape controls, use ReplayViewer instead.
 *
 * @module apps/core-v2-demo/src/components/LiveChat
 */

import { useWorkflow } from "@open-harness/core-v2/react";
import { type ChangeEvent, type FormEvent, useMemo } from "react";
import {
  createTaskExecutorWorkflow,
  type TaskWorkflowState,
} from "../lib/workflow";

/**
 * Props for the LiveChat component.
 */
interface LiveChatProps {
  /**
   * API endpoint URL for server-side workflow execution.
   */
  api: string;

  /**
   * Callback when the session ends.
   * Called when user clicks "End Session" button.
   */
  onSessionEnd: () => void;
}

/**
 * Loading spinner component with pulsing animation.
 */
function LoadingSpinner() {
  return (
    <div className="flex items-center gap-3" data-testid="loading-indicator">
      <div className="flex gap-1">
        <span className="h-2 w-2 animate-bounce rounded-full bg-blue-400 [animation-delay:-0.3s]" />
        <span className="h-2 w-2 animate-bounce rounded-full bg-blue-400 [animation-delay:-0.15s]" />
        <span className="h-2 w-2 animate-bounce rounded-full bg-blue-400" />
      </div>
      <span className="text-sm text-zinc-500 dark:text-zinc-400">
        AI is thinking...
      </span>
    </div>
  );
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
 * LiveChat component for recording new workflow sessions.
 *
 * Features:
 * - AI SDK-compatible patterns (messages, input, handleSubmit, isLoading)
 * - Recording enabled by default (record: true)
 * - NO tape controls (not applicable during live streaming)
 * - End Session button to complete recording
 * - Real-time workflow state display
 */
export function LiveChat({ api, onSessionEnd }: LiveChatProps) {
  // Create workflow instance once
  const workflow = useMemo(() => createTaskExecutorWorkflow(), []);

  // Use the workflow hook
  // NOTE: record is disabled until store integration is complete
  const { messages, input, setInput, handleSubmit, isLoading, error, state } =
    useWorkflow<TaskWorkflowState>(workflow, {
      api,
      record: false,
    });

  // Handle form submission
  const onSubmit = (e: FormEvent) => {
    handleSubmit(e);
  };

  // Handle input change
  const onInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
  };

  // Check if workflow is complete (to show end session button)
  const isComplete = state?.currentPhase === "complete";

  return (
    <div
      className="flex h-[600px] flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
      data-testid="live-chat"
    >
      {/* Messages container */}
      <div
        className="flex flex-1 flex-col gap-4 overflow-y-auto bg-gradient-to-b from-zinc-50 to-white p-4 dark:from-zinc-900 dark:to-zinc-800"
        data-testid="messages-container"
      >
        {messages.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
            <div className="rounded-full bg-blue-100 p-4 dark:bg-blue-900/30">
              <svg
                className="h-8 w-8 text-blue-500"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                role="img"
                aria-label="Chat"
              >
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <div className="space-y-1">
              <p className="font-medium text-zinc-700 dark:text-zinc-300">
                Start Recording
              </p>
              <p className="max-w-sm text-sm text-zinc-500 dark:text-zinc-400">
                Enter a goal and the AI will break it down into tasks. This
                session is being recorded for replay.
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

        {/* Loading indicator */}
        {isLoading && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-tl-sm border border-zinc-200 bg-white px-4 py-3 shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
              <LoadingSpinner />
            </div>
          </div>
        )}
      </div>

      {/* Error display */}
      {error && (
        <div
          className="mx-4 mb-2 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-400"
          data-testid="error-display"
        >
          <svg
            className="h-5 w-5 flex-shrink-0"
            viewBox="0 0 24 24"
            fill="currentColor"
            role="img"
            aria-label="Error"
          >
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
          </svg>
          <span>{error.message}</span>
        </div>
      )}

      {/* Workflow state display */}
      <div className="border-t border-zinc-200 bg-zinc-50 px-4 py-2.5 dark:border-zinc-700 dark:bg-zinc-800/50">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-blue-500" />
              <span className="text-zinc-500 dark:text-zinc-400">Phase:</span>
              <span className="font-semibold capitalize text-zinc-700 dark:text-zinc-300">
                {state?.currentPhase ?? "planning"}
              </span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="text-zinc-500 dark:text-zinc-400">Tasks:</span>
              <span className="font-semibold tabular-nums text-zinc-700 dark:text-zinc-300">
                {state?.tasks?.length ?? 0}
              </span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="text-zinc-500 dark:text-zinc-400">Done:</span>
              <span className="font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                {state?.executionResults?.length ?? 0}
              </span>
            </span>
          </div>
          {/* End Session button - visible when workflow is complete or has messages */}
          {(isComplete || messages.length > 0) && !isLoading && (
            <button
              type="button"
              onClick={onSessionEnd}
              className="flex items-center gap-1.5 rounded-lg bg-zinc-200 px-3 py-1 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-600"
              data-testid="end-session-button"
            >
              <svg
                className="h-3 w-3"
                viewBox="0 0 24 24"
                fill="currentColor"
                role="img"
                aria-label="Stop"
              >
                <rect x="6" y="6" width="12" height="12" rx="1" />
              </svg>
              End Session
            </button>
          )}
        </div>
      </div>

      {/* NOTE: No tape controls here - they don't work during live streaming! */}
      {/* Tape controls are only shown in ReplayViewer for recorded sessions */}

      {/* Input form */}
      <form
        onSubmit={onSubmit}
        className="flex gap-3 border-t border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900"
        data-testid="chat-form"
      >
        <input
          type="text"
          value={input}
          onChange={onInputChange}
          placeholder="Enter your goal..."
          disabled={isLoading || isComplete}
          className="flex-1 rounded-xl border border-zinc-300 bg-zinc-50 px-4 py-2.5 text-zinc-900 placeholder-zinc-400 transition-colors focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500 dark:focus:bg-zinc-700"
          data-testid="chat-input"
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim() || isComplete}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 px-5 py-2.5 font-semibold text-white shadow-md transition-all hover:from-blue-600 hover:to-blue-700 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 active:scale-[0.98] disabled:cursor-not-allowed disabled:from-zinc-400 disabled:to-zinc-500 disabled:shadow-none dark:focus:ring-offset-zinc-900"
          data-testid="submit-button"
        >
          {isLoading ? (
            <>
              <svg
                className="h-4 w-4 animate-spin"
                fill="none"
                viewBox="0 0 24 24"
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
              <span>Processing</span>
            </>
          ) : (
            <>
              <span>Send</span>
              <svg
                className="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                role="img"
                aria-label="Send"
              >
                <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
              </svg>
            </>
          )}
        </button>
      </form>
    </div>
  );
}
