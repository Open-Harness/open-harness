/**
 * Tests for HITL Interaction helper.
 *
 * @module
 */

import { describe, expect, it } from "vitest"

import type { InteractionEventId as EventId } from "../src/Domain/Ids.js"
import type { AnyEvent, Event } from "../src/Domain/Interaction.js"
import {
  createInteraction,
  findPendingInteractions,
  isInteractionRequest,
  isInteractionResponse
} from "../src/Domain/Interaction.js"

// Helper to cast strings to EventId for tests
const eventId = (id: string): EventId => id as EventId

// Test state type
interface TestState {
  tasks: ReadonlyArray<string>
  phase: "planning" | "executing" | "done"
}

// Helper event factories for testing (inline since defineEvent was removed)
const PlanRejected = {
  name: "plan:rejected" as const,
  create: (payload: { reason: string }, causedBy?: EventId): Event<"plan:rejected", { reason: string }> => ({
    id: crypto.randomUUID() as EventId,
    name: "plan:rejected",
    payload,
    timestamp: new Date(),
    ...(causedBy !== undefined ? { causedBy } : {})
  })
}
const ExecutionStarted = {
  name: "execution:started" as const,
  create: (payload: Record<string, never>, causedBy?: EventId): Event<"execution:started", Record<string, never>> => ({
    id: crypto.randomUUID() as EventId,
    name: "execution:started",
    payload,
    timestamp: new Date(),
    ...(causedBy !== undefined ? { causedBy } : {})
  })
}

describe("createInteraction", () => {
  it("creates an interaction with approval type", () => {
    const planApproval = createInteraction<TestState>({
      name: "plan-approval",
      type: "approval",
      prompt: (state: TestState) => `Approve ${state.tasks.length} tasks?`,
      onResponse: (response: unknown, state: TestState, trigger: AnyEvent) => {
        if (response === true) {
          return {
            state: { ...state, phase: "executing" as const },
            events: [ExecutionStarted.create({}, trigger.id)]
          }
        }
        return {
          state: { ...state, phase: "planning" as const },
          events: [PlanRejected.create({ reason: "User rejected" }, trigger.id)]
        }
      }
    })

    expect(planApproval.name).toBe("plan-approval")
    expect(planApproval.type).toBe("approval")
    expect(planApproval.responseHandler).toBeDefined()
    expect(planApproval.request).toBeDefined()
  })

  it("creates an interaction with choice type", () => {
    const priorityChoice = createInteraction<TestState>({
      name: "priority-choice",
      type: "choice",
      prompt: () => "Select priority level",
      options: ["low", "medium", "high"],
      onResponse: (_response: unknown, state: TestState) => {
        return { state, events: [] }
      }
    })

    expect(priorityChoice.name).toBe("priority-choice")
    expect(priorityChoice.type).toBe("choice")
  })

  it("creates an interaction with freeform type", () => {
    const feedbackRequest = createInteraction<TestState>({
      name: "feedback",
      type: "freeform",
      prompt: () => "Please provide feedback",
      onResponse: (_response: unknown, state: TestState) => {
        return { state, events: [] }
      }
    })

    expect(feedbackRequest.name).toBe("feedback")
    expect(feedbackRequest.type).toBe("freeform")
  })

  it("request() creates a valid input:requested event", () => {
    const approval = createInteraction<TestState>({
      name: "test-approval",
      type: "approval",
      prompt: (state: TestState) => `Approve ${state.tasks.length} tasks?`,
      onResponse: (_response: unknown, state: TestState) => ({ state, events: [] })
    })

    const state: TestState = { tasks: ["task1", "task2"], phase: "planning" }
    const event = approval.request(state, "test-agent")

    expect(event.name).toBe("input:requested")
    expect(event.payload.interactionId).toMatch(/^test-approval-/)
    expect(event.payload.agentName).toBe("test-agent")
    expect(event.payload.prompt).toBe("Approve 2 tasks?")
    expect(event.payload.inputType).toBe("approval")
  })

  it("request() includes options for choice type", () => {
    const choice = createInteraction<TestState>({
      name: "test-choice",
      type: "choice",
      prompt: () => "Pick one",
      options: ["a", "b", "c"],
      onResponse: (_response: unknown, state: TestState) => ({ state, events: [] })
    })

    const state: TestState = { tasks: [], phase: "planning" }
    const event = choice.request(state, "agent")

    expect(event.payload.options).toEqual(["a", "b", "c"])
  })

  it("request() includes metadata when provided", () => {
    const interaction = createInteraction<TestState>({
      name: "test-meta",
      type: "freeform",
      prompt: () => "Enter text",
      metadata: (state: TestState) => ({ taskCount: state.tasks.length }),
      onResponse: (_response: unknown, state: TestState) => ({ state, events: [] })
    })

    const state: TestState = { tasks: ["t1", "t2", "t3"], phase: "planning" }
    const event = interaction.request(state, "agent")

    expect(event.payload.metadata).toEqual({ taskCount: 3 })
  })

  it("request() generates unique interactionIds", () => {
    const interaction = createInteraction<TestState>({
      name: "unique-test",
      type: "freeform",
      prompt: () => "Test",
      onResponse: (_response: unknown, state: TestState) => ({ state, events: [] })
    })

    const state: TestState = { tasks: [], phase: "planning" }
    const event1 = interaction.request(state, "agent")
    const event2 = interaction.request(state, "agent")

    expect(event1.payload.interactionId).not.toBe(event2.payload.interactionId)
  })

  it("responseHandler processes approval responses", () => {
    const approval = createInteraction<TestState>({
      name: "approval-handler-test",
      type: "approval",
      prompt: () => "Approve?",
      onResponse: (response: unknown, state: TestState, trigger: AnyEvent) => {
        if (response === true) {
          return {
            state: { ...state, phase: "executing" as const },
            events: [ExecutionStarted.create({}, trigger.id)]
          }
        }
        return {
          state: { ...state, phase: "planning" as const },
          events: []
        }
      }
    })

    const state: TestState = { tasks: ["task1"], phase: "planning" }

    // Test approval
    const approveEvent = {
      id: eventId("evt-1"),
      name: "input:response" as const,
      payload: {
        interactionId: "approval-handler-test-1-123",
        value: "approve",
        approved: true
      },
      timestamp: new Date()
    }

    const approveResult = approval.responseHandler.handler(approveEvent, state)
    expect(approveResult.state.phase).toBe("executing")
    expect(approveResult.events.length).toBe(1)
    expect(approveResult.events[0].name).toBe("execution:started")
  })

  it("responseHandler ignores responses for other interactions", () => {
    const approval = createInteraction<TestState>({
      name: "my-approval",
      type: "approval",
      prompt: () => "Approve?",
      onResponse: () => {
        throw new Error("Should not be called")
      }
    })

    const state: TestState = { tasks: [], phase: "planning" }

    // Response for a different interaction
    const otherEvent = {
      id: eventId("evt-1"),
      name: "input:response" as const,
      payload: {
        interactionId: "other-interaction-1-123",
        value: "yes"
      },
      timestamp: new Date()
    }

    // Should pass through without calling onResponse
    const result = approval.responseHandler.handler(otherEvent, state)
    expect(result.state).toBe(state)
    expect(result.events).toEqual([])
  })
})

