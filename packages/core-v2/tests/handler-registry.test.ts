/**
 * HandlerRegistry Tests
 *
 * Tests for the HandlerRegistry service, including:
 * - Error types and codes
 * - Context.Tag service identifier
 * - Register, get, has operations
 * - Duplicate handler detection
 * - GetAll and count operations
 * - Layer integration
 */

import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import type { AnyEvent } from "../src/event/Event.js";
import type { HandlerDefinition, HandlerResult } from "../src/handler/Handler.js";
import {
	HandlerRegistry,
	HandlerRegistryError,
	type HandlerRegistryErrorCode,
	HandlerRegistryLive,
} from "../src/handler/HandlerRegistry.js";

// ============================================================================
// Test Helpers
// ============================================================================

interface TestState {
	count: number;
	messages: string[];
}

const createTestHandler = (name: string, handles: string): HandlerDefinition<AnyEvent, TestState> => ({
	name,
	handles,
	handler: (_event: AnyEvent, state: TestState): HandlerResult<TestState> => ({
		state: { ...state, count: state.count + 1 },
		events: [],
	}),
});

// ============================================================================
// Error Type Tests
// ============================================================================

describe("HandlerRegistryError", () => {
	it("should have correct _tag", () => {
		const error = new HandlerRegistryError("HANDLER_NOT_FOUND", "Not found");
		expect(error._tag).toBe("HandlerRegistryError");
	});

	it("should have correct name", () => {
		const error = new HandlerRegistryError("DUPLICATE_HANDLER", "Duplicate");
		expect(error.name).toBe("HandlerRegistryError");
	});

	it("should support all error codes", () => {
		const codes: HandlerRegistryErrorCode[] = ["HANDLER_NOT_FOUND", "DUPLICATE_HANDLER", "REGISTRATION_FAILED"];

		for (const code of codes) {
			const error = new HandlerRegistryError(code, `Error: ${code}`);
			expect(error.code).toBe(code);
			expect(error.message).toBe(`Error: ${code}`);
		}
	});

	it("should preserve cause when provided", () => {
		const cause = new Error("Original error");
		const error = new HandlerRegistryError("REGISTRATION_FAILED", "Failed", cause);
		expect(error.cause).toBe(cause);
	});

	it("should extend Error", () => {
		const error = new HandlerRegistryError("HANDLER_NOT_FOUND", "Not found");
		expect(error).toBeInstanceOf(Error);
	});
});

// ============================================================================
// Context.Tag Tests
// ============================================================================

describe("HandlerRegistry Context.Tag", () => {
	it("should have correct service identifier", () => {
		// Context.Tag creates a service identifier
		expect(HandlerRegistry.key).toBe("@core-v2/HandlerRegistry");
	});

	it("should be usable in Effect.gen for dependency injection", async () => {
		const program = Effect.gen(function* () {
			const registry = yield* HandlerRegistry;
			expect(registry).toBeDefined();
			expect(typeof registry.register).toBe("function");
			expect(typeof registry.get).toBe("function");
			expect(typeof registry.has).toBe("function");
			expect(typeof registry.getAll).toBe("function");
			expect(typeof registry.count).toBe("function");
			return true;
		});

		const result = await Effect.runPromise(program.pipe(Effect.provide(HandlerRegistryLive)));
		expect(result).toBe(true);
	});
});

// ============================================================================
// Register Operation Tests
// ============================================================================

