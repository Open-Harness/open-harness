/**
 * Tape Tests
 *
 * Comprehensive tests for the Tape time-travel debugging system.
 * Tests cover: position/length, state computation, VCR controls,
 * status flags, edge cases, and deterministic replay.
 */

import { describe, expect, it } from "vitest";
import { type AnyEvent, createEvent, defineEvent } from "../src/event/index.js";
import { defineHandler, type Handler } from "../src/handler/index.js";
import {
	computeState,
	createTape,
	createTapeFromDefinitions,
	type TapeControls,
	type TapeMetadata,
	type TapeStatus,
} from "../src/tape/index.js";

// ============================================================================
// Test Fixtures
// ============================================================================

interface TestState {
	count: number;
	values: readonly string[];
	lastEvent?: string;
}

const initialState: TestState = {
	count: 0,
	values: [],
};

// Define test events
const CountIncremented = defineEvent<"count:incremented", { by: number }>("count:incremented");
const ValueAdded = defineEvent<"value:added", { value: string }>("value:added");
const CountReset = defineEvent<"count:reset", Record<string, never>>("count:reset");

// Create test events
function createTestEvents(): AnyEvent[] {
	const e1 = CountIncremented.create({ by: 1 });
	const e2 = CountIncremented.create({ by: 2 }, e1.id);
	const e3 = ValueAdded.create({ value: "hello" }, e2.id);
	const e4 = CountIncremented.create({ by: 3 }, e3.id);
	const e5 = ValueAdded.create({ value: "world" }, e4.id);
	return [e1, e2, e3, e4, e5];
}

// Define test handlers
const countIncrementedHandler = defineHandler(CountIncremented, {
	name: "handleCountIncremented",
	handler: (event, state: TestState) => ({
		state: {
			...state,
			count: state.count + event.payload.by,
			lastEvent: event.name,
		},
		events: [],
	}),
});

const valueAddedHandler = defineHandler(ValueAdded, {
	name: "handleValueAdded",
	handler: (event, state: TestState) => ({
		state: {
			...state,
			values: [...state.values, event.payload.value],
			lastEvent: event.name,
		},
		events: [],
	}),
});

const countResetHandler = defineHandler(CountReset, {
	name: "handleCountReset",
	handler: (_event, state: TestState) => ({
		state: {
			...state,
			count: 0,
			lastEvent: "count:reset",
		},
		events: [],
	}),
});

// Build handler map
function createHandlerMap(): Map<string, Handler<AnyEvent, TestState>> {
	const map = new Map<string, Handler<AnyEvent, TestState>>();
	map.set("count:incremented", countIncrementedHandler.handler as Handler<AnyEvent, TestState>);
	map.set("value:added", valueAddedHandler.handler as Handler<AnyEvent, TestState>);
	map.set("count:reset", countResetHandler.handler as Handler<AnyEvent, TestState>);
	return map;
}

// ============================================================================
// TapeStatus Type Tests
// ============================================================================

describe("TapeStatus type", () => {
	it('should include "idle" status', () => {
		const status: TapeStatus = "idle";
		expect(status).toBe("idle");
	});

	it('should include "playing" status', () => {
		const status: TapeStatus = "playing";
		expect(status).toBe("playing");
	});

	it('should include "paused" status', () => {
		const status: TapeStatus = "paused";
		expect(status).toBe("paused");
	});

	it('should include "recording" status', () => {
		const status: TapeStatus = "recording";
		expect(status).toBe("recording");
	});
});

// ============================================================================
// TapeMetadata Interface Tests
// ============================================================================

describe("TapeMetadata interface", () => {
	it("should have required properties", () => {
		const metadata: TapeMetadata = {
			sessionId: "session-123",
			eventCount: 10,
			status: "idle",
		};
		expect(metadata.sessionId).toBe("session-123");
		expect(metadata.eventCount).toBe(10);
		expect(metadata.status).toBe("idle");
	});

	it("should have optional duration", () => {
		const metadata: TapeMetadata = {
			sessionId: "session-123",
			eventCount: 10,
			status: "idle",
			duration: 5000,
		};
		expect(metadata.duration).toBe(5000);
	});
});

// ============================================================================
// computeState Utility Tests
// ============================================================================

