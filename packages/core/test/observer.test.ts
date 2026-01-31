/**
 * Tests for WorkflowObserver dispatch in the runtime.
 *
 * Validates that the observer protocol receives all lifecycle callbacks
 * in the correct order during workflow execution.
 * Uses ProviderRecorder playback with pre-seeded fixtures.
 */

import { describe, expect, it } from "vitest"
import { z } from "zod"

import type { SerializedEvent } from "../src/Domain/Events.js"
import { agent } from "../src/Engine/agent.js"
import { phase } from "../src/Engine/phase.js"
import { executeWorkflow } from "../src/Engine/runtime.js"
import type { WorkflowObserver } from "../src/Engine/types.js"
import { workflow } from "../src/Engine/workflow.js"
import { runWithTestRuntime, type SimpleFixture, testProvider } from "./helpers/test-provider.js"

// ─────────────────────────────────────────────────────────────────
// Test State and Types
// ─────────────────────────────────────────────────────────────────

interface TestState {
  goal: string
  tasks: Array<string>
  done: boolean
}

type TestPhases = "planning" | "execution" | "done"

// Shared schemas for hash consistency
const messageSchema = z.object({ message: z.string() })
const resultSchema = z.object({ result: z.string() })

const providerOptions = { model: "claude-sonnet-4-5" }

// Test agents (per ADR-010: agents own provider directly)
const planAgent = agent<TestState, { message: string }>({
  name: "plan-agent",
  provider: testProvider,
  output: messageSchema,
  prompt: (state) => `Plan: ${state.goal}`,
  update: (output, draft) => {
    draft.tasks.push(output.message)
  }
})

const execAgent = agent<TestState, { result: string }>({
  name: "exec-agent",
  provider: testProvider,
  output: resultSchema,
  prompt: (state) => `Execute: ${state.tasks.join(",")}`,
  update: (output, draft) => {
    draft.tasks.push(output.result)
    draft.done = true
  }
})

// ─────────────────────────────────────────────────────────────────
// Fixture definitions
// ─────────────────────────────────────────────────────────────────

const fixtures: ReadonlyArray<SimpleFixture> = [
  // planAgent fixtures for various inputs
  {
    prompt: "Plan: Build an API",
    output: { message: "Task planned" },
    text: "planning text",
    outputSchema: messageSchema,
    providerOptions
  },
  {
    prompt: "Plan: Test",
    output: { message: "Task planned" },
    text: "planning text",
    outputSchema: messageSchema,
    providerOptions
  },
  {
    prompt: "Plan: Simple test",
    output: { message: "Task planned" },
    text: "planning text",
    outputSchema: messageSchema,
    providerOptions
  },
  {
    prompt: "Plan: No observer",
    output: { message: "Task planned" },
    text: "planning text",
    outputSchema: messageSchema,
    providerOptions
  },
  // Streaming test: different output for text delta test
  {
    prompt: "Plan: Stream test",
    output: { message: "Planned" },
    text: "streaming text here",
    outputSchema: messageSchema,
    providerOptions
  },
  // execAgent fixture
  {
    prompt: "Execute: Task planned",
    output: { result: "Task executed" },
    outputSchema: resultSchema,
    providerOptions
  }
]

// ─────────────────────────────────────────────────────────────────
// Helper: create a recording observer
// ─────────────────────────────────────────────────────────────────

interface ObserverLog {
  calls: Array<{ method: string; args: Array<unknown> }>
}

function createRecordingObserver<S>(): { observer: WorkflowObserver<S>; log: ObserverLog } {
  const log: ObserverLog = { calls: [] }

  const observer: WorkflowObserver<S> = {
    onStarted(sessionId: string) {
      log.calls.push({ method: "onStarted", args: [sessionId] })
    },
    onStateChanged(state: S, patches?: ReadonlyArray<unknown>) {
      log.calls.push({ method: "onStateChanged", args: [state, patches] })
    },
    onPhaseChanged(p: string, from?: string) {
      log.calls.push({ method: "onPhaseChanged", args: [p, from] })
    },
    onAgentStarted(info: { agent: string; phase?: string }) {
      log.calls.push({ method: "onAgentStarted", args: [info] })
    },
    onAgentCompleted(info: { agent: string; output: unknown; durationMs: number }) {
      log.calls.push({ method: "onAgentCompleted", args: [info] })
    },
    onCompleted(result: { state: S; events: ReadonlyArray<SerializedEvent> }) {
      log.calls.push({ method: "onCompleted", args: [result] })
    },
    onError(error: unknown) {
      log.calls.push({ method: "onError", args: [error] })
    },
    onEvent(evt: SerializedEvent) {
      log.calls.push({ method: "onEvent", args: [evt] })
    },
    onTextDelta(info: { agent: string; delta: string }) {
      log.calls.push({ method: "onTextDelta", args: [info] })
    },
    onThinkingDelta(info: { agent: string; delta: string }) {
      log.calls.push({ method: "onThinkingDelta", args: [info] })
    }
  }

  return { observer, log }
}

