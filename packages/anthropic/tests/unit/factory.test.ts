/**
 * Unit Tests for Agent Factory
 *
 * Tests for defineAnthropicAgent() factory function.
 *
 * Run with: bun test tests/unit/factory.test.ts
 */

import { beforeEach, describe, expect, test } from "bun:test";
import { Container } from "@needle-di/core";
import type { GenericMessage, IAgentRunner, RunnerCallbacks } from "@openharness/sdk";
import {
	EventBus,
	IAgentRunnerToken,
	IConfigToken,
	IEventBusToken,
	IUnifiedEventBusToken,
	setMonologueContainer,
	UnifiedEventBus,
} from "@openharness/sdk";
import { z } from "zod";
import { setDecoratorContainer } from "../../src/infra/recording/decorators.js";
import { defineAnthropicAgent, resetFactoryContainer, setFactoryContainer } from "../../src/provider/factory.js";
import { createPromptTemplate, createStaticPrompt } from "../../src/provider/prompt-template.js";

// Mock input/output schemas for testing
const TestInputSchema = z.object({
	task: z.string().min(1),
});

const TestOutputSchema = z.object({
	result: z.string(),
});

type TestInput = z.infer<typeof TestInputSchema>;
// type TestOutput = z.infer<typeof TestOutputSchema>;

/**
 * Mock runner that returns a predefined result.
 */
class MockAgentRunner implements IAgentRunner {
	lastPrompt?: string;
	lastOptions?: unknown;
	mockResult: GenericMessage = {
		type: "result",
		subtype: "success",
		structured_output: { result: "mock result" },
	} as unknown as GenericMessage;

	async run(args: {
		prompt: string;
		options: unknown;
		callbacks?: RunnerCallbacks;
	}): Promise<GenericMessage | undefined> {
		this.lastPrompt = args.prompt;
		this.lastOptions = args.options;

		// Fire onMessage callback if provided
		if (args.callbacks?.onMessage) {
			args.callbacks.onMessage(this.mockResult);
		}

		return this.mockResult;
	}
}

/**
 * Create a test container with mock runner for unit tests.
 */
function createMockContainer(): { container: Container; mockRunner: MockAgentRunner } {
	const container = new Container();
	const mockRunner = new MockAgentRunner();

	// Bind config
	container.bind({
		provide: IConfigToken,
		useValue: { isReplayMode: false, recordingsDir: "./test-recordings" },
	});

	// Bind mock runner
	container.bind({
		provide: IAgentRunnerToken,
		useValue: mockRunner,
	});

	// Bind event buses
	container.bind({
		provide: IEventBusToken,
		useFactory: () => new EventBus(),
	});

	container.bind({
		provide: IUnifiedEventBusToken,
		useFactory: () => new UnifiedEventBus(),
	});

	// Wire up decorator containers
	setDecoratorContainer(container);
	setMonologueContainer(container);

	return { container, mockRunner };
}