describe("computeState utility", () => {
	it("should return initial state when position is -1", () => {
		const events = createTestEvents();
		const handlers = createHandlerMap();

		const state = computeState(events, handlers, initialState, -1);

		expect(state).toEqual(initialState);
		expect(state.count).toBe(0);
		expect(state.values).toEqual([]);
	});

	it("should compute state after first event (position 0)", () => {
		const events = createTestEvents();
		const handlers = createHandlerMap();

		const state = computeState(events, handlers, initialState, 0);

		expect(state.count).toBe(1); // First event increments by 1
		expect(state.lastEvent).toBe("count:incremented");
	});

	it("should compute state after multiple events", () => {
		const events = createTestEvents();
		const handlers = createHandlerMap();

		// Position 2 = events 0, 1, 2 (increment +1, +2, add "hello")
		const state = computeState(events, handlers, initialState, 2);

		expect(state.count).toBe(3); // 1 + 2
		expect(state.values).toEqual(["hello"]);
		expect(state.lastEvent).toBe("value:added");
	});

	it("should compute state at final position", () => {
		const events = createTestEvents();
		const handlers = createHandlerMap();

		// Position 4 = all 5 events
		const state = computeState(events, handlers, initialState, 4);

		expect(state.count).toBe(6); // 1 + 2 + 3
		expect(state.values).toEqual(["hello", "world"]);
		expect(state.lastEvent).toBe("value:added");
	});

	it("should clamp position to valid range", () => {
		const events = createTestEvents();
		const handlers = createHandlerMap();

		// Position 100 should be clamped to 4
		const state = computeState(events, handlers, initialState, 100);

		expect(state.count).toBe(6);
		expect(state.values).toEqual(["hello", "world"]);
	});

	it("should handle empty events array", () => {
		const handlers = createHandlerMap();

		const state = computeState([], handlers, initialState, 0);

		expect(state).toEqual(initialState);
	});

	it("should skip events without handlers", () => {
		const events: AnyEvent[] = [createEvent("unknown:event", { data: "test" }), CountIncremented.create({ by: 5 })];
		const handlers = createHandlerMap();

		const state = computeState(events, handlers, initialState, 1);

		expect(state.count).toBe(5); // Only count:incremented was handled
	});

	it("should be deterministic - same result every time", () => {
		const events = createTestEvents();
		const handlers = createHandlerMap();

		const results: TestState[] = [];
		for (let i = 0; i < 100; i++) {
			results.push(computeState(events, handlers, initialState, 4));
		}

		// All results should be identical
		for (const result of results) {
			expect(result.count).toBe(6);
			expect(result.values).toEqual(["hello", "world"]);
		}
	});
});

// ============================================================================
// createTape Factory Tests
// ============================================================================

describe("createTape factory", () => {
	it("should create tape with correct initial state", () => {
		const events = createTestEvents();
		const handlers = createHandlerMap();

		const tape = createTape({
			events,
			handlers,
			initialState,
		});

		expect(tape.position).toBe(0);
		expect(tape.length).toBe(5);
		expect(tape.status).toBe("idle");
	});

	it("should create tape with custom starting position", () => {
		const events = createTestEvents();
		const handlers = createHandlerMap();

		const tape = createTape({
			events,
			handlers,
			initialState,
			position: 3,
		});

		expect(tape.position).toBe(3);
	});

	it("should clamp position to valid range", () => {
		const events = createTestEvents();
		const handlers = createHandlerMap();

		const tape = createTape({
			events,
			handlers,
			initialState,
			position: 100, // Way out of bounds
		});

		expect(tape.position).toBe(4); // Clamped to max
	});

	it("should create tape with custom status", () => {
		const events = createTestEvents();
		const handlers = createHandlerMap();

		const tape = createTape({
			events,
			handlers,
			initialState,
			status: "recording",
		});

		expect(tape.status).toBe("recording");
	});

	it("should create empty tape", () => {
		const handlers = createHandlerMap();

		const tape = createTape({
			events: [],
			handlers,
			initialState,
		});

		expect(tape.length).toBe(0);
		expect(tape.position).toBe(0);
		expect(tape.current).toBeUndefined();
		expect(tape.state).toEqual(initialState);
	});
});

// ============================================================================
// createTapeFromDefinitions Factory Tests
// ============================================================================

