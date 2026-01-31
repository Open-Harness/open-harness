/**
 * Tests for RuntimeConfig.database field and observer type exports.
 *
 * Validates:
 * - RuntimeConfig accepts optional database field
 * - WorkflowObserver, InputRequest are exported from core index
 * - Config fields affect runtime behavior (mode, database, recorder)
 */

import { describe, expect, it, vi } from "vitest"
import { z } from "zod"

import { agent } from "../src/Engine/agent.js"
import { run } from "../src/Engine/run.js"
import { workflow } from "../src/Engine/workflow.js"
import type { InputRequest, RuntimeConfig, WorkflowObserver } from "../src/index.js"
import { seedRecorder, type SimpleFixture, testProvider } from "./helpers/test-provider.js"

describe("RuntimeConfig", () => {
  // Per ADR-010: No providers map needed - agents own their providers directly
  it("accepts empty config with defaults", () => {
    const config: RuntimeConfig = {}
    expect(config.database).toBeUndefined()
    expect(config.mode).toBeUndefined()
  })

  it("accepts database field with file path", () => {
    const config: RuntimeConfig = {
      database: "./test.db"
    }
    expect(config.database).toBe("./test.db")
  })

  it("accepts database field with :memory: for tests", () => {
    const config: RuntimeConfig = {
      database: ":memory:"
    }
    expect(config.database).toBe(":memory:")
  })

  it("accepts database field alongside other optional fields", () => {
    const config: RuntimeConfig = {
      database: "./scaffold.db",
      mode: "live"
    }
    expect(config.database).toBe("./scaffold.db")
    expect(config.mode).toBe("live")
  })
})

describe("Observer type exports", () => {
  it("WorkflowObserver type is importable", () => {
    // Type-level check: if this compiles, the export works.
    // WorkflowObserver<S> has all optional methods
    const observer: WorkflowObserver<unknown> = {}
    expect(observer).toBeDefined()
  })

  it("InputRequest type is importable", () => {
    // Per ADR-002: Only "approval" and "choice" types are valid
    // Per ADR-008: id field is required for request-response correlation
    const request: InputRequest = {
      id: "test-request-1",
      prompt: "What do you think?",
      type: "approval"
    }
    expect(request.id).toBe("test-request-1")
    expect(request.prompt).toBe("What do you think?")
    expect(request.type).toBe("approval")
  })
})

// ─────────────────────────────────────────────────────────────────
// Behavioral: Config affects runtime behavior
// ─────────────────────────────────────────────────────────────────

describe("RuntimeConfig behavioral (config affects runtime)", () => {
  const outputSchema = z.object({ result: z.string() })
  const providerOptions = { model: "claude-sonnet-4-5" }

  const testAgent = agent<{ result: string }, { result: string }>({
    name: "config-test-agent",
    provider: testProvider,
    output: outputSchema,
    prompt: () => "test prompt",
    update: (output, draft) => {
      draft.result = output.result
    }
  })

  const testWorkflow = workflow<{ result: string }>({
    name: "config-test-workflow",
    initialState: { result: "" },
    start: () => {},
    agent: testAgent,
    until: () => true
  })

  const fixtures: ReadonlyArray<SimpleFixture> = [
    {
      prompt: "test prompt",
      output: { result: "done" },
      outputSchema,
      providerOptions
    }
  ]

  it("mode: 'playback' with recorder uses recorded fixtures", async () => {
    const result = await run(testWorkflow, {
      input: "go",
      runtime: {
        mode: "playback",
        recorder: await seedRecorder(fixtures),
        database: ":memory:"
      }
    })

    // If playback mode didn't work, the dummy provider would throw
    expect(result.state.result).toBe("done")
    expect(result.completed).toBe(true)
  })

  it("database: ':memory:' creates working in-memory store", async () => {
    const eventSpy = vi.fn()

    const result = await run(testWorkflow, {
      input: "go",
      runtime: {
        mode: "playback",
        recorder: await seedRecorder(fixtures),
        database: ":memory:"
      },
      observer: { onEvent: eventSpy }
    })

    // Events were emitted (proving in-memory EventStore works)
    expect(eventSpy).toHaveBeenCalled()
    expect(result.completed).toBe(true)
  })

  it("observer config receives lifecycle callbacks during execution", async () => {
    const started = vi.fn()
    const completed = vi.fn()
    const stateChanged = vi.fn()
    const agentStarted = vi.fn()
    const agentCompleted = vi.fn()

    await run(testWorkflow, {
      input: "go",
      runtime: {
        mode: "playback",
        recorder: await seedRecorder(fixtures),
        database: ":memory:"
      },
      observer: {
        onStarted: started,
        onCompleted: completed,
        onStateChanged: stateChanged,
        onAgentStarted: agentStarted,
        onAgentCompleted: agentCompleted
      }
    })

    // All lifecycle callbacks should have fired
    expect(started).toHaveBeenCalledTimes(1)
    expect(completed).toHaveBeenCalledTimes(1)
    expect(stateChanged).toHaveBeenCalled()
    expect(agentStarted).toHaveBeenCalled()
    expect(agentCompleted).toHaveBeenCalled()

    // completed receives state and events
    expect(completed).toHaveBeenCalledWith(
      expect.objectContaining({
        state: expect.objectContaining({ result: "done" }),
        events: expect.any(Array)
      })
    )
  })
})
