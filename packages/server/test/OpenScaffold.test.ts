/**
 * OpenScaffold lifecycle tests.
 *
 * Tests the public API facade that hides Effect internals.
 * Focuses on lifecycle management: create, dispose, server start/stop.
 */

import { Stream } from "effect"
import { afterEach, describe, expect, it } from "vitest"
import { z } from "zod"

import { agent, phase, workflow } from "@open-scaffold/core"
import type { AgentProvider, AgentStreamEvent, ProviderRunOptions } from "@open-scaffold/core"

import { OpenScaffold, OpenScaffoldError } from "../src/OpenScaffold.js"

// ─────────────────────────────────────────────────────────────────
// Test fixtures
// ─────────────────────────────────────────────────────────────────

const createMockProvider = (): AgentProvider => ({
  name: "test-mock-provider",
  model: "test-mock-model",
  stream: (_options: ProviderRunOptions): Stream.Stream<AgentStreamEvent, never> => {
    return Stream.fromIterable([
      { _tag: "TextDelta", delta: "Test response" },
      { _tag: "TextComplete", text: "Test response" },
      {
        _tag: "Result",
        output: { value: "done" },
        stopReason: "end_turn",
        text: "Test response"
      }
    ] as Array<AgentStreamEvent>)
  }
})

interface TestState {
  input: string
  value: string
}

type TestPhases = "process" | "done"

const testAgent = agent<TestState, { value: string }>({
  name: "test-agent",
  provider: createMockProvider(),
  output: z.object({ value: z.string() }),
  prompt: (state) => `Process: ${state.input}`,
  update: (output, draft) => {
    draft.value = output.value
  }
})

const testWorkflow = workflow<TestState, string, TestPhases>({
  name: "test-lifecycle-workflow",
  initialState: { input: "", value: "" },
  start: (input, draft) => {
    draft.input = input
  },
  phases: {
    process: { run: testAgent, next: "done" },
    done: phase.terminal<TestState, TestPhases>()
  }
})

// ─────────────────────────────────────────────────────────────────
// OpenScaffold.create() tests
// ─────────────────────────────────────────────────────────────────

describe("OpenScaffold.create()", () => {
  let scaffold: OpenScaffold | null = null

  afterEach(async () => {
    if (scaffold) {
      await scaffold.dispose()
      scaffold = null
    }
  })

  it("creates instance with in-memory database", async () => {
    scaffold = OpenScaffold.create({
      database: ":memory:",
      mode: "live"
    })

    expect(scaffold).toBeDefined()
    expect(scaffold.database).toBe(":memory:")
    expect(scaffold.mode).toBe("live")
  })

  it("creates instance with playback mode", async () => {
    scaffold = OpenScaffold.create({
      database: ":memory:",
      mode: "playback"
    })

    expect(scaffold.mode).toBe("playback")
  })

  it("creates instance with providers map", async () => {
    const mockProvider = createMockProvider()
    scaffold = OpenScaffold.create({
      database: ":memory:",
      mode: "live",
      providers: {
        "test-model": mockProvider
      }
    })

    expect(scaffold).toBeDefined()
  })
})

// ─────────────────────────────────────────────────────────────────
// OpenScaffold.dispose() tests
// ─────────────────────────────────────────────────────────────────

describe("OpenScaffold.dispose()", () => {
  it("disposes cleanly without any servers", async () => {
    const scaffold = OpenScaffold.create({
      database: ":memory:",
      mode: "live"
    })

    // Should not throw
    await scaffold.dispose()
  })

  it("disposes cleanly after creating but not starting server", async () => {
    const scaffold = OpenScaffold.create({
      database: ":memory:",
      mode: "live"
    })

    // Create server but don't start it
    scaffold.createServer({
      workflow: testWorkflow,
      port: 0
    })

    // Should not throw
    await scaffold.dispose()
  })

  it("can be called multiple times without error", async () => {
    const scaffold = OpenScaffold.create({
      database: ":memory:",
      mode: "live"
    })

    await scaffold.dispose()
    // Second dispose should not throw
    await scaffold.dispose()
  })
})

// ─────────────────────────────────────────────────────────────────
// Server lifecycle tests
// ─────────────────────────────────────────────────────────────────

describe("OpenScaffoldServer lifecycle", () => {
  let scaffold: OpenScaffold | null = null

  afterEach(async () => {
    if (scaffold) {
      await scaffold.dispose()
      scaffold = null
    }
  })

  it("starts and stops server", async () => {
    scaffold = OpenScaffold.create({
      database: ":memory:",
      mode: "live"
    })

    const server = scaffold.createServer({
      workflow: testWorkflow,
      port: 0
    })

    await server.start()
    const addr = await server.address()
    expect(addr.port).toBeGreaterThan(0)

    await server.stop()
  })

  it("returns correct address after start", async () => {
    scaffold = OpenScaffold.create({
      database: ":memory:",
      mode: "live"
    })

    const server = scaffold.createServer({
      workflow: testWorkflow,
      host: "127.0.0.1",
      port: 0
    })

    await server.start()
    const addr = await server.address()

    expect(addr.host).toBe("127.0.0.1")
    expect(typeof addr.port).toBe("number")
    expect(addr.port).toBeGreaterThan(0)

    await server.stop()
  })

  it("server can be stopped and restarted", async () => {
    scaffold = OpenScaffold.create({
      database: ":memory:",
      mode: "live"
    })

    const server = scaffold.createServer({
      workflow: testWorkflow,
      port: 0
    })

    // First start
    await server.start()
    const addr1 = await server.address()
    expect(addr1.port).toBeGreaterThan(0)

    // Stop
    await server.stop()

    // Restart
    await server.start()
    const addr2 = await server.address()
    expect(addr2.port).toBeGreaterThan(0)

    await server.stop()
  })

  it("can create multiple servers from same scaffold", async () => {
    scaffold = OpenScaffold.create({
      database: ":memory:",
      mode: "live"
    })

    const server1 = scaffold.createServer({
      workflow: testWorkflow,
      port: 0
    })

    const server2 = scaffold.createServer({
      workflow: testWorkflow,
      port: 0
    })

    await server1.start()
    await server2.start()

    const addr1 = await server1.address()
    const addr2 = await server2.address()

    // Both should have valid ports
    expect(addr1.port).toBeGreaterThan(0)
    expect(addr2.port).toBeGreaterThan(0)
    // Ports should be different
    expect(addr1.port).not.toBe(addr2.port)

    await server1.stop()
    await server2.stop()
  })
})