describe("isInteractionRequest", () => {
  it("returns true for input:requested events", () => {
    const event: AnyEvent = {
      id: eventId("evt-1"),
      name: "input:requested",
      payload: {
        interactionId: "test-1",
        agentName: "agent",
        prompt: "Test?",
        inputType: "approval"
      },
      timestamp: new Date()
    }

    expect(isInteractionRequest(event)).toBe(true)
  })

  it("returns false for other events", () => {
    const event: AnyEvent = {
      id: eventId("evt-1"),
      name: "user:input",
      payload: { text: "hello" },
      timestamp: new Date()
    }

    expect(isInteractionRequest(event)).toBe(false)
  })
})

describe("isInteractionResponse", () => {
  it("returns true for input:response events", () => {
    const event: AnyEvent = {
      id: eventId("evt-1"),
      name: "input:response",
      payload: {
        interactionId: "test-1",
        value: "yes"
      },
      timestamp: new Date()
    }

    expect(isInteractionResponse(event)).toBe(true)
  })

  it("returns false for other events", () => {
    const event: AnyEvent = {
      id: eventId("evt-1"),
      name: "input:requested",
      payload: { interactionId: "test" },
      timestamp: new Date()
    }

    expect(isInteractionResponse(event)).toBe(false)
  })
})

describe("findPendingInteractions", () => {
  it("returns empty array when no interactions", () => {
    const events: Array<AnyEvent> = [
      { id: eventId("1"), name: "workflow:started", payload: { goal: "test" }, timestamp: new Date() }
    ]

    const pending = findPendingInteractions(events)
    expect(pending).toEqual([])
  })

  it("returns pending request that has no response", () => {
    const events: Array<AnyEvent> = [
      {
        id: eventId("1"),
        name: "input:requested",
        payload: {
          interactionId: "req-1",
          agentName: "agent",
          prompt: "Approve?",
          inputType: "approval"
        },
        timestamp: new Date()
      }
    ]

    const pending = findPendingInteractions(events)
    expect(pending.length).toBe(1)
    expect(pending[0].payload.interactionId).toBe("req-1")
  })

  it("excludes requests that have responses", () => {
    const events: Array<AnyEvent> = [
      {
        id: eventId("1"),
        name: "input:requested",
        payload: {
          interactionId: "req-1",
          agentName: "agent",
          prompt: "Approve?",
          inputType: "approval"
        },
        timestamp: new Date()
      },
      {
        id: eventId("2"),
        name: "input:response",
        payload: {
          interactionId: "req-1",
          value: "yes",
          approved: true
        },
        timestamp: new Date()
      }
    ]

    const pending = findPendingInteractions(events)
    expect(pending).toEqual([])
  })

  it("returns multiple pending requests", () => {
    const events: Array<AnyEvent> = [
      {
        id: eventId("1"),
        name: "input:requested",
        payload: {
          interactionId: "req-1",
          agentName: "agent1",
          prompt: "First?",
          inputType: "approval"
        },
        timestamp: new Date()
      },
      {
        id: eventId("2"),
        name: "input:requested",
        payload: {
          interactionId: "req-2",
          agentName: "agent2",
          prompt: "Second?",
          inputType: "freeform"
        },
        timestamp: new Date()
      },
      {
        id: eventId("3"),
        name: "input:response",
        payload: {
          interactionId: "req-1",
          value: "yes"
        },
        timestamp: new Date()
      }
    ]

    const pending = findPendingInteractions(events)
    expect(pending.length).toBe(1)
    expect(pending[0].payload.interactionId).toBe("req-2")
  })
})
