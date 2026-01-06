import { Database } from "bun:sqlite";
import type { RunSnapshot, RunStore } from "../../index.js";
import type { RuntimeEvent } from "../../core/events.js";

/**
 * Options for SQLite-backed run store.
 *
 * @property {string} [filename] - SQLite filename.
 * @property {Database} [db] - Pre-configured Database instance.
 */
export interface SqliteRunStoreOptions {
  filename?: string;
  db?: Database;
}

/**
 * SQLite-backed RunStore implementation.
 */
export class SqliteRunStore implements RunStore {
  private readonly db: Database;
  private readonly insertEvent: ReturnType<Database["prepare"]>;
  private readonly insertSnapshot: ReturnType<Database["prepare"]>;
  private readonly selectSnapshot: ReturnType<Database["prepare"]>;
  private readonly selectEvents: ReturnType<Database["prepare"]>;
  private readonly selectMaxSeq: ReturnType<Database["prepare"]>;

  /**
   * Create a SQLite run store.
   * @param options - Store options.
   */
  constructor(options: SqliteRunStoreOptions = {}) {
    this.db = options.db ?? new Database(options.filename ?? "runs.db");
    this.db.exec(
      `CREATE TABLE IF NOT EXISTS run_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        run_id TEXT NOT NULL,
        seq INTEGER NOT NULL,
        event TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS run_events_run_id_seq ON run_events(run_id, seq);
      CREATE TABLE IF NOT EXISTS run_snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        run_id TEXT NOT NULL,
        seq INTEGER NOT NULL,
        snapshot TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS run_snapshots_run_id_seq ON run_snapshots(run_id, seq);`,
    );

    this.insertEvent = this.db.prepare(
      "INSERT INTO run_events (run_id, seq, event, created_at) VALUES (?, ?, ?, ?)",
    );
    this.insertSnapshot = this.db.prepare(
      "INSERT INTO run_snapshots (run_id, seq, snapshot, created_at) VALUES (?, ?, ?, ?)",
    );
    this.selectSnapshot = this.db.prepare(
      "SELECT snapshot FROM run_snapshots WHERE run_id = ? ORDER BY seq DESC, id DESC LIMIT 1",
    );
    this.selectEvents = this.db.prepare(
      "SELECT event FROM run_events WHERE run_id = ? AND seq > ? ORDER BY seq ASC",
    );
    this.selectMaxSeq = this.db.prepare(
      "SELECT MAX(seq) as seq FROM run_events WHERE run_id = ?",
    );
  }

  appendEvent(runId: string, event: RuntimeEvent): void {
    const seq = this.nextSeq(runId);
    this.insertEvent.run(runId, seq, JSON.stringify(event), Date.now());
  }

  saveSnapshot(runId: string, snapshot: RunSnapshot): void {
    const seq = this.currentSeq(runId);
    this.insertSnapshot.run(runId, seq, JSON.stringify(snapshot), Date.now());
  }

  loadSnapshot(runId: string): RunSnapshot | null {
    const row = this.selectSnapshot.get(runId) as { snapshot?: string } | null;
    if (!row?.snapshot) return null;
    return JSON.parse(row.snapshot) as RunSnapshot;
  }

  loadEvents(runId: string, afterSeq: number = 0): RuntimeEvent[] {
    const rows = this.selectEvents.all(runId, afterSeq) as Array<{
      event: string;
    }>;
    return rows.map((row) => JSON.parse(row.event) as RuntimeEvent);
  }

  private currentSeq(runId: string): number {
    const row = this.selectMaxSeq.get(runId) as { seq?: number | null } | null;
    return typeof row?.seq === "number" ? row.seq : 0;
  }

  private nextSeq(runId: string): number {
    return this.currentSeq(runId) + 1;
  }
}
