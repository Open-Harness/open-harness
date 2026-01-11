import { describe, expect, test } from "bun:test";
import { createSignal } from "@internal/signals-core";
import { Player } from "../src/player.js";
import type { Recording } from "../src/store.js";

function createTestRecording(signalCount: number): Recording {
	const signals = Array.from({ length: signalCount }, (_, i) => createSignal(`event:${i}`, { index: i }));
	return {
		metadata: {
			id: "test",
			createdAt: new Date().toISOString(),
			signalCount,
		},
		signals,
	};
}

describe("Player", () => {
	describe("initial state", () => {
		test("starts at position -1 (before first signal)", () => {
			const player = new Player(createTestRecording(3));

			expect(player.position.index).toBe(-1);
			expect(player.position.atStart).toBe(true);
			expect(player.position.atEnd).toBe(false);
			expect(player.position.current).toBeUndefined();
		});

		test("reports total signals", () => {
			const player = new Player(createTestRecording(5));
			expect(player.position.total).toBe(5);
		});
	});

	describe("step", () => {
		test("advances to next signal", () => {
			const player = new Player(createTestRecording(3));

			const signal = player.step();
			expect(signal?.name).toBe("event:0");
			expect(player.position.index).toBe(0);
			expect(player.position.atStart).toBe(false);
		});

		test("returns undefined at end", () => {
			const player = new Player(createTestRecording(2));

			player.step(); // index 0
			player.step(); // index 1
			const signal = player.step(); // at end

			expect(signal).toBeUndefined();
			expect(player.position.atEnd).toBe(true);
		});

		test("updates snapshot", () => {
			const signals = [
				createSignal("text:delta", { content: "Hello" }),
				createSignal("text:delta", { content: " world" }),
			];
			const player = Player.fromSignals(signals);

			player.step();
			expect(player.snapshot.harness.text.content).toBe("Hello");

			player.step();
			expect(player.snapshot.harness.text.content).toBe("Hello world");
		});
	});

	describe("back", () => {
		test("moves to previous signal", () => {
			const player = new Player(createTestRecording(3));

			player.step(); // 0
			player.step(); // 1
			const signal = player.back();

			expect(signal?.name).toBe("event:1");
			expect(player.position.index).toBe(0);
		});

		test("returns undefined at start", () => {
			const player = new Player(createTestRecording(3));
			const signal = player.back();

			expect(signal).toBeUndefined();
			expect(player.position.atStart).toBe(true);
		});

		test("recomputes snapshot correctly", () => {
			const signals = [
				createSignal("text:delta", { content: "a" }),
				createSignal("text:delta", { content: "b" }),
				createSignal("text:delta", { content: "c" }),
			];
			const player = Player.fromSignals(signals);

			player.step(); // a
			player.step(); // ab
			player.step(); // abc
			player.back(); // back to ab

			expect(player.snapshot.harness.text.content).toBe("ab");
		});
	});

	describe("goto", () => {
		test("jumps to specific index", () => {
			const player = new Player(createTestRecording(5));

			player.goto(2);
			expect(player.position.index).toBe(2);
			expect(player.position.current?.name).toBe("event:2");
		});

		test("clamps to valid range", () => {
			const player = new Player(createTestRecording(5));

			player.goto(-10);
			expect(player.position.index).toBe(-1);

			player.goto(100);
			expect(player.position.index).toBe(4);
		});

		test("computes snapshot at target", () => {
			const signals = [
				createSignal("text:delta", { content: "a" }),
				createSignal("text:delta", { content: "b" }),
				createSignal("text:delta", { content: "c" }),
			];
			const player = Player.fromSignals(signals);

			player.goto(1);
			expect(player.snapshot.harness.text.content).toBe("ab");
		});
	});

	describe("gotoCheckpoint", () => {
		test("jumps to named checkpoint", () => {
			const signals = [createSignal("event:0", 0), createSignal("event:1", 1), createSignal("event:2", 2)];
			const checkpoints = [{ name: "midpoint", index: 1, timestamp: new Date().toISOString() }];
			const player = Player.fromSignals(signals, checkpoints);

			const found = player.gotoCheckpoint("midpoint");
			expect(found).toBe(true);
			expect(player.position.index).toBe(1);
		});

		test("returns false for unknown checkpoint", () => {
			const player = new Player(createTestRecording(3));
			const found = player.gotoCheckpoint("unknown");
			expect(found).toBe(false);
		});
	});

	describe("gotoNext", () => {
		test("finds next matching signal", () => {
			const signals = [
				createSignal("text:delta", { content: "a" }),
				createSignal("tool:call", {}),
				createSignal("text:delta", { content: "b" }),
				createSignal("tool:result", {}),
			];
			const player = Player.fromSignals(signals);

			const found = player.gotoNext("tool:*");
			expect(found?.name).toBe("tool:call");
			expect(player.position.index).toBe(1);

			const found2 = player.gotoNext("tool:*");
			expect(found2?.name).toBe("tool:result");
			expect(player.position.index).toBe(3);
		});

		test("returns undefined if no match", () => {
			const player = new Player(createTestRecording(3));
			const found = player.gotoNext("nonexistent:*");
			expect(found).toBeUndefined();
		});
	});

	describe("gotoPrevious", () => {
		test("finds previous matching signal", () => {
			const signals = [
				createSignal("tool:call", {}),
				createSignal("text:delta", { content: "a" }),
				createSignal("text:delta", { content: "b" }),
				createSignal("tool:result", {}),
			];
			const player = Player.fromSignals(signals);

			player.fastForward();
			const found = player.gotoPrevious("text:*");
			expect(found?.name).toBe("text:delta");
			expect(player.position.index).toBe(2);
		});
	});

	describe("rewind", () => {
		test("goes back to start", () => {
			const player = new Player(createTestRecording(5));

			player.step();
			player.step();
			player.step();
			player.rewind();

			expect(player.position.index).toBe(-1);
			expect(player.position.atStart).toBe(true);
		});

		test("resets snapshot", () => {
			const signals = [createSignal("text:delta", { content: "hello" })];
			const player = Player.fromSignals(signals);

			player.step();
			expect(player.snapshot.harness.text.content).toBe("hello");

			player.rewind();
			expect(player.snapshot.harness.text.content).toBe("");
		});
	});

	describe("fastForward", () => {
		test("goes to last signal", () => {
			const player = new Player(createTestRecording(5));

			player.fastForward();

			expect(player.position.index).toBe(4);
			expect(player.position.atEnd).toBe(true);
		});
	});

	describe("peek", () => {
		test("returns signal without moving", () => {
			const player = new Player(createTestRecording(3));

			const signal = player.peek(1);
			expect(signal?.name).toBe("event:1");
			expect(player.position.index).toBe(-1); // didn't move
		});

		test("returns undefined for invalid index", () => {
			const player = new Player(createTestRecording(3));
			expect(player.peek(-1)).toBeUndefined();
			expect(player.peek(10)).toBeUndefined();
		});
	});

	describe("peekRange", () => {
		test("returns signals in range", () => {
			const player = new Player(createTestRecording(5));

			const signals = player.peekRange(1, 3);
			expect(signals.length).toBe(2);
			expect(signals[0].name).toBe("event:1");
			expect(signals[1].name).toBe("event:2");
		});
	});

	describe("findAll", () => {
		test("finds all matching signals", () => {
			const signals = [
				createSignal("text:delta", { content: "a" }),
				createSignal("tool:call", {}),
				createSignal("text:delta", { content: "b" }),
				createSignal("text:complete", { content: "ab" }),
			];
			const player = Player.fromSignals(signals);

			const matches = player.findAll("text:*");
			expect(matches.length).toBe(3);
			expect(matches[0].index).toBe(0);
			expect(matches[1].index).toBe(2);
			expect(matches[2].index).toBe(3);
		});
	});

	describe("state", () => {
		test("returns full state object", () => {
			const player = new Player(createTestRecording(3));
			player.step();

			const state = player.state;
			expect(state.position.index).toBe(0);
			expect(state.snapshot).toBeDefined();
			expect(state.checkpoints).toBeDefined();
		});
	});
});