describe("createTapeFromDefinitions factory", () => {
	it("should create tape from handler definitions", () => {
		const events = createTestEvents();

		const tape = createTapeFromDefinitions(events, [countIncrementedHandler, valueAddedHandler], initialState);

		expect(tape.length).toBe(5);
		expect(tape.position).toBe(0);
	});

	it("should compute state correctly from definitions", () => {
		const events = createTestEvents();

		const tape = createTapeFromDefinitions(events, [countIncrementedHandler, valueAddedHandler], initialState, {
			position: 4,
		});

		expect(tape.state.count).toBe(6);
		expect(tape.state.values).toEqual(["hello", "world"]);
	});
});

// ============================================================================
// Tape Position & Length Tests
// ============================================================================

describe("Tape position and length", () => {
	it("should expose correct position", () => {
		const events = createTestEvents();
		const handlers = createHandlerMap();

		const tape = createTape({ events, handlers, initialState, position: 2 });

		expect(tape.position).toBe(2);
	});

	it("should expose correct length", () => {
		const events = createTestEvents();
		const handlers = createHandlerMap();

		const tape = createTape({ events, handlers, initialState });

		expect(tape.length).toBe(5);
	});

	it("should handle single event", () => {
		const events = [CountIncremented.create({ by: 1 })];
		const handlers = createHandlerMap();

		const tape = createTape({ events, handlers, initialState });

		expect(tape.length).toBe(1);
		expect(tape.position).toBe(0);
	});
});

// ============================================================================
// Tape Current Event Tests
// ============================================================================

describe("Tape current event", () => {
	it("should return event at current position", () => {
		const events = createTestEvents();
		const handlers = createHandlerMap();

		const tape = createTape({ events, handlers, initialState, position: 2 });

		expect(tape.current).toBeDefined();
		expect(tape.current?.name).toBe("value:added");
	});

	it("should return undefined for empty tape", () => {
		const handlers = createHandlerMap();

		const tape = createTape({ events: [], handlers, initialState });

		expect(tape.current).toBeUndefined();
	});
});

// ============================================================================
// Tape State Computation Tests
// ============================================================================

describe("Tape state computation", () => {
	it("should compute state at position 0", () => {
		const events = createTestEvents();
		const handlers = createHandlerMap();

		const tape = createTape({ events, handlers, initialState, position: 0 });

		expect(tape.state.count).toBe(1);
	});

	it("should compute state at any position", () => {
		const events = createTestEvents();
		const handlers = createHandlerMap();

		const tape = createTape({ events, handlers, initialState, position: 3 });

		// Events 0,1,2,3: +1, +2, "hello", +3
		expect(tape.state.count).toBe(6);
		expect(tape.state.values).toEqual(["hello"]);
	});

	it("should cache state to avoid recomputation", () => {
		const events = createTestEvents();
		const handlers = createHandlerMap();

		const tape = createTape({ events, handlers, initialState, position: 4 });

		// Access state multiple times
		const state1 = tape.state;
		const state2 = tape.state;
		const state3 = tape.state;

		// Should return same object (cached)
		expect(state1).toBe(state2);
		expect(state2).toBe(state3);
	});
});

// ============================================================================
// Tape Events Array Tests
// ============================================================================

describe("Tape events array", () => {
	it("should expose all events", () => {
		const events = createTestEvents();
		const handlers = createHandlerMap();

		const tape = createTape({ events, handlers, initialState });

		expect(tape.events).toHaveLength(5);
		expect(tape.events[0]?.name).toBe("count:incremented");
	});

	it("should be readonly", () => {
		const events = createTestEvents();
		const handlers = createHandlerMap();

		const tape = createTape({ events, handlers, initialState });

		// TypeScript ensures this is readonly, runtime check for immutability
		expect(Array.isArray(tape.events)).toBe(true);
	});
});

// ============================================================================
// Tape Status Flags Tests
// ============================================================================

