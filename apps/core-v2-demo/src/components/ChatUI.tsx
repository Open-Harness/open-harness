"use client";

/**
 * ChatUI Component
 *
 * A React component that demonstrates core-v2's React integration:
 * - useWorkflow hook for AI SDK-compatible patterns
 * - Messages list with user/assistant styling
 * - Input field with submit button
 * - Loading indicator and error display
 * - Tape controls for time-travel debugging
 *
 * @module apps/core-v2-demo/src/components/ChatUI
 */

import { useWorkflow } from "@open-harness/core-v2/react";
import { type ChangeEvent, type FormEvent, useMemo } from "react";
import {
  createTaskExecutorWorkflow,
  type TaskWorkflowState,
} from "../lib/workflow";

/**
 * Props for the ChatUI component.
 */
interface ChatUIProps {
  /**
   * API endpoint URL for server-side workflow execution.
   * If not provided, runs workflow locally (client-side).
   */
  api?: string;
}

/**
 * ChatUI component that uses useWorkflow hook from @open-harness/core-v2/react.
 *
 * Features:
 * - AI SDK-compatible patterns (messages, input, handleSubmit, isLoading)
 * - Time-travel debugging via tape controls (stepBack, step, rewind)
 * - Real-time workflow state display
 * - Tailwind CSS styling for visual feedback
 */
export function ChatUI({ api }: ChatUIProps) {
  // Create workflow instance once
  const workflow = useMemo(() => createTaskExecutorWorkflow(), []);

  // Use the workflow hook - AI SDK compatible + Open Harness unique values
  const {
    messages,
    input,
    setInput,
    handleSubmit,
    isLoading,
    error,
    state,
    tape,
  } = useWorkflow<TaskWorkflowState>(workflow, { api });

  // Handle form submission
  const onSubmit = (e: FormEvent) => {
    handleSubmit(e);
  };

  // Handle input change
  const onInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
  };

  return (
    <div className="flex h-[600px] flex-col rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
      {/* Messages container */}
      <div
        className="flex flex-1 flex-col gap-3 overflow-y-auto p-4"
        data-testid="messages-container"
      >
        {messages.length === 0 ? (
          <div className="text-center text-zinc-400 dark:text-zinc-500">
            Enter a goal to get started. The AI will break it down into tasks
            and execute them.
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`max-w-[80%] rounded-lg px-4 py-2 ${
                message.role === "user"
                  ? "ml-auto bg-blue-500 text-white"
                  : "mr-auto bg-zinc-100 text-zinc-900 dark:bg-zinc-700 dark:text-zinc-100"
              }`}
              data-role={message.role}
              data-testid={`message-${message.role}`}
            >
              {/* Agent name if present */}
              {message.name && (
                <div className="mb-1 text-xs opacity-70">{message.name}</div>
              )}

              {/* Message content */}
              <div className="whitespace-pre-wrap">{message.content}</div>

              {/* Tool invocations if present */}
              {message.toolInvocations &&
                message.toolInvocations.length > 0 && (
                  <div className="mt-2 text-xs opacity-70">
                    Tools:{" "}
                    {message.toolInvocations.map((t) => t.toolName).join(", ")}
                  </div>
                )}
            </div>
          ))
        )}

        {/* Loading indicator */}
        {isLoading && (
          <div
            className="flex items-center gap-2 text-zinc-400 dark:text-zinc-500"
            data-testid="loading-indicator"
          >
            <svg
              className="h-4 w-4 animate-spin"
              fill="none"
              viewBox="0 0 24 24"
              role="img"
              aria-label="Loading spinner"
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
            <span>Processing...</span>
          </div>
        )}
      </div>

      {/* Error display */}
      {error && (
        <div
          className="mx-4 mb-2 rounded bg-red-100 px-3 py-2 text-sm text-red-600 dark:bg-red-900/30 dark:text-red-400"
          data-testid="error-display"
        >
          {error.message}
        </div>
      )}

      {/* Workflow state display */}
      <div className="border-t border-zinc-200 bg-zinc-50 px-4 py-2 dark:border-zinc-700 dark:bg-zinc-800/50">
        <div className="flex items-center gap-4 text-xs text-zinc-500 dark:text-zinc-400">
          <span>
            Phase:{" "}
            <span className="font-medium text-zinc-700 dark:text-zinc-300">
              {state?.currentPhase ?? "planning"}
            </span>
          </span>
          <span>
            Tasks:{" "}
            <span className="font-medium text-zinc-700 dark:text-zinc-300">
              {state?.tasks?.length ?? 0}
            </span>
          </span>
          <span>
            Completed:{" "}
            <span className="font-medium text-zinc-700 dark:text-zinc-300">
              {state?.executionResults?.length ?? 0}
            </span>
          </span>
        </div>
      </div>

      {/* Tape controls */}
      <div
        className="flex items-center gap-2 border-t border-zinc-200 bg-zinc-50 px-4 py-2 dark:border-zinc-700 dark:bg-zinc-800/50"
        data-testid="tape-controls"
      >
        <button
          type="button"
          onClick={tape.rewind}
          className="rounded px-2 py-1 text-sm transition-colors hover:bg-zinc-200 dark:hover:bg-zinc-700"
          title="Rewind to start"
          data-testid="rewind-button"
        >
          Rewind
        </button>
        <button
          type="button"
          onClick={tape.stepBack}
          className="rounded px-2 py-1 text-sm transition-colors hover:bg-zinc-200 dark:hover:bg-zinc-700"
          title="Step back"
          data-testid="step-back-button"
        >
          Step Back
        </button>
        <span
          className="min-w-[80px] text-center text-sm text-zinc-600 dark:text-zinc-400"
          data-testid="position-indicator"
        >
          Position {tape.position + 1} of {tape.length || 1}
        </span>
        <button
          type="button"
          onClick={tape.step}
          className="rounded px-2 py-1 text-sm transition-colors hover:bg-zinc-200 dark:hover:bg-zinc-700"
          title="Step forward"
          data-testid="step-button"
        >
          Step
        </button>
      </div>

      {/* Input form */}
      <form
        onSubmit={onSubmit}
        className="flex gap-2 border-t border-zinc-200 p-4 dark:border-zinc-700"
        data-testid="chat-form"
      >
        <input
          type="text"
          value={input}
          onChange={onInputChange}
          placeholder="Enter your goal..."
          disabled={isLoading}
          className="flex-1 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-zinc-900 placeholder-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100 dark:placeholder-zinc-500"
          data-testid="chat-input"
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="rounded-lg bg-blue-500 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:focus:ring-offset-zinc-900"
          data-testid="submit-button"
        >
          {isLoading ? "Processing..." : "Send"}
        </button>
      </form>
    </div>
  );
}
