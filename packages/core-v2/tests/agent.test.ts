/**
 * Agent Module Tests
 *
 * Tests for Agent types, factories, and utilities.
 * Verifies that agents can be created, validated, and matched to events.
 */

import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
	type Agent,
	type AgentRegistry,
	agent,
	createAgentRegistry,
	findMatchingAgents,
	MissingOutputSchemaError,
	type PromptPart,
	shouldActivate,
} from "../src/agent/index.js";
import { type AnyEvent, createEvent } from "../src/event/index.js";

// ============================================================================
// Test Fixtures
// ============================================================================

// Sample workflow state type
interface TestState {
	goal: string;
	completedTasks: string[];
	activeAgent?: string;
}

// Sample Zod output schemas
const PlannerOutput = z.object({
	tasks: z.array(
		z.object({
			id: z.string(),
			title: z.string(),
		}),
	),
});

const ReviewerOutput = z.object({
	approved: z.boolean(),
	feedback: z.string(),
});

// Helper to create test events
function createTestEvent(name: string, payload: unknown = {}): AnyEvent {
	return createEvent(name, payload);
}

// ============================================================================
// Agent Interface Tests
// ============================================================================

describe("Agent Interface", () => {
	it("defines an agent with all required properties", () => {
		const plannerAgent: Agent<TestState, z.infer<typeof PlannerOutput>> = {
			name: "planner",
			activatesOn: ["workflow:start"],
			emits: ["plan:created", "agent:completed"],
			outputSchema: PlannerOutput,
			prompt: (state) => `Create tasks for: ${state.goal}`,
			onOutput: (output, event) => [createEvent("plan:created", { tasks: output.tasks }, event.id)],
		};

		expect(plannerAgent.name).toBe("planner");
		expect(plannerAgent.activatesOn).toEqual(["workflow:start"]);
		expect(plannerAgent.emits).toEqual(["plan:created", "agent:completed"]);
		expect(plannerAgent.outputSchema).toBe(PlannerOutput);
		expect(typeof plannerAgent.prompt).toBe("function");
		expect(typeof plannerAgent.onOutput).toBe("function");
	});

	it("supports optional model override", () => {
		const agentDef: Agent<TestState, z.infer<typeof PlannerOutput>> = {
			name: "fast-planner",
			activatesOn: ["workflow:start"],
			emits: ["plan:created"],
			model: "claude-3-haiku-20240307",
			outputSchema: PlannerOutput,
			prompt: () => "Quick plan",
			onOutput: () => [],
		};

		expect(agentDef.model).toBe("claude-3-haiku-20240307");
	});

	it("supports optional when guard condition", () => {
		const agentDef: Agent<TestState, z.infer<typeof ReviewerOutput>> = {
			name: "reviewer",
			activatesOn: ["plan:created"],
			emits: ["review:complete"],
			outputSchema: ReviewerOutput,
			prompt: () => "Review this plan",
			when: (state) => state.activeAgent === undefined,
			onOutput: () => [],
		};

		expect(typeof agentDef.when).toBe("function");
		expect(agentDef.when?.({ goal: "", completedTasks: [], activeAgent: undefined })).toBe(true);
		expect(agentDef.when?.({ goal: "", completedTasks: [], activeAgent: "other" })).toBe(false);
	});
});

// ============================================================================
// PromptTemplate Tests
// ============================================================================

describe("PromptTemplate", () => {
	it("supports string prompts", () => {
		const agentDef: Agent<TestState, z.infer<typeof PlannerOutput>> = {
			name: "simple",
			activatesOn: ["start"],
			emits: [],
			outputSchema: PlannerOutput,
			prompt: () => "Simple string prompt",
			onOutput: () => [],
		};

		const result = agentDef.prompt({ goal: "", completedTasks: [] }, createTestEvent("start"));
		expect(result).toBe("Simple string prompt");
	});

	it("supports template part arrays", () => {
		const parts: readonly PromptPart[] = [
			{ type: "text", content: "Create a plan for: " },
			{ type: "variable", content: "goal" },
			{ type: "text", content: "\nCompleted: " },
			{ type: "variable", content: "completedCount" },
		];

		const agentDef: Agent<TestState, z.infer<typeof PlannerOutput>> = {
			name: "templated",
			activatesOn: ["start"],
			emits: [],
			outputSchema: PlannerOutput,
			prompt: () => parts,
			onOutput: () => [],
		};

		const result = agentDef.prompt({ goal: "Build app", completedTasks: [] }, createTestEvent("start"));
		expect(Array.isArray(result)).toBe(true);
		expect(result).toHaveLength(4);
	});

	it("prompt function receives state and event", () => {
		let capturedState: TestState | undefined;
		let capturedEvent: AnyEvent | undefined;

		const agentDef: Agent<TestState, z.infer<typeof PlannerOutput>> = {
			name: "inspector",
			activatesOn: ["inspect"],
			emits: [],
			outputSchema: PlannerOutput,
			prompt: (state, event) => {
				capturedState = state;
				capturedEvent = event;
				return `Goal: ${state.goal}, Event: ${event.name}`;
			},
			onOutput: () => [],
		};

		const state: TestState = { goal: "Test goal", completedTasks: ["task1"] };
		const event = createTestEvent("inspect", { detail: "test" });

		const result = agentDef.prompt(state, event);

		expect(capturedState).toBe(state);
		expect(capturedEvent).toBe(event);
		expect(result).toBe("Goal: Test goal, Event: inspect");
	});
});

