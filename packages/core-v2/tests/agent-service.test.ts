/**
 * AgentRegistry Service Tests
 *
 * Tests for the AgentRegistry service, including:
 * - Error types and codes
 * - Context.Tag service identifier
 * - Register, get, findMatching operations
 * - Duplicate agent detection
 * - Guard condition (when) evaluation
 * - GetAll and count operations
 * - Layer integration
 */

import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import type { Agent } from "../src/agent/Agent.js";
import {
	AgentRegistry,
	AgentRegistryError,
	type AgentRegistryErrorCode,
	AgentRegistryLive,
} from "../src/agent/AgentService.js";
import { type AnyEvent, createEvent } from "../src/event/Event.js";

// ============================================================================
// Test Helpers
// ============================================================================

interface TestState {
	count: number;
	isActive: boolean;
	currentAgent?: string;
}

const TestOutputSchema = z.object({
	result: z.string(),
});

type TestOutput = z.infer<typeof TestOutputSchema>;

/**
 * Create a test agent.
 * Returns as Agent<unknown, unknown> to work with the generic registry service.
 * In real code, the workflow would have a typed state and all agents would share it.
 */
const createTestAgent = (
	name: string,
	activatesOn: readonly string[],
	when?: (state: TestState) => boolean,
): Agent<unknown, unknown> => ({
	name,
	activatesOn,
	emits: ["agent:completed"],
	outputSchema: TestOutputSchema,
	prompt: (state, _event) => `Process state with count: ${(state as TestState).count}`,
	when: when ? (state: unknown) => when(state as TestState) : undefined,
	onOutput: (output, event) => [
		createEvent("agent:completed", { name, result: (output as TestOutput).result }, event.id),
	],
});

// ============================================================================
// Error Type Tests
// ============================================================================

describe("AgentRegistryError", () => {
	it("should have correct _tag", () => {
		const error = new AgentRegistryError("AGENT_NOT_FOUND", "Not found");
		expect(error._tag).toBe("AgentRegistryError");
	});

	it("should have correct name", () => {
		const error = new AgentRegistryError("DUPLICATE_AGENT", "Duplicate");
		expect(error.name).toBe("AgentRegistryError");
	});

	it("should support all error codes", () => {
		const codes: AgentRegistryErrorCode[] = ["AGENT_NOT_FOUND", "DUPLICATE_AGENT", "REGISTRATION_FAILED"];

		for (const code of codes) {
			const error = new AgentRegistryError(code, `Error: ${code}`);
			expect(error.code).toBe(code);
			expect(error.message).toBe(`Error: ${code}`);
		}
	});

	it("should preserve cause when provided", () => {
		const cause = new Error("Original error");
		const error = new AgentRegistryError("REGISTRATION_FAILED", "Failed", cause);
		expect(error.cause).toBe(cause);
	});

	it("should extend Error", () => {
		const error = new AgentRegistryError("AGENT_NOT_FOUND", "Not found");
		expect(error).toBeInstanceOf(Error);
	});
});

// ============================================================================
// Context.Tag Tests
// ============================================================================

describe("AgentRegistry Context.Tag", () => {
	it("should have correct service identifier", () => {
		expect(AgentRegistry.key).toBe("@core-v2/AgentRegistry");
	});

	it("should be usable in Effect.gen for dependency injection", async () => {
		const program = Effect.gen(function* () {
			const registry = yield* AgentRegistry;
			expect(registry).toBeDefined();
			expect(typeof registry.register).toBe("function");
			expect(typeof registry.get).toBe("function");
			expect(typeof registry.findMatching).toBe("function");
			expect(typeof registry.has).toBe("function");
			expect(typeof registry.getAll).toBe("function");
			expect(typeof registry.count).toBe("function");
			return true;
		});

		const result = await Effect.runPromise(program.pipe(Effect.provide(AgentRegistryLive)));
		expect(result).toBe(true);
	});
});

// ============================================================================
// Register Operation Tests
// ============================================================================

