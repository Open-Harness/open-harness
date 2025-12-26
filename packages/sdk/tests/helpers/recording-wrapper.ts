/**
 * Recording Wrapper - Test utility for capturing golden recordings
 *
 * Provides a RecordingRunner that wraps another runner to capture
 * LLM responses for replay testing.
 *
 * @example
 * ```typescript
 * const { container, recorder } = createRecordingContainer("golden/parser-agent");
 * const parser = container.get(ParserAgent);
 *
 * recorder.startCapture("my-scenario");
 * await parser.parse(input, callbacks);
 * await recorder.saveCapture({ fixture: "sample-tasks.md" });
 * ```
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import { Container } from "@needle-di/core";
import type { Options, SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import { AnthropicRunner } from "../../src/providers/anthropic/runner/anthropic-runner.js";
import {
	IConfigToken,
	IAgentRunnerToken,
	IAnthropicRunnerToken,
	IReplayRunnerToken,
	IRecordingFactoryToken,
	IEventBusToken,
	IVaultToken,
	type IConfig,
	type IAgentRunner,
	type RunnerCallbacks,
} from "../../src/core/tokens.js";
import { RecordingFactory } from "../../src/core/recording-factory.js";
import { ReplayRunner } from "../../src/core/replay-runner.js";
import { EventBus } from "../../src/core/event-bus.js";
import { Vault } from "../../src/core/vault.js";
import { CodingAgent } from "../../src/providers/anthropic/agents/coding-agent.js";
import { ReviewAgent } from "../../src/providers/anthropic/agents/review-agent.js";
import { PlannerAgent } from "../../src/providers/anthropic/agents/planner-agent.js";
import { setDecoratorContainer } from "../../src/core/decorators.js";

/**
 * Recorded session data saved to disk.
 */
export interface RecordedAgentSession {
	scenarioId: string;
	category: string;
	timestamp: number;
	messages: SDKMessage[];
	metadata?: Record<string, unknown>;
}

/**
 * Recording runner that captures all messages from the underlying runner.
 */
export class RecordingRunner implements IAgentRunner {
	private capturedMessages: SDKMessage[] = [];
	private isCapturing = false;
	private currentScenarioId: string | null = null;

	constructor(
		private delegate: IAgentRunner,
		private recordingsDir: string,
		private category: string,
	) {}

	async run(args: { prompt: string; options: Options; callbacks?: RunnerCallbacks }): Promise<SDKMessage | undefined> {
		const { prompt, options, callbacks } = args;

		const wrappedCallbacks: RunnerCallbacks = {
			onMessage: (msg) => {
				if (this.isCapturing) {
					this.capturedMessages.push(msg);
				}
				if (callbacks?.onMessage) {
					callbacks.onMessage(msg);
				}
			},
		};

		return this.delegate.run({
			prompt,
			options,
			callbacks: wrappedCallbacks,
		});
	}

	/**
	 * Start capturing messages for a scenario.
	 */
	startCapture(scenarioId: string): void {
		this.currentScenarioId = scenarioId;
		this.capturedMessages = [];
		this.isCapturing = true;
	}

	/**
	 * Stop capturing and save the recording.
	 */
	async saveCapture(metadata?: Record<string, unknown>): Promise<string> {
		if (!this.currentScenarioId) {
			throw new Error("No capture in progress");
		}

		this.isCapturing = false;

		const session: RecordedAgentSession = {
			scenarioId: this.currentScenarioId,
			category: this.category,
			timestamp: Date.now(),
			messages: this.capturedMessages,
			metadata,
		};

		const filePath = path.join(this.recordingsDir, this.category, `${this.currentScenarioId}.json`);
		const dirPath = path.dirname(filePath);

		await fs.mkdir(dirPath, { recursive: true });
		await fs.writeFile(filePath, JSON.stringify(session, null, 2));

		const messageCount = this.capturedMessages.length;
		console.log(`Recording saved: ${filePath} (${messageCount} messages)`);

		// Reset
		const scenarioId = this.currentScenarioId;
		this.currentScenarioId = null;
		this.capturedMessages = [];

		return filePath;
	}

	/**
	 * Get the current captured messages.
	 */
	getCapturedMessages(): SDKMessage[] {
		return [...this.capturedMessages];
	}

	/**
	 * Cancel the current capture without saving.
	 */
	cancelCapture(): void {
		this.isCapturing = false;
		this.currentScenarioId = null;
		this.capturedMessages = [];
	}
}

/**
 * Create a container configured for recording.
 *
 * @param category - Recording category (e.g., "golden/parser-agent")
 * @param recordingsDir - Base directory for recordings (default: "./recordings")
 * @returns Object with container and recording runner
 */
export function createRecordingContainer(
	category: string,
	recordingsDir = "./recordings",
): { container: Container; recorder: RecordingRunner } {
	const container = new Container();

	const config: IConfig = {
		isReplayMode: false,
		recordingsDir,
	};

	// Create the real runner
	const realRunner = new AnthropicRunner();

	// Create recording runner that wraps the real runner
	const recordingRunner = new RecordingRunner(realRunner, recordingsDir, category);

	// Bind config
	container.bind({
		provide: IConfigToken,
		useValue: config,
	});

	// Bind the recording runner for both tokens
	container.bind({
		provide: IAgentRunnerToken,
		useValue: recordingRunner,
	});

	container.bind({
		provide: IAnthropicRunnerToken,
		useValue: recordingRunner,
	});

	// Bind replay runner separately
	container.bind({
		provide: IReplayRunnerToken,
		useClass: ReplayRunner,
	});

	// Vault
	container.bind({
		provide: IVaultToken,
		useClass: Vault,
	});

	// Recording Factory
	container.bind({
		provide: IRecordingFactoryToken,
		useClass: RecordingFactory,
	});

	// Event Bus
	container.bind({
		provide: IEventBusToken,
		useFactory: () => new EventBus(),
	});

	// Agents
	container.bind(CodingAgent);
	container.bind(ReviewAgent);
	container.bind(PlannerAgent);

	// Wire up decorator container
	setDecoratorContainer(container);

	return { container, recorder: recordingRunner };
}

/**
 * Load a recorded session from disk.
 *
 * @param recordingsDir - Base recordings directory
 * @param category - Recording category
 * @param scenarioId - Scenario identifier
 * @returns Recorded session or null if not found
 */
export async function loadRecordedSession(
	recordingsDir: string,
	category: string,
	scenarioId: string,
): Promise<RecordedAgentSession | null> {
	const filePath = path.join(recordingsDir, category, `${scenarioId}.json`);

	try {
		const content = await fs.readFile(filePath, "utf-8");
		return JSON.parse(content) as RecordedAgentSession;
	} catch {
		return null;
	}
}
