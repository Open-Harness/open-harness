/**
 * Snapshot Storage
 * Hybrid storage using SQLite for metadata and JSON files for full state
 */

import type { TradingDatabase } from '../core/database'
import type { TimeSource } from '../core/time-source'
import type { Snapshot, AgentState, MonologueEntry } from './agent-state'

export class SnapshotStorage {
  private db: TradingDatabase
  private timeSource: TimeSource
  private snapshotsDir: string

  constructor(db: TradingDatabase, timeSource: TimeSource, snapshotsDir: string = './snapshots') {
    this.db = db
    this.timeSource = timeSource
    this.snapshotsDir = snapshotsDir
  }

  async capture(
    name: string,
    state: AgentState,
    monologues: MonologueEntry[],
    metadata: { createdBy: 'manual' | 'auto' | 'error'; reason: string }
  ): Promise<Snapshot> {
    const id = this.generateId()
    const timestamp = this.timeSource.now()

    const snapshot: Snapshot = {
      id,
      name,
      timestamp,
      state,
      monologues,
      metadata,
    }

    // Save full state to JSON
    const jsonPath = `${this.snapshotsDir}/snapshot-${id}.json`
    await Bun.write(jsonPath, JSON.stringify(snapshot, null, 2))

    // Save metadata to SQLite
    this.db.run(
      `INSERT INTO snapshots (id, name, timestamp, stage, position_status, created_at, json_path, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        name,
        timestamp,
        state.strategy.currentStage,
        state.position.hasOpenPosition ? 'OPEN' : 'CLOSED',
        timestamp,
        jsonPath,
        JSON.stringify(metadata),
      ]
    )

    // Save monologues
    for (const monologue of monologues) {
      this.db.run(
        `INSERT INTO snapshot_monologues (snapshot_id, timestamp, agent_decision, explanation)
         VALUES (?, ?, ?, ?)`,
        [id, monologue.timestamp, monologue.stage, monologue.content]
      )
    }

    return snapshot
  }

  async restore(id: string): Promise<Snapshot | null> {
    const rows = this.db.query<{ json_path: string }>(
      'SELECT json_path FROM snapshots WHERE id = ?',
      [id]
    )

    if (rows.length === 0) return null

    const jsonPath = rows[0].json_path
    const file = Bun.file(jsonPath)

    if (!(await file.exists())) {
      console.error(`Snapshot file not found: ${jsonPath}`)
      return null
    }

    const content = await file.text()
    return JSON.parse(content) as Snapshot
  }

  async list(options: {
    limit?: number
    stage?: string
    after?: number
    before?: number
  } = {}): Promise<Array<{ id: string; name: string; timestamp: number; stage: string; position_status: string }>> {
    let sql = 'SELECT id, name, timestamp, stage, position_status FROM snapshots WHERE 1=1'
    const params: any[] = []

    if (options.stage) {
      sql += ' AND stage = ?'
      params.push(options.stage)
    }
    if (options.after) {
      sql += ' AND timestamp > ?'
      params.push(options.after)
    }
    if (options.before) {
      sql += ' AND timestamp < ?'
      params.push(options.before)
    }

    sql += ' ORDER BY timestamp DESC'

    if (options.limit) {
      sql += ' LIMIT ?'
      params.push(options.limit)
    }

    return this.db.query(sql, params)
  }

  async findNearestTo(timestamp: number): Promise<string | null> {
    const rows = this.db.query<{ id: string }>(
      `SELECT id FROM snapshots
       ORDER BY ABS(timestamp - ?)
       LIMIT 1`,
      [timestamp]
    )
    return rows.length > 0 ? rows[0].id : null
  }

  async delete(id: string): Promise<boolean> {
    const rows = this.db.query<{ json_path: string }>(
      'SELECT json_path FROM snapshots WHERE id = ?',
      [id]
    )

    if (rows.length === 0) return false

    // Delete file
    const jsonPath = rows[0].json_path
    try {
      await Bun.write(jsonPath, '') // Clear file
      // Note: Bun doesn't have unlink, would need node:fs for actual deletion
    } catch (e) {
      // Ignore file errors
    }

    // Delete from database
    this.db.run('DELETE FROM snapshot_monologues WHERE snapshot_id = ?', [id])
    this.db.run('DELETE FROM snapshots WHERE id = ?', [id])

    return true
  }

  private generateId(): string {
    const timestamp = this.timeSource.now().toString(36)
    const random = Math.random().toString(36).substring(2, 8)
    return `${timestamp}-${random}`
  }
}
