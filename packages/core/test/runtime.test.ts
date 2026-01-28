/**
 * Tests for Engine/runtime.ts
 *
 * Validates the Effect-based workflow runtime execution.
 * Uses ProviderRecorder playback with pre-seeded fixtures.
 */

import { describe, expect, it } from "vitest"
import { z } from "zod"

import { agent } from "../src/Engine/agent.js"
import { phase } from "../src/Engine/phase.js"
import { type ExecuteOptions, executeWorkflow } from "../src/Engine/runtime.js"
import { EVENTS, WorkflowAgentError } from "../src/Engine/types.js"
import { workflow } from "../src/Engine/workflow.js"
import { runWithTestRuntime, type SimpleFixture } from "./helpers/test-provider.js"

// ─────────────────────────────────────────────────────────────────
// Test State and Types
// ─────────────────────────────────────────────────────────────────

interface TestState {
  goal: string
  tasks: Array<string>
  done: boolean
}

type TestPhases = "planning" | "done"

// Shared output schema (must be the same instance for hash consistency)
const messageSchema = z.object({ message: z.string() })

// Test agent
const testAgent = agent<TestState, { message: string }>({
  name: "test-agent",
  model: "claude-sonnet-4-5",
  output: messageSchema,
  prompt: (state: TestState) => `Goal: ${state.goal}`,
  update: (output: { message: string }, draft: TestState) => {
    draft.tasks.push(output.message)
  }
})

// ─────────────────────────────────────────────────────────────────
// Fixture definitions
// ─────────────────────────────────────────────────────────────────

const providerOptions = { model: "claude-sonnet-4-5" }

const fixtures: ReadonlyArray<SimpleFixture> = [
  {
    prompt: "Goal: Build an API",
    output: { message: "Task completed" },
    outputSchema: messageSchema,
    providerOptions
  },
  {
    prompt: "Goal: ",
    output: { message: "Task completed" },
    outputSchema: messageSchema,
    providerOptions
  },
  {
    prompt: "Goal: Test goal",
    output: { message: "Task completed" },
    outputSchema: messageSchema,
    providerOptions
  }
]

// ─────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────