describe("AgentRegistryService.register", () => {
	it("should register an agent successfully", async () => {
		const program = Effect.gen(function* () {
			const registry = yield* AgentRegistry;
			const agent = createTestAgent("testAgent", ["test:event"]);

			yield* registry.register(agent);

			const hasAgent = yield* registry.has("testAgent");
			expect(hasAgent).toBe(true);
		});

		await Effect.runPromise(program.pipe(Effect.provide(AgentRegistryLive)));
	});

	it("should register multiple agents", async () => {
		const program = Effect.gen(function* () {
			const registry = yield* AgentRegistry;

			yield* registry.register(createTestAgent("agent1", ["event:one"]));
			yield* registry.register(createTestAgent("agent2", ["event:two"]));
			yield* registry.register(createTestAgent("agent3", ["event:three"]));

			expect(yield* registry.has("agent1")).toBe(true);
			expect(yield* registry.has("agent2")).toBe(true);
			expect(yield* registry.has("agent3")).toBe(true);
			expect(yield* registry.count()).toBe(3);
		});

		await Effect.runPromise(program.pipe(Effect.provide(AgentRegistryLive)));
	});

	it("should fail when registering duplicate agent name", async () => {
		const program = Effect.gen(function* () {
			const registry = yield* AgentRegistry;

			yield* registry.register(createTestAgent("duplicateName", ["event:a"]));

			// Try to register another agent with the same name
			const result = yield* Effect.either(registry.register(createTestAgent("duplicateName", ["event:b"])));

			expect(result._tag).toBe("Left");
			if (result._tag === "Left") {
				const error = result.left;
				expect(error).toBeInstanceOf(AgentRegistryError);
				expect(error.code).toBe("DUPLICATE_AGENT");
				expect(error.message).toContain("duplicateName");
			}
		});

		await Effect.runPromise(program.pipe(Effect.provide(AgentRegistryLive)));
	});
});

// ============================================================================
// Get Operation Tests
// ============================================================================

describe("AgentRegistryService.get", () => {
	it("should return agent for registered name", async () => {
		const program = Effect.gen(function* () {
			const registry = yield* AgentRegistry;
			const agent = createTestAgent("myAgent", ["my:event"]);

			yield* registry.register(agent);

			const retrieved = yield* registry.get("myAgent");
			expect(retrieved).toBeDefined();
			expect(retrieved?.name).toBe("myAgent");
			expect(retrieved?.activatesOn).toEqual(["my:event"]);
		});

		await Effect.runPromise(program.pipe(Effect.provide(AgentRegistryLive)));
	});

	it("should return undefined for unregistered name", async () => {
		const program = Effect.gen(function* () {
			const registry = yield* AgentRegistry;

			const agent = yield* registry.get("nonexistent");
			expect(agent).toBeUndefined();
		});

		await Effect.runPromise(program.pipe(Effect.provide(AgentRegistryLive)));
	});

	it("should return correct agent when multiple are registered", async () => {
		const agent1 = createTestAgent("a1", ["e1"]);
		const agent2 = createTestAgent("a2", ["e2"]);

		const program = Effect.gen(function* () {
			const registry = yield* AgentRegistry;

			yield* registry.register(agent1);
			yield* registry.register(agent2);

			const retrieved1 = yield* registry.get("a1");
			const retrieved2 = yield* registry.get("a2");

			expect(retrieved1?.name).toBe("a1");
			expect(retrieved1?.activatesOn).toEqual(["e1"]);
			expect(retrieved2?.name).toBe("a2");
			expect(retrieved2?.activatesOn).toEqual(["e2"]);
		});

		await Effect.runPromise(program.pipe(Effect.provide(AgentRegistryLive)));
	});
});

// ============================================================================
// FindMatching Operation Tests
// ============================================================================