// ============================================================================
// agent() Factory Tests
// ============================================================================

describe("agent() factory", () => {
	it("creates a valid agent from options", () => {
		const planner = agent<TestState, z.infer<typeof PlannerOutput>>({
			name: "planner",
			activatesOn: ["workflow:start"],
			emits: ["plan:created"],
			outputSchema: PlannerOutput,
			prompt: (state) => `Plan for: ${state.goal}`,
			onOutput: (output, event) => [createEvent("plan:created", { tasks: output.tasks }, event.id)],
		});

		expect(planner.name).toBe("planner");
		expect(planner.activatesOn).toEqual(["workflow:start"]);
		expect(planner.emits).toEqual(["plan:created"]);
		expect(planner.outputSchema).toBe(PlannerOutput);
	});

	it("throws MissingOutputSchemaError when outputSchema is undefined", () => {
		expect(() =>
			agent<TestState>({
				name: "broken-agent",
				activatesOn: ["start"],
				emits: [],
				outputSchema: undefined,
				prompt: () => "test",
				onOutput: () => [],
			}),
		).toThrow(MissingOutputSchemaError);
	});

	it("throws MissingOutputSchemaError when outputSchema is null", () => {
		expect(() =>
			agent<TestState>({
				name: "null-schema-agent",
				activatesOn: ["start"],
				emits: [],
				outputSchema: null,
				prompt: () => "test",
				onOutput: () => [],
			}),
		).toThrow(MissingOutputSchemaError);
	});

	it("error message includes agent name and explanation", () => {
		try {
			agent<TestState>({
				name: "my-broken-agent",
				activatesOn: ["start"],
				emits: [],
				outputSchema: undefined,
				prompt: () => "test",
				onOutput: () => [],
			});
			expect.fail("Should have thrown");
		} catch (error) {
			expect(error).toBeInstanceOf(MissingOutputSchemaError);
			expect((error as Error).message).toContain("my-broken-agent");
			expect((error as Error).message).toContain("reliable workflow state");
			expect((error as Error).message).toContain("Zod schema");
		}
	});

	it("preserves optional model override", () => {
		const agentDef = agent<TestState, z.infer<typeof PlannerOutput>>({
			name: "fast",
			activatesOn: ["start"],
			emits: [],
			model: "claude-3-haiku-20240307",
			outputSchema: PlannerOutput,
			prompt: () => "test",
			onOutput: () => [],
		});

		expect(agentDef.model).toBe("claude-3-haiku-20240307");
	});

	it("preserves optional when guard", () => {
		const agentDef = agent<TestState, z.infer<typeof PlannerOutput>>({
			name: "guarded",
			activatesOn: ["start"],
			emits: [],
			outputSchema: PlannerOutput,
			prompt: () => "test",
			when: (state) => state.goal.length > 0,
			onOutput: () => [],
		});

		expect(agentDef.when).toBeDefined();
		expect(agentDef.when?.({ goal: "yes", completedTasks: [] })).toBe(true);
		expect(agentDef.when?.({ goal: "", completedTasks: [] })).toBe(false);
	});
});

// ============================================================================
// onOutput Tests
// ============================================================================

