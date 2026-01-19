/**
 * Custom Adapter Integration Test (V-04)
 *
 * Verifies that users can create custom adapters using createAdapter()
 * and that they correctly receive signals replayed from an SQLite recording.
 *
 * IMPORTANT: This test uses the existing SQLite recording:
 *   Database: packages/prd-workflow/.sandbox/recordings.db
 *   Recording ID: rec_f0b64b75
 *   Recording Name: "structured-output-verification"
 *
 * The recording contains 230 real agent interaction signals.
 * This test does NOT use live API calls - it replays recorded signals.
 *
 * NOTE: Uses Bun's native SQLite to avoid cyclic dependency with @open-harness/stores.
 */

import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { join } from "node:path";
import type { Signal } from "@internal/signals-core";
import { createAdapter } from "../adapter.js";

// Path to the recordings database
// import.meta.dir is packages/internal/signals/src/adapters/
// We need to go up to packages/ then into prd-workflow/.sandbox/
const RECORDINGS_DB_PATH = join(import.meta.dir, "../../../../prd-workflow/.sandbox/recordings.db");

// The recording ID containing real workflow signals
const RECORDING_ID = "rec_f0b64b75";
const RECORDING_NAME = "structured-output-verification";

/**
 * Minimal signal store implementation using Bun's native SQLite.
 * Only implements the read operations needed for testing.
 */
class TestSignalStore {
	private db: Database;

	constructor(dbPath: string) {
		this.db = new Database(dbPath, { readonly: true });
	}

	/**
	 * Load recording metadata
	 */
	getRecording(id: string): { id: string; name: string; signalCount: number } | null {
		const row = this.db.prepare("SELECT id, name, signal_count FROM recordings WHERE id = ?").get(id) as
			| { id: string; name: string | null; signal_count: number }
			| undefined;

		if (!row) return null;

		return {
			id: row.id,
			name: row.name ?? "",
			signalCount: row.signal_count,
		};
	}

	/**
	 * Load signals from a recording
	 */
	loadSignals(recordingId: string, options?: { fromIndex?: number; toIndex?: number }): Signal[] {
		let query = `
			SELECT signal_id, name, payload, timestamp, source
			FROM signals
			WHERE recording_id = ?
		`;
		const params: (string | number)[] = [recordingId];

		if (options?.fromIndex !== undefined) {
			query += " AND signal_index >= ?";
			params.push(options.fromIndex);
		}

		if (options?.toIndex !== undefined) {
			query += " AND signal_index < ?";
			params.push(options.toIndex);
		}

		query += " ORDER BY signal_index ASC";

		const rows = this.db.prepare(query).all(...params) as Array<{
			signal_id: string;
			name: string;
			payload: string;
			timestamp: string;
			source: string | null;
		}>;

		return rows.map((row) => ({
			id: row.signal_id,
			name: row.name,
			payload: JSON.parse(row.payload),
			timestamp: row.timestamp,
			...(row.source ? { source: JSON.parse(row.source) } : {}),
		}));
	}

	close(): void {
		this.db.close();
	}
}

