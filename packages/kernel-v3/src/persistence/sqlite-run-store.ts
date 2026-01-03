import type { Database } from "bun:sqlite";
import type { RuntimeEvent } from "../core/events.js";
import type { RunSnapshot } from "../runtime/snapshot.js";
import type { RunStore } from "./run-store.js";

export interface SqliteRunStoreOptions {
  filename?: string;
  db?: Database;
}

export declare class SqliteRunStore implements RunStore {
  constructor(options?: SqliteRunStoreOptions);
  appendEvent(runId: string, event: RuntimeEvent): void;
  saveSnapshot(runId: string, snapshot: RunSnapshot): void;
  loadSnapshot(runId: string): RunSnapshot | null;
  loadEvents(runId: string, afterSeq?: number): RuntimeEvent[];
}
