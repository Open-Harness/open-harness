import { describe, expect, test } from "bun:test";
import { createSignal } from "@internal/signals-core";
import { applySignal, createEmptySnapshot, snapshot, snapshotAll } from "../src/snapshot.js";

describe("snapshot", () => {
	describe("createEmptySnapshot", () => {
		test("creates snapshot with initial state", () => {
			const snap = createEmptySnapshot();

			expect(snap.atIndex).toBe(-1);
			expect(snap.provider.running).toBe(false);
			expect(snap.provider.text.content).toBe("");
			expect(snap.provider.text.deltaCount).toBe(0);
			expect(snap.provider.toolCalls.size).toBe(0);
			expect(snap.custom.size).toBe(0);
			expect(snap.signalCounts.size).toBe(0);
		});
	});

	describe("applySignal", () => {
		test("handles provider:start", () => {
			const snap = createEmptySnapshot();
			const signal = createSignal("provider:start", { input: {} });
			const result = applySignal(snap, signal, 0);

			expect(result.provider.running).toBe(true);
			expect(result.atIndex).toBe(0);
			expect(result.signalCounts.get("provider:start")).toBe(1);
		});

		test("handles provider:end", () => {
			let snap = createEmptySnapshot();
			snap = applySignal(snap, createSignal("provider:start", {}), 0);
			snap = applySignal(snap, createSignal("provider:end", {}), 1);

			expect(snap.provider.running).toBe(false);
		});

		test("handles text:delta accumulation", () => {
			let snap = createEmptySnapshot();
			snap = applySignal(snap, createSignal("text:delta", { content: "Hello" }), 0);
			snap = applySignal(snap, createSignal("text:delta", { content: " world" }), 1);
			snap = applySignal(snap, createSignal("text:delta", { content: "!" }), 2);

			expect(snap.provider.text.content).toBe("Hello world!");
			expect(snap.provider.text.deltaCount).toBe(3);
		});

		test("handles text:complete override", () => {
			let snap = createEmptySnapshot();
			snap = applySignal(snap, createSignal("text:delta", { content: "partial" }), 0);
			snap = applySignal(snap, createSignal("text:complete", { content: "full text" }), 1);

			expect(snap.provider.text.content).toBe("full text");
		});

		test("handles thinking:delta accumulation", () => {
			let snap = createEmptySnapshot();
			snap = applySignal(snap, createSignal("thinking:delta", { content: "Let me think" }), 0);
			snap = applySignal(snap, createSignal("thinking:delta", { content: "..." }), 1);

			expect(snap.provider.thinking.content).toBe("Let me think...");
			expect(snap.provider.thinking.deltaCount).toBe(2);
		});

		test("handles tool:call", () => {
			let snap = createEmptySnapshot();
			snap = applySignal(
				snap,
				createSignal("tool:call", {
					id: "call_1",
					name: "get_weather",
					input: { city: "NYC" },
				}),
				0,
			);

			const tool = snap.provider.toolCalls.get("call_1");
			expect(tool?.name).toBe("get_weather");
			expect(tool?.status).toBe("pending");
		});

		test("handles tool:result", () => {
			let snap = createEmptySnapshot();
			snap = applySignal(
				snap,
				createSignal("tool:call", {
					id: "call_1",
					name: "get_weather",
					input: {},
				}),
				0,
			);
			snap = applySignal(
				snap,
				createSignal("tool:result", {
					id: "call_1",
					name: "get_weather",
					result: { temp: 72 },
				}),
				1,
			);

			const tool = snap.provider.toolCalls.get("call_1");
			expect(tool?.status).toBe("complete");
			expect(tool?.result).toEqual({ temp: 72 });
		});

		test("handles tool:result with error", () => {
			let snap = createEmptySnapshot();
			snap = applySignal(snap, createSignal("tool:call", { id: "call_1", name: "test", input: {} }), 0);
			snap = applySignal(
				snap,
				createSignal("tool:result", {
					id: "call_1",
					name: "test",
					result: null,
					error: "Failed",
				}),
				1,
			);

			const tool = snap.provider.toolCalls.get("call_1");
			expect(tool?.status).toBe("error");
			expect(tool?.error).toBe("Failed");
		});

		test("handles provider:error", () => {
			let snap = createEmptySnapshot();
			snap = applySignal(snap, createSignal("provider:error", { code: "ERR", message: "Something broke" }), 0);

			expect(snap.provider.lastError?.code).toBe("ERR");
			expect(snap.provider.lastError?.message).toBe("Something broke");
		});

		test("stores custom signals", () => {
			let snap = createEmptySnapshot();
			snap = applySignal(snap, createSignal("analysis:complete", { result: "bullish" }), 0);
			snap = applySignal(snap, createSignal("trade:proposed", { amount: 100 }), 1);

			expect(snap.custom.get("analysis:complete")).toEqual({ result: "bullish" });
			expect(snap.custom.get("trade:proposed")).toEqual({ amount: 100 });
		});
	});

	describe("snapshot", () => {
		test("returns empty snapshot for empty signals", () => {
			const snap = snapshot([]);
			expect(snap.atIndex).toBe(-1);
		});

		test("computes snapshot at default index (last)", () => {
			const signals = [
				createSignal("provider:start", {}),
				createSignal("text:delta", { content: "Hello" }),
				createSignal("text:delta", { content: " world" }),
				createSignal("provider:end", {}),
			];

			const snap = snapshot(signals);
			expect(snap.atIndex).toBe(3);
			expect(snap.provider.text.content).toBe("Hello world");
			expect(snap.provider.running).toBe(false);
		});

		test("computes snapshot at specific index", () => {
			const signals = [
				createSignal("provider:start", {}),
				createSignal("text:delta", { content: "Hello" }),
				createSignal("text:delta", { content: " world" }),
				createSignal("provider:end", {}),
			];

			const snap = snapshot(signals, 1);
			expect(snap.atIndex).toBe(1);
			expect(snap.provider.text.content).toBe("Hello");
			expect(snap.provider.running).toBe(true);
		});
	});

	describe("snapshotAll", () => {
		test("creates snapshot at every signal", () => {
			const signals = [
				createSignal("text:delta", { content: "a" }),
				createSignal("text:delta", { content: "b" }),
				createSignal("text:delta", { content: "c" }),
			];

			const snapshots = snapshotAll(signals);
			expect(snapshots.length).toBe(3);
			expect(snapshots[0].provider.text.content).toBe("a");
			expect(snapshots[1].provider.text.content).toBe("ab");
			expect(snapshots[2].provider.text.content).toBe("abc");
		});
	});
});
