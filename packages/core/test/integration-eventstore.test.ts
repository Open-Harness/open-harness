/**
 * Integration test: EventStore persistence.
 *
 * Runs a real workflow and verifies events are persisted to
 * a LibSQL-backed EventStore (using a temp file for real SQLite).
 * After execution, opens a NEW connection to the same DB to verify
 * events survived independently (true persistence, not just in-memory).
 * Uses ProviderRecorder playback with pre-seeded fixtures.
 */

import { mkdirSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import * as path from "node:path"

import { Effect } from "effect"
import { afterEach, describe, expect, it } from "vitest"
import { z } from "zod"

import type { SessionId } from "../src/Domain/Ids.js"
import { EventStoreLive } from "../src/Layers/LibSQL.js"
import { agent } from "../src/Engine/agent.js"
import type { RuntimeConfig } from "../src/Engine/execute.js"
import { run } from "../src/Engine/run.js"
import { EVENTS } from "../src/Engine/types.js"
import { workflow } from "../src/Engine/workflow.js"
import { EventStore } from "../src/Services/EventStore.js"
import { seedRecorder, type SimpleFixture } from "./helpers/test-provider.js"

// ─────────────────────────────────────────────────────────────────
// Test fixtures
// ─────────────────────────────────────────────────────────────────

interface PersistState {
  goal: string
  result: string
}

const resultSchema = z.object({ result: z.string() })
const providerOptions = { model: "claude-sonnet-4-5" }

const testAgent = agent<PersistState, { result: string }>({
  name: "persist-agent",
  model: "claude-sonnet-4-5",
  output: resultSchema,
  prompt: (state: PersistState) => `Goal: ${state.goal}`,
  update: (output: { result: string }, draft: PersistState) => {
    draft.result = output.result
  }
})

const testWorkflow = workflow<PersistState, string>({
  name: "persist-test",
  initialState: { goal: "", result: "" },
  start: (input: string, draft: PersistState) => {
    draft.goal = input
  },
  agent: testAgent,
  until: () => true
})

// ─────────────────────────────────────────────────────────────────
// Fixture recordings
// ─────────────────────────────────────────────────────────────────

const fixtures: ReadonlyArray<SimpleFixture> = [
  {
    prompt: "Goal: Persist this",
    output: { result: "persisted-value" },
    outputSchema: resultSchema,
    providerOptions
  },
  {
    prompt: "Goal: Position test",
    output: { result: "persisted-value" },
    outputSchema: resultSchema,
    providerOptions
  }
]

// Dummy provider for playback mode (should never be called)
const playbackDummy = {
  name: "playback-dummy",
  stream: () => {
    throw new Error("playbackDummyProvider called - recording not found")
  }
}

const makeDbPath = () => {
  const dir = path.join(tmpdir(), "open-scaffold-tests")
  mkdirSync(dir, { recursive: true })
  const filePath = path.join(dir, `eventstore-integration-${crypto.randomUUID()}.db`)
  return { filePath, url: `file:${filePath}` }
}

// ─────────────────────────────────────────────────────────────────
// Test
// ─────────────────────────────────────────────────────────────────

describe("EventStore persistence integration", () => {
  const dbPaths: Array<string> = []

  afterEach(() => {
    for (const filePath of dbPaths) {
      rmSync(filePath, { force: true })
    }
    dbPaths.length = 0
  })

  it("persists events to LibSQL-backed EventStore during workflow execution", async () => {
    const { filePath, url } = makeDbPath()
    dbPaths.push(filePath)

    // Run workflow with file-backed database, using playback mode
    const runtime: RuntimeConfig = {
      providers: { "claude-sonnet-4-5": playbackDummy },
      mode: "playback",
      recorder: seedRecorder(fixtures),
      database: url
    }

    const result = await run(testWorkflow, {
      input: "Persist this",
      runtime
    })

    // Verify workflow completed
    expect(result.completed).toBe(true)
    expect(result.state.result).toBe("persisted-value")
    expect(result.events.length).toBeGreaterThan(0)

    // Open a NEW connection to the same DB file to verify true persistence
    const verifyLayer = EventStoreLive({ url })

    const persistedEvents = await Effect.runPromise(
      Effect.gen(function*() {
        const store = yield* EventStore
        return yield* store.getEvents(result.sessionId as SessionId)
      }).pipe(Effect.provide(verifyLayer)) as Effect.Effect<Array<unknown>>
    )

    // Events should be persisted (readable from a new connection)
    expect(persistedEvents.length).toBeGreaterThan(0)

    // Verify key lifecycle events that are persisted by the runtime's emitEvent helper.
    // Note: agent:started and agent:completed are emitted by runAgentDef and collected
    // in-memory, but only events emitted via the runtime's emitEvent are persisted to EventStore.
    const eventNames = (persistedEvents as Array<{ name: string }>).map((e) => e.name)
    expect(eventNames).toContain(EVENTS.STATE_UPDATED)
    expect(eventNames).toContain(EVENTS.WORKFLOW_STARTED)
    expect(eventNames).toContain(EVENTS.WORKFLOW_COMPLETED)

    // Verify ordering: started before completed
    const startedIdx = eventNames.indexOf(EVENTS.WORKFLOW_STARTED)
    const completedIdx = eventNames.indexOf(EVENTS.WORKFLOW_COMPLETED)
    expect(startedIdx).toBeLessThan(completedIdx)

    // Verify session appears in listSessions
    const sessions = await Effect.runPromise(
      Effect.gen(function*() {
        const store = yield* EventStore
        return yield* store.listSessions()
      }).pipe(Effect.provide(verifyLayer)) as Effect.Effect<Array<unknown>>
    )
    expect(sessions).toContain(result.sessionId)
  })

  it("events are retrievable from a specific position via persisted store", async () => {
    const { filePath, url } = makeDbPath()
    dbPaths.push(filePath)

    const runtime: RuntimeConfig = {
      providers: { "claude-sonnet-4-5": playbackDummy },
      mode: "playback",
      recorder: seedRecorder(fixtures),
      database: url
    }

    const result = await run(testWorkflow, {
      input: "Position test",
      runtime
    })

    // Open a new connection to verify getEventsFrom works on persisted data
    const verifyLayer = EventStoreLive({ url })

    const { allEvents, fromPos2 } = await Effect.runPromise(
      Effect.gen(function*() {
        const store = yield* EventStore
        const all = yield* store.getEvents(result.sessionId as SessionId)
        const from2 = yield* store.getEventsFrom(result.sessionId as SessionId, 2)
        return { allEvents: all, fromPos2: from2 }
      }).pipe(Effect.provide(verifyLayer)) as Effect.Effect<{ allEvents: Array<unknown>; fromPos2: Array<unknown> }>
    )

    // fromPos2 should be a subset of allEvents
    expect(fromPos2.length).toBeLessThan(allEvents.length)
    expect(fromPos2.length).toBe(allEvents.length - 2)
  })
})
