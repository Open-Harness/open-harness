import { describe, expect, test } from "bun:test";
import { createSignal } from "@internal/signals-core";
import { MemorySignalStore } from "../src/memory-store.js";

describe("MemorySignalStore", () => {
	describe("create", () => {
		test("creates recording with generated ID", async () => {
			const store = new MemorySignalStore();
			const id = await store.create();

			expect(id).toMatch(/^rec_/);
			expect(await store.exists(id)).toBe(true);
		});

		test("creates recording with options", async () => {
			const store = new MemorySignalStore();
			const id = await store.create({
				name: "test recording",
				tags: ["test", "unit"],
				providerType: "claude",
			});

			const recording = await store.load(id);
			expect(recording?.metadata.name).toBe("test recording");
			expect(recording?.metadata.tags).toEqual(["test", "unit"]);
			expect(recording?.metadata.providerType).toBe("claude");
		});
	});

	describe("append", () => {
		test("appends signal to recording", async () => {
			const store = new MemorySignalStore();
			const id = await store.create();

			const signal = createSignal("test:event", { value: 1 });
			await store.append(id, signal);

			const recording = await store.load(id);
			expect(recording?.signals.length).toBe(1);
			expect(recording?.signals[0].name).toBe("test:event");
		});

		test("throws for non-existent recording", async () => {
			const store = new MemorySignalStore();
			const signal = createSignal("test:event", null);

			await expect(store.append("invalid", signal)).rejects.toThrow("Recording not found");
		});

		test("throws for finalized recording", async () => {
			const store = new MemorySignalStore();
			const id = await store.create();
			await store.finalize(id);

			const signal = createSignal("test:event", null);
			await expect(store.append(id, signal)).rejects.toThrow("Recording is finalized");
		});
	});

	describe("appendBatch", () => {
		test("appends multiple signals", async () => {
			const store = new MemorySignalStore();
			const id = await store.create();

			const signals = [createSignal("event:1", 1), createSignal("event:2", 2), createSignal("event:3", 3)];
			await store.appendBatch(id, signals);

			const recording = await store.load(id);
			expect(recording?.signals.length).toBe(3);
			expect(recording?.metadata.signalCount).toBe(3);
		});
	});

	describe("checkpoint", () => {
		test("creates checkpoint at current position", async () => {
			const store = new MemorySignalStore();
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
	});

	describe("load", () => {
		test("returns null for non-existent recording", async () => {
			const store = new MemorySignalStore();
			const recording = await store.load("invalid");
			expect(recording).toBeNull();
		});

		test("returns complete recording", async () => {
			const store = new MemorySignalStore();
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
	});

	describe("loadSignals", () => {
		test("loads signals with range filter", async () => {
			const store = new MemorySignalStore();
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
			const store = new MemorySignalStore();
			const id = await store.create();

			await store.appendBatch(id, [
				createSignal("text:delta", "a"),
				createSignal("tool:call", {}),
				createSignal("text:delta", "b"),
				createSignal("provider:end", {}),
			]);

			const signals = await store.loadSignals(id, { patterns: ["text:*"] });
			expect(signals.length).toBe(2);
			expect(signals[0].name).toBe("text:delta");
			expect(signals[1].name).toBe("text:delta");
		});
	});

	describe("list", () => {
		test("lists all recordings", async () => {
			const store = new MemorySignalStore();
			await store.create({ name: "first" });
			await store.create({ name: "second" });
			await store.create({ name: "third" });

			const list = await store.list();
			expect(list.length).toBe(3);
		});

		test("filters by provider type", async () => {
			const store = new MemorySignalStore();
			await store.create({ providerType: "claude" });
			await store.create({ providerType: "openai" });
			await store.create({ providerType: "claude" });

			const list = await store.list({ providerType: "claude" });
			expect(list.length).toBe(2);
		});

		test("filters by tags", async () => {
			const store = new MemorySignalStore();
			await store.create({ tags: ["test", "unit"] });
			await store.create({ tags: ["test", "integration"] });
			await store.create({ tags: ["production"] });

			const list = await store.list({ tags: ["test"] });
			expect(list.length).toBe(2);
		});

		test("paginates results", async () => {
			const store = new MemorySignalStore();
			for (let i = 0; i < 10; i++) {
				await store.create({ name: `recording-${i}` });
			}

			const page1 = await store.list({ limit: 3 });
			const page2 = await store.list({ limit: 3, offset: 3 });

			expect(page1.length).toBe(3);
			expect(page2.length).toBe(3);
		});
	});

	describe("delete", () => {
		test("removes recording", async () => {
			const store = new MemorySignalStore();
			const id = await store.create();

			expect(await store.exists(id)).toBe(true);
			await store.delete(id);
			expect(await store.exists(id)).toBe(false);
		});
	});
});