describe("defineAnthropicAgent", () => {
	beforeEach(() => {
		// Reset container state between tests
		resetFactoryContainer();
	});

	describe("agent creation", () => {
		test("returns an agent object with name, execute, and stream", () => {
			const { container } = createMockContainer();
			setFactoryContainer(container);

			const agent = defineAnthropicAgent({
				name: "TestAgent",
				prompt: createPromptTemplate("Do this: {{task}}"),
				inputSchema: TestInputSchema,
				outputSchema: TestOutputSchema,
			});

			expect(agent).toBeDefined();
			expect(agent.name).toBe("TestAgent");
			expect(typeof agent.execute).toBe("function");
			expect(typeof agent.stream).toBe("function");
		});

		test("accepts static string as prompt", () => {
			const { container } = createMockContainer();
			setFactoryContainer(container);

			const agent = defineAnthropicAgent({
				name: "StaticPromptAgent",
				prompt: "You are a helpful assistant. Process the input.",
				inputSchema: TestInputSchema,
				outputSchema: TestOutputSchema,
			});

			expect(agent).toBeDefined();
			expect(agent.name).toBe("StaticPromptAgent");
		});

		test("accepts PromptTemplate as prompt", () => {
			const { container } = createMockContainer();
			setFactoryContainer(container);

			const template = createPromptTemplate("Task: {{task}}", TestInputSchema);

			const agent = defineAnthropicAgent({
				name: "TemplateAgent",
				prompt: template,
				inputSchema: TestInputSchema,
				outputSchema: TestOutputSchema,
			});

			expect(agent).toBeDefined();
			expect(agent.name).toBe("TemplateAgent");
		});

		test("accepts createStaticPrompt as prompt", () => {
			const { container } = createMockContainer();
			setFactoryContainer(container);

			// Static prompts don't use variables, so use empty input schema
			const EmptyInputSchema = z.object({});

			const agent = defineAnthropicAgent({
				name: "StaticTemplateAgent",
				prompt: createStaticPrompt("You are a helpful assistant"),
				inputSchema: EmptyInputSchema,
				outputSchema: TestOutputSchema,
			});

			expect(agent).toBeDefined();
		});
	});

	describe("execute method", () => {
		test("validates input against schema and throws on invalid input", async () => {
			const { container } = createMockContainer();
			setFactoryContainer(container);

			const agent = defineAnthropicAgent({
				name: "ValidatorAgent",
				prompt: createPromptTemplate("Task: {{task}}"),
				inputSchema: TestInputSchema,
				outputSchema: TestOutputSchema,
			});

			// Empty task should fail validation (min 1 char)
			await expect(agent.execute({ task: "" })).rejects.toThrow("Input validation failed");

			// Missing task should fail
			await expect(agent.execute({} as TestInput)).rejects.toThrow("Input validation failed");
		});

		test("passes rendered prompt to runner", async () => {
			const { container, mockRunner } = createMockContainer();
			setFactoryContainer(container);

			const agent = defineAnthropicAgent({
				name: "PromptRendererAgent",
				prompt: createPromptTemplate("Complete this task: {{task}}"),
				inputSchema: TestInputSchema,
				outputSchema: TestOutputSchema,
			});

			await agent.execute({ task: "test task" });

			expect(mockRunner.lastPrompt).toBe("Complete this task: test task");
		});

		test("returns structured output from runner", async () => {
			const { container, mockRunner } = createMockContainer();
			setFactoryContainer(container);

			mockRunner.mockResult = {
				type: "result",
				subtype: "success",
				structured_output: { result: "expected output" },
			} as unknown as GenericMessage;

			const agent = defineAnthropicAgent({
				name: "OutputAgent",
				prompt: createPromptTemplate("Task: {{task}}"),
				inputSchema: TestInputSchema,
				outputSchema: TestOutputSchema,
			});

			const output = await agent.execute({ task: "test" });

			expect(output).toEqual({ result: "expected output" });
		});
	});

	describe("stream method", () => {
		test("returns an AgentHandle with interrupt, streamInput, setModel, and result", () => {
			const { container } = createMockContainer();
			setFactoryContainer(container);

			const agent = defineAnthropicAgent({
				name: "StreamAgent",
				prompt: createPromptTemplate("Task: {{task}}"),
				inputSchema: TestInputSchema,
				outputSchema: TestOutputSchema,
			});

			const handle = agent.stream({ task: "test" });

			expect(handle).toBeDefined();
			expect(typeof handle.interrupt).toBe("function");
			expect(typeof handle.streamInput).toBe("function");
			expect(typeof handle.setModel).toBe("function");
			expect(handle.result).toBeDefined();
			expect(handle.result instanceof Promise).toBe(true);
		});

		test("interrupt can be called without error", () => {
			const { container } = createMockContainer();
			setFactoryContainer(container);

			const agent = defineAnthropicAgent({
				name: "InterruptAgent",
				prompt: createPromptTemplate("Task: {{task}}"),
				inputSchema: TestInputSchema,
				outputSchema: TestOutputSchema,
			});

			const handle = agent.stream({ task: "test" });

			// Should not throw
			expect(() => handle.interrupt()).not.toThrow();
		});

		test("result promise resolves to output", async () => {
			const { container, mockRunner } = createMockContainer();
			setFactoryContainer(container);

			mockRunner.mockResult = {
				type: "result",
				subtype: "success",
				structured_output: { result: "stream result" },
			} as unknown as GenericMessage;

			const agent = defineAnthropicAgent({
				name: "StreamResultAgent",
				prompt: createPromptTemplate("Task: {{task}}"),
				inputSchema: TestInputSchema,
				outputSchema: TestOutputSchema,
			});

			const handle = agent.stream({ task: "test" });
			const output = await handle.result;

			expect(output).toEqual({ result: "stream result" });
		});
	});

	describe("agent options", () => {
		test("accepts optional SDK options", () => {
			const { container } = createMockContainer();
			setFactoryContainer(container);

			const agent = defineAnthropicAgent({
				name: "OptionsAgent",
				prompt: createPromptTemplate("Task: {{task}}"),
				inputSchema: TestInputSchema,
				outputSchema: TestOutputSchema,
				options: {
					model: "claude-sonnet-4-20250514",
					maxTurns: 10,
				},
			});

			expect(agent).toBeDefined();
		});

		test("accepts recording options", () => {
			const { container } = createMockContainer();
			setFactoryContainer(container);

			const agent = defineAnthropicAgent({
				name: "RecordingAgent",
				prompt: createPromptTemplate("Task: {{task}}"),
				inputSchema: TestInputSchema,
				outputSchema: TestOutputSchema,
				recording: {
					enabled: true,
					vaultPath: "./recordings",
				},
			});

			expect(agent).toBeDefined();
		});

		test("accepts monologue options", () => {
			const { container } = createMockContainer();
			setFactoryContainer(container);

			const agent = defineAnthropicAgent({
				name: "MonologueAgent",
				prompt: createPromptTemplate("Task: {{task}}"),
				inputSchema: TestInputSchema,
				outputSchema: TestOutputSchema,
				monologue: {
					enabled: true,
					scope: "test-scope",
				},
			});

			expect(agent).toBeDefined();
		});
	});

	describe("container management", () => {
		test("resetFactoryContainer clears the container", () => {
			const { container: container1 } = createMockContainer();
			setFactoryContainer(container1);

			// Create an agent
			const agent1 = defineAnthropicAgent({
				name: "Agent1",
				prompt: "test",
				inputSchema: TestInputSchema,
				outputSchema: TestOutputSchema,
			});

			// Reset
			resetFactoryContainer();

			// Set a new container
			const { container: container2 } = createMockContainer();
			setFactoryContainer(container2);

			// Creating another agent should work
			const agent2 = defineAnthropicAgent({
				name: "Agent2",
				prompt: "test",
				inputSchema: TestInputSchema,
				outputSchema: TestOutputSchema,
			});

			expect(agent1.name).toBe("Agent1");
			expect(agent2.name).toBe("Agent2");
		});
	});
});

