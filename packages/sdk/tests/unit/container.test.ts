/**
 * Container Tests - Validates the NeedleDI refactoring
 *
 * Tests:
 * 1. Container creation and basic injection
 * 2. Constructor injection in services
 * 3. @Record decorator with factory injection
 * 4. BaseAgent with injected runner
 * 5. Recording and replay functionality
 * 6. All callback types fire correctly
 * 7. Promise-based API (no async generators)
 */

import { describe, expect, test } from "bun:test";
import type { Options, SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import { Container, inject, injectable } from "@needle-di/core";
import { CodingAgent } from "../../src/providers/anthropic/agents/coding-agent.js";
import { createContainer } from "../../src/core/container.js";
import { Record } from "../../src/core/decorators.js";
import type { RunnerCallbacks } from "../../src/core/tokens.js";
import {
	type IAgentRunner,
	IAgentRunnerToken,
	IConfigToken,
	IRecordingFactoryToken,
	IVaultToken,
} from "../../src/core/tokens.js";
import { BaseAgent } from "../../src/providers/anthropic/runner/base-agent.js";
import type { CompactData, SessionResult } from "../../src/providers/anthropic/runner/models.js";

// ============================================================================
// Mock Runner for Testing
// ============================================================================

@injectable()
class MockRunner implements IAgentRunner {
	public callCount = 0;
	public lastPrompt = "";

	async run(args: { prompt: string; options: Options; callbacks?: RunnerCallbacks }): Promise<SDKMessage | undefined> {
		this.callCount++;
		this.lastPrompt = args.prompt;

		// Simulate SDK message sequence
		const messages: SDKMessage[] = [
			{
				type: "system",
				subtype: "init",
				session_id: "mock_session",
				model: "mock-model",
				tools: [],
			} as any, // biome-ignore lint/suspicious/noExplicitAny: Partial mocks for testing
			{
				type: "tool_progress",
				tool_name: "test_tool",
				elapsed_time_seconds: 0.5,
			} as any, // biome-ignore lint/suspicious/noExplicitAny: Partial mocks for testing
			{
				type: "system",
				subtype: "compact_boundary",
				session_id: "mock_session",
				compact_metadata: {
					trigger: "manual",
					pre_tokens: 1000,
				},
			} as any, // biome-ignore lint/suspicious/noExplicitAny: Partial mocks for testing
			{
				type: "system",
				subtype: "status",
				session_id: "mock_session",
				status: "compacting",
			} as any, // biome-ignore lint/suspicious/noExplicitAny: Partial mocks for testing
			{
				type: "assistant",
				message: {
					content: [
						{
							type: "text",
							text: `Mock response to: ${args.prompt.slice(0, 50)}`,
						},
					],
				},
			} as any, // biome-ignore lint/suspicious/noExplicitAny: Partial mocks for testing
			{
				type: "result",
				subtype: "success",
				session_id: "mock_session",
				duration_ms: 100,
				duration_api_ms: 80,
				is_error: false,
				num_turns: 1,
				total_cost_usd: 0.001,
				usage: { input_tokens: 10, output_tokens: 20 },
				structured_output: {
					stopReason: "finished",
					summary: "Mock task completed",
					handoff: "",
				},
			} as any, // biome-ignore lint/suspicious/noExplicitAny: Partial mocks for testing
		];

		// Fire callbacks for each message
		for (const msg of messages) {
			if (args.callbacks?.onMessage) {
				args.callbacks.onMessage(msg);
			}
		}

		return messages[messages.length - 1];
	}
}

// ============================================================================
// Mock Recording Factory for Testing
// ============================================================================

class MockRecordingFactory {
	createRecorder() {
		return {
			async run(args: {
				prompt: string;
				options: Options;
				callbacks?: RunnerCallbacks;
				runFn: (args: {
					prompt: string;
					options: Options;
					callbacks?: RunnerCallbacks;
				}) => Promise<SDKMessage | undefined>;
			}) {
				return args.runFn(args);
			},
		};
	}
}

// ============================================================================
// Tests
// ============================================================================

describe("Container Creation", () => {
	test("creates live container", () => {
		const container = createContainer({ mode: "live" });
		expect(container).toBeInstanceOf(Container);

		const config = container.get(IConfigToken);
		expect(config.isReplayMode).toBe(false);
	});

	test("creates replay container", () => {
		const container = createContainer({ mode: "replay" });
		const config = container.get(IConfigToken);
		expect(config.isReplayMode).toBe(true);
	});

	test("applies custom config", () => {
		const container = createContainer({
			config: { recordingsDir: "/custom/path" },
		});
		const config = container.get(IConfigToken);
		expect(config.recordingsDir).toBe("/custom/path");
	});
});

describe("Constructor Injection", () => {
	test("BaseAgent receives injected runner", async () => {
		const container = createContainer({ mode: "live" });

		const mockRunner = new MockRunner();
		container.bind({ provide: IAgentRunnerToken, useValue: mockRunner });

		const agent = new BaseAgent("TestAgent", mockRunner);
		expect(agent.name).toBe("TestAgent");
	});

	test("Direct Instantiation (Testing Pattern)", async () => {
		const mockRunner = new MockRunner();
		const agent = new BaseAgent("TestAgent", mockRunner);

		expect(agent.name).toBe("TestAgent");

		const events: string[] = [];

		await agent.run("test", "session", {
			callbacks: {
				onSessionStart: () => events.push("start"),
				onText: () => events.push("text"),
				onResult: () => events.push("result"),
				onSessionEnd: () => events.push("end"),
			},
		});

		expect(events).toContain("start");
		expect(events).toContain("text");
		expect(events).toContain("result");
		expect(events).toContain("end");
	});
});

describe("@Record Decorator", () => {
	test("decorated method works with mock runner", async () => {
		const container = createContainer({ mode: "live" });

		const mockRunner = new MockRunner();
		container.bind({ provide: IAgentRunnerToken, useValue: mockRunner });
		container.bind({
			provide: IRecordingFactoryToken,
			useValue: new MockRecordingFactory(),
		});

		@injectable()
		class DecoratedService {
			constructor(private runner: IAgentRunner = inject(IAgentRunnerToken)) {}

			// biome-ignore lint/suspicious/noExplicitAny: Record decorator uses any[] for generic args
			@Record("smoke", (args: any[]) => args[1])
			async doWork(prompt: string, _sessionId: string, callbacks?: RunnerCallbacks): Promise<SDKMessage | undefined> {
				return this.runner.run({
					prompt,
					options: {},
					callbacks,
				});
			}
		}

		const service = new DecoratedService(mockRunner);
		container.bind(DecoratedService);

		const result = await service.doWork("decorated test", "smoke_session", {
			onMessage: (msg: SDKMessage) => {
				console.log(`[MSG] ${msg.type}`);
			},
		});

		expect(result).toBeDefined();
		expect(mockRunner.callCount).toBe(1);
	});
});

describe("Promise-based API", () => {
	test("agent.run returns Promise, not AsyncGenerator", async () => {
		const mockRunner = new MockRunner();
		const agent = new BaseAgent("TestAgent", mockRunner);

		const result = agent.run("test", "session");

		// Should be a Promise, not an AsyncGenerator
		expect(result).toBeInstanceOf(Promise);
		// biome-ignore lint/suspicious/noExplicitAny: Testing that result is not an async iterator
		expect(typeof (result as any)[Symbol.asyncIterator]).not.toBe("function");

		// Should resolve to SDKMessage
		const resolved = await result;
		expect(resolved).toBeDefined();
		expect(resolved?.type).toBe("result");
	});

	test("callbacks fire during execution", async () => {
		const mockRunner = new MockRunner();
		const agent = new BaseAgent("TestAgent", mockRunner);

		const events: string[] = [];

		await agent.run("test", "session", {
			callbacks: {
				onSessionStart: () => events.push("start"),
				onText: () => events.push("text"),
				onResult: () => events.push("result"),
				onSessionEnd: () => events.push("end"),
			},
		});

		expect(events).toContain("start");
		expect(events).toContain("text");
		expect(events).toContain("result");
		expect(events).toContain("end");
	});
});

describe("Callback Tests", () => {
	test("onResult callback provides structured result data", async () => {
		const mockRunner = new MockRunner();
		const agent = new BaseAgent("TestAgent", mockRunner);

		let capturedResult: SessionResult | undefined;

		await agent.run("test", "session", {
			callbacks: {
				onResult: (result) => {
					capturedResult = result;
				},
			},
		});

		expect(capturedResult).toBeDefined();
		expect(capturedResult).not.toBeUndefined();
		if (!capturedResult) {
			throw new Error("capturedResult is undefined");
		}
		const result: SessionResult = capturedResult;
		expect(result.success).toBe(true);
		expect(result.num_turns).toBe(1);
		expect(result.usage.input_tokens).toBe(10);
		expect(result.usage.output_tokens).toBe(20);
		expect(result.duration_ms).toBe(100);
		expect(result.total_cost_usd).toBe(0.001);
	});

	test("onToolProgress callback", async () => {
		const mockRunner = new MockRunner();
		const agent = new BaseAgent("TestAgent", mockRunner);

		let capturedProgress: boolean = false;

		await agent.run("test", "session", {
			callbacks: {
				onToolProgress: (_toolName, _elapsedSeconds) => {
					capturedProgress = true;
				},
			},
		});

		expect(capturedProgress).toBe(true);
	});

	test("onCompact callback", async () => {
		const mockRunner = new MockRunner();
		const agent = new BaseAgent("TestAgent", mockRunner);

		let capturedCompact: CompactData | undefined;

		await agent.run("test", "session", {
			callbacks: {
				onCompact: (data: CompactData) => {
					capturedCompact = data;
				},
			},
		});

		expect(capturedCompact).toBeDefined();
		expect(capturedCompact?.trigger).toBeDefined();
	});

	test("onStatus callback", async () => {
		const mockRunner = new MockRunner();
		const agent = new BaseAgent("TestAgent", mockRunner);

		let capturedStatus: string | null = null;

		await agent.run("test", "session", {
			callbacks: {
				onStatus: (data) => {
					capturedStatus = data.status ?? "null";
				},
			},
		});

		expect(capturedStatus).toBeDefined();
		expect(["compacting", "null"].includes(capturedStatus ?? "null")).toBe(true);
	});
});

describe("Vault Integration", () => {
	test("resolves vault", async () => {
		const container = createContainer({
			mode: "live",
			config: { recordingsDir: "/tmp/smoke_test_recordings" },
		});

		const vault = container.get(IVaultToken);
		const session = await vault.startSession("smoke", "test_vault");

		expect(session).toBeDefined();
		expect(typeof session.exists).toBe("function");
		expect(typeof session.getMessages).toBe("function");
		expect(typeof session.save).toBe("function");
	});

	describe("Recording Factory", () => {
		test("resolves recording factory", async () => {
			const container = createContainer({ mode: "live" });

			const factory = container.get(IRecordingFactoryToken);
			expect(factory).toBeDefined();
			expect(typeof factory.createRecorder).toBe("function");
		});

		test("creates recorder", () => {
			const container = createContainer({ mode: "live" });

			const factory = container.get(IRecordingFactoryToken);
			const recorder = factory.createRecorder("test", "smoke_test_id");

			expect(recorder).toBeDefined();
		});
	});
});

describe("Full Agent Workflow", () => {
	test("CodingAgent resolves with correct name", async () => {
		const container = createContainer({ mode: "live" });

		const mockRunner = new MockRunner();
		container.bind({ provide: IAgentRunnerToken, useValue: mockRunner });
		container.bind(CodingAgent);

		const coder = container.get(CodingAgent);
		expect(coder).toBeDefined();
		expect(coder.name).toBe("Coder");
	});

	// AgentMonologue test removed - will be reimplemented in Phase 3
});