describe("AgentRegistryService.findMatching", () => {
	it("should return agents that listen for the event", async () => {
		const program = Effect.gen(function* () {
			const registry = yield* AgentRegistry;

			yield* registry.register(createTestAgent("listener", ["target:event"]));
			yield* registry.register(createTestAgent("other", ["other:event"]));

			const state: TestState = { count: 0, isActive: true };
			const matching = yield* registry.findMatching("target:event", state);

			expect(matching).toHaveLength(1);
			expect(matching[0]?.name).toBe("listener");
		});

		await Effect.runPromise(program.pipe(Effect.provide(AgentRegistryLive)));
	});

	it("should return multiple matching agents", async () => {
		const program = Effect.gen(function* () {
			const registry = yield* AgentRegistry;

			yield* registry.register(createTestAgent("agent1", ["shared:event", "other:event"]));
			yield* registry.register(createTestAgent("agent2", ["shared:event"]));
			yield* registry.register(createTestAgent("agent3", ["different:event"]));

			const state: TestState = { count: 0, isActive: true };
			const matching = yield* registry.findMatching("shared:event", state);

			expect(matching).toHaveLength(2);
			const names = matching.map((a) => a.name);
			expect(names).toContain("agent1");
			expect(names).toContain("agent2");
		});

		await Effect.runPromise(program.pipe(Effect.provide(AgentRegistryLive)));
	});

	it("should return empty array when no agents match", async () => {
		const program = Effect.gen(function* () {
			const registry = yield* AgentRegistry;

			yield* registry.register(createTestAgent("agent", ["some:event"]));

			const state: TestState = { count: 0, isActive: true };
			const matching = yield* registry.findMatching("nonexistent:event", state);

			expect(matching).toEqual([]);
		});

		await Effect.runPromise(program.pipe(Effect.provide(AgentRegistryLive)));
	});

	it("should respect when guard conditions", async () => {
		const program = Effect.gen(function* () {
			const registry = yield* AgentRegistry;

			// Agent with guard that checks isActive
			yield* registry.register(createTestAgent("guardedAgent", ["test:event"], (state) => state.isActive));

			// Agent without guard
			yield* registry.register(createTestAgent("unguardedAgent", ["test:event"]));

			// With isActive=true, both should match
			const activeState: TestState = { count: 0, isActive: true };
			const activeMatching = yield* registry.findMatching("test:event", activeState);
			expect(activeMatching).toHaveLength(2);

			// With isActive=false, only unguarded should match
			const inactiveState: TestState = { count: 0, isActive: false };
			const inactiveMatching = yield* registry.findMatching("test:event", inactiveState);
			expect(inactiveMatching).toHaveLength(1);
			expect(inactiveMatching[0]?.name).toBe("unguardedAgent");
		});

		await Effect.runPromise(program.pipe(Effect.provide(AgentRegistryLive)));
	});

	it("should evaluate guard with current state", async () => {
		const program = Effect.gen(function* () {
			const registry = yield* AgentRegistry;

			// Agent that only activates when count > 5
			yield* registry.register(createTestAgent("countAgent", ["test:event"], (state) => state.count > 5));

			const lowState: TestState = { count: 3, isActive: true };
			const lowMatching = yield* registry.findMatching("test:event", lowState);
			expect(lowMatching).toHaveLength(0);

			const highState: TestState = { count: 10, isActive: true };
			const highMatching = yield* registry.findMatching("test:event", highState);
			expect(highMatching).toHaveLength(1);
		});

		await Effect.runPromise(program.pipe(Effect.provide(AgentRegistryLive)));
	});

	it("should handle agents listening to multiple events", async () => {
		const program = Effect.gen(function* () {
			const registry = yield* AgentRegistry;

			yield* registry.register(createTestAgent("multiListener", ["event:a", "event:b", "event:c"]));

			const state: TestState = { count: 0, isActive: true };

			const matchA = yield* registry.findMatching("event:a", state);
			const matchB = yield* registry.findMatching("event:b", state);
			const matchC = yield* registry.findMatching("event:c", state);
			const matchD = yield* registry.findMatching("event:d", state);

			expect(matchA).toHaveLength(1);
			expect(matchB).toHaveLength(1);
			expect(matchC).toHaveLength(1);
			expect(matchD).toHaveLength(0);
		});

		await Effect.runPromise(program.pipe(Effect.provide(AgentRegistryLive)));
	});
});

// ============================================================================
// Has Operation Tests
// ============================================================================

describe("AgentRegistryService.has", () => {
	it("should return true for registered agent", async () => {
		const program = Effect.gen(function* () {
			const registry = yield* AgentRegistry;
			yield* registry.register(createTestAgent("existingAgent", ["some:event"]));

			expect(yield* registry.has("existingAgent")).toBe(true);
		});

		await Effect.runPromise(program.pipe(Effect.provide(AgentRegistryLive)));
	});

	it("should return false for unregistered agent", async () => {
		const program = Effect.gen(function* () {
			const registry = yield* AgentRegistry;

			expect(yield* registry.has("missingAgent")).toBe(false);
		});

		await Effect.runPromise(program.pipe(Effect.provide(AgentRegistryLive)));
	});

	it("should work correctly with empty registry", async () => {
		const program = Effect.gen(function* () {
			const registry = yield* AgentRegistry;

			expect(yield* registry.has("anyAgent")).toBe(false);
		});

		await Effect.runPromise(program.pipe(Effect.provide(AgentRegistryLive)));
	});
});

// ============================================================================
// GetAll Operation Tests
// ============================================================================

