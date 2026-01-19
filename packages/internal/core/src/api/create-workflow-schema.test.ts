/**
 * Tests for structured output wiring in create-workflow.ts
 *
 * These tests verify:
 * 1. JSON Schema is passed to harness when agent has outputSchema
 * 2. structuredOutput is extracted from harness response
 * 3. Signal payload uses structuredOutput when available
 * 4. Fallback to { agent, output } wrapper when no structured output
 * 5. Updates field prefers structuredOutput
 */

import { describe, it, expect } from "bun:test";
import { z } from "zod";
import { createWorkflow } from "./create-workflow.js";
import { defineAgent } from "./define-agent.js";
import {
	createSignal,
	HARNESS_SIGNALS,
	type Harness,
	type HarnessInput,
	type HarnessOutput,
	type RunContext,
	type Signal,
} from "@internal/signals-core";

// ============================================================================
// Test State Type
// ============================================================================

type TestState = {
	phase: "idle" | "planned";
	plan: { tasks: string[]; count: number } | null;
};

// ============================================================================
// Mock Harnesses
// ============================================================================

/**
 * Create a mock harness that returns structured output when outputSchema is provided
 */
function createStructuredHarness(structuredResponse: unknown): Harness {
	return {
		type: "mock-structured",
		displayName: "Mock Structured Harness",
		capabilities: {
			streaming: true,
			structuredOutput: true,
			tools: false,
			resume: false,
		},
		async *run(
			input: HarnessInput & { outputSchema?: Record<string, unknown> },
			ctx: RunContext,
		): AsyncGenerator<Signal, HarnessOutput & { structuredOutput?: unknown }> {
			yield createSignal(HARNESS_SIGNALS.START, { input });

			// If outputSchema was provided, return structured output
			const hasSchema = !!input.outputSchema;
			const textContent = hasSchema
				? JSON.stringify(structuredResponse)
				: "Plain text response";

			yield createSignal(HARNESS_SIGNALS.TEXT_DELTA, { content: textContent });
			yield createSignal(HARNESS_SIGNALS.TEXT_COMPLETE, { content: textContent });

			const output: HarnessOutput & { structuredOutput?: unknown } = {
				content: textContent,
				usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
				...(hasSchema ? { structuredOutput: structuredResponse } : {}),
			};

			yield createSignal(HARNESS_SIGNALS.END, {
				output,
				durationMs: 100,
			});

			return output;
		},
	};
}

/**
 * Create a mock harness that NEVER returns structured output (legacy behavior)
 */
function createLegacyHarness(textResponse: string): Harness {
	return {
		type: "mock-legacy",
		displayName: "Mock Legacy Harness",
		capabilities: {
			streaming: true,
			structuredOutput: false,
			tools: false,
			resume: false,
		},
		async *run(
			input: HarnessInput,
			ctx: RunContext,
		): AsyncGenerator<Signal, HarnessOutput> {
			yield createSignal(HARNESS_SIGNALS.START, { input });
			yield createSignal(HARNESS_SIGNALS.TEXT_DELTA, { content: textResponse });
			yield createSignal(HARNESS_SIGNALS.TEXT_COMPLETE, {
				content: textResponse,
			});
			yield createSignal(HARNESS_SIGNALS.END, {
				output: { content: textResponse },
				durationMs: 100,
			});
			return {
				content: textResponse,
				usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
			};
		},
	};
}

/**
 * Create a mock harness that captures the input for inspection
 */
function createCapturingHarness(): {
	harness: Harness;
	getCapturedInput: () => (HarnessInput & { outputSchema?: unknown }) | null;
} {
	let capturedInput: (HarnessInput & { outputSchema?: unknown }) | null = null;

	const harness: Harness = {
		type: "mock-capturing",
		displayName: "Mock Capturing Harness",
		capabilities: {
			streaming: true,
			structuredOutput: true,
			tools: false,
			resume: false,
		},
		async *run(
			input: HarnessInput & { outputSchema?: unknown },
			ctx: RunContext,
		): AsyncGenerator<Signal, HarnessOutput> {
			capturedInput = input;

			yield createSignal(HARNESS_SIGNALS.START, { input });
			yield createSignal(HARNESS_SIGNALS.TEXT_COMPLETE, { content: "captured" });
			yield createSignal(HARNESS_SIGNALS.END, {
				output: { content: "captured" },
				durationMs: 100,
			});
			return {
				content: "captured",
				usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
			};
		},
	};

	return { harness, getCapturedInput: () => capturedInput };
}