describe("executeWorkflow", () => {
  describe("initialization", () => {
    it("initializes state correctly with start() function", async () => {
      const simpleWorkflow = workflow<TestState>({
        name: "init-test",
        initialState: { goal: "", tasks: [], done: false },
        start: (input: string, draft: TestState) => {
          draft.goal = input
          draft.tasks.push("initialized")
        },
        agent: testAgent,
        until: (state: TestState) => state.tasks.length > 1 // Stop after one agent run
      })

      const options: ExecuteOptions<string> = {
        input: "Build an API",
        sessionId: "test-session-123"
      }

      // Execute workflow with recorded fixtures in playback mode
      const result = await runWithTestRuntime(
        executeWorkflow(simpleWorkflow, options),
        { fixtures }
      )

      // Verify initialization happened
      expect(result.state.goal).toBe("Build an API")
      expect(result.state.tasks).toContain("initialized")
      // Agent should have added its output
      expect(result.state.tasks).toContain("Task completed")
    })

    it("generates session ID if not provided", async () => {
      const simpleWorkflow = workflow<TestState>({
        name: "session-test",
        initialState: { goal: "", tasks: [], done: false },
        start: () => {},
        agent: testAgent,
        until: () => true // Stop immediately after one run
      })

      const options: ExecuteOptions<string> = {
        input: "Test"
        // No sessionId provided
      }

      const result = await runWithTestRuntime(
        executeWorkflow(simpleWorkflow, options),
        { fixtures }
      )

      // Should complete without error
      expect(result.sessionId).toBeDefined()
      expect(result.sessionId.length).toBeGreaterThan(0)
    })
  })

  describe("simple workflow", () => {
    it("executes agent and updates state", async () => {
      const simpleWorkflow = workflow<TestState>({
        name: "simple-test",
        initialState: { goal: "", tasks: [], done: false },
        start: (input, draft) => {
          draft.goal = input
        },
        agent: testAgent,
        until: () => true // Stop after first agent run
      })

      const result = await runWithTestRuntime(
        executeWorkflow(simpleWorkflow, { input: "Test goal" }),
        { fixtures }
      )

      expect(result.state.goal).toBe("Test goal")
      expect(result.state.tasks).toContain("Task completed")
    })

    it("captures Immer patches in state:updated events", async () => {
      const simpleWorkflow = workflow<TestState>({
        name: "patches-test",
        initialState: { goal: "", tasks: [], done: false },
        start: (input, draft) => {
          draft.goal = input
        },
        agent: testAgent,
        until: () => true
      })

      const result = await runWithTestRuntime(
        executeWorkflow(simpleWorkflow, { input: "Test goal" }),
        { fixtures }
      )

      // Find state:updated events
      const stateEvents = result.events.filter((e) => e.name === EVENTS.STATE_UPDATED)
      expect(stateEvents.length).toBeGreaterThan(0)

      // Verify patches are present in state:updated events
      for (const event of stateEvents) {
        const payload = event.payload as { state: unknown; patches?: Array<unknown>; inversePatches?: Array<unknown> }
        expect(payload.patches).toBeDefined()
        expect(Array.isArray(payload.patches)).toBe(true)
        expect(payload.inversePatches).toBeDefined()
        expect(Array.isArray(payload.inversePatches)).toBe(true)
      }

      // Verify patches describe the actual changes
      const firstStateEvent = stateEvents[0]
      const firstPayload = firstStateEvent.payload as {
        patches: Array<{ op: string; path: Array<string>; value?: unknown }>
      }
      // The first state update should include setting the goal
      const goalPatch = firstPayload.patches.find((p) => p.path.includes("goal"))
      expect(goalPatch).toBeDefined()
    })
  })

  describe("phase workflow", () => {
    it("executes phase and transitions to terminal", async () => {
      const phasedWorkflow = workflow<TestState, string, TestPhases>({
        name: "phased-test",
        initialState: { goal: "", tasks: [], done: false },
        start: (input, draft) => {
          draft.goal = input
        },
        phases: {
          planning: { run: testAgent, next: "done" },
          done: phase.terminal<TestState, TestPhases>()
        }
      })

      const result = await runWithTestRuntime(
        executeWorkflow(phasedWorkflow, { input: "Test goal" }),
        { fixtures }
      )

      expect(result.state.goal).toBe("Test goal")
      expect(result.state.tasks).toContain("Task completed")
      // Verify events include phase transitions
      const phaseEvents = result.events.filter((e) => e.name === EVENTS.PHASE_ENTERED)
      expect(phaseEvents.length).toBeGreaterThan(0)
    })
  })
})

describe("EVENTS constant", () => {
  it("has all expected event names", () => {
    expect(EVENTS.WORKFLOW_STARTED).toBe("workflow:started")
    expect(EVENTS.WORKFLOW_COMPLETED).toBe("workflow:completed")
    expect(EVENTS.PHASE_ENTERED).toBe("phase:entered")
    expect(EVENTS.PHASE_EXITED).toBe("phase:exited")
    expect(EVENTS.AGENT_STARTED).toBe("agent:started")
    expect(EVENTS.AGENT_COMPLETED).toBe("agent:completed")
    expect(EVENTS.STATE_UPDATED).toBe("state:updated")
    expect(EVENTS.TEXT_DELTA).toBe("text:delta")
    expect(EVENTS.THINKING_DELTA).toBe("thinking:delta")
    expect(EVENTS.TOOL_CALLED).toBe("tool:called")
    expect(EVENTS.TOOL_RESULT).toBe("tool:result")
    expect(EVENTS.INPUT_REQUESTED).toBe("input:requested")
    expect(EVENTS.INPUT_RESPONSE).toBe("input:response")
  })
})

describe("WorkflowAgentError", () => {
  it("is a tagged error with correct _tag", () => {
    const error = new WorkflowAgentError({
      agentName: "test",
      message: "Test error"
    })

    expect(error._tag).toBe("WorkflowAgentError")
    expect(error.agentName).toBe("test")
    expect(error.message).toBe("Test error")
  })

  it("can include optional cause", () => {
    const cause = new Error("Underlying error")
    const error = new WorkflowAgentError({
      agentName: "test",
      message: "Test error",
      cause
    })

    expect(error.cause).toBe(cause)
  })
})