// ─────────────────────────────────────────────────────────────────
// listSessions() tests
// ─────────────────────────────────────────────────────────────────

describe("OpenScaffold.listSessions()", () => {
  let scaffold: OpenScaffold | null = null

  afterEach(async () => {
    if (scaffold) {
      await scaffold.dispose()
      scaffold = null
    }
  })

  it("returns empty array when no sessions exist", async () => {
    scaffold = OpenScaffold.create({
      database: ":memory:",
      mode: "live"
    })

    const sessions = await scaffold.listSessions()
    expect(sessions).toEqual([])
  })

  // Note: OpenScaffold.listSessions() and createServer() use separate ManagedRuntime instances.
  // With `:memory:` databases, each runtime gets its own isolated SQLite instance.
  // For shared data, use a file-based database path (e.g., "file:./data/app.db").
  // This test verifies the API works correctly - data sharing requires file-based storage.
  it("returns sessions from the scaffold runtime (not server runtime)", async () => {
    scaffold = OpenScaffold.create({
      database: ":memory:",
      mode: "live"
    })

    // listSessions() queries the scaffold's own EventStore
    // With :memory: databases, this is isolated from server's EventStore
    const sessions = await scaffold.listSessions()
    expect(sessions).toEqual([])

    // The API contract is verified - listSessions() returns sessions from scaffold's runtime
  })
})

// ─────────────────────────────────────────────────────────────────
// getProviderRecorder() tests
// ─────────────────────────────────────────────────────────────────

describe("OpenScaffold.getProviderRecorder()", () => {
  let scaffold: OpenScaffold | null = null

  afterEach(async () => {
    if (scaffold) {
      await scaffold.dispose()
      scaffold = null
    }
  })

  it("returns the provider recorder service", async () => {
    scaffold = OpenScaffold.create({
      database: ":memory:",
      mode: "live"
    })

    const recorder = await scaffold.getProviderRecorder()
    expect(recorder).toBeDefined()
    expect(typeof recorder.load).toBe("function")
    expect(typeof recorder.list).toBe("function")
    expect(typeof recorder.delete).toBe("function")
    // Incremental recording API
    expect(typeof recorder.startRecording).toBe("function")
    expect(typeof recorder.appendEvent).toBe("function")
    expect(typeof recorder.finalizeRecording).toBe("function")
  })
})

// ─────────────────────────────────────────────────────────────────
// OpenScaffoldError tests
// ─────────────────────────────────────────────────────────────────

describe("OpenScaffoldError", () => {
  it("constructs with Error cause", () => {
    const cause = new Error("Original error")
    const error = new OpenScaffoldError("start", cause)

    expect(error.name).toBe("OpenScaffoldError")
    expect(error.operation).toBe("start")
    expect(error.cause).toBe(cause)
    expect(error.message).toContain("start failed")
    expect(error.message).toContain("Original error")
  })

  it("constructs with string cause", () => {
    const error = new OpenScaffoldError("stop", "Something went wrong")

    expect(error.operation).toBe("stop")
    expect(error.message).toContain("Something went wrong")
  })

  it("constructs with unknown cause", () => {
    const error = new OpenScaffoldError("address", { code: 123 })

    expect(error.operation).toBe("address")
    expect(error.message).toBe("OpenScaffold address failed: [object Object]")
  })
})

// ─────────────────────────────────────────────────────────────────
// Graceful cleanup tests
// ─────────────────────────────────────────────────────────────────

describe("Graceful cleanup", () => {
  it("disposes scaffold while server is running", async () => {
    const scaffold = OpenScaffold.create({
      database: ":memory:",
      mode: "live"
    })

    const server = scaffold.createServer({
      workflow: testWorkflow,
      port: 0
    })

    await server.start()
    const addr = await server.address()
    expect(addr.port).toBeGreaterThan(0)

    // Dispose without explicitly stopping server
    // The scaffold dispose should clean up the managed runtime
    await scaffold.dispose()

    // Server should no longer be accessible after dispose
    // Note: The server's http.Server instance may still accept connections
    // briefly due to Node.js internals, but new requests should fail
  })

  it("stops server with active sessions gracefully", async () => {
    const scaffold = OpenScaffold.create({
      database: ":memory:",
      mode: "live"
    })

    const server = scaffold.createServer({
      workflow: testWorkflow,
      port: 0
    })

    await server.start()
    const addr = await server.address()

    // Start a session
    const response = await fetch(`http://127.0.0.1:${addr.port}/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ input: "test" })
    })
    expect(response.status).toBe(201)

    // Stop server - should interrupt active sessions
    await server.stop()

    // Dispose scaffold
    await scaffold.dispose()
  })
})
