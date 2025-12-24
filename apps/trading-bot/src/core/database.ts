/**
 * SQLite Database Wrapper
 * Uses bun:sqlite for zero-dependency SQLite support
 */

import { Database } from 'bun:sqlite'

export interface DatabaseConfig {
  path: string
  readonly?: boolean
}

export class TradingDatabase {
  private db: Database

  constructor(config: DatabaseConfig = { path: ':memory:' }) {
    this.db = new Database(config.path, {
      readonly: config.readonly ?? false,
      create: true,
    })
    this.db.exec('PRAGMA journal_mode = WAL')
  }

  initialize(): void {
    this.db.exec(`
      -- Cache for market data
      CREATE TABLE IF NOT EXISTS cache (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        expires_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_cache_expires ON cache(expires_at);

      -- Trade history for audit
      CREATE TABLE IF NOT EXISTS trades (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        symbol TEXT NOT NULL,
        side TEXT NOT NULL,
        size REAL NOT NULL,
        entry_price REAL NOT NULL,
        exit_price REAL,
        profit REAL,
        status TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        closed_at INTEGER
      );
      CREATE INDEX IF NOT EXISTS idx_trades_symbol ON trades(symbol);
      CREATE INDEX IF NOT EXISTS idx_trades_created ON trades(created_at);

      -- Positions for tracking
      CREATE TABLE IF NOT EXISTS positions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        symbol TEXT NOT NULL,
        side TEXT NOT NULL,
        size REAL NOT NULL,
        avg_entry_price REAL NOT NULL,
        unrealized_pnl REAL,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_positions_symbol ON positions(symbol);

      -- DCA layers for tracking
      CREATE TABLE IF NOT EXISTS dca_layers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        position_id INTEGER NOT NULL,
        layer_number INTEGER NOT NULL,
        size REAL NOT NULL,
        entry_price REAL NOT NULL,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (position_id) REFERENCES positions(id)
      );
      CREATE INDEX IF NOT EXISTS idx_dca_position ON dca_layers(position_id);

      -- Audit log for every agent decision
      CREATE TABLE IF NOT EXISTS audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp INTEGER NOT NULL,
        stage TEXT NOT NULL,
        agent_decision TEXT,
        cli_command TEXT,
        result TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_log(timestamp);

      -- Snapshot metadata (fast queries)
      CREATE TABLE IF NOT EXISTS snapshots (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        stage TEXT NOT NULL,
        position_status TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        json_path TEXT NOT NULL,
        metadata TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_snapshot_timestamp ON snapshots(timestamp);
      CREATE INDEX IF NOT EXISTS idx_snapshot_stage ON snapshots(stage);

      -- Snapshot monologues (for conversation)
      CREATE TABLE IF NOT EXISTS snapshot_monologues (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        snapshot_id TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        agent_decision TEXT,
        explanation TEXT,
        FOREIGN KEY (snapshot_id) REFERENCES snapshots(id)
      );
    `)
  }

  query<T>(sql: string, params: any[] = []): T[] {
    return this.db.query(sql).all(...params) as T[]
  }

  run(sql: string, params: any[] = []): void {
    this.db.run(sql, ...params)
  }

  close(): void {
    this.db.close()
  }

  get raw(): Database {
    return this.db
  }
}
