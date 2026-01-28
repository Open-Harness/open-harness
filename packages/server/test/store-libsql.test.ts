import { mkdirSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import * as path from "node:path"

import { Effect } from "effect"
import { describe, expect, it } from "vitest"

import { type EventId, Services, type SessionId } from "@open-scaffold/core"
import { EventStoreLive, StateSnapshotStoreLive } from "../src/index.js"

const makeDb = () => {
  const dir = path.join(tmpdir(), "open-scaffold-tests")
  mkdirSync(dir, { recursive: true })
  const filePath = path.join(dir, `store-${crypto.randomUUID()}.db`)
  return { filePath, url: `file:${filePath}` }
}

describe("LibSQL stores", () => {
  it("EventStoreLive CRUD", async () => {
    const { filePath, url } = makeDb()
    const layer = EventStoreLive({ url })

    const sessionId = crypto.randomUUID() as SessionId
    const event = {
      id: crypto.randomUUID() as EventId,
      name: "user:input",
      payload: { text: "hello" },
      timestamp: new Date()
    }

    const program = Effect.gen(function*() {
      const store = yield* Services.EventStore
      yield* store.append(sessionId, event)

      const events = yield* store.getEvents(sessionId)
      const eventsFrom = yield* store.getEventsFrom(sessionId, 0)
      const sessions = yield* store.listSessions()

      yield* store.deleteSession(sessionId)
      const sessionsAfter = yield* store.listSessions()

      return { events, eventsFrom, sessions, sessionsAfter }
    }).pipe(Effect.provide(layer))

    const result = await Effect.runPromise(program)

    expect(result.events).toHaveLength(1)
    expect(result.eventsFrom).toHaveLength(1)
    expect(result.events[0].name).toBe(event.name)
    expect(result.sessions).toContain(sessionId)
    expect(result.sessionsAfter).not.toContain(sessionId)

    rmSync(filePath, { force: true })
  })

  it("StateSnapshotStoreLive CRUD", async () => {
    const { filePath, url } = makeDb()
    const layer = StateSnapshotStoreLive({ url })

    const sessionId = crypto.randomUUID() as SessionId

    const program = Effect.gen(function*() {
      const store = yield* Services.StateSnapshotStore

      const snapshot = {
        sessionId,
        position: 3,
        state: { phase: "running" },
        createdAt: new Date()
      }

      yield* store.save(snapshot)
      const latest = yield* store.getLatest(sessionId)
      yield* store.delete(sessionId)
      const afterDelete = yield* store.getLatest(sessionId)

      return { latest, afterDelete }
    }).pipe(Effect.provide(layer))

    const result = await Effect.runPromise(program)

    expect(result.latest?.sessionId).toBe(sessionId)
    expect(result.latest?.position).toBe(3)
    expect((result.latest?.state as { phase: string }).phase).toBe("running")
    expect(result.afterDelete).toBeNull()

    rmSync(filePath, { force: true })
  })
})
