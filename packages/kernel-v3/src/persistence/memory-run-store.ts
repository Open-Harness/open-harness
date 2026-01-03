import type { RuntimeEvent } from "../core/events.js";
import type { RunSnapshot } from "../runtime/snapshot.js";
import type { RunStore } from "./run-store.js";

type StoredEvent = {
	seq: number;
	event: RuntimeEvent;
};

type StoredSnapshot = {
	seq: number;
	snapshot: RunSnapshot;
};

/**
 * In-memory RunStore for tests or ephemeral runs.
 */
export class InMemoryRunStore implements RunStore {
	private readonly events = new Map<string, StoredEvent[]>();
	private readonly snapshots = new Map<string, StoredSnapshot[]>();
	private readonly seqByRun = new Map<string, number>();

	appendEvent(runId: string, event: RuntimeEvent): void {
		const seq = (this.seqByRun.get(runId) ?? 0) + 1;
		this.seqByRun.set(runId, seq);
		const list = this.events.get(runId) ?? [];
		list.push({ seq, event: clone(event) });
		this.events.set(runId, list);
	}

	saveSnapshot(runId: string, snapshot: RunSnapshot): void {
		const seq = this.seqByRun.get(runId) ?? 0;
		const list = this.snapshots.get(runId) ?? [];
		list.push({ seq, snapshot: clone(snapshot) });
		this.snapshots.set(runId, list);
	}

	loadSnapshot(runId: string): RunSnapshot | null {
		const list = this.snapshots.get(runId);
		if (!list || list.length === 0) return null;
		const latest = list[list.length - 1];
		if (!latest) return null;
		return clone(latest.snapshot);
	}

	loadEvents(runId: string, afterSeq: number = 0): RuntimeEvent[] {
		const list = this.events.get(runId) ?? [];
		return list.filter((entry) => entry.seq > afterSeq).map((entry) => clone(entry.event));
	}
}

function clone<T>(value: T): T {
	if (typeof structuredClone === "function") {
		return structuredClone(value);
	}
	return JSON.parse(JSON.stringify(value)) as T;
}
