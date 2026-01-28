/**
 * Tests for computeStateAt pure function.
 *
 * Validates backward scanning for state:updated events at various positions.
 */

import { Effect } from "effect"
import { describe, expect, it } from "vitest"

import { type AnyEvent, EVENTS, makeEvent } from "../src/Engine/types.js"
import { computeStateAt } from "../src/Engine/utils.js"

// Helper to create events synchronously via Effect.runSync
const mkEvent = (name: string, payload: Record<string, unknown>): AnyEvent => Effect.runSync(makeEvent(name, payload))

describe("computeStateAt", () => {
  it("returns undefined when events array is empty", () => {
    const result = computeStateAt([], 0)
    expect(result).toBeUndefined()
  })

  it("returns undefined when no state:updated events exist", () => {
    const events = [
      mkEvent(EVENTS.WORKFLOW_STARTED, { sessionId: "s1", workflowName: "test", input: "hi" }),
      mkEvent(EVENTS.AGENT_STARTED, { agentName: "a1" }),
      mkEvent(EVENTS.AGENT_COMPLETED, { agentName: "a1", output: "done", durationMs: 100 })
    ]
    const result = computeStateAt(events, events.length)
    expect(result).toBeUndefined()
  })

  it("returns the state from the only state:updated event", () => {
    const state = { count: 1, items: ["a"] }
    const events = [
      mkEvent(EVENTS.WORKFLOW_STARTED, { sessionId: "s1", workflowName: "test", input: "hi" }),
      mkEvent(EVENTS.STATE_UPDATED, { state }),
      mkEvent(EVENTS.AGENT_COMPLETED, { agentName: "a1", output: "done", durationMs: 100 })
    ]
    const result = computeStateAt<typeof state>(events, events.length)
    expect(result).toEqual(state)
  })

  it("returns the most recent state:updated event before position", () => {
    const state1 = { count: 1 }
    const state2 = { count: 2 }
    const state3 = { count: 3 }
    const events = [
      mkEvent(EVENTS.STATE_UPDATED, { state: state1 }),
      mkEvent(EVENTS.AGENT_STARTED, { agentName: "a1" }),
      mkEvent(EVENTS.STATE_UPDATED, { state: state2 }),
      mkEvent(EVENTS.AGENT_STARTED, { agentName: "a2" }),
      mkEvent(EVENTS.STATE_UPDATED, { state: state3 })
    ]

    // At position 5 (all events), should return state3
    expect(computeStateAt(events, 5)).toEqual(state3)

    // At position 3 (first 3 events), should return state2
    expect(computeStateAt(events, 3)).toEqual(state2)

    // At position 1 (first event only), should return state1
    expect(computeStateAt(events, 1)).toEqual(state1)
  })

  it("returns undefined when position is 0", () => {
    const events = [
      mkEvent(EVENTS.STATE_UPDATED, { state: { count: 1 } })
    ]
    const result = computeStateAt(events, 0)
    expect(result).toBeUndefined()
  })

  it("clamps position to events.length when position exceeds array length", () => {
    const state = { value: "final" }
    const events = [
      mkEvent(EVENTS.STATE_UPDATED, { state })
    ]
    // Position 100 but only 1 event
    const result = computeStateAt(events, 100)
    expect(result).toEqual(state)
  })

  it("returns state from the beginning of the event log", () => {
    const state = { phase: "init" }
    const events = [
      mkEvent(EVENTS.STATE_UPDATED, { state }),
      mkEvent(EVENTS.AGENT_STARTED, { agentName: "a1" }),
      mkEvent(EVENTS.AGENT_COMPLETED, { agentName: "a1", output: "done", durationMs: 50 }),
      mkEvent(EVENTS.AGENT_STARTED, { agentName: "a2" }),
      mkEvent(EVENTS.AGENT_COMPLETED, { agentName: "a2", output: "done2", durationMs: 60 })
    ]
    // All events, but only the first is state:updated
    const result = computeStateAt(events, events.length)
    expect(result).toEqual(state)
  })

  it("returns state from the end of the event log", () => {
    const finalState = { completed: true }
    const events = [
      mkEvent(EVENTS.AGENT_STARTED, { agentName: "a1" }),
      mkEvent(EVENTS.AGENT_COMPLETED, { agentName: "a1", output: "done", durationMs: 50 }),
      mkEvent(EVENTS.STATE_UPDATED, { state: finalState })
    ]
    const result = computeStateAt(events, events.length)
    expect(result).toEqual(finalState)
  })

  it("handles position in the middle correctly", () => {
    const state1 = { step: 1 }
    const state2 = { step: 2 }
    const events = [
      mkEvent(EVENTS.AGENT_STARTED, { agentName: "a1" }),
      mkEvent(EVENTS.STATE_UPDATED, { state: state1 }),
      mkEvent(EVENTS.AGENT_STARTED, { agentName: "a2" }),
      mkEvent(EVENTS.STATE_UPDATED, { state: state2 })
    ]

    // Position 2 means we look at events[0] and events[1]
    expect(computeStateAt(events, 2)).toEqual(state1)

    // Position 4 means all events
    expect(computeStateAt(events, 4)).toEqual(state2)
  })
})