describe("onOutput callback", () => {
	it("receives parsed output and triggering event", () => {
		let capturedOutput: z.infer<typeof PlannerOutput> | undefined;
		let capturedEvent: AnyEvent | undefined;

		const agentDef = agent<TestState, z.infer<typeof PlannerOutput>>({
			name: "output-inspector",
			activatesOn: ["start"],
			emits: ["plan:created"],
			outputSchema: PlannerOutput,
			prompt: () => "test",
			onOutput: (output, event) => {
				capturedOutput = output;
				capturedEvent = event;
				return [];
			},
		});

		const triggerEvent = createTestEvent("start");
		const output = { tasks: [{ id: "1", title: "Task 1" }] };

		agentDef.onOutput(output, triggerEvent);

		expect(capturedOutput).toEqual(output);
		expect(capturedEvent).toBe(triggerEvent);
	});

	it("returns array of events to emit", () => {
		const agentDef = agent<TestState, z.infer<typeof PlannerOutput>>({
			name: "emitter",
			activatesOn: ["start"],
			emits: ["plan:created", "task:added"],
			outputSchema: PlannerOutput,
			prompt: () => "test",
			onOutput: (output, event) => {
				const events: AnyEvent[] = [createEvent("plan:created", { taskCount: output.tasks.length }, event.id)];
				for (const task of output.tasks) {
					events.push(createEvent("task:added", { task }, event.id));
				}
				return events;
			},
		});

		const triggerEvent = createTestEvent("start");
		const output = {
			tasks: [
				{ id: "1", title: "Task 1" },
				{ id: "2", title: "Task 2" },
			],
		};

		const emitted = agentDef.onOutput(output, triggerEvent);

		expect(emitted).toHaveLength(3);
		expect(emitted[0]?.name).toBe("plan:created");
		expect((emitted[0]?.payload as { taskCount: number }).taskCount).toBe(2);
		expect(emitted[1]?.name).toBe("task:added");
		expect(emitted[2]?.name).toBe("task:added");
	});

	it("can return empty array when no events needed", () => {
		const agentDef = agent<TestState, z.infer<typeof ReviewerOutput>>({
			name: "silent",
			activatesOn: ["start"],
			emits: [],
			outputSchema: ReviewerOutput,
			prompt: () => "test",
			onOutput: () => [],
		});

		const result = agentDef.onOutput({ approved: true, feedback: "Good" }, createTestEvent("start"));
		expect(result).toEqual([]);
	});

	it("links emitted events to triggering event via causedBy", () => {
		const agentDef = agent<TestState, z.infer<typeof PlannerOutput>>({
			name: "linker",
			activatesOn: ["start"],
			emits: ["plan:created"],
			outputSchema: PlannerOutput,
			prompt: () => "test",
			onOutput: (output, event) => [createEvent("plan:created", { tasks: output.tasks }, event.id)],
		});

		const triggerEvent = createTestEvent("start");
		const emitted = agentDef.onOutput({ tasks: [] }, triggerEvent);

		expect(emitted[0]?.causedBy).toBe(triggerEvent.id);
	});
});

// ============================================================================
// shouldActivate Tests
// ============================================================================

describe("shouldActivate()", () => {
	const testAgent = agent<TestState, z.infer<typeof PlannerOutput>>({
		name: "test-agent",
		activatesOn: ["task:created", "workflow:start"],
		emits: [],
		outputSchema: PlannerOutput,
		prompt: () => "test",
		onOutput: () => [],
	});

	it("returns true when event name matches activatesOn", () => {
		const state: TestState = { goal: "test", completedTasks: [] };

		expect(shouldActivate(testAgent, "task:created", state)).toBe(true);
		expect(shouldActivate(testAgent, "workflow:start", state)).toBe(true);
	});

	it("returns false when event name does not match", () => {
		const state: TestState = { goal: "test", completedTasks: [] };

		expect(shouldActivate(testAgent, "unknown:event", state)).toBe(false);
		expect(shouldActivate(testAgent, "task:completed", state)).toBe(false);
	});

	it("respects when guard when present", () => {
		const guardedAgent = agent<TestState, z.infer<typeof PlannerOutput>>({
			name: "guarded",
			activatesOn: ["start"],
			emits: [],
			outputSchema: PlannerOutput,
			prompt: () => "test",
			when: (state) => state.activeAgent === undefined,
			onOutput: () => [],
		});

		// Guard passes
		expect(shouldActivate(guardedAgent, "start", { goal: "", completedTasks: [] })).toBe(true);

		// Guard fails
		expect(shouldActivate(guardedAgent, "start", { goal: "", completedTasks: [], activeAgent: "other" })).toBe(false);
	});

	it("event mismatch takes precedence over guard", () => {
		const guardedAgent = agent<TestState, z.infer<typeof PlannerOutput>>({
			name: "guarded",
			activatesOn: ["start"],
			emits: [],
			outputSchema: PlannerOutput,
			prompt: () => "test",
			when: () => true, // Always true
			onOutput: () => [],
		});

		// Even with passing guard, wrong event name means no activation
		expect(shouldActivate(guardedAgent, "wrong-event", { goal: "", completedTasks: [] })).toBe(false);
	});
});

