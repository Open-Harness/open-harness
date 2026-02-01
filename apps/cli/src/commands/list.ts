/**
 * List command - list recorded sessions
 *
 * @module
 */

import { OpenScaffold, type SessionInfo } from "@open-harness/server"

export interface ListOptions {
  database: string
  limit: string
}

export async function listCommand(options: ListOptions): Promise<void> {
  try {
    const scaffold = OpenScaffold.create({
      database: `file:${options.database}`,
      mode: "playback"
    })

    const sessions: Array<SessionInfo> = await scaffold.listSessions()
    const limit = parseInt(options.limit, 10)

    if (sessions.length === 0) {
      console.log("No sessions found.")
      console.log(`\nDatabase: ${options.database}`)
      await scaffold.dispose()
      return
    }

    console.log(`Sessions in ${options.database}:\n`)
    console.log("ID                                    Workflow              Events  Created")
    console.log("─".repeat(80))

    for (const session of sessions.slice(0, limit)) {
      const id = session.id.padEnd(36)
      const name = session.workflow.slice(0, 20).padEnd(20)
      const events = String(session.eventCount).padStart(6)
      const created = session.createdAt.toISOString().slice(0, 19).replace("T", " ")

      console.log(`${id}  ${name}  ${events}  ${created}`)
    }

    if (sessions.length > limit) {
      console.log(`\n... and ${sessions.length - limit} more`)
    }

    console.log(`\nTotal: ${sessions.length} sessions`)

    await scaffold.dispose()
  } catch (err) {
    console.error("Error:", (err as Error).message)
    process.exit(1)
  }
}
