/**
 * Tests for HITL (Human-in-the-Loop) queue wiring.
 *
 * Validates that respond() on the WorkflowExecution handle feeds into
 * the runtime's Queue.take(ctx.inputQueue), unblocking HITL phases.
 * Uses ProviderRecorder playback with pre-seeded fixtures.
 *
 * Event payloads use canonical ADR-008 format (id, prompt, type, value).
 */

import { beforeAll, describe, expect, it } from "vitest"
import { z } from "zod"

import { agent } from "../src/Engine/agent.js"
import { execute, type RuntimeConfig } from "../src/Engine/execute.js"
import { phase } from "../src/Engine/phase.js"
import { EVENTS } from "../src/Engine/types.js"
import { workflow } from "../src/Engine/workflow.js"
import { seedRecorder, type SimpleFixture, testProvider } from "./helpers/test-provider.js"

// ─────────────────────────────────────────────────────────────────
// Test State and Types
// ─────────────────────────────────────────────────────────────────

interface HitlState {
  proposal: string
  approved: boolean
  finalMessage: string
}

type HitlPhases = "review" | "finalize" | "done"

// Shared schema
const messageSchema = z.object({ message: z.string() })
const providerOptions = { model: "claude-sonnet-4-5" }

// Agent for the finalize phase (per ADR-010: agents own provider directly)
const finalizeAgent = agent<HitlState, { message: string }>({
  name: "finalizer",
  provider: testProvider,
  output: messageSchema,
  prompt: (state) => `Finalize: ${state.proposal}, approved=${state.approved}`,
  update: (output, draft) => {
    draft.finalMessage = output.message
  }
})

// ─────────────────────────────────────────────────────────────────
// Fixture definitions
// ─────────────────────────────────────────────────────────────────

const hitlFixtures: ReadonlyArray<SimpleFixture> = [
  {
    prompt: "Finalize: Build a REST API, approved=true",
    output: { message: "All done!" },
    outputSchema: messageSchema,
    providerOptions
  },
  {
    prompt: "Finalize: Bad idea, approved=false",
    output: { message: "All done!" },
    outputSchema: messageSchema,
    providerOptions
  },
  {
    prompt: "Finalize: Test early respond, approved=true",
    output: { message: "All done!" },
    outputSchema: messageSchema,
    providerOptions
  }
]

// ─────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────

