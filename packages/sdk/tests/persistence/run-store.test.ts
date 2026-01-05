import { Database } from "bun:sqlite";
import { describe, expect, test } from "bun:test";
import type { RuntimeEvent } from "../../src/core/events.js";
import { InMemoryRunStore } from "../../src/persistence/memory-run-store.js";
import { SqliteRunStore } from "../../src/persistence/sqlite-run-store.js";
import type { RunSnapshot } from "../../src/runtime/snapshot.js";

const sampleEvent = (flowName: string): RuntimeEvent => ({
  type: "flow:start",
  flowName,
  timestamp: 1,
});

const sampleSnapshot = (runId: string): RunSnapshot => ({
  runId,
  status: "paused",
  outputs: { a: { value: 1 } },
  state: { counter: 1 },
  nodeStatus: { a: "done" },
  edgeStatus: {},
  loopCounters: {},
  inbox: [],
  agentSessions: {},
});

function runStoreContract(
  name: string,
  createStore: () => {
    store: {
      appendEvent: (id: string, e: RuntimeEvent) => void;
      saveSnapshot: (id: string, s: RunSnapshot) => void;
      loadSnapshot: (id: string) => RunSnapshot | null;
      loadEvents: (id: string, after?: number) => RuntimeEvent[];
    };
    cleanup?: () => void;
  },
) {
  describe(name, () => {
    test("append/load events with sequence", () => {
      const { store, cleanup } = createStore();
      store.appendEvent("run-1", sampleEvent("one"));
      store.appendEvent("run-1", sampleEvent("two"));

      const all = store.loadEvents("run-1");
      expect(all).toHaveLength(2);
      expect(all[0]).toEqual({
        type: "flow:start",
        flowName: "one",
        timestamp: 1,
      });
      expect(all[1]).toEqual({
        type: "flow:start",
        flowName: "two",
        timestamp: 1,
      });

      const afterFirst = store.loadEvents("run-1", 1);
      expect(afterFirst).toHaveLength(1);
      expect(afterFirst[0]).toEqual({
        type: "flow:start",
        flowName: "two",
        timestamp: 1,
      });
      cleanup?.();
    });

    test("save/load snapshots", () => {
      const { store, cleanup } = createStore();
      store.saveSnapshot("run-1", sampleSnapshot("run-1"));
      const loaded = store.loadSnapshot("run-1");
      expect(loaded).toEqual(sampleSnapshot("run-1"));
      cleanup?.();
    });
  });
}

runStoreContract("InMemoryRunStore", () => ({
  store: new InMemoryRunStore(),
}));

runStoreContract("SqliteRunStore", () => {
  const db = new Database(":memory:");
  const store = new SqliteRunStore({ db });
  return { store, cleanup: () => db.close() };
});
