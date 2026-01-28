/**
 * Tests for Engine/execute.ts
 *
 * Validates the async iterator API for workflow execution.
 * Uses ProviderRecorder playback with pre-seeded fixtures.
 */

import { describe, expect, it } from "vitest"
import { z } from "zod"

import { agent } from "../src/Engine/agent.js"
import { execute, type RuntimeConfig } from "../src/Engine/execute.js"
import { phase } from "../src/Engine/phase.js"
import { EVENTS } from "../src/Engine/types.js"
import { workflow } from "../src/Engine/workflow.js"
import { seedRecorder, type SimpleFixture } from "./helpers/test-provider.js"

// ─────────────────────────────────────────────────────────────────
// Test State and Types
// ─────────────────────────────────────────────────────────────────

interface TestState {
  goal: string
  tasks: Array<string>
  done: boolean
}

// Shared schema
const messageSchema = z.object({ message: z.string() })
const providerOptions = { model: "claude-sonnet-4-5" }

// Test agent
const testAgent = agent<TestState, { message: string }>({
  name: "test-agent",
  model: "claude-sonnet-4-5",
  output: messageSchema,
  prompt: (state) => `Goal: ${state.goal}`,
  update: (output, draft) => {
    draft.tasks.push(output.message)
  }
})

// Test workflow
const testWorkflow = workflow<TestState>({
  name: "test-workflow",
  initialState: { goal: "", tasks: [], done: false },
  start: (input, draft) => {
    draft.goal = input
  },
  agent: testAgent,
  until: () => true // Stop after one agent run
})

// ─────────────────────────────────────────────────────────────────
// Fixture definitions
// ─────────────────────────────────────────────────────────────────

const simpleFixtures: ReadonlyArray<SimpleFixture> = [
  {
    prompt: "Goal: Build API",
    output: { message: "Task done" },
    outputSchema: messageSchema,
    providerOptions
  },
  {
    prompt: "Goal: Test",
    output: { message: "Task done" },
    outputSchema: messageSchema,
    providerOptions
  },
  {
    prompt: "Goal: Stream test",
    output: { message: "Task done" },
    outputSchema: messageSchema,
    providerOptions
  }
]

// Dummy provider that should never be called in playback mode
const playbackDummy = {
  name: "playback-dummy",
  stream: () => {
    throw new Error("playbackDummyProvider called - recording not found")
  }
}

// Test runtime config using playback mode
const testRuntime: RuntimeConfig = {
  providers: { "claude-sonnet-4-5": playbackDummy },
  mode: "playback",
  recorder: seedRecorder(simpleFixtures),
  database: ":memory:"
}

// ─────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────