describe("Tape status flags", () => {
	it("should report isRecording true when status is recording", () => {
		const events = createTestEvents();
		const handlers = createHandlerMap();

		const tape = createTape({ events, handlers, initialState, status: "recording" });

		expect(tape.isRecording).toBe(true);
		expect(tape.isReplaying).toBe(false);
	});

	it("should report isReplaying true when status is playing", () => {
		const events = createTestEvents();
		const handlers = createHandlerMap();

		const tape = createTape({ events, handlers, initialState, status: "playing" });

		expect(tape.isRecording).toBe(false);
		expect(tape.isReplaying).toBe(true);
	});

	it("should report isReplaying true when status is paused", () => {
		const events = createTestEvents();
		const handlers = createHandlerMap();

		const tape = createTape({ events, handlers, initialState, status: "paused" });

		expect(tape.isRecording).toBe(false);
		expect(tape.isReplaying).toBe(true);
	});

	it("should report both false when status is idle", () => {
		const events = createTestEvents();
		const handlers = createHandlerMap();

		const tape = createTape({ events, handlers, initialState, status: "idle" });

		expect(tape.isRecording).toBe(false);
		expect(tape.isReplaying).toBe(false);
	});
});

// ============================================================================
// VCR Control: rewind() Tests - FR-028
// ============================================================================

describe("Tape rewind() - FR-028", () => {
	it("should return to position 0", () => {
		const events = createTestEvents();
		const handlers = createHandlerMap();

		const tape = createTape({ events, handlers, initialState, position: 4 });
		const rewound = tape.rewind();

		expect(rewound.position).toBe(0);
	});

	it("should reset status to idle", () => {
		const events = createTestEvents();
		const handlers = createHandlerMap();

		const tape = createTape({ events, handlers, initialState, position: 4, status: "playing" });
		const rewound = tape.rewind();

		expect(rewound.status).toBe("idle");
	});

	it("should return new tape (immutable)", () => {
		const events = createTestEvents();
		const handlers = createHandlerMap();

		const tape = createTape({ events, handlers, initialState, position: 4 });
		const rewound = tape.rewind();

		expect(rewound).not.toBe(tape);
		expect(tape.position).toBe(4); // Original unchanged
	});

	it("should have state at position 0", () => {
		const events = createTestEvents();
		const handlers = createHandlerMap();

		const tape = createTape({ events, handlers, initialState, position: 4 });
		const rewound = tape.rewind();

		expect(rewound.state.count).toBe(1); // State after first event
	});
});

// ============================================================================
// VCR Control: step() Tests - FR-029
// ============================================================================

describe("Tape step() - FR-029", () => {
	it("should advance position by 1", () => {
		const events = createTestEvents();
		const handlers = createHandlerMap();

		const tape = createTape({ events, handlers, initialState, position: 0 });
		const stepped = tape.step();

		expect(stepped.position).toBe(1);
	});

	it("should clamp at end (not exceed length-1)", () => {
		const events = createTestEvents();
		const handlers = createHandlerMap();

		const tape = createTape({ events, handlers, initialState, position: 4 });
		const stepped = tape.step();

		expect(stepped.position).toBe(4); // Stays at max
	});

	it("should update state correctly", () => {
		const events = createTestEvents();
		const handlers = createHandlerMap();

		const tape = createTape({ events, handlers, initialState, position: 0 });
		const stepped = tape.step();

		expect(stepped.state.count).toBe(3); // 1 + 2
	});

	it("should return new tape (immutable)", () => {
		const events = createTestEvents();
		const handlers = createHandlerMap();

		const tape = createTape({ events, handlers, initialState, position: 0 });
		const stepped = tape.step();

		expect(stepped).not.toBe(tape);
		expect(tape.position).toBe(0); // Original unchanged
	});

	it("should handle empty tape gracefully", () => {
		const handlers = createHandlerMap();

		const tape = createTape({ events: [], handlers, initialState });
		const stepped = tape.step();

		expect(stepped.position).toBe(0);
	});
});

// ============================================================================
// VCR Control: stepBack() Tests - FR-030 (THE KEY FEATURE)
// ============================================================================