describe("HITL queue wiring", () => {
  // Per ADR-010: No providers map needed - agents own their providers directly
  // Created in beforeAll because seedRecorder is async (LibSQL :memory:)
  let testRuntime: RuntimeConfig

  beforeAll(async () => {
    const recorder = await seedRecorder(hitlFixtures)
    testRuntime = {
      mode: "playback",
      recorder,
      database: ":memory:"
    }
  })
  it("respond() unblocks a human phase and workflow completes", async () => {
    // Workflow: review (human) -> finalize (agent) -> done (terminal)
    const hitlWorkflow = workflow<HitlState, string, HitlPhases>({
      name: "hitl-test",
      initialState: { proposal: "", approved: false, finalMessage: "" },
      start: (input, draft) => {
        draft.proposal = input
      },
      phases: {
        review: {
          human: {
            prompt: (state) => `Review proposal: ${state.proposal}`,
            type: "approval"
          },
          onResponse: (response, draft) => {
            draft.approved = response === "approve"
          },
          next: "finalize"
        },
        finalize: {
          run: finalizeAgent,
          next: "done"
        },
        done: phase.terminal<HitlState, HitlPhases>()
      }
    })

    const execution = execute(hitlWorkflow, {
      input: "Build a REST API",
      runtime: testRuntime
    })

    // Consume events from the async iterator
    const events: Array<{ name: string; payload: unknown }> = []
    let respondedAlready = false

    for await (const event of execution) {
      events.push({ name: event.name, payload: event.payload })

      // When we see input:requested, provide the human response
      if (event.name === EVENTS.INPUT_REQUESTED && !respondedAlready) {
        respondedAlready = true
        execution.respond("approve")
      }
    }

    // Workflow should have completed
    const result = await execution.result

    // Verify state was updated by the human response handler
    expect(result.state.approved).toBe(true)

    // Verify the finalizer agent ran and updated state
    expect(result.state.finalMessage).toBe("All done!")

    // Verify we saw all expected event types
    const eventNames = events.map((e) => e.name)
    expect(eventNames).toContain(EVENTS.WORKFLOW_STARTED)
    expect(eventNames).toContain(EVENTS.INPUT_REQUESTED)
    expect(eventNames).toContain(EVENTS.INPUT_RECEIVED)
    expect(eventNames).toContain(EVENTS.PHASE_ENTERED)
    expect(eventNames).toContain(EVENTS.AGENT_STARTED)
    expect(eventNames).toContain(EVENTS.AGENT_COMPLETED)
    expect(eventNames).toContain(EVENTS.WORKFLOW_COMPLETED)

    // Verify the input:requested payload (canonical names per ADR-008)
    const inputRequestedEvent = events.find((e) => e.name === EVENTS.INPUT_REQUESTED)
    const payload = inputRequestedEvent?.payload as { id: string; prompt: string; type: string }
    expect(payload.prompt).toBe("Review proposal: Build a REST API")
    expect(payload.type).toBe("approval")

    // Verify the input:received payload (canonical names per ADR-008)
    const inputReceivedEvent = events.find((e) => e.name === EVENTS.INPUT_RECEIVED)
    const responsePayload = inputReceivedEvent?.payload as { id: string; value: string }
    expect(responsePayload.value).toBe("approve")
  })

  it("respond() with rejection updates state accordingly", async () => {
    const hitlWorkflow = workflow<HitlState, string, HitlPhases>({
      name: "hitl-reject-test",
      initialState: { proposal: "", approved: false, finalMessage: "" },
      start: (input, draft) => {
        draft.proposal = input
      },
      phases: {
        review: {
          human: {
            prompt: (state) => `Review: ${state.proposal}`,
            type: "approval"
          },
          onResponse: (response, draft) => {
            draft.approved = response === "approve"
          },
          next: "finalize"
        },
        finalize: {
          run: finalizeAgent,
          next: "done"
        },
        done: phase.terminal<HitlState, HitlPhases>()
      }
    })

    const execution = execute(hitlWorkflow, {
      input: "Bad idea",
      runtime: testRuntime
    })

    for await (const event of execution) {
      if (event.name === EVENTS.INPUT_REQUESTED) {
        execution.respond("reject")
      }
    }

    const result = await execution.result
    expect(result.state.approved).toBe(false)
    expect(result.state.proposal).toBe("Bad idea")
    // Finalizer still runs (workflow transitions regardless of approval)
    expect(result.state.finalMessage).toBeDefined()
  })

  it("respond() before runtime reaches Queue.take still works (buffered)", async () => {
    // This tests that Queue.offer before Queue.take is buffered correctly
    // by the unbounded queue semantics
    const hitlWorkflow = workflow<HitlState, string, HitlPhases>({
      name: "hitl-prebuffer-test",
      initialState: { proposal: "", approved: false, finalMessage: "" },
      start: (input, draft) => {
        draft.proposal = input
      },
      phases: {
        review: {
          human: {
            prompt: () => "Approve?",
            type: "approval"
          },
          onResponse: (response, draft) => {
            draft.approved = response === "approve"
          },
          next: "finalize"
        },
        finalize: {
          run: finalizeAgent,
          next: "done"
        },
        done: phase.terminal<HitlState, HitlPhases>()
      }
    })

    const execution = execute(hitlWorkflow, {
      input: "Test early respond",
      runtime: testRuntime
    })

    // Pre-buffer the response before consuming any events
    // The unbounded queue should hold it until the runtime takes
    execution.respond("approve")

    // Now consume events - the workflow should unblock and complete
    const result = await execution.result
    expect(result.state.approved).toBe(true)
    expect(result.completed).toBe(true)
  })
})