// ============================================================================
// Tests
// ============================================================================

describe("create-workflow schema wiring", () => {
	describe("JSON Schema passing to harness", () => {
		it("passes outputSchema to harness when agent has jsonSchema", async () => {
			const { harness, getCapturedInput } = createCapturingHarness();

			const PlanSchema = z.object({
				tasks: z.array(z.string()),
				count: z.number(),
			});

			const plannerAgent = defineAgent<z.infer<typeof PlanSchema>, TestState>({
				prompt: "Create a plan",
				activateOn: ["workflow:start"],
				emits: ["plan:created"],
				outputSchema: PlanSchema,
			});

			const { runReactive } = createWorkflow<TestState>();

			await runReactive({
				agents: { planner: plannerAgent },
				state: { phase: "idle", plan: null },
				harness,
			});

			const input = getCapturedInput();
			expect(input).not.toBeNull();
			expect(input?.outputSchema).toBeDefined();
			expect(input?.outputSchema).toHaveProperty("type", "object");
			expect(input?.outputSchema).toHaveProperty("properties");
		});

		it("does not pass outputSchema when agent has no jsonSchema", async () => {
			const { harness, getCapturedInput } = createCapturingHarness();

			const { agent, runReactive } = createWorkflow<TestState>();

			const basicAgent = agent({
				prompt: "Just respond",
				activateOn: ["workflow:start"],
				emits: ["response:ready"],
			});

			await runReactive({
				agents: { basic: basicAgent },
				state: { phase: "idle", plan: null },
				harness,
			});

			const input = getCapturedInput();
			expect(input).not.toBeNull();
			expect(input?.outputSchema).toBeUndefined();
		});
	});

	describe("structuredOutput extraction", () => {
		it("extracts structuredOutput from harness response", async () => {
			const structuredData = { tasks: ["task1", "task2"], count: 2 };
			const harness = createStructuredHarness(structuredData);

			const PlanSchema = z.object({
				tasks: z.array(z.string()),
				count: z.number(),
			});

			const plannerAgent = defineAgent<z.infer<typeof PlanSchema>, TestState>({
				prompt: "Create a plan",
				activateOn: ["workflow:start"],
				emits: ["plan:created"],
				outputSchema: PlanSchema,
			});

			const { runReactive } = createWorkflow<TestState>();

			const result = await runReactive({
				agents: { planner: plannerAgent },
				state: { phase: "idle", plan: null },
				harness,
			});

			// Find the plan:created signal
			const planSignal = result.signals.find((s) => s.name === "plan:created");
			expect(planSignal).toBeDefined();

			// Payload should be the structured output directly
			expect(planSignal?.payload).toEqual(structuredData);
		});

		it("falls back to wrapper when no structuredOutput", async () => {
			const harness = createLegacyHarness("Plain text response");

			const { agent, runReactive } = createWorkflow<TestState>();

			const basicAgent = agent({
				prompt: "Just respond",
				activateOn: ["workflow:start"],
				emits: ["response:ready"],
			});

			const result = await runReactive({
				agents: { basic: basicAgent },
				state: { phase: "idle", plan: null },
				harness,
			});

			// Find the response:ready signal
			const responseSignal = result.signals.find(
				(s) => s.name === "response:ready",
			);
			expect(responseSignal).toBeDefined();

			// Payload should be the wrapper format
			const payload = responseSignal?.payload as { agent: string; output: unknown };
			expect(payload.agent).toBe("basic");
			expect(payload.output).toBeDefined();
		});
	});

	describe("updates field with structuredOutput", () => {
		it("uses structuredOutput for state updates", async () => {
			const structuredData = { tasks: ["task1", "task2"], count: 2 };
			const harness = createStructuredHarness(structuredData);

			const PlanSchema = z.object({
				tasks: z.array(z.string()),
				count: z.number(),
			});

			const plannerAgent = defineAgent<z.infer<typeof PlanSchema>, TestState>({
				prompt: "Create a plan",
				activateOn: ["workflow:start"],
				emits: ["plan:created"],
				outputSchema: PlanSchema,
				updates: "plan",
			});

			const { runReactive } = createWorkflow<TestState>();

			const result = await runReactive({
				agents: { planner: plannerAgent },
				state: { phase: "idle", plan: null },
				harness,
			});

			// State should have the structured output
			expect(result.state.plan).toEqual(structuredData);
		});

		it("emits state change signal with structuredOutput value", async () => {
			const structuredData = { tasks: ["task1", "task2"], count: 2 };
			const harness = createStructuredHarness(structuredData);

			const PlanSchema = z.object({
				tasks: z.array(z.string()),
				count: z.number(),
			});

			const plannerAgent = defineAgent<z.infer<typeof PlanSchema>, TestState>({
				prompt: "Create a plan",
				activateOn: ["workflow:start"],
				outputSchema: PlanSchema,
				updates: "plan",
			});

			const { runReactive } = createWorkflow<TestState>();

			const result = await runReactive({
				agents: { planner: plannerAgent },
				state: { phase: "idle", plan: null },
				harness,
			});

			// Find the state change signal
			const stateChangeSignal = result.signals.find(
				(s) => s.name === "state:plan:changed",
			);
			expect(stateChangeSignal).toBeDefined();

			const payload = stateChangeSignal?.payload as {
				key: string;
				oldValue: unknown;
				newValue: unknown;
			};
			expect(payload.key).toBe("plan");
			expect(payload.oldValue).toBeNull();
			expect(payload.newValue).toEqual(structuredData);
		});
	});

	describe("backward compatibility", () => {
		it("works with agents created via factory agent()", async () => {
			const harness = createLegacyHarness("Factory agent response");

			const { agent, runReactive } = createWorkflow<TestState>();

			const factoryAgent = agent({
				prompt: "Factory created agent",
				activateOn: ["workflow:start"],
				emits: ["factory:done"],
			});

			const result = await runReactive({
				agents: { factory: factoryAgent },
				state: { phase: "idle", plan: null },
				harness,
			});

			// Should work without errors
			const doneSignal = result.signals.find((s) => s.name === "factory:done");
			expect(doneSignal).toBeDefined();

			const payload = doneSignal?.payload as { agent: string; output: unknown };
			expect(payload.agent).toBe("factory");
		});

		it("mixes defineAgent and factory agents in same workflow", async () => {
			const structuredData = { tasks: ["task1"], count: 1 };
			const harness = createStructuredHarness(structuredData);

			const PlanSchema = z.object({
				tasks: z.array(z.string()),
				count: z.number(),
			});

			const definedAgent = defineAgent<z.infer<typeof PlanSchema>, TestState>({
				prompt: "Defined agent with schema",
				activateOn: ["workflow:start"],
				emits: ["defined:done"],
				outputSchema: PlanSchema,
			});

			const { agent, runReactive } = createWorkflow<TestState>();

			const factoryAgent = agent({
				prompt: "Factory agent without schema",
				activateOn: ["defined:done"],
				emits: ["factory:done"],
			});

			const result = await runReactive({
				agents: {
					defined: definedAgent,
					factory: factoryAgent,
				},
				state: { phase: "idle", plan: null },
				harness,
			});

			// Both agents should activate
			expect(result.metrics.activations).toBe(2);

			// Check signals
			const definedSignal = result.signals.find(
				(s) => s.name === "defined:done",
			);
			const factorySignal = result.signals.find(
				(s) => s.name === "factory:done",
			);

			expect(definedSignal).toBeDefined();
			expect(factorySignal).toBeDefined();

			// Defined agent should have structured payload
			expect(definedSignal?.payload).toEqual(structuredData);

			// Factory agent should have wrapper payload
			const factoryPayload = factorySignal?.payload as {
				agent: string;
				output: unknown;
			};
			expect(factoryPayload.agent).toBe("factory");
		});
	});
});