describe("Tape stepBack() - FR-030 (THE KEY FEATURE)", () => {
	it("should go backward one position", () => {
		const events = createTestEvents();
		const handlers = createHandlerMap();

		const tape = createTape({ events, handlers, initialState, position: 3 });
		const steppedBack = tape.stepBack();

		expect(steppedBack.position).toBe(2);
	});

	it("should clamp at position 0 (not go negative)", () => {
		const events = createTestEvents();
		const handlers = createHandlerMap();

		const tape = createTape({ events, handlers, initialState, position: 0 });
		const steppedBack = tape.stepBack();

		expect(steppedBack.position).toBe(0); // Stays at 0
	});

	it("should revert state to previous position", () => {
		const events = createTestEvents();
		const handlers = createHandlerMap();

		// Position 4: count=6, values=["hello","world"]
		const tape = createTape({ events, handlers, initialState, position: 4 });
		// Position 3: count=6, values=["hello"]
		const steppedBack = tape.stepBack();

		expect(steppedBack.state.count).toBe(6);
		expect(steppedBack.state.values).toEqual(["hello"]);
	});

	it("should return new tape (immutable)", () => {
		const events = createTestEvents();
		const handlers = createHandlerMap();

		const tape = createTape({ events, handlers, initialState, position: 3 });
		const steppedBack = tape.stepBack();

		expect(steppedBack).not.toBe(tape);
		expect(tape.position).toBe(3); // Original unchanged
	});

	it("should allow multiple stepBack calls (time travel)", () => {
		const events = createTestEvents();
		const handlers = createHandlerMap();

		const tape = createTape({ events, handlers, initialState, position: 4 });
		const t1 = tape.stepBack(); // position 3
		const t2 = t1.stepBack(); // position 2
		const t3 = t2.stepBack(); // position 1
		const t4 = t3.stepBack(); // position 0
		const t5 = t4.stepBack(); // position 0 (clamped)

		expect(t1.position).toBe(3);
		expect(t2.position).toBe(2);
		expect(t3.position).toBe(1);
		expect(t4.position).toBe(0);
		expect(t5.position).toBe(0);
	});

	it("should handle empty tape gracefully", () => {
		const handlers = createHandlerMap();

		const tape = createTape({ events: [], handlers, initialState });
		const steppedBack = tape.stepBack();

		expect(steppedBack.position).toBe(0);
	});

	it("should correctly recompute state when stepping back", () => {
		const events = createTestEvents();
		const handlers = createHandlerMap();

		// Start at position 4
		const tape = createTape({ events, handlers, initialState, position: 4 });
		expect(tape.state.count).toBe(6);
		expect(tape.state.values).toEqual(["hello", "world"]);

		// Step back to position 3
		const t3 = tape.stepBack();
		expect(t3.state.count).toBe(6); // +1 +2 +3
		expect(t3.state.values).toEqual(["hello"]);

		// Step back to position 2
		const t2 = t3.stepBack();
		expect(t2.state.count).toBe(3); // +1 +2
		expect(t2.state.values).toEqual(["hello"]);

		// Step back to position 1
		const t1 = t2.stepBack();
		expect(t1.state.count).toBe(3); // +1 +2
		expect(t1.state.values).toEqual([]);

		// Step back to position 0
		const t0 = t1.stepBack();
		expect(t0.state.count).toBe(1); // +1
		expect(t0.state.values).toEqual([]);
	});
});

// ============================================================================
// VCR Control: stepTo() Tests - FR-031
// ============================================================================

describe("Tape stepTo() - FR-031", () => {
	it("should jump to specified position", () => {
		const events = createTestEvents();
		const handlers = createHandlerMap();

		const tape = createTape({ events, handlers, initialState, position: 0 });
		const jumped = tape.stepTo(3);

		expect(jumped.position).toBe(3);
	});

	it("should clamp position at end", () => {
		const events = createTestEvents();
		const handlers = createHandlerMap();

		const tape = createTape({ events, handlers, initialState, position: 0 });
		const jumped = tape.stepTo(100);

		expect(jumped.position).toBe(4); // Clamped to max
	});

	it("should clamp position at beginning", () => {
		const events = createTestEvents();
		const handlers = createHandlerMap();

		const tape = createTape({ events, handlers, initialState, position: 3 });
		const jumped = tape.stepTo(-10);

		expect(jumped.position).toBe(0); // Clamped to 0
	});

	it("should compute correct state at target position", () => {
		const events = createTestEvents();
		const handlers = createHandlerMap();

		const tape = createTape({ events, handlers, initialState, position: 0 });
		const jumped = tape.stepTo(2);

		expect(jumped.state.count).toBe(3);
		expect(jumped.state.values).toEqual(["hello"]);
	});

	it("should return new tape (immutable)", () => {
		const events = createTestEvents();
		const handlers = createHandlerMap();

		const tape = createTape({ events, handlers, initialState, position: 0 });
		const jumped = tape.stepTo(3);

		expect(jumped).not.toBe(tape);
		expect(tape.position).toBe(0); // Original unchanged
	});

	it("should handle empty tape", () => {
		const handlers = createHandlerMap();

		const tape = createTape({ events: [], handlers, initialState });
		const jumped = tape.stepTo(5);

		expect(jumped.position).toBe(0);
	});
});

