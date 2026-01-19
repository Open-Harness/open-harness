/**
 * SqliteSignalStore unit tests
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { unlinkSync } from "node:fs";
import { createSignal } from "@open-harness/core";
import { SqliteSignalStore } from "../src/sqlite-store.js";

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Generate a unique temp database path for each test
 */
function tempDbPath(): string {
	return `/tmp/test-sqlite-signals-${Date.now()}-${Math.random().toString(36).slice(2)}.db`;
}

// ============================================================================
// Tests
// ============================================================================

describe("SqliteSignalStore", () => {
	let store: SqliteSignalStore;
	let dbPath: string;

	beforeEach(() => {
		dbPath = tempDbPath();
		store = new SqliteSignalStore(dbPath);
	});

	afterEach(() => {
		store.close();
		// Clean up temp database file
		try {
			unlinkSync(dbPath);
			unlinkSync(`${dbPath}-wal`); // WAL mode journal
			unlinkSync(`${dbPath}-shm`); // Shared memory file
		} catch {
			// Files may not exist, ignore
		}
	});

	// ========================================================================
	// Constructor / Schema
	// ========================================================================

	describe("constructor", () => {
		test("creates database and tables", () => {
			// If we can create a recording, the tables exist
			const idPromise = store.create({ name: "test" });
			expect(idPromise).resolves.toMatch(/^rec_/);
		});
	});

	// ========================================================================
	// create()
	// ========================================================================

	describe("create()", () => {
		test("generates unique recording IDs with 'rec_' prefix", async () => {
			const id1 = await store.create();
			const id2 = await store.create();

			expect(id1).toMatch(/^rec_[a-f0-9]{8}$/);
			expect(id2).toMatch(/^rec_[a-f0-9]{8}$/);
			expect(id1).not.toBe(id2);
		});

		test("stores recording with name and tags", async () => {
			const id = await store.create({
				name: "Test Recording",
				tags: ["integration", "prd"],
				harnessType: "claude",
			});

			const recording = await store.load(id);
			expect(recording).not.toBeNull();
			if (!recording) throw new Error("Recording not found");

			expect(recording.metadata.name).toBe("Test Recording");
			expect(recording.metadata.tags).toEqual(["integration", "prd"]);
			expect(recording.metadata.harnessType).toBe("claude");
		});

		test("creates recording with no options", async () => {
			const id = await store.create();

			const recording = await store.load(id);
			expect(recording).not.toBeNull();
			if (!recording) throw new Error("Recording not found");

			expect(recording.metadata.signalCount).toBe(0);
			expect(recording.signals).toEqual([]);
		});
	});

	// ========================================================================
	// append() / appendBatch()
	// ========================================================================

	describe("append()", () => {
		test("stores signals correctly", async () => {
			const id = await store.create();

			const signal1 = createSignal("task:ready", { taskId: "t1" });
			const signal2 = createSignal("task:complete", { taskId: "t1", outcome: "success" });

			await store.append(id, signal1);
			await store.append(id, signal2);

			const recording = await store.load(id);
			expect(recording).not.toBeNull();
			if (!recording) throw new Error("Recording not found");

			expect(recording.signals.length).toBe(2);
			expect(recording.metadata.signalCount).toBe(2);

			expect(recording.signals[0].id).toBe(signal1.id);
			expect(recording.signals[0].name).toBe("task:ready");
			expect(recording.signals[0].payload).toEqual({ taskId: "t1" });

			expect(recording.signals[1].id).toBe(signal2.id);
			expect(recording.signals[1].name).toBe("task:complete");
			expect(recording.signals[1].payload).toEqual({ taskId: "t1", outcome: "success" });
		});

		test("throws error for nonexistent recording", async () => {
			const signal = createSignal("test:signal", {});
			await expect(store.append("nonexistent_id", signal)).rejects.toThrow("Recording not found");
		});

		test("throws error when recording is finalized", async () => {
			const id = await store.create();
			await store.finalize(id);

			const signal = createSignal("test:signal", {});
			await expect(store.append(id, signal)).rejects.toThrow("Recording is finalized");
		});

		test("preserves signal source", async () => {
			const id = await store.create();

			const signal = createSignal("harness:response", { content: "Hello" }, { harness: "claude" });
			await store.append(id, signal);

			const recording = await store.load(id);
			expect(recording).not.toBeNull();
			if (!recording) throw new Error("Recording not found");

			expect(recording.signals[0].source).toEqual({ harness: "claude" });
		});
	});

	describe("appendBatch()", () => {
		test("stores multiple signals atomically", async () => {
			const id = await store.create();

			const signals = [
				createSignal("event:1", { index: 1 }),
				createSignal("event:2", { index: 2 }),
				createSignal("event:3", { index: 3 }),
			];

			await store.appendBatch(id, signals);

			const recording = await store.load(id);
			expect(recording).not.toBeNull();
			if (!recording) throw new Error("Recording not found");

			expect(recording.signals.length).toBe(3);
			expect(recording.metadata.signalCount).toBe(3);

			// Verify order preserved
			expect(recording.signals[0].payload).toEqual({ index: 1 });
			expect(recording.signals[1].payload).toEqual({ index: 2 });
			expect(recording.signals[2].payload).toEqual({ index: 3 });
		});

		test("throws error for nonexistent recording", async () => {
			const signals = [createSignal("test:signal", {})];
			await expect(store.appendBatch("nonexistent_id", signals)).rejects.toThrow("Recording not found");
		});

		test("throws error when recording is finalized", async () => {
			const id = await store.create();
			await store.finalize(id);

			const signals = [createSignal("test:signal", {})];
			await expect(store.appendBatch(id, signals)).rejects.toThrow("Recording is finalized");
		});
	});

	// ========================================================================
	// checkpoint() / getCheckpoints()
	// ========================================================================

	describe("checkpoint()", () => {
		test("creates checkpoints", async () => {
			const id = await store.create();

			await store.append(id, createSignal("event:1", {}));
			await store.checkpoint(id, "first-checkpoint");

			await store.append(id, createSignal("event:2", {}));
			await store.append(id, createSignal("event:3", {}));
			await store.checkpoint(id, "second-checkpoint");

			const checkpoints = await store.getCheckpoints(id);

			expect(checkpoints.length).toBe(2);
			expect(checkpoints[0].name).toBe("first-checkpoint");
			expect(checkpoints[0].index).toBe(0);
			expect(checkpoints[1].name).toBe("second-checkpoint");
			expect(checkpoints[1].index).toBe(2);
		});

		test("throws error for nonexistent recording", async () => {
			await expect(store.checkpoint("nonexistent_id", "test")).rejects.toThrow("Recording not found");
		});
	});

	describe("getCheckpoints()", () => {
		test("returns checkpoints in order", async () => {
			const id = await store.create();

			for (let i = 0; i < 5; i++) {
				await store.append(id, createSignal(`event:${i}`, { i }));
				await store.checkpoint(id, `checkpoint-${i}`);
			}

			const checkpoints = await store.getCheckpoints(id);

			expect(checkpoints.length).toBe(5);
			for (let i = 0; i < 5; i++) {
				expect(checkpoints[i].name).toBe(`checkpoint-${i}`);
				expect(checkpoints[i].index).toBe(i);
			}
		});

		test("throws error for nonexistent recording", async () => {
			await expect(store.getCheckpoints("nonexistent_id")).rejects.toThrow("Recording not found");
		});
	});

	// ========================================================================
	// finalize()
	// ========================================================================

	describe("finalize()", () => {
		test("updates metadata with duration", async () => {
			const id = await store.create();
			await store.append(id, createSignal("event:1", {}));
			await store.finalize(id, 1234);

			const recording = await store.load(id);
			expect(recording).not.toBeNull();
			if (!recording) throw new Error("Recording not found");

			expect(recording.metadata.durationMs).toBe(1234);
		});

		test("throws error for nonexistent recording", async () => {
			await expect(store.finalize("nonexistent_id")).rejects.toThrow("Recording not found");
		});
	});

	// ========================================================================
	// load()
	// ========================================================================

	describe("load()", () => {
		test("returns complete Recording with all signals", async () => {
			const id = await store.create({ name: "Full Recording", tags: ["test"] });

			const signals = [
				createSignal("start", { phase: "init" }),
				createSignal("process", { phase: "running" }),
				createSignal("end", { phase: "complete" }),
			];

			await store.appendBatch(id, signals);
			await store.finalize(id, 5000);

			const recording = await store.load(id);

			expect(recording).not.toBeNull();
			if (!recording) throw new Error("Recording not found");

			// Metadata
			expect(recording.metadata.id).toBe(id);
			expect(recording.metadata.name).toBe("Full Recording");
			expect(recording.metadata.tags).toEqual(["test"]);
			expect(recording.metadata.signalCount).toBe(3);
			expect(recording.metadata.durationMs).toBe(5000);

			// Signals
			expect(recording.signals.length).toBe(3);
			expect(recording.signals[0].name).toBe("start");
			expect(recording.signals[1].name).toBe("process");
			expect(recording.signals[2].name).toBe("end");
		});

		test("returns null for nonexistent recording", async () => {
			const recording = await store.load("nonexistent_id");
			expect(recording).toBeNull();
		});
	});

	// ========================================================================
	// loadSignals()
	// ========================================================================

	describe("loadSignals()", () => {
		test("respects fromIndex filter", async () => {
			const id = await store.create();

			for (let i = 0; i < 5; i++) {
				await store.append(id, createSignal(`event:${i}`, { index: i }));
			}

			const signals = await store.loadSignals(id, { fromIndex: 2 });

			expect(signals.length).toBe(3);
			expect(signals[0].payload).toEqual({ index: 2 });
			expect(signals[1].payload).toEqual({ index: 3 });
			expect(signals[2].payload).toEqual({ index: 4 });
		});

		test("respects toIndex filter", async () => {
			const id = await store.create();

			for (let i = 0; i < 5; i++) {
				await store.append(id, createSignal(`event:${i}`, { index: i }));
			}

			const signals = await store.loadSignals(id, { toIndex: 3 });

			expect(signals.length).toBe(3);
			expect(signals[0].payload).toEqual({ index: 0 });
			expect(signals[1].payload).toEqual({ index: 1 });
			expect(signals[2].payload).toEqual({ index: 2 });
		});

		test("respects fromIndex and toIndex together", async () => {
			const id = await store.create();

			for (let i = 0; i < 10; i++) {
				await store.append(id, createSignal(`event:${i}`, { index: i }));
			}

			const signals = await store.loadSignals(id, { fromIndex: 3, toIndex: 7 });

			expect(signals.length).toBe(4);
			expect(signals[0].payload).toEqual({ index: 3 });
			expect(signals[3].payload).toEqual({ index: 6 });
		});

		test("respects pattern filter", async () => {
			const id = await store.create();

			await store.append(id, createSignal("task:ready", {}));
			await store.append(id, createSignal("task:complete", {}));
			await store.append(id, createSignal("milestone:testable", {}));
			await store.append(id, createSignal("task:approved", {}));

			const signals = await store.loadSignals(id, { patterns: ["task:*"] });

			expect(signals.length).toBe(3);
			expect(signals[0].name).toBe("task:ready");
			expect(signals[1].name).toBe("task:complete");
			expect(signals[2].name).toBe("task:approved");
		});

		test("throws error for nonexistent recording", async () => {
			await expect(store.loadSignals("nonexistent_id")).rejects.toThrow("Recording not found");
		});
	});

	// ========================================================================
	// list()
	// ========================================================================

	describe("list()", () => {
		test("filters by harnessType", async () => {
			await store.create({ name: "Claude 1", harnessType: "claude" });
			await store.create({ name: "OpenAI 1", harnessType: "openai" });
			await store.create({ name: "Claude 2", harnessType: "claude" });

			const claudeRecordings = await store.list({ harnessType: "claude" });
			const openaiRecordings = await store.list({ harnessType: "openai" });

			expect(claudeRecordings.length).toBe(2);
			expect(openaiRecordings.length).toBe(1);
		});

		test("filters by tags", async () => {
			await store.create({ tags: ["integration", "prd"] });
			await store.create({ tags: ["unit"] });
			await store.create({ tags: ["integration", "api"] });

			const integrationRecordings = await store.list({ tags: ["integration"] });
			const unitRecordings = await store.list({ tags: ["unit"] });

			expect(integrationRecordings.length).toBe(2);
			expect(unitRecordings.length).toBe(1);
		});

		test("respects limit", async () => {
			for (let i = 0; i < 10; i++) {
				await store.create({ name: `Recording ${i}` });
			}

			const limited = await store.list({ limit: 5 });
			expect(limited.length).toBe(5);
		});

		test("respects offset", async () => {
			for (let i = 0; i < 10; i++) {
				await store.create({ name: `Recording ${i}` });
			}

			const all = await store.list();
			const offset = await store.list({ offset: 3 });

			expect(all.length).toBe(10);
			expect(offset.length).toBe(7);
		});

		test("returns newest first", async () => {
			const id1 = await store.create({ name: "First" });
			await new Promise((resolve) => setTimeout(resolve, 10)); // Small delay
			const id2 = await store.create({ name: "Second" });
			await new Promise((resolve) => setTimeout(resolve, 10)); // Small delay
			const id3 = await store.create({ name: "Third" });

			const recordings = await store.list();

			expect(recordings.length).toBe(3);
			expect(recordings[0].id).toBe(id3);
			expect(recordings[1].id).toBe(id2);
			expect(recordings[2].id).toBe(id1);
		});
	});

	// ========================================================================
	// delete()
	// ========================================================================

	describe("delete()", () => {
		test("removes recording and all associated data", async () => {
			const id = await store.create({ name: "To Delete" });

			await store.append(id, createSignal("event:1", {}));
			await store.checkpoint(id, "checkpoint-1");

			// Verify exists
			expect(await store.exists(id)).toBe(true);

			// Delete
			await store.delete(id);

			// Verify gone
			expect(await store.exists(id)).toBe(false);
			expect(await store.load(id)).toBeNull();
		});

		test("does not throw for nonexistent recording", async () => {
			// Should not throw
			await store.delete("nonexistent_id");
		});
	});

	// ========================================================================
	// exists()
	// ========================================================================

	describe("exists()", () => {
		test("returns correct boolean", async () => {
			const id = await store.create();

			expect(await store.exists(id)).toBe(true);
			expect(await store.exists("nonexistent_id")).toBe(false);

			await store.delete(id);
			expect(await store.exists(id)).toBe(false);
		});
	});

	// ========================================================================
	// Persistence
	// ========================================================================

	describe("persistence", () => {
		test("data persists across store instances", async () => {
			// Create recording in first store instance
			const id = await store.create({ name: "Persistent Recording" });
			await store.append(id, createSignal("test:signal", { value: 42 }));
			await store.finalize(id, 100);

			// Close first store
			store.close();

			// Open new store instance with same database
			const store2 = new SqliteSignalStore(dbPath);

			try {
				// Verify data persisted
				const recording = await store2.load(id);
				expect(recording).not.toBeNull();
				if (!recording) throw new Error("Recording not found");

				expect(recording.metadata.name).toBe("Persistent Recording");
				expect(recording.metadata.durationMs).toBe(100);
				expect(recording.signals.length).toBe(1);
				expect(recording.signals[0].payload).toEqual({ value: 42 });
			} finally {
				store2.close();
			}

			// Re-open for cleanup in afterEach
			store = new SqliteSignalStore(dbPath);
		});
	});
});
