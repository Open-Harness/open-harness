/**
 * LibSQL configuration types.
 *
 * @module
 */

/**
 * Configuration for LibSQL connection.
 */
export interface LibSQLConfig {
  /**
   * Database URL.
   * - Local file: "file:./data/events.db"
   * - Turso: "libsql://your-db.turso.io"
   */
  readonly url: string

  /**
   * Auth token for Turso cloud databases.
   */
  readonly authToken?: string

  /**
   * Whether to run migrations automatically on connect.
   * @default true
   */
  readonly autoMigrate?: boolean
}
