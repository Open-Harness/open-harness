/**
 * Replay command - replay a recorded session
 *
 * @module
 */

import type { WorkflowDef } from "@open-scaffold/core"
import { OpenScaffold, type SessionInfo } from "@open-scaffold/server"
import { resolve } from "path"

export interface ReplayOptions {
  session: string
  database: string
  headless?: boolean
}

export async function replayCommand(options: ReplayOptions): Promise<void> {
  try {
    // Create scaffold instance in playback mode
    const scaffold = OpenScaffold.create({
      database: `file:${resolve(options.database)}`,
      mode: "playback"
    })

    // Get session info
    const sessions: Array<SessionInfo> = await scaffold.listSessions()
    const session = sessions.find((s) => s.id === options.session)

    if (!session) {
      console.error(`Session not found: ${options.session}`)
      console.error(`\nAvailable sessions:`)
      for (const s of sessions.slice(0, 5)) {
        console.error(`  ${s.id} - ${s.workflow} (${s.createdAt.toISOString()})`)
      }
      process.exit(1)
    }

    // Create a minimal server to serve recorded events.
    // In replay mode the workflow is never executed, so we provide
    // a stub PhaseWorkflowDef that satisfies the type constraint.
    const replayStub: WorkflowDef<unknown, string, string> = {
      name: session.workflow,
      initialState: {},
      start: () => {},
      phases: {
        done: { terminal: true }
      }
    }

    const server = scaffold.createServer({
      workflow: replayStub,
      port: 0
    })

    await server.start()
    const addr = await server.address()

    if (options.headless) {
      // Headless mode: stream events as JSON lines
      await runHeadless(addr.port, options.session)
    } else {
      // TUI mode: dynamically import to avoid loading OpenTUI in headless mode
      const { runTui } = await import("./run-tui.js")
      await runTui(addr.port, options.session, { name: session.workflow }, { isReplay: true })
    }

    await server.stop()
    await scaffold.dispose()
  } catch (err) {
    console.error("Error:", (err as Error).message)
    process.exit(1)
  }
}

async function runHeadless(port: number, sessionId: string): Promise<void> {
  // For replay, use the state endpoint which returns all events at once
  // The SSE endpoint hangs for completed sessions since it waits for live events
  const url = `http://127.0.0.1:${port}/sessions/${sessionId}/state`

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to fetch session: ${response.status}`)
  }

  const data = await response.json() as { state: unknown; events: Array<unknown> }

  // Output each event as a JSON line
  for (const event of data.events) {
    console.log(JSON.stringify(event))
  }
}
