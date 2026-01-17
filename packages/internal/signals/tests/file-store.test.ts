import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { readFile, rm } from "node:fs/promises";
import { createSignal } from "@internal/signals-core";
import { FileSignalStore } from "../src/file-store.js";

const TEST_DIR = ".test-recordings-unit";

describe("FileSignalStore", () => {
	let store: FileSignalStore;

	beforeEach(async () => {
		store = new FileSignalStore({ baseDir: TEST_DIR });
	});

	afterEach(async () => {
		// Clean up test directory
		try {
			await rm(TEST_DIR, { recursive: true });
		} catch {
			// Ignore if doesn't exist
		}
	});

	describe("create", () => {
		test("creates recording with generated ID", async () => {
			const id = await store.create();

			expect(id).toMatch(/^rec_/);
			expect(await store.exists(id)).toBe(true);
		});

		test("creates recording with options", async () => {
			const id = await store.create({
				name: "test recording",
				tags: ["test", "unit"],
				harnessType: "claude",
			});

			const recording = await store.load(id);
			expect(recording?.metadata.name).toBe("test recording");
			expect(recording?.metadata.tags).toEqual(["test", "unit"]);
			expect(recording?.metadata.harnessType).toBe("claude");
		});

		test("creates directory structure", async () => {
			const id = await store.create({ name: "test" });

			// Verify files exist
			const metadataContent = await readFile(`${TEST_DIR}/${id}/metadata.json`, "utf-8");
			const metadata = JSON.parse(metadataContent);
			expect(metadata.name).toBe("test");

			const signalsContent = await readFile(`${TEST_DIR}/${id}/signals.jsonl`, "utf-8");
			expect(signalsContent).toBe("");

			const checkpointsContent = await readFile(`${TEST_DIR}/${id}/checkpoints.json`, "utf-8");
			expect(JSON.parse(checkpointsContent)).toEqual([]);
		});
	});

	describe("append", () => {
		test("appends signal to recording", async () => {
			const id = await store.create();

			const signal = createSignal("test:event", { value: 1 });
			await store.append(id, signal);

			const recording = await store.load(id);
			expect(recording?.signals.length).toBe(1);
			expect(recording?.signals[0].name).toBe("test:event");
		});

		test("appends signals in JSONL format", async () => {
			const id = await store.create();

			await store.append(id, createSignal("event:1", 1));
			await store.append(id, createSignal("event:2", 2));

			const content = await readFile(`${TEST_DIR}/${id}/signals.jsonl`, "utf-8");
			const lines = content.trim().split("\n");
			expect(lines.length).toBe(2);

			// Each line is valid JSON
			const signal1 = JSON.parse(lines[0]);
			const signal2 = JSON.parse(lines[1]);
			expect(signal1.name).toBe("event:1");
			expect(signal2.name).toBe("event:2");
		});

		test("throws for non-existent recording", async () => {
			const signal = createSignal("test:event", null);

			await expect(store.append("invalid", signal)).rejects.toThrow("Recording not found");
		});

		test("throws for finalized recording", async () => {
			const id = await store.create();
			await store.finalize(id);

			const signal = createSignal("test:event", null);
			await expect(store.append(id, signal)).rejects.toThrow("Recording is finalized");
		});
	});

	describe("appendBatch", () => {
		test("appends multiple signals", async () => {
			const id = await store.create();

			const signals = [createSignal("event:1", 1), createSignal("event:2", 2), createSignal("event:3", 3)];
			await store.appendBatch(id, signals);

			const recording = await store.load(id);
			expect(recording?.signals.length).toBe(3);
			expect(recording?.metadata.signalCount).toBe(3);
		});

		test("handles empty batch", async () => {
			const id = await store.create();
			await store.appendBatch(id, []);

			const recording = await store.load(id);
			expect(recording?.signals.length).toBe(0);
		});
	});

	describe("checkpoint", () => {
		test("creates checkpoint at current position", async () => {
			const id = await store.create();

			await store.append(id, createSignal("event:1", 1));
			await store.append(id, createSignal("event:2", 2));
			await store.checkpoint(id, "midpoint");
			await store.append(id, createSignal("event:3", 3));

			const checkpoints = await store.getCheckpoints(id);
			expect(checkpoints.length).toBe(1);
			expect(checkpoints[0].name).toBe("midpoint");
			expect(checkpoints[0].index).toBe(1); // After event:2
		});

		test("persists checkpoints to file", async () => {
			const id = await store.create();

			await store.append(id, createSignal("event:1", 1));
			await store.checkpoint(id, "first");
			await store.append(id, createSignal("event:2", 2));
			await store.checkpoint(id, "second");

			const content = await readFile(`${TEST_DIR}/${id}/checkpoints.json`, "utf-8");
			const checkpoints = JSON.parse(content);
			expect(checkpoints.length).toBe(2);
			expect(checkpoints[0].name).toBe("first");
			expect(checkpoints[1].name).toBe("second");
		});
	});

	describe("load", () => {
		test("returns null for non-existent recording", async () => {
			const recording = await store.load("invalid");
			expect(recording).toBeNull();
		});

		test("returns complete recording", async () => {
			const id = await store.create({ name: "test" });

			await store.append(id, createSignal("event:1", 1));
			await store.append(id, createSignal("event:2", 2));
			await store.finalize(id, 1000);

			const recording = await store.load(id);
			expect(recording?.metadata.name).toBe("test");
			expect(recording?.metadata.signalCount).toBe(2);
			expect(recording?.metadata.durationMs).toBe(1000);
			expect(recording?.signals.length).toBe(2);
		});

		test("does not expose internal finalized flag", async () => {
			const id = await store.create();
			await store.finalize(id);

			const recording = await store.load(id);
			expect(recording?.metadata).not.toHaveProperty("finalized");
		});
	});

	describe("loadSignals", () => {
		test("loads signals with range filter", async () => {
			const id = await store.create();

			await store.appendBatch(id, [
				createSignal("event:1", 1),
				createSignal("event:2", 2),
				createSignal("event:3", 3),
				createSignal("event:4", 4),
			]);

			const signals = await store.loadSignals(id, { fromIndex: 1, toIndex: 3 });
			expect(signals.length).toBe(2);
			expect(signals[0].name).toBe("event:2");
			expect(signals[1].name).toBe("event:3");
		});

		test("loads signals with pattern filter", async () => {
			const id = await store.create();

			await store.appendBatch(id, [
				createSignal("text:delta", "a"),
				createSignal("tool:call", {}),
				createSignal("text:delta", "b"),
				createSignal("harness:end", {}),
			]);

			const signals = await store.loadSignals(id, { patterns: ["text:*"] });
			expect(signals.length).toBe(2);
			expect(signals[0].name).toBe("text:delta");
			expect(signals[1].name).toBe("text:delta");
		});

		test("throws for non-existent recording", async () => {
			await expect(store.loadSignals("invalid")).rejects.toThrow("Recording not found");
		});
	});

	describe("list", () => {
		test("lists all recordings", async () => {
			await store.create({ name: "first" });
			await store.create({ name: "second" });
			await store.create({ name: "third" });

			const list = await store.list();
			expect(list.length).toBe(3);
		});

		test("returns empty array when directory does not exist", async () => {
			const emptyStore = new FileSignalStore({ baseDir: ".nonexistent" });
			const list = await emptyStore.list();
			expect(list).toEqual([]);
		});

		test("filters by harness type", async () => {
			await store.create({ harnessType: "claude" });
			await store.create({ harnessType: "openai" });
			await store.create({ harnessType: "claude" });

			const list = await store.list({ harnessType: "claude" });
			expect(list.length).toBe(2);
		});

		test("filters by tags", async () => {
			await store.create({ tags: ["test", "unit"] });
			await store.create({ tags: ["test", "integration"] });
			await store.create({ tags: ["production"] });

			const list = await store.list({ tags: ["test"] });
			expect(list.length).toBe(2);
		});

		test("paginates results", async () => {
			for (let i = 0; i < 10; i++) {
				await store.create({ name: `recording-${i}` });
			}

			const page1 = await store.list({ limit: 3 });
			const page2 = await store.list({ limit: 3, offset: 3 });

			expect(page1.length).toBe(3);
			expect(page2.length).toBe(3);
		});

		test("sorts by creation time (newest first)", async () => {
			const id1 = await store.create({ name: "first" });
			// Small delay to ensure different timestamps
			await new Promise((r) => setTimeout(r, 10));
			const id2 = await store.create({ name: "second" });

			const list = await store.list();
			expect(list[0].id).toBe(id2); // Second created is first in list
			expect(list[1].id).toBe(id1);
		});
	});

	describe("delete", () => {
		test("removes recording", async () => {
			const id = await store.create();

			expect(await store.exists(id)).toBe(true);
			await store.delete(id);
			expect(await store.exists(id)).toBe(false);
		});

		test("does not throw for non-existent recording", async () => {
			await expect(store.delete("invalid")).resolves.toBeUndefined();
		});
	});

	describe("clear", () => {
		test("removes all recordings", async () => {
			await store.create({ name: "first" });
			await store.create({ name: "second" });

			await store.clear();

			const list = await store.list();
			expect(list.length).toBe(0);
		});
	});

	describe("persistence across instances", () => {
		test("recording persists across store instances", async () => {
			// Create and populate with first store instance
			const store1 = new FileSignalStore({ baseDir: TEST_DIR });
			const id = await store1.create({ name: "persistent" });
			await store1.append(id, createSignal("event:1", 1));
			await store1.finalize(id, 500);

			// Load with new store instance
			const store2 = new FileSignalStore({ baseDir: TEST_DIR });
			const recording = await store2.load(id);

			expect(recording?.metadata.name).toBe("persistent");
			expect(recording?.signals.length).toBe(1);
			expect(recording?.metadata.durationMs).toBe(500);
		});
	});
});
