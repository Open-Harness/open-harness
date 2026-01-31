/**
 * VCR Integration Tests - Real HTTP Server Tests.
 *
 * Tests the full HTTP server using real LibSQL :memory: stores.
 * Workflow definitions use agent() + phase() + workflow() from @open-harness/core.
 *
 * @module
 */

import { Effect } from "effect"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { z } from "zod"

import { agent, phase, workflow, type WorkflowDef } from "@open-harness/core"
import {
  createServer,
  EventStoreLive,
  makeInMemoryRecorderLayer,
  type ServerService,
  StateSnapshotStoreLive
} from "../src/internal.js"

// ─────────────────────────────────────────────────────────────────
// Test Workflow Definition
// ─────────────────────────────────────────────────────────────────

interface VcrTestState {
  goal: string
  tasks: Array<string>
  done: boolean
}

type VcrPhases = "planning" | "done"

// Per ADR-010: Agents own their provider directly
const vcrTestProvider = {
  name: "vcr-test-provider",
  model: "test-model",
  stream: () => {
    throw new Error("Should not be called in playback mode")
  }
}

const vcrAgent = agent<VcrTestState, { message: string }>({
  name: "vcr-agent",
  provider: vcrTestProvider,
  output: z.object({ message: z.string() }),
  prompt: (state) => `Goal: ${state.goal}`,
  update: (output, draft) => {
    draft.tasks.push(output.message)
  }
})

const vcrWorkflow = workflow<VcrTestState, string, VcrPhases>({
  name: "vcr-test-workflow",
  initialState: { goal: "", tasks: [], done: false },
  start: (input, draft) => {
    draft.goal = input
  },
  phases: {
    planning: { run: vcrAgent, next: "done" },
    done: phase.terminal()
  }
}) as WorkflowDef<VcrTestState, string, string>

// ─────────────────────────────────────────────────────────────────
// Helper
// ─────────────────────────────────────────────────────────────────

const fetchJson = async (url: string, options?: RequestInit) => {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options
  })
  const body = await res.json()
  return { status: res.status, body }
}

// ─────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────

describe("VCR Integration Tests (Real HTTP)", () => {
  let server: ServerService
  let baseUrl: string

  beforeAll(async () => {
    server = createServer({
      port: 0, // Ephemeral port
      workflow: vcrWorkflow,
      eventStore: EventStoreLive({ url: ":memory:" }),
      snapshotStore: StateSnapshotStoreLive({ url: ":memory:" }),
      providerMode: "playback",
      providerRecorder: makeInMemoryRecorderLayer()
    })
    await Effect.runPromise(server.start())
    const addr = await Effect.runPromise(server.address())
    baseUrl = `http://${addr.host}:${addr.port}`
  })

  afterAll(async () => {
    await Effect.runPromise(server.stop())
  })

  it("lists sessions (initially empty)", async () => {
    const { body, status } = await fetchJson(`${baseUrl}/sessions`)
    expect(status).toBe(200)
    expect(body.sessions).toEqual([])
  })

  it("returns 404 when getting non-existent session", async () => {
    const sessionId = crypto.randomUUID()
    const { status } = await fetchJson(`${baseUrl}/sessions/${sessionId}`)
    expect(status).toBe(404)
  })

  it("returns 400 when creating session without input", async () => {
    const { body, status } = await fetchJson(`${baseUrl}/sessions`, {
      method: "POST",
      body: JSON.stringify({})
    })
    expect(status).toBe(400)
    expect(body.error).toContain("input")
  })

  it("returns 404 when pausing non-existent session", async () => {
    const sessionId = crypto.randomUUID()
    const { status } = await fetchJson(`${baseUrl}/sessions/${sessionId}/pause`, {
      method: "POST"
    })
    expect(status).toBe(404)
  })

  it("returns error when forking non-existent session", async () => {
    const sessionId = crypto.randomUUID()
    const { status } = await fetchJson(`${baseUrl}/sessions/${sessionId}/fork`, {
      method: "POST"
    })
    // SessionNotFound is mapped to 404 by the error handler
    expect(status).toBe(404)
  })

  it("providers status endpoint returns provider info", async () => {
    const { body, status } = await fetchJson(`${baseUrl}/providers/status`)
    expect(status).toBe(200)
    expect(body.provider).toBeDefined()
    expect(body.provider.connected).toBe(true)
  })

  it("delete session for non-existent session succeeds silently", async () => {
    const sessionId = crypto.randomUUID()
    const { body, status } = await fetchJson(`${baseUrl}/sessions/${sessionId}`, {
      method: "DELETE"
    })
    expect(status).toBe(200)
    expect(body.ok).toBe(true)
  })

  it("recordings list returns empty initially", async () => {
    const { body, status } = await fetchJson(`${baseUrl}/recordings`)
    expect(status).toBe(200)
    expect(body.recordings).toEqual([])
  })
})