// ============================================================================
// VCR Control: play() Tests - FR-032
// ============================================================================

describe("Tape play() - FR-032", () => {
	it("should play from current position to end", async () => {
		const events = createTestEvents();
		const handlers = createHandlerMap();

		const tape = createTape({ events, handlers, initialState, position: 0 });
		const final = await tape.play();

		expect(final.position).toBe(4); // At end
	});

	it("should set status to paused when done", async () => {
		const events = createTestEvents();
		const handlers = createHandlerMap();

		const tape = createTape({ events, handlers, initialState, position: 0 });
		const final = await tape.play();

		expect(final.status).toBe("paused");
	});

	it("should have final state at end", async () => {
		const events = createTestEvents();
		const handlers = createHandlerMap();

		const tape = createTape({ events, handlers, initialState, position: 0 });
		const final = await tape.play();

		expect(final.state.count).toBe(6);
		expect(final.state.values).toEqual(["hello", "world"]);
	});

	it("should handle empty tape", async () => {
		const handlers = createHandlerMap();

		const tape = createTape({ events: [], handlers, initialState });
		const final = await tape.play();

		expect(final.position).toBe(0);
		expect(final.status).toBe("paused");
	});

	it("should handle already at end", async () => {
		const events = createTestEvents();
		const handlers = createHandlerMap();

		const tape = createTape({ events, handlers, initialState, position: 4 });
		const final = await tape.play();

		expect(final.position).toBe(4);
		expect(final.status).toBe("paused");
	});
});

// ============================================================================
// VCR Control: playTo() Tests - FR-033
// ============================================================================

describe("Tape playTo() - FR-033", () => {
	it("should play to specified position", async () => {
		const events = createTestEvents();
		const handlers = createHandlerMap();

		const tape = createTape({ events, handlers, initialState, position: 0 });
		const final = await tape.playTo(2);

		expect(final.position).toBe(2);
	});

	it("should clamp target position", async () => {
		const events = createTestEvents();
		const handlers = createHandlerMap();

		const tape = createTape({ events, handlers, initialState, position: 0 });
		const final = await tape.playTo(100);

		expect(final.position).toBe(4);
	});

	it("should set status to paused when done", async () => {
		const events = createTestEvents();
		const handlers = createHandlerMap();

		const tape = createTape({ events, handlers, initialState, position: 0 });
		const final = await tape.playTo(2);

		expect(final.status).toBe("paused");
	});

	it("should handle target before current position", async () => {
		const events = createTestEvents();
		const handlers = createHandlerMap();

		const tape = createTape({ events, handlers, initialState, position: 4 });
		const final = await tape.playTo(2);

		expect(final.position).toBe(2);
		expect(final.status).toBe("paused");
	});
});

// ============================================================================
// VCR Control: pause() Tests - FR-034
// ============================================================================

describe("Tape pause() - FR-034", () => {
	it("should set status to paused", () => {
		const events = createTestEvents();
		const handlers = createHandlerMap();

		const tape = createTape({ events, handlers, initialState, status: "playing" });
		const paused = tape.pause();

		expect(paused.status).toBe("paused");
	});

	it("should maintain current position", () => {
		const events = createTestEvents();
		const handlers = createHandlerMap();

		const tape = createTape({ events, handlers, initialState, position: 3, status: "playing" });
		const paused = tape.pause();

		expect(paused.position).toBe(3);
	});

	it("should return new tape (immutable)", () => {
		const events = createTestEvents();
		const handlers = createHandlerMap();

		const tape = createTape({ events, handlers, initialState, status: "playing" });
		const paused = tape.pause();

		expect(paused).not.toBe(tape);
	});
});

// ============================================================================
// Inspection: stateAt() Tests
// ============================================================================