// ============================================================================
// findMatchingAgents Tests
// ============================================================================

describe("findMatchingAgents()", () => {
	const plannerAgent = agent<TestState, z.infer<typeof PlannerOutput>>({
		name: "planner",
		activatesOn: ["workflow:start"],
		emits: ["plan:created"],
		outputSchema: PlannerOutput,
		prompt: () => "plan",
		onOutput: () => [],
	});

	const reviewerAgent = agent<TestState, z.infer<typeof ReviewerOutput>>({
		name: "reviewer",
		activatesOn: ["plan:created"],
		emits: ["review:complete"],
		outputSchema: ReviewerOutput,
		prompt: () => "review",
		onOutput: () => [],
	});

	const multiTriggerAgent = agent<TestState, z.infer<typeof ReviewerOutput>>({
		name: "multi",
		activatesOn: ["workflow:start", "plan:created"],
		emits: [],
		outputSchema: ReviewerOutput,
		prompt: () => "multi",
		onOutput: () => [],
	});

	it("finds agents that match event name", () => {
		const registry = createAgentRegistry<TestState>([plannerAgent, reviewerAgent, multiTriggerAgent]);
		const state: TestState = { goal: "test", completedTasks: [] };

		const matching = findMatchingAgents(registry, "workflow:start", state);

		expect(matching).toHaveLength(2);
		expect(matching.map((a) => a.name).sort()).toEqual(["multi", "planner"]);
	});

	it("returns empty array when no agents match", () => {
		const registry = createAgentRegistry<TestState>([plannerAgent, reviewerAgent]);
		const state: TestState = { goal: "test", completedTasks: [] };

		const matching = findMatchingAgents(registry, "unknown:event", state);

		expect(matching).toEqual([]);
	});

	it("filters by when guard", () => {
		const guardedAgent = agent<TestState, z.infer<typeof PlannerOutput>>({
			name: "guarded",
			activatesOn: ["workflow:start"],
			emits: [],
			outputSchema: PlannerOutput,
			prompt: () => "guarded",
			when: (state) => state.goal === "specific-goal",
			onOutput: () => [],
		});

		const registry = createAgentRegistry<TestState>([plannerAgent, guardedAgent]);

		// Guard fails - only planner matches
		const matchingNoGuard = findMatchingAgents(registry, "workflow:start", {
			goal: "other-goal",
			completedTasks: [],
		});
		expect(matchingNoGuard).toHaveLength(1);
		expect(matchingNoGuard[0]?.name).toBe("planner");

		// Guard passes - both match
		const matchingWithGuard = findMatchingAgents(registry, "workflow:start", {
			goal: "specific-goal",
			completedTasks: [],
		});
		expect(matchingWithGuard).toHaveLength(2);
	});
});

// ============================================================================
// createAgentRegistry Tests
// ============================================================================

describe("createAgentRegistry()", () => {
	it("creates a Map from array of agents", () => {
		const agents = [
			agent<TestState, z.infer<typeof PlannerOutput>>({
				name: "agent1",
				activatesOn: ["start"],
				emits: [],
				outputSchema: PlannerOutput,
				prompt: () => "",
				onOutput: () => [],
			}),
			agent<TestState, z.infer<typeof ReviewerOutput>>({
				name: "agent2",
				activatesOn: ["start"],
				emits: [],
				outputSchema: ReviewerOutput,
				prompt: () => "",
				onOutput: () => [],
			}),
		];

		const registry = createAgentRegistry<TestState>(agents);

		expect(registry.size).toBe(2);
		expect(registry.get("agent1")?.name).toBe("agent1");
		expect(registry.get("agent2")?.name).toBe("agent2");
	});

	it("throws on duplicate agent names", () => {
		const agents = [
			agent<TestState, z.infer<typeof PlannerOutput>>({
				name: "duplicate",
				activatesOn: ["start"],
				emits: [],
				outputSchema: PlannerOutput,
				prompt: () => "",
				onOutput: () => [],
			}),
			agent<TestState, z.infer<typeof ReviewerOutput>>({
				name: "duplicate",
				activatesOn: ["other"],
				emits: [],
				outputSchema: ReviewerOutput,
				prompt: () => "",
				onOutput: () => [],
			}),
		];

		expect(() => createAgentRegistry<TestState>(agents)).toThrow('Duplicate agent name: "duplicate"');
	});

	it("returns empty registry for empty array", () => {
		const registry = createAgentRegistry<TestState>([]);
		expect(registry.size).toBe(0);
	});

	it("returns read-only Map", () => {
		const agents = [
			agent<TestState, z.infer<typeof PlannerOutput>>({
				name: "agent1",
				activatesOn: ["start"],
				emits: [],
				outputSchema: PlannerOutput,
				prompt: () => "",
				onOutput: () => [],
			}),
		];

		const registry: AgentRegistry<TestState> = createAgentRegistry<TestState>(agents);

		// TypeScript should prevent direct mutation, but at runtime Map is still mutable
		// The readonly type is the contract we enforce
		expect(typeof registry.get).toBe("function");
		expect(typeof registry.has).toBe("function");
		expect(typeof registry.values).toBe("function");
	});
});

