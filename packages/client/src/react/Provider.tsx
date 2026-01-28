/**
 * WorkflowProvider - React component that provides workflow context.
 *
 * @module
 */

import type { ReactNode } from "react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import type { AnyEvent } from "@open-scaffold/core"

import { HttpClient } from "../HttpClient.js"
import type { ConnectionStatus, ForkResult, PauseResult, ResumeResult, WorkflowClient } from "../Contract.js"
import { WorkflowContext } from "./context.js"

/**
 * Props for WorkflowProvider.
 */
export interface WorkflowProviderProps {
  /** Server URL */
  readonly url: string
  /** Optional initial session ID to connect to */
  readonly sessionId?: string
  /** Children to render */
  readonly children: ReactNode
}

/**
 * Provider component for Open Scaffold workflows.
 *
 * @example
 * ```tsx
 * <WorkflowProvider url="http://localhost:42069">
 *   <MyApp />
 * </WorkflowProvider>
 * ```
 */
export const WorkflowProvider = (_props: WorkflowProviderProps): ReactNode => {
  const [client, setClient] = useState<WorkflowClient | null>(null)
  const clientRef = useRef<WorkflowClient | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(_props.sessionId ?? null)
  const [events, setEvents] = useState<ReadonlyArray<AnyEvent>>([])
  const [state, setState] = useState<unknown>(undefined)
  const [status, setStatus] = useState<ConnectionStatus>("disconnected")
  const [isRunning, setIsRunning] = useState(false)
  const connectionVersion = useRef(0)
  const activeSessionId = useRef<string | null>(null)

  useEffect(() => {
    const instance = HttpClient({ url: _props.url })
    clientRef.current = instance
    setClient(instance)
    setStatus(instance.status)

    return () => {
      connectionVersion.current += 1
      void instance.disconnect()
      clientRef.current = null
      setClient(null)
      setStatus("disconnected")
    }
  }, [_props.url])

  const startEventLoop = useCallback((instance: WorkflowClient, version: number) => {
    void (async () => {
      try {
        for await (const event of instance.events()) {
          if (connectionVersion.current !== version) {
            return
          }
          setEvents((prev) => [...prev, event])
          setStatus(instance.status)
          try {
            const snapshot = await instance.getState<unknown>()
            if (connectionVersion.current === version) {
              setState(snapshot)
            }
          } catch {
            // Ignore state fetch errors; events are still the source of truth.
          }
        }
      } catch {
        if (connectionVersion.current === version) {
          setStatus("error")
        }
      }
    })()
  }, [])

  const connectToSession = useCallback(
    async (targetSessionId: string) => {
      const instance = clientRef.current
      if (!instance) {
        throw new Error("Workflow client not initialized")
      }

      if (activeSessionId.current !== targetSessionId) {
        setEvents([])
        setState(undefined)
      }

      activeSessionId.current = targetSessionId
      setSessionId(targetSessionId)
      setStatus("connecting")

      connectionVersion.current += 1
      const version = connectionVersion.current

      await instance.connect(targetSessionId)
      if (connectionVersion.current !== version) {
        return
      }

      setStatus(instance.status)

      try {
        const [snapshot, sessionInfo] = await Promise.all([
          instance.getState<unknown>(),
          instance.getSession()
        ])
        if (connectionVersion.current === version) {
          setState(snapshot)
          setIsRunning(sessionInfo.running)
        }
      } catch {
        // Ignore state/session fetch errors on initial connect.
      }

      startEventLoop(instance, version)
    },
    [startEventLoop]
  )

  useEffect(() => {
    if (_props.sessionId) {
      void connectToSession(_props.sessionId)
    }
  }, [_props.sessionId, connectToSession])

  const createSession = useCallback(
    async (input: string) => {
      const instance = clientRef.current
      if (!instance) {
        throw new Error("Workflow client not initialized")
      }
      const created = await instance.createSession(input)
      setIsRunning(true)
      await connectToSession(created)
      return created
    },
    [connectToSession]
  )

  const sendInput = useCallback(async (event: AnyEvent) => {
    const instance = clientRef.current
    if (!instance) {
      throw new Error("Workflow client not initialized")
    }
    await instance.sendInput(event)
  }, [])

  const disconnect = useCallback(async () => {
    const instance = clientRef.current
    if (!instance) {
      return
    }
    connectionVersion.current += 1
    await instance.disconnect()
    activeSessionId.current = null
    setSessionId(null)
    setEvents([])
    setState(undefined)
    setStatus("disconnected")
    setIsRunning(false)
  }, [])

  const pause = useCallback(async (): Promise<PauseResult> => {
    const instance = clientRef.current
    if (!instance) {
      throw new Error("Workflow client not initialized")
    }
    const result = await instance.pause()
    if (result.wasPaused) {
      setIsRunning(false)
    }
    return result
  }, [])

  const resume = useCallback(async (): Promise<ResumeResult> => {
    const instance = clientRef.current
    if (!instance) {
      throw new Error("Workflow client not initialized")
    }
    const result = await instance.resume()
    if (result.wasResumed) {
      setIsRunning(true)
    }
    return result
  }, [])

  const fork = useCallback(async (): Promise<ForkResult> => {
    const instance = clientRef.current
    if (!instance) {
      throw new Error("Workflow client not initialized")
    }
    return instance.fork()
  }, [])

  // Derive isPaused: session exists and has events but not running
  const isPaused = sessionId !== null && events.length > 0 && !isRunning

  const value = useMemo(
    () => ({
      client,
      sessionId,
      events,
      state,
      status,
      createSession,
      connectSession: connectToSession,
      sendInput,
      disconnect,
      pause,
      resume,
      fork,
      isRunning,
      isPaused
    }),
    [client, sessionId, events, state, status, createSession, connectToSession, sendInput, disconnect, pause, resume, fork, isRunning, isPaused]
  )

  return <WorkflowContext.Provider value={value}>{_props.children}</WorkflowContext.Provider>
}