describe("Tape stateAt()", () => {
	it("should compute state at any position without changing current", () => {
		const events = createTestEvents();
		const handlers = createHandlerMap();

		const tape = createTape({ events, handlers, initialState, position: 0 });
		const stateAt3 = tape.stateAt(3);

		expect(tape.position).toBe(0); // Unchanged
		expect(stateAt3.count).toBe(6); // State at position 3
	});

	it("should return initial state for position -1", () => {
		const events = createTestEvents();
		const handlers = createHandlerMap();

		const tape = createTape({ events, handlers, initialState, position: 3 });
		const stateAtMinus1 = tape.stateAt(-1);

		expect(stateAtMinus1).toEqual(initialState);
	});

	it("should clamp position to valid range", () => {
		const events = createTestEvents();
		const handlers = createHandlerMap();

		const tape = createTape({ events, handlers, initialState, position: 0 });
		const stateAt100 = tape.stateAt(100);

		expect(stateAt100.count).toBe(6); // State at clamped position
	});
});

// ============================================================================
// Inspection: eventAt() Tests
// ============================================================================

describe("Tape eventAt()", () => {
	it("should return event at specified position", () => {
		const events = createTestEvents();
		const handlers = createHandlerMap();

		const tape = createTape({ events, handlers, initialState, position: 0 });
		const eventAt2 = tape.eventAt(2);

		expect(eventAt2).toBeDefined();
		expect(eventAt2?.name).toBe("value:added");
	});

	it("should return undefined for out of bounds position", () => {
		const events = createTestEvents();
		const handlers = createHandlerMap();

		const tape = createTape({ events, handlers, initialState });
		const eventAt100 = tape.eventAt(100);
		const eventAtMinus1 = tape.eventAt(-1);

		expect(eventAt100).toBeUndefined();
		expect(eventAtMinus1).toBeUndefined();
	});

	it("should not change current position", () => {
		const events = createTestEvents();
		const handlers = createHandlerMap();

		const tape = createTape({ events, handlers, initialState, position: 0 });
		tape.eventAt(3);

		expect(tape.position).toBe(0); // Unchanged
	});
});

// ============================================================================
// TapeControls Interface Tests
// ============================================================================

describe("TapeControls interface", () => {
	it("should have required methods", () => {
		const controls: TapeControls<TestState> = {
			rewind: () => {},
			step: () => {},
			stepBack: () => {},
			stepTo: (_n: number) => {},
			play: async () => {},
			playTo: async (_n: number) => {},
			pause: () => {},
			position: 0,
			length: 5,
			status: "idle",
		};

		expect(typeof controls.rewind).toBe("function");
		expect(typeof controls.step).toBe("function");
		expect(typeof controls.stepBack).toBe("function");
		expect(typeof controls.stepTo).toBe("function");
		expect(typeof controls.play).toBe("function");
		expect(typeof controls.playTo).toBe("function");
		expect(typeof controls.pause).toBe("function");
		expect(controls.position).toBe(0);
		expect(controls.length).toBe(5);
		expect(controls.status).toBe("idle");
	});
});

// ============================================================================
// Edge Cases (from spec)
// ============================================================================

describe("Edge Cases (from spec)", () => {
	it("stepBack at position 0 stays at 0 (FR-030)", () => {
		const events = createTestEvents();
		const handlers = createHandlerMap();

		const tape = createTape({ events, handlers, initialState, position: 0 });
		const steppedBack = tape.stepBack();

		expect(steppedBack.position).toBe(0);
		expect(steppedBack.state).toEqual(tape.state);
	});

	it("stepBack at position 0 preserves state and does not go negative (Phase 10 edge case)", () => {
		const events = createTestEvents();
		const handlers = createHandlerMap();

		const tape = createTape({ events, handlers, initialState, position: 0 });

		// State at position 0 is after first event (count:incremented by 1)
		expect(tape.state.count).toBe(1);
		expect(tape.state.values).toEqual([]);

		// Call stepBack multiple times - should never go negative or corrupt state
		const t1 = tape.stepBack();
		expect(t1.position).toBe(0);
		expect(t1.state.count).toBe(1);
		expect(t1.state.values).toEqual([]);

		const t2 = t1.stepBack();
		expect(t2.position).toBe(0);
		expect(t2.state.count).toBe(1);

		const t3 = t2.stepBack();
		expect(t3.position).toBe(0);
		expect(t3.state.count).toBe(1);

		// Verify tape is still usable - can step forward from position 0
		const t4 = t3.step();
		expect(t4.position).toBe(1);
		expect(t4.state.count).toBe(3); // 1 + 2

		// Verify current event is still accessible
		expect(t3.current).toBeDefined();
		expect(t3.current?.name).toBe("count:incremented");
	});

	it("step past end stays at end (FR-029)", () => {
		const events = createTestEvents();
		const handlers = createHandlerMap();

		const tape = createTape({ events, handlers, initialState, position: 4 });
		const stepped = tape.step();

		expect(stepped.position).toBe(4);
	});

	it("stepTo clamps correctly (FR-031)", () => {
		const events = createTestEvents();
		const handlers = createHandlerMap();

		const tape = createTape({ events, handlers, initialState });

		expect(tape.stepTo(-100).position).toBe(0);
		expect(tape.stepTo(100).position).toBe(4);
	});

	it("state recomputation is deterministic (SC-004)", () => {
		const events = createTestEvents();
		const handlers = createHandlerMap();

		// Replay 100 times at the same position
		const states: TestState[] = [];
		for (let i = 0; i < 100; i++) {
			const tape = createTape({ events, handlers, initialState, position: 4 });
			states.push(tape.state);
		}

		// All should be identical
		for (const state of states) {
			expect(state.count).toBe(6);
			expect(state.values).toEqual(["hello", "world"]);
		}
	});
});