describe("HandlerRegistryService.register", () => {
	it("should register a handler successfully", async () => {
		const program = Effect.gen(function* () {
			const registry = yield* HandlerRegistry;
			const handler = createTestHandler("testHandler", "test:event");

			yield* registry.register(handler);

			const hasHandler = yield* registry.has("test:event");
			expect(hasHandler).toBe(true);
		});

		await Effect.runPromise(program.pipe(Effect.provide(HandlerRegistryLive)));
	});

	it("should register multiple handlers for different events", async () => {
		const program = Effect.gen(function* () {
			const registry = yield* HandlerRegistry;

			yield* registry.register(createTestHandler("handler1", "event:one"));
			yield* registry.register(createTestHandler("handler2", "event:two"));
			yield* registry.register(createTestHandler("handler3", "event:three"));

			expect(yield* registry.has("event:one")).toBe(true);
			expect(yield* registry.has("event:two")).toBe(true);
			expect(yield* registry.has("event:three")).toBe(true);
			expect(yield* registry.count()).toBe(3);
		});

		await Effect.runPromise(program.pipe(Effect.provide(HandlerRegistryLive)));
	});

	it("should fail when registering duplicate handler for same event", async () => {
		const program = Effect.gen(function* () {
			const registry = yield* HandlerRegistry;

			yield* registry.register(createTestHandler("first", "duplicate:event"));

			// Try to register another handler for the same event
			const result = yield* Effect.either(registry.register(createTestHandler("second", "duplicate:event")));

			expect(result._tag).toBe("Left");
			if (result._tag === "Left") {
				const error = result.left;
				expect(error).toBeInstanceOf(HandlerRegistryError);
				expect(error.code).toBe("DUPLICATE_HANDLER");
				expect(error.message).toContain("duplicate:event");
				expect(error.message).toContain("first");
				expect(error.message).toContain("second");
			}
		});

		await Effect.runPromise(program.pipe(Effect.provide(HandlerRegistryLive)));
	});
});

// ============================================================================
// Get Operation Tests
// ============================================================================

describe("HandlerRegistryService.get", () => {
	it("should return handler for registered event", async () => {
		const program = Effect.gen(function* () {
			const registry = yield* HandlerRegistry;
			const definition = createTestHandler("myHandler", "my:event");

			yield* registry.register(definition);

			const handler = yield* registry.get("my:event");
			expect(handler).toBeDefined();
			expect(handler).toBe(definition.handler);
		});

		await Effect.runPromise(program.pipe(Effect.provide(HandlerRegistryLive)));
	});

	it("should return undefined for unregistered event", async () => {
		const program = Effect.gen(function* () {
			const registry = yield* HandlerRegistry;

			const handler = yield* registry.get("nonexistent:event");
			expect(handler).toBeUndefined();
		});

		await Effect.runPromise(program.pipe(Effect.provide(HandlerRegistryLive)));
	});

	it("should return correct handler when multiple are registered", async () => {
		const handler1 = (_event: AnyEvent, state: TestState): HandlerResult<TestState> => ({
			state: { ...state, count: 1 },
			events: [],
		});

		const handler2 = (_event: AnyEvent, state: TestState): HandlerResult<TestState> => ({
			state: { ...state, count: 2 },
			events: [],
		});

		const program = Effect.gen(function* () {
			const registry = yield* HandlerRegistry;

			yield* registry.register({ name: "h1", handles: "event:a", handler: handler1 });
			yield* registry.register({ name: "h2", handles: "event:b", handler: handler2 });

			const retrieved1 = yield* registry.get("event:a");
			const retrieved2 = yield* registry.get("event:b");

			expect(retrieved1).toBe(handler1);
			expect(retrieved2).toBe(handler2);
		});

		await Effect.runPromise(program.pipe(Effect.provide(HandlerRegistryLive)));
	});
});

// ============================================================================
// Has Operation Tests
// ============================================================================

describe("HandlerRegistryService.has", () => {
	it("should return true for registered event", async () => {
		const program = Effect.gen(function* () {
			const registry = yield* HandlerRegistry;
			yield* registry.register(createTestHandler("handler", "exists:event"));

			expect(yield* registry.has("exists:event")).toBe(true);
		});

		await Effect.runPromise(program.pipe(Effect.provide(HandlerRegistryLive)));
	});

	it("should return false for unregistered event", async () => {
		const program = Effect.gen(function* () {
			const registry = yield* HandlerRegistry;

			expect(yield* registry.has("missing:event")).toBe(false);
		});

		await Effect.runPromise(program.pipe(Effect.provide(HandlerRegistryLive)));
	});

	it("should work correctly with empty registry", async () => {
		const program = Effect.gen(function* () {
			const registry = yield* HandlerRegistry;

			expect(yield* registry.has("any:event")).toBe(false);
		});

		await Effect.runPromise(program.pipe(Effect.provide(HandlerRegistryLive)));
	});
});

