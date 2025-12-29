/**
 * Integration Tests for Preset Agents
 *
 * Tests that preset agents can be imported and used with zero configuration.
 *
 * Run with: bun test tests/integration/presets.test.ts
 */

import { beforeEach, describe, expect, test } from "bun:test";
import type { GenericMessage } from "@openharness/sdk";
import { IAgentRunnerToken } from "@openharness/sdk";
// Import preset agents
// Import schemas for type checking
import {
	CodingAgent,
	CodingInputSchema,
	CodingOutputSchema,
	CodingPromptTemplate,
	PlannerAgent,
	PlannerInputSchema,
	PlannerOutputSchema,
	ReviewAgent,
	ReviewInputSchema,
	ReviewOutputSchema,
} from "../../src/presets/index.js";
import { resetFactoryContainer, setFactoryContainer } from "../../src/provider/factory.js";

// Import prompt template factory for override tests
import { createPromptTemplate } from "../../src/provider/prompt-template.js";
import { createTestContainer, MockAgentRunner } from "../helpers/test-container.js";

/**
 * Preset-specific mock runner with predefined results for each agent type.
 */
class PresetMockRunner extends MockAgentRunner {
	mockResults: Map<string, GenericMessage> = new Map();

	constructor() {
		super();

		// Default mock results for each agent type
		this.mockResults.set("CodingAgent", {
			type: "result",
			subtype: "success",
			structured_output: {
				code: "function add(a, b) { return a + b; }",
				explanation: "A simple function to add two numbers",
				language: "javascript",
			},
		} as unknown as GenericMessage);

		this.mockResults.set("ReviewAgent", {
			type: "result",
			subtype: "success",
			structured_output: {
				approved: true,
				issues: [],
				suggestions: ["Consider adding input validation"],
			},
		} as unknown as GenericMessage);

		this.mockResults.set("PlannerAgent", {
			type: "result",
			subtype: "success",
			structured_output: {
				tasks: [
					{
						id: "TASK-1",
						title: "Set up project structure",
						description: "Create initial project files and configuration",
						dependencies: [],
					},
					{
						id: "TASK-2",
						title: "Implement core functionality",
						description: "Build the main feature",
						dependencies: ["TASK-1"],
					},
				],
			},
		} as unknown as GenericMessage);
	}

	override async run(args: {
		prompt: string;
		options: unknown;
		callbacks?: import("@openharness/sdk").RunnerCallbacks;
	}): Promise<GenericMessage | undefined> {
		this.lastPrompt = args.prompt;

		// Determine which agent is being called based on prompt content
		let agentName = "CodingAgent";
		if (args.prompt.includes("Code Review Agent")) {
			agentName = "ReviewAgent";
		} else if (args.prompt.includes("Planner Agent")) {
			agentName = "PlannerAgent";
		}

		const result = this.mockResults.get(agentName)!;

		if (args.callbacks?.onMessage) {
			args.callbacks.onMessage(result);
		}

		return result;
	}
}

/**
 * Create test container with PresetMockRunner for preset tests.
 */
function createMockContainer() {
	const { container } = createTestContainer();
	const mockRunner = new PresetMockRunner();

	// Replace the default mock runner with our preset-specific one
	// Note: rebinding directly overrides the previous binding in NeedleDI
	container.bind({
		provide: IAgentRunnerToken,
		useValue: mockRunner,
	});

	return { container, mockRunner };
}

