/**
 * Tests for Engine/types.ts
 *
 * Validates the core type definitions for the state-first DX.
 */

import { Effect, Schema } from "effect"
import { describe, expect, it } from "vitest"

import { type EventName, type SerializedEvent, tagToEventName } from "../src/Domain/Events.js"
import { AgentIdSchema, makeSessionId, parseSessionId, SessionIdSchema, WorkflowIdSchema } from "../src/Domain/Ids.js"
import {
  type Draft,
  EventIdSchema,
  makeEvent,
  makeEventId,
  parseEventId,
  type StateSnapshot,
  WorkflowAbortedError,
  WorkflowAgentError,
  WorkflowPhaseError,
  WorkflowProviderError,
  type WorkflowResult,
  WorkflowStoreError,
  WorkflowTimeoutError,
  WorkflowValidationError
} from "../src/Engine/types.js"

describe("tagToEventName mapping", () => {
  it("has all expected event names", () => {
    expect(tagToEventName.WorkflowStarted).toBe("workflow:started")
    expect(tagToEventName.WorkflowCompleted).toBe("workflow:completed")
    expect(tagToEventName.PhaseEntered).toBe("phase:entered")
    expect(tagToEventName.PhaseExited).toBe("phase:exited")
    expect(tagToEventName.AgentStarted).toBe("agent:started")
    expect(tagToEventName.AgentCompleted).toBe("agent:completed")
    expect(tagToEventName.StateIntent).toBe("state:intent")
    expect(tagToEventName.StateCheckpoint).toBe("state:checkpoint")
    expect(tagToEventName.TextDelta).toBe("text:delta")
    expect(tagToEventName.ThinkingDelta).toBe("thinking:delta")
    expect(tagToEventName.ToolCalled).toBe("tool:called")
    expect(tagToEventName.ToolResult).toBe("tool:result")
    expect(tagToEventName.InputRequested).toBe("input:requested")
    expect(tagToEventName.InputReceived).toBe("input:received")
  })

  it("event names are unique", () => {
    const values = Object.values(tagToEventName)
    const uniqueValues = new Set(values)
    expect(values.length).toBe(uniqueValues.size)
  })
})

describe("EventId (Effect Schema branded type)", () => {
  it("makeEventId generates valid UUID", async () => {
    const id = await Effect.runPromise(makeEventId())
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
  })

  it("parseEventId validates UUID format", async () => {
    const validId = "550e8400-e29b-41d4-a716-446655440000"
    const parsed = await Effect.runPromise(parseEventId(validId))
    expect(parsed).toBe(validId)
  })

  it("parseEventId rejects invalid UUID", async () => {
    const invalidId = "not-a-uuid"
    await expect(Effect.runPromise(parseEventId(invalidId))).rejects.toThrow()
  })

  it("EventIdSchema brands the type", () => {
    // This is a compile-time check - the schema exists and has brand
    expect(EventIdSchema).toBeDefined()
  })
})

describe("SessionId (Effect Schema branded type)", () => {
  it("makeSessionId generates valid UUID", async () => {
    const id = await Effect.runPromise(makeSessionId())
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
  })

  it("parseSessionId validates UUID format", async () => {
    const validId = "550e8400-e29b-41d4-a716-446655440000"
    const parsed = await Effect.runPromise(parseSessionId(validId))
    expect(parsed).toBe(validId)
  })

  it("parseSessionId rejects invalid UUID", async () => {
    const invalidId = "not-a-uuid"
    await expect(Effect.runPromise(parseSessionId(invalidId))).rejects.toThrow()
  })

  it("parseSessionId rejects empty string", async () => {
    await expect(Effect.runPromise(parseSessionId(""))).rejects.toThrow()
  })

  it("parseSessionId rejects partial UUID", async () => {
    const partialId = "550e8400-e29b-41d4"
    await expect(Effect.runPromise(parseSessionId(partialId))).rejects.toThrow()
  })

  it("SessionIdSchema brands the type", () => {
    expect(SessionIdSchema).toBeDefined()
  })
})

