/**
 * React hooks for Open Scaffold workflows.
 *
 * @module
 */

import type { AnyEvent } from "@open-scaffold/core"
import { useCallback, useContext, useEffect, useMemo, useState } from "react"

import type { ConnectionStatus, ForkResult, PauseResult, ResumeResult, StateAtResult } from "../Contract.js"
import { WorkflowContext } from "./context.js"

const useWorkflowContext = () => {
  const context = useContext(WorkflowContext)
  if (!context) {
    throw new Error("WorkflowProvider is missing. Wrap your app in <WorkflowProvider />.")
  }
  return context
}

/**
 * Get all events from the current workflow session.
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const events = useEvents()
 *   return <div>{events.length} events</div>
 * }
 * ```
 */
export const useEvents = (): ReadonlyArray<AnyEvent> => {
  return useWorkflowContext().events
}

/**
 * Get the current computed state from the workflow.
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const state = useWorkflowState<MyState>()
 *   return <div>{state?.taskCount} tasks</div>
 * }
 * ```
 */
export const useWorkflowState = <S>(): S | undefined => {
  return useWorkflowContext().state as S | undefined
}

/**
 * Get a stable function to send user input events.
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const send = useSendInput()
 *   return <button onClick={() => send({ type: "user:click" })}>Click</button>
 * }
 * ```
 */
export const useSendInput = (): (event: AnyEvent) => Promise<void> => {
  return useWorkflowContext().sendInput
}

/**
 * Get the current connection status.
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const status = useStatus()
 *   return <div>Status: {status}</div>
 * }
 * ```
 */
export const useStatus = (): ConnectionStatus => {
  return useWorkflowContext().status
}

/**
 * Get a stable function to create a new session.
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const createSession = useCreateSession()
 *   return <button onClick={() => createSession("Build a todo app")}>Start</button>
 * }
 * ```
 */
export const useCreateSession = (): (input: string) => Promise<string> => {
  return useWorkflowContext().createSession
}

/**
 * Get a stable function to connect to an existing session.
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const connect = useConnectSession()
 *   return <button onClick={() => connect("session-id")}>Connect</button>
 * }
 * ```
 */
export const useConnectSession = (): (sessionId: string) => Promise<void> => {
  return useWorkflowContext().connectSession
}

/**
 * Get the current session ID.
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const sessionId = useSessionId()
 *   return <div>Session: {sessionId ?? "Not connected"}</div>
 * }
 * ```
 */
export const useSessionId = (): string | null => {
  return useWorkflowContext().sessionId
}

/**
 * Get a stable function to disconnect from the current session.
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const disconnect = useDisconnect()
 *   return <button onClick={disconnect}>Disconnect</button>
 * }
 * ```
 */
export const useDisconnect = (): () => Promise<void> => {
  return useWorkflowContext().disconnect
}

/**
 * Get the current position in the event stream (number of events received).
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const position = usePosition()
 *   return <div>Position: {position}</div>
 * }
 * ```
 */
export const usePosition = (): number => {
  return useWorkflowContext().events.length
}

/**
 * Check if the client is currently connected.
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const isConnected = useIsConnected()
 *   return <div>{isConnected ? "Connected" : "Not connected"}</div>
 * }
 * ```
 */
export const useIsConnected = (): boolean => {
  return useWorkflowContext().status === "connected"
}

/**
 * Options for filtering events.
 */
export interface UseFilteredEventsOptions {
  /** Filter by event name(s) - matches the event's `name` property */
  readonly name?: string | ReadonlyArray<string>
}

/**
 * Get events filtered by name.
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const textEvents = useFilteredEvents({ name: "text:delta" })
 *   const agentEvents = useFilteredEvents({ name: ["agent:started", "agent:completed"] })
 *   return <div>{textEvents.length} text events</div>
 * }
 * ```
 */
export const useFilteredEvents = (options: UseFilteredEventsOptions): ReadonlyArray<AnyEvent> => {
  const events = useWorkflowContext().events
  return useMemo(() => {
    if (!options.name) {
      return events
    }
    const names = Array.isArray(options.name) ? options.name : [options.name]
    return events.filter((event) => names.includes(event.name))
  }, [events, options.name])
}

/**
 * Result from useStateAt hook.
 */
export interface UseStateAtResult<S> {
  /** The computed state (undefined while loading or on error) */
  readonly state: S | undefined
  /** Whether the state is currently being fetched */
  readonly isLoading: boolean
  /** Error if the fetch failed */
  readonly error: Error | undefined
  /** Refetch the state at the current position */
  readonly refetch: () => void
}

/**
 * Get the state at a specific position in the event history.
 * Enables time-travel debugging by replaying events up to the given position.
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const position = usePosition()
 *   const [targetPosition, setTargetPosition] = useState(0)
 *   const { state, isLoading } = useStateAt<MyState>(targetPosition)
 *
 *   return (
 *     <div>
 *       <input
 *         type="range"
 *         min={0}
 *         max={position}
 *         value={targetPosition}
 *         onChange={(e) => setTargetPosition(Number(e.target.value))}
 *       />
 *       {isLoading ? "Loading..." : JSON.stringify(state)}
 *     </div>
 *   )
 * }
 * ```
 */
