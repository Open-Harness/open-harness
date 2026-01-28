/**
 * Tests for Engine/run.ts
 *
 * Validates the simple Promise API for workflow execution.
 * Uses ProviderRecorder playback with pre-seeded fixtures.
 */

import { describe, expect, it, vi } from "vitest"
import { z } from "zod"

import { agent } from "../src/Engine/agent.js"
import type { RuntimeConfig } from "../src/Engine/execute.js"
import { run, type RunOptions, runSimple, runWithText } from "../src/Engine/run.js"
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
// Fixtures
// ─────────────────────────────────────────────────────────────────

const fixtures: ReadonlyArray<SimpleFixture> = [
  {
    prompt: "Goal: Build API",
    output: { message: "Task completed" },
    text: "Generated text",
    outputSchema: messageSchema,
    providerOptions
  },
  {
    prompt: "Goal: Test",
    output: { message: "Task completed" },
    text: "Generated text",
    outputSchema: messageSchema,
    providerOptions
  },
  {
    prompt: "Goal: Test Goal",
    output: { message: "Task completed" },
    text: "Generated text",
    outputSchema: messageSchema,
    providerOptions
  },
  {
    prompt: "Goal: Build an API",
    output: { message: "Task completed" },
    text: "Generated text",
    outputSchema: messageSchema,
    providerOptions
  },
  {
    prompt: "Goal: Just the input",
    output: { message: "Task completed" },
    text: "Generated text",
    outputSchema: messageSchema,
    providerOptions
  }
]

// Dummy provider for playback mode
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
  recorder: seedRecorder(fixtures),
  database: ":memory:"
}

// ─────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────

describe("run()", () => {
  describe("basic execution", () => {
    it("executes workflow and returns result", async () => {
      const result = await run(testWorkflow, {
        input: "Build API",
        runtime: testRuntime
      })

      expect(result.state.goal).toBe("Build API")
      expect(result.state.tasks).toContain("Task completed")
      expect(result.durationMs).toBeGreaterThanOrEqual(0)
    })

    it("generates session ID if not provided", async () => {
      const result = await run(testWorkflow, {
        input: "Test",
        runtime: testRuntime
      })

      expect(result.sessionId).toBeDefined()
      expect(result.sessionId.length).toBeGreaterThan(0)
    })

    it("uses provided session ID", async () => {
      const sessionId = "custom-session-456"

      const result = await run(testWorkflow, {
        input: "Test",
        sessionId,
        runtime: testRuntime
      })

      expect(result.sessionId).toBe(sessionId)
    })
  })

  describe("observer callbacks", () => {
    it("calls observer.event for each event", async () => {
      const event = vi.fn()

      await run(testWorkflow, {
        input: "Test",
        runtime: testRuntime,
        observer: { onEvent: event }
      })

      expect(event).toHaveBeenCalled()
      expect(event.mock.calls.length).toBeGreaterThan(0)
    })

    it("calls observer.stateChanged when state updates", async () => {
      const stateChanged = vi.fn()

      await run(testWorkflow, {
        input: "Test Goal",
        runtime: testRuntime,
        observer: { onStateChanged: stateChanged }
      })

      expect(stateChanged).toHaveBeenCalled()
    })

    it("calls observer.agentStarted when agent begins", async () => {
      const agentStarted = vi.fn()

      await run(testWorkflow, {
        input: "Test",
        runtime: testRuntime,
        observer: { onAgentStarted: agentStarted }
      })

      expect(agentStarted).toHaveBeenCalledWith(
        expect.objectContaining({ agent: "test-agent" })
      )
    })
  })
})

describe("runSimple()", () => {
  it("is a convenience wrapper for run()", async () => {
    const result = await runSimple(testWorkflow, "Test", testRuntime)

    expect(result.state.goal).toBe("Test")
    expect(result.state.tasks).toContain("Task completed")
  })

  it("accepts workflow, input, and runtime", async () => {
    const result = await runSimple(testWorkflow, "Build an API", testRuntime)

    expect(result.state.goal).toBe("Build an API")
  })
})

describe("runWithText()", () => {
  it("returns object with text and result properties", async () => {
    const { result, text } = await runWithText(testWorkflow, "Test", testRuntime)

    expect(result.state.goal).toBe("Test")
    // Text is collected from streamed chunks via observer
    expect(typeof text).toBe("string")
  })
})

describe("RunOptions interface", () => {
  it("accepts observer field", () => {
    const options: RunOptions<TestState, string> = {
      input: "Test",
      runtime: testRuntime,
      sessionId: "abc",
      observer: {
        onEvent: () => {},
        onStateChanged: () => {},
        onTextDelta: () => {},
        onPhaseChanged: () => {},
        onAgentStarted: () => {},
        onAgentCompleted: () => {},
        onInputRequested: async () => "response"
      }
    }

    // TypeScript should accept this without errors
    expect(options.input).toBe("Test")
  })

  it("requires input and runtime fields", () => {
    const minimalOptions: RunOptions<TestState, string> = {
      input: "Just the input",
      runtime: testRuntime
    }

    expect(minimalOptions.input).toBe("Just the input")
    expect(minimalOptions.runtime).toBe(testRuntime)
  })
})