// ============================================================================
// Integration Tests
// ============================================================================

describe("Agent Integration", () => {
	it("complete agent workflow: create, activate, emit events", () => {
		// 1. Define state and schemas
		interface ChatState {
			messages: string[];
			isProcessing: boolean;
		}

		const ResponseOutput = z.object({
			response: z.string(),
			confidence: z.number(),
		});

		// 2. Create agent
		const chatAgent = agent<ChatState, z.infer<typeof ResponseOutput>>({
			name: "chat-responder",
			activatesOn: ["user:message"],
			emits: ["chat:response"],
			outputSchema: ResponseOutput,
			prompt: (state, event) =>
				`Respond to: ${(event.payload as { text: string }).text}. Previous messages: ${state.messages.join(", ")}`,
			when: (state) => !state.isProcessing,
			onOutput: (output, event) => [
				createEvent("chat:response", { text: output.response, confidence: output.confidence }, event.id),
			],
		});

		// 3. Create registry
		const registry = createAgentRegistry<ChatState>([chatAgent]);

		// 4. Test activation
		const state: ChatState = { messages: ["Hello"], isProcessing: false };
		const userMessage = createTestEvent("user:message", { text: "How are you?" });

		const matching = findMatchingAgents(registry, "user:message", state);
		expect(matching).toHaveLength(1);
		expect(matching[0]?.name).toBe("chat-responder");

		// 5. Test prompt generation
		const firstAgent = matching[0];
		expect(firstAgent).toBeDefined();
		// biome-ignore lint/style/noNonNullAssertion: test context, we just asserted defined
		const prompt = firstAgent!.prompt(state, userMessage);
		expect(prompt).toContain("How are you?");
		expect(prompt).toContain("Hello");

		// 6. Simulate output and event emission
		const output: z.infer<typeof ResponseOutput> = {
			response: "I am doing well!",
			confidence: 0.95,
		};

		// biome-ignore lint/style/noNonNullAssertion: test context, we just asserted defined
		const emittedEvents = firstAgent!.onOutput(output, userMessage);

		expect(emittedEvents).toHaveLength(1);
		expect(emittedEvents[0]?.name).toBe("chat:response");
		expect((emittedEvents[0]?.payload as { text: string }).text).toBe("I am doing well!");
		expect(emittedEvents[0]?.causedBy).toBe(userMessage.id);
	});

	it("multiple agents can listen to same event", () => {
		const Logger = z.object({ logged: z.boolean() });
		const Analytics = z.object({ tracked: z.boolean() });

		const loggerAgent = agent<TestState, z.infer<typeof Logger>>({
			name: "logger",
			activatesOn: ["user:action"],
			emits: ["log:recorded"],
			outputSchema: Logger,
			prompt: () => "log",
			onOutput: () => [createEvent("log:recorded", {})],
		});

		const analyticsAgent = agent<TestState, z.infer<typeof Analytics>>({
			name: "analytics",
			activatesOn: ["user:action"],
			emits: ["analytics:tracked"],
			outputSchema: Analytics,
			prompt: () => "track",
			onOutput: () => [createEvent("analytics:tracked", {})],
		});

		const registry = createAgentRegistry<TestState>([loggerAgent, analyticsAgent]);
		const state: TestState = { goal: "", completedTasks: [] };

		const matching = findMatchingAgents(registry, "user:action", state);

		expect(matching).toHaveLength(2);
		expect(matching.map((a) => a.name).sort()).toEqual(["analytics", "logger"]);
	});
});
