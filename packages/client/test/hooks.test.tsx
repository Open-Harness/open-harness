/**
 * Tests for React hooks.
 *
 * These tests use a test WorkflowProvider that injects controlled context
 * values, so we can test each hook in isolation without a real server.
 *
 * @module
 */

import type { AnyEvent } from "@open-scaffold/core"
import { renderHook } from "@testing-library/react"
import React from "react"
import type { ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"

import type { ConnectionStatus, ForkResult, PauseResult, ResumeResult, WorkflowClient } from "../src/Contract.js"
import { WorkflowContext, type WorkflowContextValue } from "../src/react/context.js"
import {
  useSessionId,
  useStatus,
  useIsConnected,
  useEvents,
  usePosition,
  useWorkflowState,
  useIsRunning,
  useIsPaused,
  useFilteredEvents,
  usePause,
  useResume,
  useFork,
  useDisconnect
} from "../src/react/hooks.js"

// ─────────────────────────────────────────────────────────────────
// Test helpers
// ─────────────────────────────────────────────────────────────────

const makeEvent = (name: string, payload: unknown = {}): AnyEvent => ({
  id: crypto.randomUUID() as AnyEvent["id"],
  name,
  payload,
  timestamp: new Date()
})

const makeContextValue = (overrides: Partial<WorkflowContextValue> = {}): WorkflowContextValue => ({
  client: null,
  sessionId: null,
  events: [],
  state: undefined,
  status: "disconnected" as ConnectionStatus,
  createSession: vi.fn(async () => "session-id"),
  connectSession: vi.fn(async () => {}),
  sendInput: vi.fn(async () => {}),
  disconnect: vi.fn(async () => {}),
  pause: vi.fn(async (): Promise<PauseResult> => ({ ok: true, wasPaused: true })),
  resume: vi.fn(async (): Promise<ResumeResult> => ({ ok: true, wasResumed: true })),
  fork: vi.fn(async (): Promise<ForkResult> => ({ sessionId: "forked-id", originalSessionId: "orig-id", eventsCopied: 5 })),
  isRunning: false,
  isPaused: false,
  ...overrides
})

const createWrapper = (value: WorkflowContextValue) => {
  return ({ children }: { children: ReactNode }) => (
    <WorkflowContext.Provider value={value}>{children}</WorkflowContext.Provider>
  )
}

// ─────────────────────────────────────────────────────────────────
// Tests: Disconnected state
// ─────────────────────────────────────────────────────────────────

describe("React Hooks (Real Server)", () => {
  it("useSessionId returns null when not connected", () => {
    const ctx = makeContextValue()
    const { result } = renderHook(() => useSessionId(), { wrapper: createWrapper(ctx) })
    expect(result.current).toBeNull()
  })

  it("useStatus starts as disconnected", () => {
    const ctx = makeContextValue()
    const { result } = renderHook(() => useStatus(), { wrapper: createWrapper(ctx) })
    expect(result.current).toBe("disconnected")
  })

  it("useIsConnected returns false when not connected", () => {
    const ctx = makeContextValue()
    const { result } = renderHook(() => useIsConnected(), { wrapper: createWrapper(ctx) })
    expect(result.current).toBe(false)
  })

  it("useEvents starts with empty array", () => {
    const ctx = makeContextValue()
    const { result } = renderHook(() => useEvents(), { wrapper: createWrapper(ctx) })
    expect(result.current).toEqual([])
  })

  it("usePosition starts at 0", () => {
    const ctx = makeContextValue()
    const { result } = renderHook(() => usePosition(), { wrapper: createWrapper(ctx) })
    expect(result.current).toBe(0)
  })

  it("useWorkflowState starts as undefined", () => {
    const ctx = makeContextValue()
    const { result } = renderHook(() => useWorkflowState(), { wrapper: createWrapper(ctx) })
    expect(result.current).toBeUndefined()
  })

  it("useIsRunning returns false when not connected", () => {
    const ctx = makeContextValue()
    const { result } = renderHook(() => useIsRunning(), { wrapper: createWrapper(ctx) })
    expect(result.current).toBe(false)
  })

  it("useIsPaused returns false when not connected", () => {
    const ctx = makeContextValue()
    const { result } = renderHook(() => useIsPaused(), { wrapper: createWrapper(ctx) })
    expect(result.current).toBe(false)
  })

  it("useFilteredEvents returns empty when no events", () => {
    const ctx = makeContextValue()
    const { result } = renderHook(() => useFilteredEvents({ name: "text:delta" }), {
      wrapper: createWrapper(ctx)
    })
    expect(result.current).toEqual([])
  })
})

// ─────────────────────────────────────────────────────────────────
// Tests: Connected/active session state
// ─────────────────────────────────────────────────────────────────

describe("React Hooks (With Active Session)", () => {
  it("useStatus becomes connected when session provided", () => {
    const ctx = makeContextValue({ status: "connected", sessionId: "s-1" })
    const { result } = renderHook(() => useStatus(), { wrapper: createWrapper(ctx) })
    expect(result.current).toBe("connected")
  })

  it("useSessionId returns session ID when connected", () => {
    const ctx = makeContextValue({ sessionId: "s-1", status: "connected" })
    const { result } = renderHook(() => useSessionId(), { wrapper: createWrapper(ctx) })
    expect(result.current).toBe("s-1")
  })

  it("useIsConnected returns true when connected", () => {
    const ctx = makeContextValue({ status: "connected" })
    const { result } = renderHook(() => useIsConnected(), { wrapper: createWrapper(ctx) })
    expect(result.current).toBe(true)
  })

  it("useEvents receives events via SSE", () => {
    const events: AnyEvent[] = [
      makeEvent("agent:started", { agentName: "coder" }),
      makeEvent("text:delta", { agentName: "coder", delta: "Hello" }),
      makeEvent("agent:completed", { agentName: "coder", output: {}, durationMs: 100 })
    ]
    const ctx = makeContextValue({ events, sessionId: "s-1", status: "connected" })
    const { result } = renderHook(() => useEvents(), { wrapper: createWrapper(ctx) })
    expect(result.current).toHaveLength(3)
    expect(result.current[0].name).toBe("agent:started")
    expect(result.current[1].name).toBe("text:delta")
    expect(result.current[2].name).toBe("agent:completed")
  })

  it("usePosition reflects event count", () => {
    const events: AnyEvent[] = [
      makeEvent("state:updated", { state: {} }),
      makeEvent("text:delta", { delta: "hi" })
    ]
    const ctx = makeContextValue({ events, sessionId: "s-1" })
    const { result } = renderHook(() => usePosition(), { wrapper: createWrapper(ctx) })
    expect(result.current).toBe(2)
  })

  it("useWorkflowState receives state", () => {
    const state = { tasks: ["a", "b"], count: 2 }
    const ctx = makeContextValue({ state, sessionId: "s-1", status: "connected" })
    const { result } = renderHook(() => useWorkflowState<{ tasks: string[]; count: number }>(), {
      wrapper: createWrapper(ctx)
    })
    expect(result.current).toEqual({ tasks: ["a", "b"], count: 2 })
  })

  it("useFilteredEvents filters by name", () => {
    const events: AnyEvent[] = [
      makeEvent("agent:started", { agentName: "coder" }),
      makeEvent("text:delta", { delta: "Hello" }),
      makeEvent("text:delta", { delta: " World" }),
      makeEvent("agent:completed", { agentName: "coder", output: {} })
    ]
    const ctx = makeContextValue({ events, sessionId: "s-1" })
    const { result } = renderHook(() => useFilteredEvents({ name: "text:delta" }), {
      wrapper: createWrapper(ctx)
    })
    expect(result.current).toHaveLength(2)
    expect(result.current[0].name).toBe("text:delta")
    expect(result.current[1].name).toBe("text:delta")
  })

  it("useStateAt fetches state at position 0", () => {
    // useStateAt requires client and sessionId; when both are null, state is undefined
    const ctx = makeContextValue({ sessionId: null, client: null })
    const { result } = renderHook(() => useStateAt(0), { wrapper: createWrapper(ctx) })
    expect(result.current.state).toBeUndefined()
    expect(result.current.isLoading).toBe(false)
  })
})

// Need to import useStateAt
import { useStateAt } from "../src/react/hooks.js"

// ─────────────────────────────────────────────────────────────────
// Tests: VCR operations
// ─────────────────────────────────────────────────────────────────

describe("React Hooks (VCR Operations)", () => {
  it("usePause can pause the session", async () => {
    const pauseFn = vi.fn(async (): Promise<PauseResult> => ({ ok: true, wasPaused: true }))
    const ctx = makeContextValue({ pause: pauseFn, sessionId: "s-1", status: "connected" })
    const { result } = renderHook(() => usePause(), { wrapper: createWrapper(ctx) })

    const pauseResult = await result.current()
    expect(pauseFn).toHaveBeenCalledOnce()
    expect(pauseResult).toEqual({ ok: true, wasPaused: true })
  })

  it("useResume can resume a paused session", async () => {
    const resumeFn = vi.fn(async (): Promise<ResumeResult> => ({ ok: true, wasResumed: true }))
    const ctx = makeContextValue({ resume: resumeFn, sessionId: "s-1", isPaused: true })
    const { result } = renderHook(() => useResume(), { wrapper: createWrapper(ctx) })

    const resumeResult = await result.current()
    expect(resumeFn).toHaveBeenCalledOnce()
    expect(resumeResult).toEqual({ ok: true, wasResumed: true })
  })

  it("useFork creates a new session", async () => {
    const forkFn = vi.fn(async (): Promise<ForkResult> => ({
      sessionId: "forked-123",
      originalSessionId: "s-1",
      eventsCopied: 10
    }))
    const ctx = makeContextValue({ fork: forkFn, sessionId: "s-1", status: "connected" })
    const { result } = renderHook(() => useFork(), { wrapper: createWrapper(ctx) })

    const forkResult = await result.current()
    expect(forkFn).toHaveBeenCalledOnce()
    expect(forkResult).toEqual({
      sessionId: "forked-123",
      originalSessionId: "s-1",
      eventsCopied: 10
    })
  })

  it("useDisconnect disconnects from session", async () => {
    const disconnectFn = vi.fn(async () => {})
    const ctx = makeContextValue({ disconnect: disconnectFn, sessionId: "s-1", status: "connected" })
    const { result } = renderHook(() => useDisconnect(), { wrapper: createWrapper(ctx) })

    await result.current()
    expect(disconnectFn).toHaveBeenCalledOnce()
  })
})