describe("AgentRegistryService.getAll", () => {
	it("should return empty array for empty registry", async () => {
		const program = Effect.gen(function* () {
			const registry = yield* AgentRegistry;

			const all = yield* registry.getAll();
			expect(all).toEqual([]);
		});

		await Effect.runPromise(program.pipe(Effect.provide(AgentRegistryLive)));
	});

	it("should return all registered agents", async () => {
		const program = Effect.gen(function* () {
			const registry = yield* AgentRegistry;

			yield* registry.register(createTestAgent("agent1", ["e1"]));
			yield* registry.register(createTestAgent("agent2", ["e2"]));
			yield* registry.register(createTestAgent("agent3", ["e3"]));

			const all = yield* registry.getAll();
			expect(all).toHaveLength(3);

			const names = all.map((a) => a.name);
			expect(names).toContain("agent1");
			expect(names).toContain("agent2");
			expect(names).toContain("agent3");
		});

		await Effect.runPromise(program.pipe(Effect.provide(AgentRegistryLive)));
	});

	it("should return agents with complete properties", async () => {
		const program = Effect.gen(function* () {
			const registry = yield* AgentRegistry;

			const agent = createTestAgent("completeAgent", ["complete:event"]);
			yield* registry.register(agent);

			const all = yield* registry.getAll();
			expect(all).toHaveLength(1);

			const retrieved = all[0];
			expect(retrieved).toBeDefined();
			expect(retrieved?.name).toBe("completeAgent");
			expect(retrieved?.activatesOn).toEqual(["complete:event"]);
			expect(retrieved?.emits).toEqual(["agent:completed"]);
			expect(retrieved?.outputSchema).toBe(TestOutputSchema);
			expect(typeof retrieved?.prompt).toBe("function");
			expect(typeof retrieved?.onOutput).toBe("function");
		});

		await Effect.runPromise(program.pipe(Effect.provide(AgentRegistryLive)));
	});
});

// ============================================================================
// Count Operation Tests
// ============================================================================

describe("AgentRegistryService.count", () => {
	it("should return 0 for empty registry", async () => {
		const program = Effect.gen(function* () {
			const registry = yield* AgentRegistry;

			expect(yield* registry.count()).toBe(0);
		});

		await Effect.runPromise(program.pipe(Effect.provide(AgentRegistryLive)));
	});

	it("should return correct count after registrations", async () => {
		const program = Effect.gen(function* () {
			const registry = yield* AgentRegistry;

			expect(yield* registry.count()).toBe(0);

			yield* registry.register(createTestAgent("a1", ["e1"]));
			expect(yield* registry.count()).toBe(1);

			yield* registry.register(createTestAgent("a2", ["e2"]));
			expect(yield* registry.count()).toBe(2);

			yield* registry.register(createTestAgent("a3", ["e3"]));
			expect(yield* registry.count()).toBe(3);
		});

		await Effect.runPromise(program.pipe(Effect.provide(AgentRegistryLive)));
	});
});

// ============================================================================
// Layer Integration Tests
// ============================================================================

describe("AgentRegistryLive Layer", () => {
	it("should provide fresh registry per program run", async () => {
		const registerAgent = Effect.gen(function* () {
			const registry = yield* AgentRegistry;
			yield* registry.register(createTestAgent("agent", ["event"]));
			return yield* registry.count();
		});

		// Run the same program twice - each should start fresh
		const count1 = await Effect.runPromise(registerAgent.pipe(Effect.provide(AgentRegistryLive)));
		const count2 = await Effect.runPromise(registerAgent.pipe(Effect.provide(AgentRegistryLive)));

		expect(count1).toBe(1);
		expect(count2).toBe(1); // Fresh registry, not 2
	});

	it("should work with Effect.provide composition", async () => {
		const program = Effect.gen(function* () {
			const registry = yield* AgentRegistry;
			yield* registry.register(createTestAgent("agent", ["event"]));
			return yield* registry.has("agent");
		});

		const result = await Effect.runPromise(program.pipe(Effect.provide(AgentRegistryLive)));

		expect(result).toBe(true);
	});
});

// ============================================================================
// Service Composition Tests
// ============================================================================

describe("AgentRegistry service composition", () => {
	it("should work in composed Effect.gen", async () => {
		const registerAgents = Effect.gen(function* () {
			const registry = yield* AgentRegistry;
			yield* registry.register(createTestAgent("a1", ["e1"]));
			yield* registry.register(createTestAgent("a2", ["e2"]));
		});

		const checkAgents = Effect.gen(function* () {
			const registry = yield* AgentRegistry;
			return {
				hasA1: yield* registry.has("a1"),
				hasA2: yield* registry.has("a2"),
				count: yield* registry.count(),
			};
		});

		const program = Effect.gen(function* () {
			yield* registerAgents;
			return yield* checkAgents;
		});

		const result = await Effect.runPromise(program.pipe(Effect.provide(AgentRegistryLive)));

		expect(result.hasA1).toBe(true);
		expect(result.hasA2).toBe(true);
		expect(result.count).toBe(2);
	});

	it("should handle error recovery with Effect.catchAll", async () => {
		const program = Effect.gen(function* () {
			const registry = yield* AgentRegistry;

			// First registration succeeds
			yield* registry.register(createTestAgent("first", ["event"]));

			// Second registration for same name should fail, but we recover
			const result = yield* Effect.catchAll(registry.register(createTestAgent("first", ["other"])), (error) =>
				Effect.succeed({
					recovered: true,
					code: error.code,
				}),
			);

			return result;
		});

		const result = await Effect.runPromise(program.pipe(Effect.provide(AgentRegistryLive)));

		expect(result).toEqual({
			recovered: true,
			code: "DUPLICATE_AGENT",
		});
	});
});

