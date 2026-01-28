/**
 * Integration test: CLI E2E pipeline.
 *
 * Exercises the same code path as `scaffold run --headless`:
 * OpenScaffold.create() -> createServer() -> HTTP POST /sessions -> GET /sessions/:id/events (SSE)
 *
 * Uses mock providers to avoid real API calls while testing the full
 * HTTP pipeline, SSE streaming, and JSON-line output format.
 */

import { Stream } from "effect"
import { afterEach, describe, expect, it } from "vitest"
import { z } from "zod"

import { agent, phase, workflow } from "@open-scaffold/core"
import type { AgentProvider, AgentStreamEvent, ProviderRunOptions } from "@open-scaffold/core"

import { OpenScaffold } from "../src/OpenScaffold.js"

// ─────────────────────────────────────────────────────────────────
// Mock provider (returns predetermined outputs)
// ─────────────────────────────────────────────────────────────────

const createE2EMockProvider = (): AgentProvider => ({
  name: "e2e-mock-provider",
  stream: (options: ProviderRunOptions): Stream.Stream<AgentStreamEvent, never> => {
    const events: Array<AgentStreamEvent> = []

    if (options.prompt.includes("task list")) {
      events.push({ _tag: "TextDelta", delta: "Planning..." })
      events.push({ _tag: "TextComplete", text: "Planning..." })
      events.push({
        _tag: "Result",
        output: { tasks: ["task-1", "task-2"] },
        stopReason: "end_turn",
        text: "Planning..."
      })
    } else {
      events.push({
        _tag: "Result",
        output: { tasks: ["default-task"] },
        stopReason: "end_turn"
      })
    }

    return Stream.fromIterable(events)
  }
})

// ─────────────────────────────────────────────────────────────────
// Test workflow (mirrors apps/cli/test-workflow.ts)
// ─────────────────────────────────────────────────────────────────

interface E2EState {
  goal: string
  tasks: Array<string>
}

type E2EPhases = "planning" | "done"

const planner = agent<E2EState, { tasks: Array<string> }>({
  name: "planner",
  model: "claude-sonnet-4-5",
  output: z.object({ tasks: z.array(z.string()) }),
  prompt: (state) => `Create a task list for: ${state.goal}`,
  update: (output, draft) => {
    for (const task of output.tasks) {
      draft.tasks.push(task)
    }
  }
})

const e2eWorkflow = workflow<E2EState, string, E2EPhases>({
  name: "e2e-test",
  initialState: { goal: "", tasks: [] },
  start: (input, draft) => {
    draft.goal = input
  },
  phases: {
    planning: { run: planner, next: "done" },
    done: phase.terminal<E2EState, E2EPhases>()
  }
})

// ─────────────────────────────────────────────────────────────────
// Test
// ─────────────────────────────────────────────────────────────────

describe("CLI E2E integration", () => {
  let scaffold: OpenScaffold | null = null

  afterEach(async () => {
    if (scaffold) {
      await scaffold.dispose()
      scaffold = null
    }
  })

  it("creates server, posts session, and streams SSE events", async () => {
    const mockProvider = createE2EMockProvider()

    // Same path as CLI: OpenScaffold.create() -> createServer()
    scaffold = OpenScaffold.create({
      database: ":memory:",
      mode: "live",
      providers: {
        "claude-sonnet-4-5": mockProvider
      }
    })

    const server = scaffold.createServer({
      workflow: e2eWorkflow,
      port: 0 // Ephemeral port
    })

    await server.start()
    const addr = await server.address()

    // Create session via HTTP POST (same as CLI does)
    const createResponse = await fetch(`http://127.0.0.1:${addr.port}/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ input: "Build a REST API" })
    })

    expect(createResponse.status).toBe(201)
    const { sessionId } = await createResponse.json() as { sessionId: string }
    expect(sessionId).toBeDefined()
    expect(typeof sessionId).toBe("string")

    // Wait a moment for the workflow to execute
    await new Promise((resolve) => setTimeout(resolve, 500))

    // Verify the session exists and has events by checking session state
    const stateResponse = await fetch(`http://127.0.0.1:${addr.port}/sessions/${sessionId}/state`)
    expect(stateResponse.status).toBe(200)
    const stateBody = await stateResponse.json() as { state: E2EState }
    expect(stateBody.state).toBeDefined()
    expect(stateBody.state.goal).toBe("Build a REST API")

    // Stream SSE events with timeout and abort after workflow:completed
    const eventsUrl = `http://127.0.0.1:${addr.port}/sessions/${sessionId}/events?history=true`
    const abortController = new AbortController()
    const eventsResponse = await fetch(eventsUrl, { signal: abortController.signal })

    expect(eventsResponse.status).toBe(200)
    expect(eventsResponse.headers.get("content-type")).toContain("text/event-stream")

    // Read SSE stream and collect JSON lines (replicating CLI runHeadless)
    const reader = eventsResponse.body?.getReader()
    expect(reader).toBeDefined()

    const decoder = new TextDecoder()
    const jsonLines: Array<unknown> = []
    let sawCompleted = false

    // Read with a timeout
    const readWithTimeout = async () => {
      const timeout = setTimeout(() => {
        abortController.abort()
      }, 5000)

      try {
        while (reader) {
          const { done, value } = await reader.read()
          if (done) break

          const text = decoder.decode(value, { stream: true })
          const lines = text.split("\n")

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6)
              if (data === "[DONE]") continue
              try {
                const parsed = JSON.parse(data) as { name?: string }
                jsonLines.push(parsed)
                if (parsed.name === "workflow:completed") {
                  sawCompleted = true
                }
              } catch {
                // Skip non-JSON SSE lines
              }
            }
          }

          // Break once we see the completion event
          if (sawCompleted) break
        }
      } catch (err) {
        // AbortError is expected if we hit timeout
        if (err instanceof Error && err.name !== "AbortError") {
          throw err
        }
      } finally {
        clearTimeout(timeout)
        abortController.abort()
      }
    }

    await readWithTimeout()

    // Verify we got SSE events (from history since the workflow already completed)
    expect(jsonLines.length).toBeGreaterThan(0)

    // Verify key events are present in the SSE stream
    const eventNames = jsonLines
      .filter((line): line is { name: string } => typeof line === "object" && line !== null && "name" in line)
      .map((line) => line.name)

    expect(eventNames).toContain("workflow:started")
    expect(eventNames).toContain("workflow:completed")
    expect(eventNames).toContain("state:updated")

    // Verify ordering
    const startedIdx = eventNames.indexOf("workflow:started")
    const completedIdx = eventNames.indexOf("workflow:completed")
    expect(startedIdx).toBeLessThan(completedIdx)

    // Cleanup
    await server.stop()
  }, 30000)

  it("returns error status for non-existent session", async () => {
    const mockProvider = createE2EMockProvider()

    scaffold = OpenScaffold.create({
      database: ":memory:",
      mode: "live",
      providers: {
        "claude-sonnet-4-5": mockProvider
      }
    })

    const server = scaffold.createServer({
      workflow: e2eWorkflow,
      port: 0
    })

    await server.start()
    const addr = await server.address()

    // Request events for a session that doesn't exist
    const response = await fetch(`http://127.0.0.1:${addr.port}/sessions/nonexistent-session-id`)
    // Server may return 400 or 404 depending on route matching
    expect(response.ok).toBe(false)
    expect(response.status).toBeGreaterThanOrEqual(400)

    await server.stop()
  }, 15000)
})