describe("WorkflowId (Effect Schema branded type)", () => {
  it("WorkflowIdSchema accepts any string", async () => {
    const decode = Schema.decodeUnknown(WorkflowIdSchema)
    const result = await Effect.runPromise(decode("my-workflow"))
    expect(result).toBe("my-workflow")
  })

  it("WorkflowIdSchema accepts workflow names with special chars", async () => {
    const decode = Schema.decodeUnknown(WorkflowIdSchema)
    const result = await Effect.runPromise(decode("task-planner-v2"))
    expect(result).toBe("task-planner-v2")
  })

  it("WorkflowIdSchema rejects non-strings", async () => {
    const decode = Schema.decodeUnknown(WorkflowIdSchema)
    await expect(Effect.runPromise(decode(123))).rejects.toThrow()
    await expect(Effect.runPromise(decode(null))).rejects.toThrow()
    await expect(Effect.runPromise(decode(undefined))).rejects.toThrow()
  })

  it("WorkflowIdSchema brands the type", () => {
    expect(WorkflowIdSchema).toBeDefined()
  })
})

describe("AgentId (Effect Schema branded type)", () => {
  it("AgentIdSchema accepts any string", async () => {
    const decode = Schema.decodeUnknown(AgentIdSchema)
    const result = await Effect.runPromise(decode("planner"))
    expect(result).toBe("planner")
  })

  it("AgentIdSchema accepts agent names with special chars", async () => {
    const decode = Schema.decodeUnknown(AgentIdSchema)
    const result = await Effect.runPromise(decode("code-reviewer-v2"))
    expect(result).toBe("code-reviewer-v2")
  })

  it("AgentIdSchema rejects non-strings", async () => {
    const decode = Schema.decodeUnknown(AgentIdSchema)
    await expect(Effect.runPromise(decode(123))).rejects.toThrow()
    await expect(Effect.runPromise(decode(null))).rejects.toThrow()
    await expect(Effect.runPromise(decode(undefined))).rejects.toThrow()
  })

  it("AgentIdSchema brands the type", () => {
    expect(AgentIdSchema).toBeDefined()
  })
})