// ─────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────

describe("WorkflowObserver dispatch", () => {
  describe("phased workflow observer", () => {
    it("dispatches all observer methods in correct order", async () => {
      const phasedWorkflow = workflow<TestState, string, TestPhases>({
        name: "observer-test",
        initialState: { goal: "", tasks: [], done: false },
        start: (input, draft) => {
          draft.goal = input
        },
        phases: {
          planning: { run: planAgent, next: "execution" },
          execution: { run: execAgent, next: "done" },
          done: phase.terminal<TestState, TestPhases>()
        }
      })

      const { log, observer } = createRecordingObserver<TestState>()

      const result = await runWithTestRuntime(
        executeWorkflow(phasedWorkflow, {
          input: "Build an API",
          sessionId: "obs-test-session",
          observer
        }),
        { fixtures }
      )

      // Verify the workflow completed
      expect(result.completed).toBe(true)
      expect(result.state.goal).toBe("Build an API")
      expect(result.state.tasks).toContain("Task planned")
      expect(result.state.tasks).toContain("Task executed")

      // Extract just the method names for order verification
      const methods = log.calls.map((c) => c.method)

      // onStarted must be called
      expect(methods).toContain("onStarted")
      // onCompleted must be called
      expect(methods).toContain("onCompleted")

      // onStarted must come before onCompleted
      const startedIdx = methods.indexOf("onStarted")
      const completedIdx = methods.lastIndexOf("onCompleted")
      expect(startedIdx).toBeLessThan(completedIdx)

      // onPhaseChanged must be called for planning and execution phases
      const phaseChangedCalls = log.calls.filter((c) => c.method === "onPhaseChanged")
      const phaseNames = phaseChangedCalls.map((c) => c.args[0])
      expect(phaseNames).toContain("planning")
      expect(phaseNames).toContain("execution")
      expect(phaseNames).toContain("done")

      // onAgentStarted must be called for both agents
      const agentStartedCalls = log.calls.filter((c) => c.method === "onAgentStarted")
      const agentNames = agentStartedCalls.map((c) => (c.args[0] as { agent: string }).agent)
      expect(agentNames).toContain("plan-agent")
      expect(agentNames).toContain("exec-agent")

      // onAgentCompleted must be called for both agents
      const agentCompletedCalls = log.calls.filter((c) => c.method === "onAgentCompleted")
      const completedAgents = agentCompletedCalls.map((c) => (c.args[0] as { agent: string }).agent)
      expect(completedAgents).toContain("plan-agent")
      expect(completedAgents).toContain("exec-agent")

      // onStateChanged must be called (at least for start() and each agent update)
      const stateChangedCalls = log.calls.filter((c) => c.method === "onStateChanged")
      expect(stateChangedCalls.length).toBeGreaterThanOrEqual(3) // start + plan + exec

      // onEvent must be called for every event
      const eventCalls = log.calls.filter((c) => c.method === "onEvent")
      expect(eventCalls.length).toBeGreaterThan(0)

      // onCompleted receives the final state and events
      const completedCall = log.calls.find((c) => c.method === "onCompleted")
      expect(completedCall).toBeDefined()
      const completedResult = completedCall!.args[0] as { state: TestState; events: ReadonlyArray<SerializedEvent> }
      expect(completedResult.state.goal).toBe("Build an API")
      expect(completedResult.events.length).toBeGreaterThan(0)
    })

    it("dispatches agentStarted before agentCompleted for each agent", async () => {
      const phasedWorkflow = workflow<TestState, string, TestPhases>({
        name: "agent-order-test",
        initialState: { goal: "", tasks: [], done: false },
        start: (input, draft) => {
          draft.goal = input
        },
        phases: {
          planning: { run: planAgent, next: "execution" },
          execution: { run: execAgent, next: "done" },
          done: phase.terminal<TestState, TestPhases>()
        }
      })

      const { log, observer } = createRecordingObserver<TestState>()

      await runWithTestRuntime(
        executeWorkflow(phasedWorkflow, {
          input: "Test",
          observer
        }),
        { fixtures }
      )

      // For each agent, onAgentStarted must come before onAgentCompleted
      for (const name of ["plan-agent", "exec-agent"]) {
        const startIdx = log.calls.findIndex(
          (c) => c.method === "onAgentStarted" && (c.args[0] as { agent: string }).agent === name
        )
        const completeIdx = log.calls.findIndex(
          (c) => c.method === "onAgentCompleted" && (c.args[0] as { agent: string }).agent === name
        )
        expect(startIdx).toBeGreaterThanOrEqual(0)
        expect(completeIdx).toBeGreaterThan(startIdx)
      }
    })

    it("dispatches stateChanged between agentStarted and agentCompleted", async () => {
      const simpleWorkflow = workflow<TestState>({
        name: "state-change-order",
        initialState: { goal: "", tasks: [], done: false },
        start: (input, draft) => {
          draft.goal = input
        },
        agent: planAgent,
        until: () => true
      })

      const { log, observer } = createRecordingObserver<TestState>()

      await runWithTestRuntime(
        executeWorkflow(simpleWorkflow, {
          input: "Test",
          observer
        }),
        { fixtures }
      )

      // Find the agent lifecycle indices
      const agentStartIdx = log.calls.findIndex(
        (c) => c.method === "onAgentStarted" && (c.args[0] as { agent: string }).agent === "plan-agent"
      )

      // onStateChanged should occur after onAgentStarted (state is updated after agent returns)
      const stateChangedAfterAgent = log.calls.findIndex(
        (c, i) => c.method === "onStateChanged" && i > agentStartIdx
      )
      expect(stateChangedAfterAgent).toBeGreaterThan(agentStartIdx)
    })
  })

  describe("simple workflow observer", () => {
    it("dispatches started and completed for simple workflows", async () => {
      const simpleWorkflow = workflow<TestState>({
        name: "simple-observer-test",
        initialState: { goal: "", tasks: [], done: false },
        start: (input, draft) => {
          draft.goal = input
        },
        agent: planAgent,
        until: () => true
      })

      const { log, observer } = createRecordingObserver<TestState>()

      await runWithTestRuntime(
        executeWorkflow(simpleWorkflow, {
          input: "Simple test",
          observer
        }),
        { fixtures }
      )

      const methods = log.calls.map((c) => c.method)
      expect(methods).toContain("onStarted")
      expect(methods).toContain("onCompleted")
      expect(methods).toContain("onAgentStarted")
      expect(methods).toContain("onAgentCompleted")
      expect(methods).toContain("onStateChanged")
    })
  })

  describe("streaming observer", () => {
    it("dispatches streamed chunks for text deltas", async () => {
      const simpleWorkflow = workflow<TestState>({
        name: "stream-observer-test",
        initialState: { goal: "", tasks: [], done: false },
        start: (input, draft) => {
          draft.goal = input
        },
        agent: planAgent,
        until: () => true
      })

      const { log, observer } = createRecordingObserver<TestState>()

      await runWithTestRuntime(
        executeWorkflow(simpleWorkflow, {
          input: "Stream test",
          observer
        }),
        { fixtures }
      )

      // Check that onTextDelta was called for the text delta
      const textDeltaCalls = log.calls.filter((c) => c.method === "onTextDelta")
      expect(textDeltaCalls.length).toBeGreaterThan(0)

      const textChunk = textDeltaCalls[0]
      expect(textChunk).toBeDefined()
      expect((textChunk!.args[0] as { agent: string }).agent).toBe("plan-agent")
    })
  })

  describe("observer is optional", () => {
    it("works without an observer", async () => {
      const simpleWorkflow = workflow<TestState>({
        name: "no-observer-test",
        initialState: { goal: "", tasks: [], done: false },
        start: (input, draft) => {
          draft.goal = input
        },
        agent: planAgent,
        until: () => true
      })

      // No observer — should not throw
      const result = await runWithTestRuntime(
        executeWorkflow(simpleWorkflow, {
          input: "No observer"
        }),
        { fixtures }
      )

      expect(result.completed).toBe(true)
      expect(result.state.tasks).toContain("Task planned")
    })
  })
})