describe("prompt override", () => {
	beforeEach(() => {
		resetFactoryContainer();
	});

	test("execute uses override prompt when provided", async () => {
		const { container, mockRunner } = createMockContainer();
		setFactoryContainer(container);

		const defaultPrompt = createPromptTemplate("Default: {{task}}");
		const overridePrompt = createPromptTemplate("Override: {{task}}");

		const agent = defineAnthropicAgent({
			name: "OverrideAgent",
			prompt: defaultPrompt,
			inputSchema: TestInputSchema,
			outputSchema: TestOutputSchema,
		});

		// Execute with override prompt
		await agent.execute({ task: "test task" }, { prompt: overridePrompt });

		// Should use override prompt, not default
		expect(mockRunner.lastPrompt).toBe("Override: test task");
	});

	test("execute uses default prompt when no override provided", async () => {
		const { container, mockRunner } = createMockContainer();
		setFactoryContainer(container);

		const agent = defineAnthropicAgent({
			name: "DefaultPromptAgent",
			prompt: createPromptTemplate("Default: {{task}}"),
			inputSchema: TestInputSchema,
			outputSchema: TestOutputSchema,
		});

		// Execute without override
		await agent.execute({ task: "test task" });

		// Should use default prompt
		expect(mockRunner.lastPrompt).toBe("Default: test task");
	});

	test("override prompt with different template structure", async () => {
		const { container, mockRunner } = createMockContainer();
		setFactoryContainer(container);

		const agent = defineAnthropicAgent({
			name: "DifferentTemplateAgent",
			prompt: createPromptTemplate("Simple: {{task}}"),
			inputSchema: TestInputSchema,
			outputSchema: TestOutputSchema,
		});

		// Use an override with more elaborate formatting
		const customPrompt = createPromptTemplate("[CUSTOM MODE]\nTask: {{task}}\nPlease process carefully.");

		await agent.execute({ task: "important task" }, { prompt: customPrompt });

		expect(mockRunner.lastPrompt).toBe("[CUSTOM MODE]\nTask: important task\nPlease process carefully.");
	});

	test("stream uses override prompt when provided", async () => {
		const { container, mockRunner } = createMockContainer();
		setFactoryContainer(container);

		const agent = defineAnthropicAgent({
			name: "StreamOverrideAgent",
			prompt: createPromptTemplate("Default: {{task}}"),
			inputSchema: TestInputSchema,
			outputSchema: TestOutputSchema,
		});

		const overridePrompt = createPromptTemplate("Stream override: {{task}}");
		const handle = agent.stream({ task: "test" }, { prompt: overridePrompt });

		await handle.result;

		expect(mockRunner.lastPrompt).toBe("Stream override: test");
	});
});

describe("type safety", () => {
	beforeEach(() => {
		resetFactoryContainer();
	});

	// These tests verify compile-time type safety
	// They should compile without errors

	test("input schema type is enforced at compile time", () => {
		const { container } = createMockContainer();
		setFactoryContainer(container);

		const StringInputSchema = z.object({
			message: z.string(),
		});

		const agent = defineAnthropicAgent({
			name: "TypeSafeAgent",
			prompt: createPromptTemplate("Message: {{message}}"),
			inputSchema: StringInputSchema,
			outputSchema: z.object({ response: z.string() }),
		});

		// This should compile - correct type
		const validInput = { message: "hello" };
		expect(() => agent.execute(validInput)).not.toThrow();

		// TypeScript would catch: agent.execute({ wrong: "key" })
		// But we can test runtime validation
	});

	test("output schema type is available", () => {
		const { container } = createMockContainer();
		setFactoryContainer(container);

		const OutputSchema = z.object({
			code: z.string(),
			language: z.string(),
		});

		const agent = defineAnthropicAgent({
			name: "OutputTypeAgent",
			prompt: "Generate code",
			inputSchema: z.object({ task: z.string() }),
			outputSchema: OutputSchema,
		});

		// The returned promise should be typed as { code: string, language: string }
		// This is verified at compile time
		expect(agent).toBeDefined();
	});
});