// ============================================================================
// Agent Prompt and Output Tests
// ============================================================================

describe("Retrieved agent behavior", () => {
	it("should be able to call prompt on retrieved agent", async () => {
		const program = Effect.gen(function* () {
			const registry = yield* AgentRegistry;

			yield* registry.register(createTestAgent("promptAgent", ["prompt:event"]));

			const agent = yield* registry.get("promptAgent");
			expect(agent).toBeDefined();

			if (agent) {
				const state: TestState = { count: 42, isActive: true };
				const event: AnyEvent = {
					id: "test-id" as AnyEvent["id"],
					name: "prompt:event",
					payload: {},
					timestamp: new Date(),
				};

				const prompt = agent.prompt(state, event);
				expect(prompt).toBe("Process state with count: 42");
			}
		});

		await Effect.runPromise(program.pipe(Effect.provide(AgentRegistryLive)));
	});

	it("should be able to call onOutput on retrieved agent", async () => {
		const program = Effect.gen(function* () {
			const registry = yield* AgentRegistry;

			yield* registry.register(createTestAgent("outputAgent", ["output:event"]));

			const agent = yield* registry.get("outputAgent");
			expect(agent).toBeDefined();

			if (agent) {
				const triggerEvent: AnyEvent = {
					id: "trigger-id" as AnyEvent["id"],
					name: "output:event",
					payload: {},
					timestamp: new Date(),
				};

				const output: TestOutput = { result: "success" };
				const events = agent.onOutput(output, triggerEvent);

				expect(events).toHaveLength(1);
				expect(events[0]?.name).toBe("agent:completed");
				expect(events[0]?.payload).toEqual({ name: "outputAgent", result: "success" });
				expect(events[0]?.causedBy).toBe("trigger-id");
			}
		});

		await Effect.runPromise(program.pipe(Effect.provide(AgentRegistryLive)));
	});
});

// ============================================================================
// Complex Guard Scenarios
// ============================================================================

describe("Complex guard scenarios", () => {
	it("should handle guards that check currentAgent", async () => {
		const program = Effect.gen(function* () {
			const registry = yield* AgentRegistry;

			// Agent that only activates when no other agent is active
			yield* registry.register(createTestAgent("exclusiveAgent", ["task:start"], (state) => !state.currentAgent));

			// Agent that activates regardless of currentAgent
			yield* registry.register(createTestAgent("anyTimeAgent", ["task:start"]));

			const freeState: TestState = { count: 0, isActive: true, currentAgent: undefined };
			const freeMatching = yield* registry.findMatching("task:start", freeState);
			expect(freeMatching).toHaveLength(2);

			const busyState: TestState = { count: 0, isActive: true, currentAgent: "otherAgent" };
			const busyMatching = yield* registry.findMatching("task:start", busyState);
			expect(busyMatching).toHaveLength(1);
			expect(busyMatching[0]?.name).toBe("anyTimeAgent");
		});

		await Effect.runPromise(program.pipe(Effect.provide(AgentRegistryLive)));
	});

	it("should handle multiple guards correctly", async () => {
		const program = Effect.gen(function* () {
			const registry = yield* AgentRegistry;

			// Agent with AND condition: isActive AND count > 0
			yield* registry.register(
				createTestAgent("strictAgent", ["test:event"], (state) => state.isActive && state.count > 0),
			);

			const state1: TestState = { count: 0, isActive: true };
			const state2: TestState = { count: 5, isActive: false };
			const state3: TestState = { count: 5, isActive: true };

			const match1 = yield* registry.findMatching("test:event", state1);
			const match2 = yield* registry.findMatching("test:event", state2);
			const match3 = yield* registry.findMatching("test:event", state3);

			expect(match1).toHaveLength(0); // count is 0
			expect(match2).toHaveLength(0); // not active
			expect(match3).toHaveLength(1); // both conditions met
		});

		await Effect.runPromise(program.pipe(Effect.provide(AgentRegistryLive)));
	});
});