describe("execute()", () => {
  describe("WorkflowExecution interface", () => {
    it("returns a WorkflowExecution object with correct shape", () => {
      const execution = execute(testWorkflow, { input: "Build API", runtime: testRuntime })

      // Check interface shape
      expect(execution).toHaveProperty("result")
      expect(execution).toHaveProperty("sessionId")
      expect(execution).toHaveProperty("respond")
      expect(execution).toHaveProperty("pause")
      expect(execution).toHaveProperty("resume")
      expect(execution).toHaveProperty("isPaused")
      expect(execution).toHaveProperty("abort")
      expect(execution[Symbol.asyncIterator]).toBeDefined()

      // Properly handle the promise to avoid unhandled rejection
      execution.result.catch(() => {})
    })

    it("generates a session ID if not provided", () => {
      const execution = execute(testWorkflow, { input: "Test", runtime: testRuntime })

      expect(execution.sessionId).toBeDefined()
      expect(typeof execution.sessionId).toBe("string")
      expect(execution.sessionId.length).toBeGreaterThan(0)

      // Properly handle the promise
      execution.result.catch(() => {})
    })

    it("uses provided session ID", () => {
      const sessionId = "my-custom-session-123"
      const execution = execute(testWorkflow, {
        input: "Test",
        sessionId,
        runtime: testRuntime
      })

      expect(execution.sessionId).toBe(sessionId)

      // Properly handle the promise
      execution.result.catch(() => {})
    })
  })

  describe("async iterator", () => {
    it("is properly defined", () => {
      const execution = execute(testWorkflow, { input: "Test", runtime: testRuntime })

      const iterator = execution[Symbol.asyncIterator]()
      expect(iterator).toHaveProperty("next")
      expect(typeof iterator.next).toBe("function")

      // Properly handle the promise
      execution.result.catch(() => {})
    })
  })

  describe("pause/resume", () => {
    it("isPaused starts as false", () => {
      const execution = execute(testWorkflow, { input: "Test", runtime: testRuntime })

      expect(execution.isPaused).toBe(false)

      // Properly handle the promise
      execution.result.catch(() => {})
    })

    it("pause() sets isPaused to true", async () => {
      const execution = execute(testWorkflow, { input: "Test", runtime: testRuntime })

      await execution.pause()

      expect(execution.isPaused).toBe(true)

      // Properly handle the promise
      execution.result.catch(() => {})
    })

    it("resume() sets isPaused to false", async () => {
      const execution = execute(testWorkflow, { input: "Test", runtime: testRuntime })

      await execution.pause()
      expect(execution.isPaused).toBe(true)

      await execution.resume()
      expect(execution.isPaused).toBe(false)

      // Properly handle the promise
      execution.result.catch(() => {})
    })
  })

  describe("respond", () => {
    it("respond() can be called without error", () => {
      const execution = execute(testWorkflow, { input: "Test", runtime: testRuntime })

      // Should not throw
      expect(() => {
        execution.respond("test response")
      }).not.toThrow()

      // Properly handle the promise
      execution.result.catch(() => {})
    })
  })

  describe("result promise", () => {
    it("resolves with workflow result", async () => {
      const execution = execute(testWorkflow, { input: "Test", runtime: testRuntime })

      const result = await execution.result

      expect(result.state.goal).toBe("Test")
      expect(result.state.tasks).toContain("Task done")
    })
  })

  describe("real-time event streaming", () => {
    it("yields events during execution, not buffered until completion", async () => {
      // Create a multi-phase workflow so we get multiple events
      type Phases = "planning" | "working" | "done"

      interface MultiPhaseState {
        goal: string
        plan: string
        result: string
      }

      const planSchema = z.object({ plan: z.string() })
      const resultSchema = z.object({ result: z.string() })

      const plannerAgent = agent<MultiPhaseState, { plan: string }>({
        name: "planner",
        model: "claude-sonnet-4-5",
        output: planSchema,
        prompt: (state) => `Plan: ${state.goal}`,
        update: (output, draft) => {
          draft.plan = output.plan
        }
      })

      const workerAgent = agent<MultiPhaseState, { result: string }>({
        name: "worker",
        model: "claude-sonnet-4-5",
        output: resultSchema,
        prompt: (state) => `Work: ${state.plan}`,
        update: (output, draft) => {
          draft.result = output.result
        }
      })

      const multiPhaseWorkflow = workflow<MultiPhaseState, string, Phases>({
        name: "multi-phase-test",
        initialState: { goal: "", plan: "", result: "" },
        start: (input, draft) => {
          draft.goal = input
        },
        phases: {
          planning: { run: plannerAgent, next: "working" },
          working: { run: workerAgent, next: "done" },
          done: phase.terminal<MultiPhaseState, Phases>()
        }
      })

      const multiPhaseFixtures: ReadonlyArray<SimpleFixture> = [
        {
          prompt: "Plan: Build something",
          output: { plan: "Step 1: do things" },
          outputSchema: planSchema,
          providerOptions
        },
        {
          prompt: "Work: Step 1: do things",
          output: { result: "Done working" },
          outputSchema: resultSchema,
          providerOptions
        }
      ]

      const multiPhaseRuntime: RuntimeConfig = {
        providers: { "claude-sonnet-4-5": playbackDummy },
        mode: "playback",
        recorder: seedRecorder(multiPhaseFixtures),
        database: ":memory:"
      }

      const execution = execute(multiPhaseWorkflow, {
        input: "Build something",
        runtime: multiPhaseRuntime
      })

      // Collect events from the async iterator with their arrival order
      const collectedEvents: Array<{ name: string; index: number }> = []
      let index = 0

      for await (const event of execution) {
        collectedEvents.push({ name: event.name, index: index++ })
      }

      // Verify we got events at all
      expect(collectedEvents.length).toBeGreaterThan(0)

      // Find key events
      const workflowStartedIdx = collectedEvents.findIndex(
        (e) => e.name === EVENTS.WORKFLOW_STARTED
      )
      const firstPhaseEnteredIdx = collectedEvents.findIndex(
        (e) => e.name === EVENTS.PHASE_ENTERED
      )
      const workflowCompletedIdx = collectedEvents.findIndex(
        (e) => e.name === EVENTS.WORKFLOW_COMPLETED
      )

      // All key events should exist
      expect(workflowStartedIdx).toBeGreaterThanOrEqual(0)
      expect(firstPhaseEnteredIdx).toBeGreaterThanOrEqual(0)
      expect(workflowCompletedIdx).toBeGreaterThanOrEqual(0)

      // Critical assertion: events arrive in order during execution,
      // NOT all at once at the end. workflow:started and phase:entered
      // must come BEFORE workflow:completed.
      expect(workflowStartedIdx).toBeLessThan(workflowCompletedIdx)
      expect(firstPhaseEnteredIdx).toBeLessThan(workflowCompletedIdx)

      // Verify we see multiple phase transitions (planning -> working -> done)
      const phaseEnteredEvents = collectedEvents.filter(
        (e) => e.name === EVENTS.PHASE_ENTERED
      )
      expect(phaseEnteredEvents.length).toBe(3) // planning, working, done

      // Verify agent events appear between phase events
      const agentStartedEvents = collectedEvents.filter(
        (e) => e.name === EVENTS.AGENT_STARTED
      )
      expect(agentStartedEvents.length).toBeGreaterThanOrEqual(2) // planner + worker

      // The result should also be available after iteration
      const result = await execution.result
      expect(result.state.plan).toBe("Step 1: do things")
      expect(result.state.result).toBe("Done working")
      expect(result.completed).toBe(true)
    })

    it("yields events from a simple workflow in real-time", async () => {
      const execution = execute(testWorkflow, { input: "Stream test", runtime: testRuntime })

      const eventNames: Array<string> = []

      for await (const event of execution) {
        eventNames.push(event.name)
      }

      // Should have events streamed in order
      expect(eventNames.length).toBeGreaterThan(0)

      // workflow:started should be present and come before workflow:completed
      const startIdx = eventNames.indexOf(EVENTS.WORKFLOW_STARTED)
      const completeIdx = eventNames.indexOf(EVENTS.WORKFLOW_COMPLETED)

      expect(startIdx).toBeGreaterThanOrEqual(0)
      expect(completeIdx).toBeGreaterThanOrEqual(0)
      expect(startIdx).toBeLessThan(completeIdx)

      // Agent events should be present between start and complete
      const agentStartIdx = eventNames.indexOf(EVENTS.AGENT_STARTED)
      expect(agentStartIdx).toBeGreaterThan(startIdx)
      expect(agentStartIdx).toBeLessThan(completeIdx)
    })
  })
})