// ============================================================================
// GetAll Operation Tests
// ============================================================================

describe("HandlerRegistryService.getAll", () => {
	it("should return empty array for empty registry", async () => {
		const program = Effect.gen(function* () {
			const registry = yield* HandlerRegistry;

			const all = yield* registry.getAll();
			expect(all).toEqual([]);
		});

		await Effect.runPromise(program.pipe(Effect.provide(HandlerRegistryLive)));
	});

	it("should return all registered handler definitions", async () => {
		const program = Effect.gen(function* () {
			const registry = yield* HandlerRegistry;

			const h1 = createTestHandler("handler1", "event:a");
			const h2 = createTestHandler("handler2", "event:b");
			const h3 = createTestHandler("handler3", "event:c");

			yield* registry.register(h1);
			yield* registry.register(h2);
			yield* registry.register(h3);

			const all = yield* registry.getAll();
			expect(all).toHaveLength(3);

			// Check all definitions are present (order may vary due to Map iteration)
			const names = all.map((d) => d.name);
			expect(names).toContain("handler1");
			expect(names).toContain("handler2");
			expect(names).toContain("handler3");
		});

		await Effect.runPromise(program.pipe(Effect.provide(HandlerRegistryLive)));
	});

	it("should return definitions with complete properties", async () => {
		const program = Effect.gen(function* () {
			const registry = yield* HandlerRegistry;

			const definition = createTestHandler("completeHandler", "complete:event");
			yield* registry.register(definition);

			const all = yield* registry.getAll();
			expect(all).toHaveLength(1);

			const retrieved = all[0];
			expect(retrieved.name).toBe("completeHandler");
			expect(retrieved.handles).toBe("complete:event");
			expect(retrieved.handler).toBe(definition.handler);
		});

		await Effect.runPromise(program.pipe(Effect.provide(HandlerRegistryLive)));
	});
});

// ============================================================================
// Count Operation Tests
// ============================================================================

describe("HandlerRegistryService.count", () => {
	it("should return 0 for empty registry", async () => {
		const program = Effect.gen(function* () {
			const registry = yield* HandlerRegistry;

			expect(yield* registry.count()).toBe(0);
		});

		await Effect.runPromise(program.pipe(Effect.provide(HandlerRegistryLive)));
	});

	it("should return correct count after registrations", async () => {
		const program = Effect.gen(function* () {
			const registry = yield* HandlerRegistry;

			expect(yield* registry.count()).toBe(0);

			yield* registry.register(createTestHandler("h1", "e1"));
			expect(yield* registry.count()).toBe(1);

			yield* registry.register(createTestHandler("h2", "e2"));
			expect(yield* registry.count()).toBe(2);

			yield* registry.register(createTestHandler("h3", "e3"));
			expect(yield* registry.count()).toBe(3);
		});

		await Effect.runPromise(program.pipe(Effect.provide(HandlerRegistryLive)));
	});
});

// ============================================================================
// Layer Integration Tests
// ============================================================================

describe("HandlerRegistryLive Layer", () => {
	it("should provide fresh registry per program run", async () => {
		const registerHandler = Effect.gen(function* () {
			const registry = yield* HandlerRegistry;
			yield* registry.register(createTestHandler("handler", "some:event"));
			return yield* registry.count();
		});

		// Run the same program twice - each should start fresh
		const count1 = await Effect.runPromise(registerHandler.pipe(Effect.provide(HandlerRegistryLive)));
		const count2 = await Effect.runPromise(registerHandler.pipe(Effect.provide(HandlerRegistryLive)));

		expect(count1).toBe(1);
		expect(count2).toBe(1); // Fresh registry, not 2
	});

	it("should work with Effect.provide composition", async () => {
		const program = Effect.gen(function* () {
			const registry = yield* HandlerRegistry;
			yield* registry.register(createTestHandler("handler", "event"));
			return yield* registry.has("event");
		});

		const result = await Effect.runPromise(program.pipe(Effect.provide(HandlerRegistryLive)));

		expect(result).toBe(true);
	});
});