describe("makeEvent", () => {
  it("creates SerializedEvent with generated ID and numeric timestamp", async () => {
    const event = await Effect.runPromise(
      makeEvent("test:event", { value: 42 })
    )

    expect(event.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
    expect(event.name).toBe("test:event")
    expect(event.payload).toEqual({ value: 42 })
    expect(typeof event.timestamp).toBe("number")
    expect(event.timestamp).toBeGreaterThan(0)
    expect(event.causedBy).toBeUndefined()
  })

  it("supports causedBy for causality tracking", async () => {
    const causeId = await Effect.runPromise(makeEventId())
    const event = await Effect.runPromise(
      makeEvent("effect:event", {}, causeId)
    )

    expect(event.causedBy).toBe(causeId)
  })
})

describe("SerializedEvent type", () => {
  it("SerializedEvent uses numeric timestamp", async () => {
    const id1 = await Effect.runPromise(makeEventId())
    const id2 = await Effect.runPromise(makeEventId())
    const id3 = await Effect.runPromise(makeEventId())

    const events: Array<SerializedEvent> = [
      { id: id1, name: "a", payload: { value: "string" }, timestamp: Date.now() },
      { id: id2, name: "b", payload: { complex: true }, timestamp: Date.now() },
      { id: id3, name: "c", payload: {}, timestamp: Date.now() }
    ]

    expect(events).toHaveLength(3)
    expect(typeof events[0].timestamp).toBe("number")
  })
})

describe("StateSnapshot type", () => {
  it("can be created with required fields", () => {
    interface TestState {
      count: number
    }

    const snapshot: StateSnapshot<TestState> = {
      sessionId: "session-123",
      state: { count: 42 },
      position: 10,
      createdAt: new Date()
    }

    expect(snapshot.sessionId).toBe("session-123")
    expect(snapshot.state.count).toBe(42)
    expect(snapshot.position).toBe(10)
    expect(snapshot.phase).toBeUndefined()
  })

  it("supports optional phase field", () => {
    const snapshot: StateSnapshot = {
      sessionId: "session-456",
      state: {},
      position: 5,
      phase: "planning",
      createdAt: new Date()
    }

    expect(snapshot.phase).toBe("planning")
  })
})

describe("WorkflowResult type", () => {
  it("represents a completed workflow", () => {
    interface TestState {
      goal: string
      done: boolean
    }

    const result: WorkflowResult<TestState> = {
      state: { goal: "test", done: true },
      sessionId: "session-789",
      events: [],
      completed: true,
      exitPhase: "done"
    }

    expect(result.state.done).toBe(true)
    expect(result.completed).toBe(true)
    expect(result.exitPhase).toBe("done")
  })

  it("represents an incomplete workflow", () => {
    const result: WorkflowResult<unknown> = {
      state: {},
      sessionId: "session-abc",
      events: [],
      completed: false
    }

    expect(result.completed).toBe(false)
    expect(result.exitPhase).toBeUndefined()
  })
})

describe("Workflow Errors (Data.TaggedError)", () => {
  it("WorkflowAgentError has correct tag and fields", () => {
    const error = new WorkflowAgentError({
      agent: "planner",
      message: "Agent failed to produce output"
    })

    expect(error._tag).toBe("WorkflowAgentError")
    expect(error.agent).toBe("planner")
    expect(error.message).toBe("Agent failed to produce output")
  })

  it("WorkflowAgentError supports cause for error chaining", () => {
    const originalError = new Error("Network failure")
    const error = new WorkflowAgentError({
      agent: "worker",
      message: "Execution failed",
      cause: originalError
    })

    expect(error.cause).toBe(originalError)
  })

  it("WorkflowValidationError has correct tag and fields", () => {
    const error = new WorkflowValidationError({
      agent: "judge",
      message: "Invalid output schema",
      path: "verdict"
    })

    expect(error._tag).toBe("WorkflowValidationError")
    expect(error.agent).toBe("judge")
    expect(error.path).toBe("verdict")
  })

  it("WorkflowPhaseError has correct tag and fields", () => {
    const error = new WorkflowPhaseError({
      fromPhase: "planning",
      toPhase: "working",
      message: "Invalid transition"
    })

    expect(error._tag).toBe("WorkflowPhaseError")
    expect(error.fromPhase).toBe("planning")
    expect(error.toPhase).toBe("working")
  })

  it("WorkflowStoreError has correct tag and fields", () => {
    const error = new WorkflowStoreError({
      operation: "snapshot",
      message: "Failed to save state"
    })

    expect(error._tag).toBe("WorkflowStoreError")
    expect(error.operation).toBe("snapshot")
  })

  it("WorkflowProviderError has correct tag and fields", () => {
    const error = new WorkflowProviderError({
      agent: "planner",
      code: "RATE_LIMITED",
      message: "Too many requests",
      retryable: true
    })

    expect(error._tag).toBe("WorkflowProviderError")
    expect(error.code).toBe("RATE_LIMITED")
    expect(error.retryable).toBe(true)
  })

  it("WorkflowTimeoutError has correct tag and fields", () => {
    const error = new WorkflowTimeoutError({
      phase: "working",
      agent: "worker",
      timeoutMs: 30000
    })

    expect(error._tag).toBe("WorkflowTimeoutError")
    expect(error.timeoutMs).toBe(30000)
  })

  it("WorkflowAbortedError has correct tag and fields", () => {
    const error = new WorkflowAbortedError({
      phase: "judging",
      reason: "User cancelled"
    })

    expect(error._tag).toBe("WorkflowAbortedError")
    expect(error.reason).toBe("User cancelled")
  })
})

describe("Draft type (compile-time)", () => {
  // These are compile-time type checks - if this file compiles, the types work

  it("allows mutation in update functions", () => {
    // This is a type-level test - we just verify the pattern works
    interface State {
      items: Array<string>
      count: number
    }

    // Simulate an update function signature
    type UpdateFn = (output: { item: string }, draft: Draft<State>) => void

    // If this compiles, Draft<State> correctly allows mutation
    const update: UpdateFn = (output, draft) => {
      draft.items.push(output.item)
      draft.count += 1
    }

    // Runtime check that the function exists
    expect(typeof update).toBe("function")
  })
})

describe("EventName type (compile-time)", () => {
  it("is a union of all event name literals", () => {
    // This is a compile-time check - if this compiles, EventName is correct
    const validNames: Array<EventName> = [
      "workflow:started",
      "workflow:completed",
      "phase:entered",
      "phase:exited",
      "agent:started",
      "agent:completed",
      "state:intent",
      "state:checkpoint",
      "session:forked",
      "text:delta",
      "thinking:delta",
      "tool:called",
      "tool:result",
      "input:requested",
      "input:received"
    ]

    expect(validNames).toHaveLength(15)
  })
})
