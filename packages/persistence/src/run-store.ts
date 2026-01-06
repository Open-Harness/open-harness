import type { RuntimeEvent } from "@internal/state";
import type { RunSnapshot } from "@internal/state";

/**
 * Persistence interface for runtime events and snapshots.
 */
export interface RunStore {
  /**
   * Append an event for a run.
   * @param runId - Run identifier.
   * @param event - Event to append.
   */
  appendEvent(runId: string, event: RuntimeEvent): void;
  /**
   * Save a full snapshot for a run.
   * @param runId - Run identifier.
   * @param snapshot - Snapshot to save.
   */
  saveSnapshot(runId: string, snapshot: RunSnapshot): void;
  /**
   * Load the most recent snapshot for a run.
   * @param runId - Run identifier.
   * @returns Snapshot or null if none exists.
   */
  loadSnapshot(runId: string): RunSnapshot | null;
  /**
   * Load events after a sequence number.
   * @param runId - Run identifier.
   * @param afterSeq - Optional sequence cursor.
   * @returns List of events.
   */
  loadEvents(runId: string, afterSeq?: number): RuntimeEvent[];
}