export const useStateAt = <S>(position: number): UseStateAtResult<S> => {
  const { client, sessionId } = useWorkflowContext()
  const [result, setResult] = useState<StateAtResult<S> | undefined>(undefined)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | undefined>(undefined)
  const [fetchTrigger, setFetchTrigger] = useState(0)

  const refetch = useCallback(() => {
    setFetchTrigger((prev) => prev + 1)
  }, [])

  useEffect(() => {
    if (!client || !sessionId) {
      setResult(undefined)
      setError(undefined)
      return
    }

    let cancelled = false
    setIsLoading(true)
    setError(undefined)

    client
      .getStateAt<S>(position)
      .then((res) => {
        if (!cancelled) {
          setResult(res)
          setIsLoading(false)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error(String(err)))
          setIsLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [client, sessionId, position, fetchTrigger])

  return {
    state: result?.state,
    isLoading,
    error,
    refetch
  }
}

// ─────────────────────────────────────────────────────────────────
// VCR Hooks
// ─────────────────────────────────────────────────────────────────

/**
 * Get a stable function to pause the current session.
 * Pausing interrupts the workflow event loop.
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const pause = usePause()
 *   return <button onClick={() => pause()}>Pause</button>
 * }
 * ```
 */
export const usePause = (): () => Promise<PauseResult> => {
  return useWorkflowContext().pause
}

/**
 * Get a stable function to resume the current session.
 * Resuming restarts the workflow event loop from where it left off.
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const resume = useResume()
 *   return <button onClick={() => resume()}>Resume</button>
 * }
 * ```
 */
export const useResume = (): () => Promise<ResumeResult> => {
  return useWorkflowContext().resume
}

/**
 * Get a stable function to fork the current session.
 * Forking creates a new session with all events copied.
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const fork = useFork()
 *   const handleFork = async () => {
 *     const result = await fork()
 *     console.log("Forked to:", result.sessionId)
 *   }
 *   return <button onClick={handleFork}>Fork</button>
 * }
 * ```
 */
export const useFork = (): () => Promise<ForkResult> => {
  return useWorkflowContext().fork
}

/**
 * Check if the session is currently running.
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const isRunning = useIsRunning()
 *   return <div>{isRunning ? "Running" : "Stopped"}</div>
 * }
 * ```
 */
export const useIsRunning = (): boolean => {
  return useWorkflowContext().isRunning
}

/**
 * Check if the session is currently paused.
 * A session is paused when it has events but is not running.
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const isPaused = useIsPaused()
 *   return <div>{isPaused ? "Paused" : "Active"}</div>
 * }
 * ```
 */
export const useIsPaused = (): boolean => {
  return useWorkflowContext().isPaused
}

// ─────────────────────────────────────────────────────────────────
// HITL Hooks
// ─────────────────────────────────────────────────────────────────

/**
 * Pending interaction request.
 */
export interface PendingInteraction {
  /** Unique ID for this interaction */
  readonly interactionId: string
  /** Agent requesting input */
  readonly agent: string
  /** Human-readable prompt */
  readonly prompt: string
  /** Type of input expected */
  readonly type: "approval" | "choice"
  /** For choice type: available options */
  readonly options?: ReadonlyArray<string>
  /** Optional metadata for UI rendering */
  readonly metadata?: Record<string, unknown>
}

/**
 * Get the first pending interaction that needs human input.
 *
 * Returns the oldest unresponded interaction request, or null if none.
 * Use this to show a modal or form for human input.
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const pending = usePendingInteraction()
 *   const sendInput = useSendInput()
 *
 *   if (!pending) return null
 *
 *   return (
 *     <div>
 *       <p>{pending.prompt}</p>
 *       {pending.type === "approval" && (
 *         <>
 *           <button onClick={() => sendInput({
 *             id: crypto.randomUUID(),
 *             name: "input:response",
 *             payload: { interactionId: pending.interactionId, value: "approve", approved: true },
 *             timestamp: new Date()
 *           })}>Approve</button>
 *           <button onClick={() => sendInput({
 *             id: crypto.randomUUID(),
 *             name: "input:response",
 *             payload: { interactionId: pending.interactionId, value: "reject", approved: false },
 *             timestamp: new Date()
 *           })}>Reject</button>
 *         </>
 *       )}
 *     </div>
 *   )
 * }
 * ```
 */
// Helper to parse interaction events from event stream
const parsePendingInteractions = (
  events: ReadonlyArray<AnyEvent>
): ReadonlyArray<PendingInteraction> => {
  const requests = new Map<string, PendingInteraction>()
  const respondedIds = new Set<string>()

  for (const event of events) {
    if (event.name === "input:requested") {
      const payload = event.payload as {
        interactionId: string
        agent: string
        prompt: string
        type: "approval" | "choice"
        options?: ReadonlyArray<string>
        metadata?: Record<string, unknown>
      }
      const pending: PendingInteraction = {
        interactionId: payload.interactionId,
        agent: payload.agent,
        prompt: payload.prompt,
        type: payload.type,
        ...(payload.options ? { options: payload.options } : {}),
        ...(payload.metadata ? { metadata: payload.metadata } : {})
      }
      requests.set(payload.interactionId, pending)
    } else if (event.name === "input:response") {
      const payload = event.payload as { interactionId: string }
      respondedIds.add(payload.interactionId)
    }
  }

  return Array.from(requests.entries())
    .filter(([id]) => !respondedIds.has(id))
    .map(([, request]) => request)
}

export const usePendingInteraction = (): PendingInteraction | null => {
  const events = useWorkflowContext().events

  return useMemo(() => {
    const pending = parsePendingInteractions(events)
    return pending.length > 0 ? pending[0] : null
  }, [events])
}

/**
 * Get all pending interactions that need human input.
 *
 * Returns all unresponded interaction requests in chronological order.
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const pendingList = usePendingInteractions()
 *   return <div>{pendingList.length} pending interactions</div>
 * }
 * ```
 */
export const usePendingInteractions = (): ReadonlyArray<PendingInteraction> => {
  const events = useWorkflowContext().events

  return useMemo(() => parsePendingInteractions(events), [events])
}
