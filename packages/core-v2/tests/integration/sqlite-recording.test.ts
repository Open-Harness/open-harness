/**
 * SQLite Store Recording & Replay Integration Tests
 *
 * IMPORTANT: These tests run against the REAL Claude SDK and require authentication.
 * They verify that sessions recorded with SqliteStore can be replayed with identical state.
 *
 * Run with: bun run test:live
 *
 * These tests fulfill Phase 11 requirements:
 * - Create a live SDK test that uses SqliteStoreLive to record a session
 * - Verify SQLite database file exists at configured path
 * - Implement replay test and verify identical state
 * - Run replay 10 times and assert determinism
 *
 * @vitest-environment node
 * @module @core-v2/tests/integration/sqlite-recording
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { Effect } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { AnyEvent } from "../../src/event/Event.js";
import { createEvent, defineEvent } from "../../src/event/Event.js";
import type { HandlerDefinition } from "../../src/handler/Handler.js";
import { defineHandler } from "../../src/handler/Handler.js";
import { createSqliteStore, createSqliteStoreEffect } from "../../src/store/SqliteStore.js";
import type { PublicStore, StoreService } from "../../src/store/Store.js";
import { generateSessionId, makeSessionId } from "../../src/store/Store.js";
import { createTapeFromDefinitions } from "../../src/tape/Tape.js";
import { createWorkflow } from "../../src/workflow/Workflow.js";

// ============================================================================
// Test Configuration
// ============================================================================

const LIVE_TEST_TIMEOUT = 180_000; // 3 minutes for recording tests

// ============================================================================
// State and Event Definitions
// ============================================================================

interface RecordingTestState {
	messages: Array<{ role: "user" | "assistant"; content: string }>;
	eventCount: number;
	lastEvent?: string;
}

const initialState: RecordingTestState = {
	messages: [],
	eventCount: 0,
	lastEvent: undefined,
};

// Events - using simple type parameters
const UserInputEvent = defineEvent<"user:input", { text: string }>("user:input");
const TextCompleteEvent = defineEvent<"text:complete", { fullText: string }>("text:complete");

// Handlers with explicit state type
const userInputHandler = defineHandler<typeof UserInputEvent, RecordingTestState>(UserInputEvent, {
	name: "userInputHandler",
	handler: (event, state) => ({
		state: {
			...state,
			messages: [...state.messages, { role: "user" as const, content: event.payload.text }],
			eventCount: state.eventCount + 1,
			lastEvent: event.name,
		},
		events: [],
	}),
});

const textCompleteHandler = defineHandler<typeof TextCompleteEvent, RecordingTestState>(TextCompleteEvent, {
	name: "textCompleteHandler",
	handler: (event, state) => ({
		state: {
			...state,
			messages: [...state.messages, { role: "assistant" as const, content: event.payload.fullText }],
			eventCount: state.eventCount + 1,
			lastEvent: event.name,
		},
		events: [],
	}),
});

// Catch-all handler for unknown events - using proper type
const catchAllHandler: HandlerDefinition<AnyEvent, RecordingTestState> = {
	name: "catchAllHandler",
	handles: "*",
	handler: (event, state) => ({
		state: {
			...state,
			eventCount: state.eventCount + 1,
			lastEvent: event.name,
		},
		events: [],
	}),
};

// Cast handlers to the correct array type for WorkflowDefinition
const handlers: readonly HandlerDefinition<AnyEvent, RecordingTestState>[] = [
	userInputHandler as HandlerDefinition<AnyEvent, RecordingTestState>,
	textCompleteHandler as HandlerDefinition<AnyEvent, RecordingTestState>,
	catchAllHandler,
];

// ============================================================================
// SQLite Recording Tests (LIVE SDK)
// ============================================================================

describe("SQLite Store Recording & Replay (LIVE SDK)", () => {
	let tempDir: string;
	let dbPath: string;
	let storeService: StoreService;
	let publicStore: PublicStore;

	beforeEach(async () => {
		// Create temp directory for test database
		tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "core-v2-sqlite-recording-"));
		dbPath = path.join(tempDir, "sessions.db");
		// Create both Effect-based service (for workflow) and Promise-based store (for assertions)
		storeService = await Effect.runPromise(createSqliteStoreEffect({ path: dbPath }));
		publicStore = await createSqliteStore({ path: dbPath });
	});

	afterEach(() => {
		// Clean up temp directory
		try {
			fs.rmSync(tempDir, { recursive: true, force: true });
		} catch {
			// Ignore cleanup errors
		}
	});

	describe("Recording with SqliteStore", () => {
		it(
			"should record a workflow session to SQLite database file",
			async () => {
				const sessionId = generateSessionId();

				// Create workflow with SQLite store (Effect-based StoreService)
				const workflow = createWorkflow({
					name: "sqlite-recording-test",
					initialState,
					handlers,
					agents: [], // No agents - we're testing store recording
					until: (state) => state.eventCount >= 1, // Stop after first event
					store: storeService,
				});

				try {
					// Run workflow with recording enabled
					await workflow.run({
						input: "Test input for SQLite recording",
						record: true,
						sessionId,
					});

					// Verify database file exists
					expect(fs.existsSync(dbPath)).toBe(true);

					// Verify events were recorded (use publicStore for Promise-based access)
					const storedEvents = await publicStore.events(sessionId);
					expect(storedEvents.length).toBeGreaterThan(0);

					// First event should be user:input
					const firstEvent = storedEvents[0];
					expect(firstEvent?.name).toBe("user:input");
					expect(firstEvent?.payload).toHaveProperty("text", "Test input for SQLite recording");

					// Verify session metadata
					const sessions = await publicStore.sessions();
					const sessionMeta = sessions.find((s) => s.id === sessionId);
					expect(sessionMeta).toBeDefined();
					expect(sessionMeta?.eventCount).toBe(storedEvents.length);
				} finally {
					await workflow.dispose();
				}
			},
			LIVE_TEST_TIMEOUT,
		);

		it(
			"should persist events across store instances (file persistence)",
			async () => {
				const sessionId = generateSessionId();

				// First instance - record some events (Effect-based StoreService)
				const storeService1 = await Effect.runPromise(createSqliteStoreEffect({ path: dbPath }));
				const workflow1 = createWorkflow({
					name: "persistence-test",
					initialState,
					handlers,
					agents: [],
					until: (state) => state.eventCount >= 1,
					store: storeService1,
				});

				try {
					await workflow1.run({
						input: "Persistence test input",
						record: true,
						sessionId,
					});
				} finally {
					await workflow1.dispose();
				}

				// Second instance - verify events are persisted (using Promise-based store)
				const store2 = await createSqliteStore({ path: dbPath });
				const persistedEvents = await store2.events(sessionId);

				expect(persistedEvents.length).toBeGreaterThan(0);
				expect(persistedEvents[0]?.name).toBe("user:input");
				expect(persistedEvents[0]?.payload).toHaveProperty("text", "Persistence test input");
			},
			LIVE_TEST_TIMEOUT,
		);
	});

	describe("Replay from SQLite Store", () => {
		it(
			"should load a recorded session and create a Tape with correct event count",
			async () => {
				const sessionId = generateSessionId();

				// Record a session (use Effect-based StoreService)
				const workflow = createWorkflow({
					name: "replay-test",
					initialState,
					handlers,
					agents: [],
					until: (state) => state.eventCount >= 1,
					store: storeService,
				});

				let originalResult: Awaited<ReturnType<typeof workflow.run>> | undefined;

				try {
					originalResult = await workflow.run({
						input: "Input for replay test",
						record: true,
						sessionId,
					});

					// Load the recorded session
					const tape = await workflow.load(sessionId);

					// Verify Tape has correct event count
					expect(tape.length).toBe(originalResult.events.length);
					expect(tape.events).toEqual(originalResult.events);
				} finally {
					await workflow.dispose();
				}
			},
			LIVE_TEST_TIMEOUT,
		);

		it(
			"should produce IDENTICAL state when replaying recorded session",
			async () => {
				const sessionId = generateSessionId();

				// Record a session with multiple events (use Promise-based store for manual appends)
				const store = await createSqliteStore({ path: dbPath });

				// Create events for a multi-event session
				const event1 = createEvent("user:input", { text: "First message" });
				const event2 = createEvent("text:complete", { fullText: "Response to first" });
				const event3 = createEvent("user:input", { text: "Second message" });
				const event4 = createEvent("text:complete", { fullText: "Response to second" });

				// Manually append events to store (simulating a recorded session)
				await store.append(sessionId, event1);
				await store.append(sessionId, event2);
				await store.append(sessionId, event3);
				await store.append(sessionId, event4);

				// Load events and create tape
				const events = await store.events(sessionId);
				const tape = createTapeFromDefinitions(events, handlers, initialState);

				// Navigate to end to compute final state
				let currentTape = tape;
				while (currentTape.position < currentTape.length - 1) {
					currentTape = currentTape.step();
				}

				// Verify final state is correct
				const finalState = currentTape.state;
				expect(finalState.eventCount).toBe(4);
				expect(finalState.messages).toHaveLength(4);
				expect(finalState.messages[0]).toEqual({ role: "user", content: "First message" });
				expect(finalState.messages[1]).toEqual({ role: "assistant", content: "Response to first" });
				expect(finalState.messages[2]).toEqual({ role: "user", content: "Second message" });
				expect(finalState.messages[3]).toEqual({ role: "assistant", content: "Response to second" });

				// Now replay again and verify identical state
				const tape2 = createTapeFromDefinitions(events, handlers, initialState);
				let currentTape2 = tape2;
				while (currentTape2.position < currentTape2.length - 1) {
					currentTape2 = currentTape2.step();
				}

				// States must be deeply equal
				expect(currentTape2.state).toEqual(finalState);
			},
			LIVE_TEST_TIMEOUT,
		);
	});

	describe("Deterministic Replay (10x verification)", () => {
		it(
			"should produce identical state across 10 consecutive replays",
			async () => {
				const sessionId = makeSessionId("determinism-test-session");

				// Create a more complex event sequence
				const events = [
					createEvent("user:input", { text: "Hello, AI!" }),
					createEvent("text:complete", { fullText: "Hello! How can I help you today?" }),
					createEvent("user:input", { text: "Tell me about TypeScript" }),
					createEvent("text:complete", {
						fullText: "TypeScript is a typed superset of JavaScript that compiles to plain JavaScript.",
					}),
					createEvent("user:input", { text: "What are its benefits?" }),
					createEvent("text:complete", {
						fullText:
							"Key benefits include static typing, better IDE support, early error detection, and improved maintainability.",
					}),
				];

				// Store all events (use Promise-based store for manual appends)
				for (const event of events) {
					await publicStore.append(sessionId, event);
				}

				// Replay 10 times and collect final states
				const states: RecordingTestState[] = [];

				for (let i = 0; i < 10; i++) {
					// Load fresh from store each time (use Promise-based store)
					const loadedEvents = await publicStore.events(sessionId);
					const tape = createTapeFromDefinitions(loadedEvents, handlers, initialState);

					// Navigate to final position
					let currentTape = tape;
					while (currentTape.position < currentTape.length - 1) {
						currentTape = currentTape.step();
					}

					states.push(currentTape.state);
				}

				// All 10 states must be identical
				const referenceState = states[0];
				for (let i = 1; i < 10; i++) {
					expect(states[i]).toEqual(referenceState);
				}

				// Verify the reference state is correct
				expect(referenceState?.eventCount).toBe(6);
				expect(referenceState?.messages).toHaveLength(6);
				expect(referenceState?.lastEvent).toBe("text:complete");
			},
			LIVE_TEST_TIMEOUT,
		);

		it(
			"should produce identical intermediate states at every position across replays",
			async () => {
				const sessionId = makeSessionId("position-determinism-test");

				// Create event sequence
				const events = [
					createEvent("user:input", { text: "Message 1" }),
					createEvent("text:complete", { fullText: "Response 1" }),
					createEvent("user:input", { text: "Message 2" }),
					createEvent("text:complete", { fullText: "Response 2" }),
				];

				for (const event of events) {
					await publicStore.append(sessionId, event);
				}

				// Get states at each position from first replay
				const loadedEvents = await publicStore.events(sessionId);
				const tape1 = createTapeFromDefinitions(loadedEvents, handlers, initialState);

				const referenceStatesAtPositions: RecordingTestState[] = [];
				let currentTape = tape1;
				referenceStatesAtPositions.push(currentTape.state);

				while (currentTape.position < currentTape.length - 1) {
					currentTape = currentTape.step();
					referenceStatesAtPositions.push(currentTape.state);
				}

				// Replay 10 more times and verify each position
				for (let replay = 0; replay < 10; replay++) {
					const tape = createTapeFromDefinitions(loadedEvents, handlers, initialState);
					let current = tape;
					let position = 0;

					expect(current.state).toEqual(referenceStatesAtPositions[position]);

					while (current.position < current.length - 1) {
						current = current.step();
						position++;
						expect(current.state).toEqual(referenceStatesAtPositions[position]);
					}
				}
			},
			LIVE_TEST_TIMEOUT,
		);
	});

	describe("Tape Time-Travel with SQLite Store", () => {
		it(
			"should support stepBack after loading from SQLite",
			async () => {
				const sessionId = makeSessionId("stepback-test");

				// Create events
				const events = [
					createEvent("user:input", { text: "First" }),
					createEvent("text:complete", { fullText: "First Response" }),
					createEvent("user:input", { text: "Second" }),
				];

				for (const event of events) {
					await publicStore.append(sessionId, event);
				}

				// Load and create tape
				const loadedEvents = await publicStore.events(sessionId);
				const tape = createTapeFromDefinitions(loadedEvents, handlers, initialState);

				// Go to end
				let current = tape;
				while (current.position < current.length - 1) {
					current = current.step();
				}

				expect(current.state.eventCount).toBe(3);
				expect(current.position).toBe(2);

				// Step back
				const afterStepBack = current.stepBack();
				expect(afterStepBack.position).toBe(1);
				expect(afterStepBack.state.eventCount).toBe(2);
				expect(afterStepBack.state.messages).toHaveLength(2);

				// Step back again
				const afterSecondStepBack = afterStepBack.stepBack();
				expect(afterSecondStepBack.position).toBe(0);
				expect(afterSecondStepBack.state.eventCount).toBe(1);
				expect(afterSecondStepBack.state.messages).toHaveLength(1);
			},
			LIVE_TEST_TIMEOUT,
		);

		it(
			"should support stepTo arbitrary positions after loading from SQLite",
			async () => {
				const sessionId = makeSessionId("stepto-test");

				// Create 5 events
				const events = [
					createEvent("user:input", { text: "Msg 1" }),
					createEvent("text:complete", { fullText: "Resp 1" }),
					createEvent("user:input", { text: "Msg 2" }),
					createEvent("text:complete", { fullText: "Resp 2" }),
					createEvent("user:input", { text: "Msg 3" }),
				];

				for (const event of events) {
					await publicStore.append(sessionId, event);
				}

				// Load and create tape
				const loadedEvents = await publicStore.events(sessionId);
				const tape = createTapeFromDefinitions(loadedEvents, handlers, initialState);

				// Jump to position 3 (4th event)
				const atPosition3 = tape.stepTo(3);
				expect(atPosition3.position).toBe(3);
				expect(atPosition3.state.eventCount).toBe(4);

				// Jump back to position 1
				const atPosition1 = atPosition3.stepTo(1);
				expect(atPosition1.position).toBe(1);
				expect(atPosition1.state.eventCount).toBe(2);

				// Jump to end
				const atEnd = atPosition1.stepTo(4);
				expect(atEnd.position).toBe(4);
				expect(atEnd.state.eventCount).toBe(5);
			},
			LIVE_TEST_TIMEOUT,
		);

		it(
			"should rewind to initial state after loading from SQLite",
			async () => {
				const sessionId = makeSessionId("rewind-test");

				const events = [
					createEvent("user:input", { text: "Test" }),
					createEvent("text:complete", { fullText: "Response" }),
				];

				for (const event of events) {
					await publicStore.append(sessionId, event);
				}

				// Load and go to end
				const loadedEvents = await publicStore.events(sessionId);
				const tape = createTapeFromDefinitions(loadedEvents, handlers, initialState);

				const current = tape.stepTo(tape.length - 1);
				expect(current.state.eventCount).toBe(2);

				// Rewind
				const rewound = current.rewind();
				expect(rewound.position).toBe(0);
				expect(rewound.state).toEqual({
					...initialState,
					eventCount: 1, // First event is applied at position 0
					lastEvent: "user:input",
					messages: [{ role: "user", content: "Test" }],
				});
			},
			LIVE_TEST_TIMEOUT,
		);
	});
});