describe("Preset Agents", () => {
	beforeEach(() => {
		resetFactoryContainer();
	});

	describe("CodingAgent", () => {
		test("can be imported and has required interface", () => {
			expect(CodingAgent).toBeDefined();
			expect(CodingAgent.name).toBe("CodingAgent");
			expect(typeof CodingAgent.execute).toBe("function");
			expect(typeof CodingAgent.stream).toBe("function");
		});

		test("executes with typed input and returns typed output", async () => {
			const { container } = createMockContainer();
			setFactoryContainer(container);

			const result = await CodingAgent.execute({
				task: "Write a function that adds two numbers",
			});

			expect(result).toBeDefined();
			expect(typeof result.code).toBe("string");
			expect(result.code).toContain("function");
		});

		test("validates input against schema", async () => {
			const { container } = createMockContainer();
			setFactoryContainer(container);

			// Empty task should fail validation
			await expect(CodingAgent.execute({ task: "" })).rejects.toThrow("Input validation failed");
		});
	});

	describe("ReviewAgent", () => {
		test("can be imported and has required interface", () => {
			expect(ReviewAgent).toBeDefined();
			expect(ReviewAgent.name).toBe("ReviewAgent");
			expect(typeof ReviewAgent.execute).toBe("function");
			expect(typeof ReviewAgent.stream).toBe("function");
		});

		test("executes with typed input and returns typed output", async () => {
			const { container } = createMockContainer();
			setFactoryContainer(container);

			const result = await ReviewAgent.execute({
				task: "Write a function that adds two numbers",
				implementationSummary: "Created add() function. commit:abc123...",
			});

			expect(result).toBeDefined();
			expect(typeof result.approved).toBe("boolean");
			expect(Array.isArray(result.issues)).toBe(true);
		});

		test("validates input against schema", async () => {
			const { container } = createMockContainer();
			setFactoryContainer(container);

			// Missing implementationSummary should fail
			await expect(
				ReviewAgent.execute({
					task: "test",
					implementationSummary: "",
				}),
			).rejects.toThrow("Input validation failed");
		});
	});

	describe("PlannerAgent", () => {
		test("can be imported and has required interface", () => {
			expect(PlannerAgent).toBeDefined();
			expect(PlannerAgent.name).toBe("PlannerAgent");
			expect(typeof PlannerAgent.execute).toBe("function");
			expect(typeof PlannerAgent.stream).toBe("function");
		});

		test("executes with typed input and returns typed output", async () => {
			const { container } = createMockContainer();
			setFactoryContainer(container);

			const result = await PlannerAgent.execute({
				prd: "Build a todo list app",
			});

			expect(result).toBeDefined();
			expect(Array.isArray(result.tasks)).toBe(true);
			expect(result.tasks.length).toBeGreaterThan(0);
			expect(result.tasks[0]).toHaveProperty("id");
			expect(result.tasks[0]).toHaveProperty("title");
			expect(result.tasks[0]).toHaveProperty("description");
			expect(result.tasks[0]).toHaveProperty("dependencies");
		});

		test("validates input against schema", async () => {
			const { container } = createMockContainer();
			setFactoryContainer(container);

			// Empty PRD should fail
			await expect(PlannerAgent.execute({ prd: "" })).rejects.toThrow("Input validation failed");
		});
	});

	describe("Schema Exports", () => {
		test("exports all input schemas", () => {
			expect(CodingInputSchema).toBeDefined();
			expect(ReviewInputSchema).toBeDefined();
			expect(PlannerInputSchema).toBeDefined();
		});

		test("exports all output schemas", () => {
			expect(CodingOutputSchema).toBeDefined();
			expect(ReviewOutputSchema).toBeDefined();
			expect(PlannerOutputSchema).toBeDefined();
		});

		test("input schemas validate correctly", () => {
			expect(CodingInputSchema.safeParse({ task: "test" }).success).toBe(true);
			expect(CodingInputSchema.safeParse({ task: "" }).success).toBe(false);

			expect(
				ReviewInputSchema.safeParse({
					task: "test",
					implementationSummary: "done",
				}).success,
			).toBe(true);

			expect(PlannerInputSchema.safeParse({ prd: "test" }).success).toBe(true);
		});
	});

	describe("Prompt Override (User Story 3)", () => {
		// NOTE: Preset agents (CodingAgent, etc.) are module-level singletons.
		// Their internal runner is cached on first use. For tests that need to
		// verify runner behavior, we create fresh agents instead.

		test("agent accepts custom prompt override", async () => {
			const { container, mockRunner } = createMockContainer();
			setFactoryContainer(container);

			// Import defineAnthropicAgent dynamically to create fresh agent
			const { defineAnthropicAgent } = await import("../../src/provider/factory.js");

			const defaultPrompt = createPromptTemplate("Default: {{task}}");
			const overridePrompt = createPromptTemplate("[CUSTOM CODING MODE]\nPlease complete: {{task}}");

			// Create a fresh agent (not the singleton preset)
			const agent = defineAnthropicAgent({
				name: "FreshCodingAgent",
				prompt: defaultPrompt,
				inputSchema: CodingInputSchema,
				outputSchema: CodingOutputSchema,
			});

			await agent.execute({ task: "write hello world" }, { prompt: overridePrompt });

			// Verify the custom prompt was used
			expect(mockRunner.lastPrompt).toContain("[CUSTOM CODING MODE]");
			expect(mockRunner.lastPrompt).toContain("write hello world");
		});

		test("agent uses default prompt when no override provided", async () => {
			const { container, mockRunner } = createMockContainer();
			setFactoryContainer(container);

			const { defineAnthropicAgent } = await import("../../src/provider/factory.js");

			const agent = defineAnthropicAgent({
				name: "FreshCodingAgent2",
				prompt: createPromptTemplate("Default Coding: {{task}}"),
				inputSchema: CodingInputSchema,
				outputSchema: CodingOutputSchema,
			});

			await agent.execute({ task: "build a function" });

			// Should use default prompt
			expect(mockRunner.lastPrompt).toContain("Default Coding:");
			expect(mockRunner.lastPrompt).toContain("build a function");
		});

		test("CodingPromptTemplate is exported for reference", () => {
			// Users can examine the default template before creating overrides
			expect(CodingPromptTemplate).toBeDefined();
			expect(CodingPromptTemplate.template).toContain("{{task}}");
		});

		test("override prompt preserves type safety", async () => {
			const { container } = createMockContainer();
			setFactoryContainer(container);

			const { defineAnthropicAgent } = await import("../../src/provider/factory.js");

			// Create override with same variables as CodingInput
			const typedOverride = createPromptTemplate<"Task: {{task}}", { task: string }>(
				"Task: {{task}}",
				CodingInputSchema,
			);

			const agent = defineAnthropicAgent({
				name: "TypeSafeCodingAgent",
				prompt: createPromptTemplate("Default: {{task}}"),
				inputSchema: CodingInputSchema,
				outputSchema: CodingOutputSchema,
			});

			// This should work - prompt matches input schema
			const result = await agent.execute({ task: "test" }, { prompt: typedOverride });

			expect(result).toBeDefined();
		});

		test("preset agents can be used with override (functional verification)", async () => {
			const { container } = createMockContainer();
			setFactoryContainer(container);

			// This test verifies that CodingAgent WORKS with override
			// (even if we can't inspect the runner due to caching)
			const customPrompt = createPromptTemplate("Custom: {{task}}");

			const result = await CodingAgent.execute({ task: "test task" }, { prompt: customPrompt });

			// The mock always returns success, so result should be defined
			expect(result).toBeDefined();
			expect(result.code).toBeDefined();
		});
	});
});