// ============================================================================
// Immutability Tests
// ============================================================================

describe("Tape immutability", () => {
	it("all control methods return new instances", () => {
		const events = createTestEvents();
		const handlers = createHandlerMap();

		const tape = createTape({ events, handlers, initialState, position: 2 });

		const rewound = tape.rewind();
		const stepped = tape.step();
		const steppedBack = tape.stepBack();
		const jumped = tape.stepTo(0);
		const paused = tape.pause();

		expect(rewound).not.toBe(tape);
		expect(stepped).not.toBe(tape);
		expect(steppedBack).not.toBe(tape);
		expect(jumped).not.toBe(tape);
		expect(paused).not.toBe(tape);
	});

	it("original tape is unchanged after operations", () => {
		const events = createTestEvents();
		const handlers = createHandlerMap();

		const tape = createTape({ events, handlers, initialState, position: 2, status: "idle" });

		tape.rewind();
		tape.step();
		tape.stepBack();
		tape.stepTo(4);
		tape.pause();

		expect(tape.position).toBe(2);
		expect(tape.status).toBe("idle");
	});
});

// ============================================================================
// Time Travel Debugging Workflow Tests
// ============================================================================

describe("Time Travel Debugging Workflow", () => {
	it("complete debugging workflow: forward, backward, jump, inspect", () => {
		const events = createTestEvents();
		const handlers = createHandlerMap();

		// Start at beginning
		const tape = createTape({ events, handlers, initialState });
		expect(tape.position).toBe(0);
		expect(tape.state.count).toBe(1);

		// Step forward
		const t1 = tape.step();
		expect(t1.position).toBe(1);
		expect(t1.state.count).toBe(3);

		// Step forward more
		const t2 = t1.step();
		expect(t2.position).toBe(2);
		expect(t2.state.values).toEqual(["hello"]);

		// Go back in time!
		const t3 = t2.stepBack();
		expect(t3.position).toBe(1);
		expect(t3.state.values).toEqual([]);

		// Jump to end
		const t4 = tape.stepTo(4);
		expect(t4.position).toBe(4);
		expect(t4.state.count).toBe(6);

		// Inspect state at position 2 without moving
		const stateAt2 = t4.stateAt(2);
		expect(stateAt2.count).toBe(3);
		expect(t4.position).toBe(4); // Position unchanged
	});

	it("debugging a bug: find which event caused a problem", () => {
		// Simulate a session where something went wrong at position 3
		const events = createTestEvents();
		const handlers = createHandlerMap();

		// Developer loads the session at the end where they see the problem
		const tape = createTape({ events, handlers, initialState, position: 4 });
		expect(tape.state.count).toBe(6);

		// They step back through history to find when count jumped
		const t3 = tape.stepBack(); // position 3
		expect(t3.state.count).toBe(6); // count is 6

		const t2 = t3.stepBack(); // position 2
		expect(t2.state.count).toBe(3); // count is 3

		// Aha! Count jumped from 3 to 6 between positions 2 and 3
		// Let's check what event caused that
		const problematicEvent = tape.eventAt(3);
		expect(problematicEvent?.name).toBe("count:incremented");
		expect((problematicEvent?.payload as { by: number }).by).toBe(3);

		// Bug found! The increment by 3 at position 3 caused the issue
	});
});
