/**
 * Public API Audit Tests
 *
 * These tests verify that the public API exports NO Effect types.
 * Per spec FR-062, consumers should never see Context, Effect, Layer,
 * Stream, Exit, Cause, or Fiber types.
 */
import { describe, expect, it } from "vitest";
import * as PublicAPI from "../src/index.js";

describe("Public API Audit (FR-062)", () => {
	describe("No Effect types exposed", () => {
		it("should not export Context", () => {
			expect("Context" in PublicAPI).toBe(false);
		});

		it("should not export Effect", () => {
			expect("Effect" in PublicAPI).toBe(false);
		});

		it("should not export Layer", () => {
			expect("Layer" in PublicAPI).toBe(false);
		});

		it("should not export Stream", () => {
			expect("Stream" in PublicAPI).toBe(false);
		});

		it("should not export Exit", () => {
			expect("Exit" in PublicAPI).toBe(false);
		});

		it("should not export Cause", () => {
			expect("Cause" in PublicAPI).toBe(false);
		});

		it("should not export Fiber", () => {
			expect("Fiber" in PublicAPI).toBe(false);
		});

		it("should not export Schema", () => {
			expect("Schema" in PublicAPI).toBe(false);
		});

		it("should not export Ref", () => {
			expect("Ref" in PublicAPI).toBe(false);
		});

		it("should not export Queue", () => {
			expect("Queue" in PublicAPI).toBe(false);
		});
	});

	describe("Event module exports", () => {
		it("should export createEvent factory", () => {
			expect(PublicAPI.createEvent).toBeTypeOf("function");
		});

		it("should export defineEvent factory", () => {
			expect(PublicAPI.defineEvent).toBeTypeOf("function");
		});

		it("should export EventBusError class", () => {
			expect(PublicAPI.EventBusError).toBeTypeOf("function");
		});

		it("should export pattern filter utilities", () => {
			expect(PublicAPI.createPatternFilter).toBeTypeOf("function");
			expect(PublicAPI.createMultiPatternFilter).toBeTypeOf("function");
		});

		it("should export subscription ID utilities", () => {
			expect(PublicAPI.makeSubscriptionId).toBeTypeOf("function");
			expect(PublicAPI.generateSubscriptionId).toBeTypeOf("function");
		});
	});

	describe("Handler module exports", () => {
		it("should export defineHandler factory", () => {
			expect(PublicAPI.defineHandler).toBeTypeOf("function");
		});

		it("should export handler utilities", () => {
			expect(PublicAPI.stateOnly).toBeTypeOf("function");
			expect(PublicAPI.emit).toBeTypeOf("function");
			expect(PublicAPI.emitEvent).toBeTypeOf("function");
		});

		it("should export HandlerRegistryError class", () => {
			expect(PublicAPI.HandlerRegistryError).toBeTypeOf("function");
		});
	});

	describe("Agent module exports", () => {
		it("should export agent factory", () => {
			expect(PublicAPI.agent).toBeTypeOf("function");
		});

		it("should export agent utilities", () => {
			expect(PublicAPI.shouldActivate).toBeTypeOf("function");
			expect(PublicAPI.findMatchingAgents).toBeTypeOf("function");
			expect(PublicAPI.createAgentRegistry).toBeTypeOf("function");
		});

		it("should export MissingOutputSchemaError class", () => {
			expect(PublicAPI.MissingOutputSchemaError).toBeTypeOf("function");
		});

		it("should export AgentRegistryError class", () => {
			expect(PublicAPI.AgentRegistryError).toBeTypeOf("function");
		});
	});

	describe("Workflow module exports", () => {
		it("should export createWorkflow factory", () => {
			expect(PublicAPI.createWorkflow).toBeTypeOf("function");
		});

		it("should export WorkflowRuntimeError class", () => {
			expect(PublicAPI.WorkflowRuntimeError).toBeTypeOf("function");
		});
	});

	describe("Tape module exports", () => {
		it("should export createTape factory", () => {
			expect(PublicAPI.createTape).toBeTypeOf("function");
		});

		it("should export createTapeFromDefinitions factory", () => {
			expect(PublicAPI.createTapeFromDefinitions).toBeTypeOf("function");
		});

		it("should export computeState utility", () => {
			expect(PublicAPI.computeState).toBeTypeOf("function");
		});
	});

	describe("Store module exports", () => {
		it("should export createMemoryStore factory", () => {
			expect(PublicAPI.createMemoryStore).toBeTypeOf("function");
		});

		it("should export createSqliteStore factory", () => {
			expect(PublicAPI.createSqliteStore).toBeTypeOf("function");
		});

		// Note: Layer exports (MemoryStoreLive, SqliteStoreMemoryLive, makeSqliteStoreLive)
		// are NOT part of the public API as they expose Effect types.
		// Use createMemoryStore() and createSqliteStore() instead.

		it("should export session ID utilities", () => {
			expect(PublicAPI.makeSessionId).toBeTypeOf("function");
			expect(PublicAPI.generateSessionId).toBeTypeOf("function");
		});

		it("should export StoreError class", () => {
			expect(PublicAPI.StoreError).toBeTypeOf("function");
		});
	});

	describe("Provider module exports", () => {
		it("should export ProviderError class", () => {
			expect(PublicAPI.ProviderError).toBeTypeOf("function");
		});
	});

	describe("Renderer module exports", () => {
		it("should export createRenderer factory", () => {
			expect(PublicAPI.createRenderer).toBeTypeOf("function");
		});

		it("should export createRendererRegistry factory", () => {
			expect(PublicAPI.createRendererRegistry).toBeTypeOf("function");
		});

		it("should export pattern matching utilities", () => {
			expect(PublicAPI.matchesPattern).toBeTypeOf("function");
			expect(PublicAPI.matchesAnyPattern).toBeTypeOf("function");
			expect(PublicAPI.findMatchingPatterns).toBeTypeOf("function");
		});

		it("should export rendering utilities", () => {
			expect(PublicAPI.renderEvent).toBeTypeOf("function");
			expect(PublicAPI.renderEventAsync).toBeTypeOf("function");
		});
	});

	describe("Consumer usage patterns", () => {
		it("should allow creating events without Effect knowledge", () => {
			const event = PublicAPI.createEvent("test:event", { data: "hello" });
			expect(event.name).toBe("test:event");
			expect(event.payload).toEqual({ data: "hello" });
			expect(event.id).toBeDefined();
			expect(event.timestamp).toBeInstanceOf(Date);
		});

		it("should allow defining events with type parameters", () => {
			// defineEvent uses TypeScript generics for type safety
			interface TestPayload {
				message: string;
				count: number;
			}
			const TestEvent = PublicAPI.defineEvent<"test:typed", TestPayload>("test:typed");

			const event = TestEvent.create({ message: "hello", count: 42 });
			expect(event.name).toBe("test:typed");
			expect(event.payload.message).toBe("hello");
			expect(event.payload.count).toBe(42);
			expect(TestEvent.is(event)).toBe(true);
		});

		it("should allow creating handlers with utility functions", () => {
			interface TestState {
				count: number;
			}

			interface CounterPayload {
				amount: number;
			}

			const CounterEvent = PublicAPI.defineEvent<"counter:increment", CounterPayload>("counter:increment");

			const handler = PublicAPI.defineHandler(CounterEvent, {
				name: "counter-handler", // name is required per DefineHandlerOptions
				handler: (event, state: TestState) => PublicAPI.stateOnly({ count: state.count + event.payload.amount }),
			});

			expect(handler.name).toBe("counter-handler");
			expect(handler.handles).toBe("counter:increment");

			const result = handler.handler(CounterEvent.create({ amount: 5 }), { count: 10 });
			expect(result.state.count).toBe(15);
			expect(result.events).toHaveLength(0);
		});

		it("should allow creating agents with outputSchema", async () => {
			const { z } = await import("zod");

			const outputSchema = z.object({ response: z.string() });
			type OutputType = { response: string };

			const testAgent = PublicAPI.agent<{ messages: string[] }, OutputType>({
				name: "test-agent",
				activatesOn: ["user:input"],
				emits: ["agent:response"],
				outputSchema,
				prompt: () => "Test prompt",
				// onOutput MUST return full Event objects (with id, timestamp) via createEvent
				onOutput: (output, event) => [PublicAPI.createEvent("agent:response", { text: output.response }, event.id)],
			});

			expect(testAgent.name).toBe("test-agent");
			expect(testAgent.activatesOn).toContain("user:input");
			expect(testAgent.emits).toContain("agent:response");
			expect(testAgent.outputSchema).toBeDefined();
		});

		it("should throw MissingOutputSchemaError when outputSchema is missing", async () => {
			const { z } = await import("zod");

			expect(() =>
				PublicAPI.agent({
					name: "bad-agent",
					activatesOn: ["user:input"],
					emits: ["agent:response"],
					outputSchema: undefined as unknown as typeof z.ZodObject,
					prompt: () => "Test prompt",
					onOutput: () => [],
				}),
			).toThrow(PublicAPI.MissingOutputSchemaError);
		});

		it("should allow creating memory store (Promise-based)", async () => {
			// Public API returns Promise<PublicStore> - no Effect types exposed
			const store = await PublicAPI.createMemoryStore();
			expect(store).toBeDefined();
			expect(store.append).toBeTypeOf("function");
			expect(store.events).toBeTypeOf("function");
			expect(store.sessions).toBeTypeOf("function");
			expect(store.clear).toBeTypeOf("function");

			// Verify it works
			const sessionId = PublicAPI.generateSessionId();
			await store.append(sessionId, PublicAPI.createEvent("test:event", { data: 1 }));
			const events = await store.events(sessionId);
			expect(events).toHaveLength(1);
		});

		it("should allow creating sqlite store (Promise-based)", async () => {
			// Public API returns Promise<PublicStore> - no Effect types exposed
			const store = await PublicAPI.createSqliteStore({ path: ":memory:" });
			expect(store).toBeDefined();
			expect(store.append).toBeTypeOf("function");
			expect(store.events).toBeTypeOf("function");
			expect(store.sessions).toBeTypeOf("function");
			expect(store.clear).toBeTypeOf("function");

			// Verify it works
			const sessionId = PublicAPI.generateSessionId();
			await store.append(sessionId, PublicAPI.createEvent("test:event", { data: 2 }));
			const events = await store.events(sessionId);
			expect(events).toHaveLength(1);
		});

		it("should allow creating renderers with pattern matching", () => {
			const outputs: string[] = [];
			const renderer = PublicAPI.createRenderer({
				name: "test-renderer",
				renderers: {
					"text:*": (event) => outputs.push(`text: ${event.name}`),
					"error:*": (event) => outputs.push(`error: ${event.name}`),
					"*": (event) => outputs.push(`other: ${event.name}`),
				},
			});

			expect(renderer.name).toBe("test-renderer");
			expect(renderer.patterns).toContain("text:*");
			expect(renderer.patterns).toContain("error:*");
			expect(renderer.patterns).toContain("*");
		});

		it("should allow creating tape from events", () => {
			interface TestState {
				count: number;
			}

			const events = [
				PublicAPI.createEvent("event:a", { value: 1 }),
				PublicAPI.createEvent("event:b", { value: 2 }),
				PublicAPI.createEvent("event:c", { value: 3 }),
			];

			const handlers = new Map<
				string,
				(event: PublicAPI.AnyEvent, state: TestState) => PublicAPI.HandlerResult<TestState>
			>([
				[
					"event:a",
					(_event, state) => ({
						state: { count: state.count + 1 },
						events: [],
					}),
				],
				[
					"event:b",
					(_event, state) => ({
						state: { count: state.count + 2 },
						events: [],
					}),
				],
				[
					"event:c",
					(_event, state) => ({
						state: { count: state.count + 3 },
						events: [],
					}),
				],
			]);

			const tape = PublicAPI.createTape({
				events,
				handlers,
				initialState: { count: 0 },
			});

			expect(tape.position).toBe(0);
			expect(tape.length).toBe(3);
			expect(tape.state).toEqual({ count: 1 }); // After first event

			const t1 = tape.step();
			expect(t1.position).toBe(1);
			expect(t1.state).toEqual({ count: 3 }); // After first two events

			const t0 = t1.stepBack();
			expect(t0.position).toBe(0);
			expect(t0.state).toEqual({ count: 1 }); // Back to first event
		});
	});
});
