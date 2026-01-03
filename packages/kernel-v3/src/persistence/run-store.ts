import type { RuntimeEvent } from "../core/events.js";
import type { RunSnapshot } from "../runtime/snapshot.js";

export interface RunStore {
  appendEvent(runId: string, event: RuntimeEvent): void;
  saveSnapshot(runId: string, snapshot: RunSnapshot): void;
  loadSnapshot(runId: string): RunSnapshot | null;
  loadEvents(runId: string, afterSeq?: number): RuntimeEvent[];
}