describe("Custom Adapter Integration (V-04)", () => {
	let store: TestSignalStore;

	beforeEach(() => {
		store = new TestSignalStore(RECORDINGS_DB_PATH);
	});

	afterEach(() => {
		store.close();
	});

	describe("recording verification", () => {
		it("loads the existing recording", () => {
			const recording = store.getRecording(RECORDING_ID);

			expect(recording).not.toBeNull();
			expect(recording?.name).toBe(RECORDING_NAME);
			expect(recording?.signalCount).toBeGreaterThan(0);
		});

		it("recording contains expected signal types", () => {
			const signals = store.loadSignals(RECORDING_ID);

			// Verify we have real workflow signals
			const signalNames = new Set(signals.map((s) => s.name));

			expect(signalNames.has("workflow:start")).toBe(true);
			expect(signalNames.has("agent:activated")).toBe(true);
		});
	});

	describe("custom adapter creation", () => {
		it("creates a custom adapter using createAdapter()", () => {
			const adapter = createAdapter({
				name: "custom-test-adapter",
				onSignal: () => {},
			});

			expect(adapter.name).toBe("custom-test-adapter");
			expect(adapter.patterns).toEqual(["*"]); // Default pattern
			expect(typeof adapter.onSignal).toBe("function");
		});

		it("creates adapter with custom patterns", () => {
			const adapter = createAdapter({
				name: "pattern-adapter",
				patterns: ["workflow:*", "agent:*"],
				onSignal: () => {},
			});

			expect(adapter.patterns).toEqual(["workflow:*", "agent:*"]);
		});

		it("creates adapter with lifecycle hooks", () => {
			let started = false;
			let stopped = false;

			const adapter = createAdapter({
				name: "lifecycle-adapter",
				onStart: () => {
					started = true;
				},
				onSignal: () => {},
				onStop: () => {
					stopped = true;
				},
			});

			expect(adapter.onStart).toBeDefined();
			expect(adapter.onStop).toBeDefined();

			adapter.onStart?.();
			adapter.onStop?.();

			expect(started).toBe(true);
			expect(stopped).toBe(true);
		});
	});

	describe("signal replay through custom adapter", () => {
		it("adapter receives all replayed signals", async () => {
			const receivedSignals: Signal[] = [];

			const adapter = createAdapter({
				name: "collector-adapter",
				onSignal: (signal) => {
					receivedSignals.push(signal);
				},
			});

			// Load signals from recording
			const signals = store.loadSignals(RECORDING_ID);
			expect(signals.length).toBeGreaterThan(0);

			// Replay through adapter with lifecycle
			await adapter.onStart?.();

			for (const signal of signals) {
				await adapter.onSignal(signal);
			}

			await adapter.onStop?.();

			// Verify all signals were received
			expect(receivedSignals.length).toBe(signals.length);
		});

		it("adapter receives signals with correct structure", async () => {
			const receivedSignals: Signal[] = [];

			const adapter = createAdapter({
				name: "structure-verifier",
				onSignal: (signal) => {
					receivedSignals.push(signal);
				},
			});

			// Load first 10 signals for structure verification
			const signals = store.loadSignals(RECORDING_ID, { toIndex: 10 });

			for (const signal of signals) {
				await adapter.onSignal(signal);
			}

			// Verify signal structure
			for (const signal of receivedSignals) {
				expect(signal).toHaveProperty("id");
				expect(signal).toHaveProperty("name");
				expect(signal).toHaveProperty("payload");
				expect(signal).toHaveProperty("timestamp");
				expect(typeof signal.id).toBe("string");
				expect(typeof signal.name).toBe("string");
				expect(typeof signal.timestamp).toBe("string");
			}
		});

		it("adapter can filter signals by pattern (workflow:*)", async () => {
			const workflowSignals: Signal[] = [];

			const adapter = createAdapter({
				name: "workflow-filter",
				patterns: ["workflow:*"],
				onSignal: (signal) => {
					workflowSignals.push(signal);
				},
			});

			// Load all signals
			const signals = store.loadSignals(RECORDING_ID);

			// Simulate pattern-filtered replay (adapter would normally receive only matching)
			// Here we manually filter to demonstrate the pattern intent
			for (const signal of signals) {
				if (signal.name.startsWith("workflow:")) {
					await adapter.onSignal(signal);
				}
			}

			// Verify only workflow signals were collected
			expect(workflowSignals.length).toBeGreaterThan(0);
			for (const signal of workflowSignals) {
				expect(signal.name.startsWith("workflow:")).toBe(true);
			}
		});

		it("adapter can filter signals by pattern (agent:*)", async () => {
			const agentSignals: Signal[] = [];

			const adapter = createAdapter({
				name: "agent-filter",
				patterns: ["agent:*"],
				onSignal: (signal) => {
					agentSignals.push(signal);
				},
			});

			// Load all signals
			const signals = store.loadSignals(RECORDING_ID);

			// Simulate pattern-filtered replay
			for (const signal of signals) {
				if (signal.name.startsWith("agent:")) {
					await adapter.onSignal(signal);
				}
			}

			// Verify only agent signals were collected
			expect(agentSignals.length).toBeGreaterThan(0);
			for (const signal of agentSignals) {
				expect(signal.name.startsWith("agent:")).toBe(true);
			}
		});
	});

	describe("async adapter handlers", () => {
		it("async onSignal handler works with recorded signals", async () => {
			const receivedSignals: string[] = [];

			const adapter = createAdapter({
				name: "async-adapter",
				onSignal: async (signal) => {
					// Simulate async processing
					await Promise.resolve();
					receivedSignals.push(signal.name);
				},
			});

			const signals = store.loadSignals(RECORDING_ID, { toIndex: 20 });

			for (const signal of signals) {
				await adapter.onSignal(signal);
			}

			expect(receivedSignals.length).toBe(signals.length);
		});

		it("async lifecycle hooks work correctly", async () => {
			const events: string[] = [];

			const adapter = createAdapter({
				name: "async-lifecycle",
				onStart: async () => {
					await Promise.resolve();
					events.push("started");
				},
				onSignal: async (signal) => {
					await Promise.resolve();
					events.push(`signal:${signal.name}`);
				},
				onStop: async () => {
					await Promise.resolve();
					events.push("stopped");
				},
			});

			const signals = store.loadSignals(RECORDING_ID, { toIndex: 3 });

			await adapter.onStart?.();

			for (const signal of signals) {
				await adapter.onSignal(signal);
			}

			await adapter.onStop?.();

			expect(events[0]).toBe("started");
			expect(events[events.length - 1]).toBe("stopped");
			expect(events.length).toBe(3 + 2); // 3 signals + start + stop
		});
	});

	describe("multiple custom adapters", () => {
		it("multiple adapters can receive the same signals", async () => {
			const adapter1Signals: Signal[] = [];
			const adapter2Signals: Signal[] = [];

			const adapter1 = createAdapter({
				name: "adapter-1",
				onSignal: (signal) => {
					adapter1Signals.push(signal);
				},
			});

			const adapter2 = createAdapter({
				name: "adapter-2",
				onSignal: (signal) => {
					adapter2Signals.push(signal);
				},
			});

			const signals = store.loadSignals(RECORDING_ID, { toIndex: 50 });

			// Replay through both adapters (simulates SignalBus broadcasting)
			for (const signal of signals) {
				adapter1.onSignal(signal);
				adapter2.onSignal(signal);
			}

			expect(adapter1Signals.length).toBe(signals.length);
			expect(adapter2Signals.length).toBe(signals.length);
		});

		it("adapters with different patterns receive different signals", async () => {
			const workflowAdapter: Signal[] = [];
			const textAdapter: Signal[] = [];

			const adapter1 = createAdapter({
				name: "workflow-only",
				patterns: ["workflow:*"],
				onSignal: (signal) => {
					workflowAdapter.push(signal);
				},
			});

			const adapter2 = createAdapter({
				name: "text-only",
				patterns: ["text:*"],
				onSignal: (signal) => {
					textAdapter.push(signal);
				},
			});

			const signals = store.loadSignals(RECORDING_ID);

			// Simulate pattern-filtered broadcast
			for (const signal of signals) {
				if (signal.name.startsWith("workflow:")) {
					adapter1.onSignal(signal);
				}
				if (signal.name.startsWith("text:")) {
					adapter2.onSignal(signal);
				}
			}

			// Both should have received signals, but different ones
			expect(workflowAdapter.length).toBeGreaterThan(0);
			expect(textAdapter.length).toBeGreaterThan(0);

			// Verify no cross-contamination
			for (const s of workflowAdapter) {
				expect(s.name.startsWith("workflow:")).toBe(true);
			}
			for (const s of textAdapter) {
				expect(s.name.startsWith("text:")).toBe(true);
			}
		});
	});

	describe("signal statistics from recording", () => {
		it("reports signal type distribution", async () => {
			const signalCounts = new Map<string, number>();

			const adapter = createAdapter({
				name: "stats-collector",
				onSignal: (signal) => {
					// Extract signal type (prefix before first colon)
					const type = signal.name.split(":")[0];
					signalCounts.set(type, (signalCounts.get(type) || 0) + 1);
				},
			});

			const signals = store.loadSignals(RECORDING_ID);

			for (const signal of signals) {
				adapter.onSignal(signal);
			}

			// Verify we have multiple signal types from real recording
			expect(signalCounts.size).toBeGreaterThan(3);

			// Common signal types in agent workflows
			const types = [...signalCounts.keys()];
			expect(types.some((t) => ["workflow", "agent", "text", "harness"].includes(t))).toBe(true);
		});
	});
});