// ============================================================================
// Service Composition Tests
// ============================================================================

describe("HandlerRegistry service composition", () => {
	it("should work in composed Effect.gen", async () => {
		const registerHandlers = Effect.gen(function* () {
			const registry = yield* HandlerRegistry;
			yield* registry.register(createTestHandler("h1", "e1"));
			yield* registry.register(createTestHandler("h2", "e2"));
		});

		const checkHandlers = Effect.gen(function* () {
			const registry = yield* HandlerRegistry;
			return {
				hasE1: yield* registry.has("e1"),
				hasE2: yield* registry.has("e2"),
				count: yield* registry.count(),
			};
		});

		const program = Effect.gen(function* () {
			yield* registerHandlers;
			return yield* checkHandlers;
		});

		const result = await Effect.runPromise(program.pipe(Effect.provide(HandlerRegistryLive)));

		expect(result.hasE1).toBe(true);
		expect(result.hasE2).toBe(true);
		expect(result.count).toBe(2);
	});

	it("should handle error recovery with Effect.catchAll", async () => {
		const program = Effect.gen(function* () {
			const registry = yield* HandlerRegistry;

			// First registration succeeds
			yield* registry.register(createTestHandler("first", "event"));

			// Second registration for same event should fail, but we recover
			const result = yield* Effect.catchAll(registry.register(createTestHandler("second", "event")), (error) =>
				Effect.succeed({
					recovered: true,
					code: error.code,
				}),
			);

			return result;
		});

		const result = await Effect.runPromise(program.pipe(Effect.provide(HandlerRegistryLive)));

		expect(result).toEqual({
			recovered: true,
			code: "DUPLICATE_HANDLER",
		});
	});
});

// ============================================================================
// Handler Execution Tests
// ============================================================================

describe("Retrieved handler execution", () => {
	it("should be able to execute retrieved handler", async () => {
		const testEvent: AnyEvent = {
			id: "test-id" as AnyEvent["id"],
			name: "test:event",
			payload: { value: 42 },
			timestamp: new Date(),
		};

		const initialState: TestState = { count: 0, messages: [] };

		const program = Effect.gen(function* () {
			const registry = yield* HandlerRegistry;

			yield* registry.register(createTestHandler("handler", "test:event"));

			const handler = yield* registry.get("test:event");
			expect(handler).toBeDefined();

			if (handler) {
				const result = handler(testEvent, initialState);
				expect(result.state.count).toBe(1);
				expect(result.events).toEqual([]);
			}
		});

		await Effect.runPromise(program.pipe(Effect.provide(HandlerRegistryLive)));
	});

	it("should work with handlers that emit events", async () => {
		const emittingHandler: HandlerDefinition<AnyEvent, TestState> = {
			name: "emitting",
			handles: "trigger:event",
			handler: (_event, state) => ({
				state: { ...state, messages: [...state.messages, "processed"] },
				events: [
					{
						id: "emitted-id" as AnyEvent["id"],
						name: "response:event",
						payload: { processed: true },
						timestamp: new Date(),
					},
				],
			}),
		};

		const program = Effect.gen(function* () {
			const registry = yield* HandlerRegistry;
			yield* registry.register(emittingHandler);

			const handler = yield* registry.get("trigger:event");
			expect(handler).toBeDefined();

			if (handler) {
				const result = handler(
					{
						id: "trigger-id" as AnyEvent["id"],
						name: "trigger:event",
						payload: {},
						timestamp: new Date(),
					},
					{ count: 0, messages: [] },
				);

				expect(result.state.messages).toContain("processed");
				expect(result.events).toHaveLength(1);
				expect(result.events[0].name).toBe("response:event");
			}
		});

		await Effect.runPromise(program.pipe(Effect.provide(HandlerRegistryLive)));
	});
});
