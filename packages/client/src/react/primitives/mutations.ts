/**
 * Primitive mutation hooks for React Query.
 *
 * Per ADR-013: Internal hooks that wrap WorkflowClient write operations.
 * These are building blocks for higher-level hooks - not exported publicly.
 *
 * @internal
 * @module
 */

import type { SerializedEvent } from "@open-scaffold/core"
import { useMutation } from "@tanstack/react-query"

import type { ForkResult, PauseResult, ResumeResult } from "../../Contract.js"
import { useWorkflowClient } from "../WorkflowClientProvider.js"

/**
 * @internal
 * Mutation to create a new session.
 *
 * @example
 * ```tsx
 * const { mutateAsync: createSession } = useCreateSessionMutation()
 * const sessionId = await createSession({ input: "Build a todo app" })
 * ```
 */
export const useCreateSessionMutation = () => {
  const { client } = useWorkflowClient()

  return useMutation({
    mutationFn: ({ input }: { input: string }): Promise<string> => client.createSession(input)
  })
}

/**
 * @internal
 * Mutation to send human input response.
 *
 * @example
 * ```tsx
 * const { mutateAsync: sendInput } = useSendInputMutation()
 * await sendInput({
 *   event: {
 *     id: crypto.randomUUID(),
 *     name: "input:received",
 *     payload: { id: "123", value: "approve", approved: true },
 *     timestamp: Date.now()
 *   }
 * })
 * ```
 */
export const useSendInputMutation = () => {
  const { client } = useWorkflowClient()

  return useMutation({
    mutationFn: ({ event }: { event: SerializedEvent }): Promise<void> => client.sendInput(event)
  })
}

/**
 * @internal
 * Mutation to pause a session.
 * Interrupts the workflow event loop.
 *
 * @example
 * ```tsx
 * const { mutateAsync: pause } = usePauseMutation()
 * const result = await pause()
 * if (result.wasPaused) {
 *   console.log("Session paused")
 * }
 * ```
 */
export const usePauseMutation = () => {
  const { client } = useWorkflowClient()

  return useMutation({
    mutationFn: (): Promise<PauseResult> => client.pause()
  })
}

/**
 * @internal
 * Mutation to resume a session.
 * Restarts the workflow event loop from where it left off.
 *
 * @example
 * ```tsx
 * const { mutateAsync: resume } = useResumeMutation()
 * const result = await resume()
 * if (result.wasResumed) {
 *   console.log("Session resumed")
 * }
 * ```
 */
export const useResumeMutation = () => {
  const { client } = useWorkflowClient()

  return useMutation({
    mutationFn: (): Promise<ResumeResult> => client.resume()
  })
}

/**
 * @internal
 * Mutation to fork a session.
 * Creates a new session with all events copied.
 *
 * @example
 * ```tsx
 * const { mutateAsync: fork } = useForkMutation()
 * const result = await fork()
 * console.log("Forked to:", result.sessionId)
 * ```
 */
export const useForkMutation = () => {
  const { client } = useWorkflowClient()

  return useMutation({
    mutationFn: (): Promise<ForkResult> => client.fork()
  })
}
