/**
 * Replay Container - Test utility for replaying golden recordings
 *
 * Loads recorded LLM sessions and replays them without API calls.
 * This enables fast, deterministic tests.
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { Options, SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import { Container } from "@needle-di/core";
import type { IAgentRunner, IConfig, RunnerCallbacks } from "@openharness/sdk";
import {
	EventBus,
	IAgentRunnerToken,
	IAnthropicRunnerToken,
	IConfigToken,
	IEventBusToken,
	IReplayRunnerToken,
	setMonologueContainer,
	type IMonologueLLM,
} from "@openharness/sdk";
import { IMonologueLLMToken } from "@openharness/sdk";
import { CodingAgent } from "../../src/agents/coding-agent.js";
import { ParserAgent } from "../../src/agents/parser-agent.js";
import { PlannerAgent } from "../../src/agents/planner-agent.js";
import { ReviewAgent } from "../../src/agents/review-agent.js";
import { setDecoratorContainer } from "../../src/recording/decorators.js";
import { RecordingFactory } from "../../src/recording/recording-factory.js";
import { Vault } from "../../src/recording/vault.js";

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

// Create tokens for recording system
import { InjectionToken } from "@needle-di/core";
import type { IRecordingFactory, IVault } from "../../src/recording/types.js";

export const IVaultToken = new InjectionToken<IVault>("IVault");
export const IRecordingFactoryToken = new InjectionToken<IRecordingFactory>("IRecordingFactory");

/**
 * Mock IMonologueLLM for replay tests (no-op implementation).
 */
class MockMonologueLLM implements IMonologueLLM {
	async generate(): Promise<string> {
		return "..."; // No-op, continue buffering
	}
}

/**
 * Replay runner that reads from a golden recording.
 */
export class GoldenReplayRunner implements IAgentRunner {
	private session: RecordedAgentSession | null = null;

	constructor(
		private recordingsDir: string,
		private category: string,
		private scenarioId: string,
	) {}

	/**
	 * Load the recording from disk.
	 */
	async load(): Promise<void> {
		const filePath = path.join(this.recordingsDir, this.category, `${this.scenarioId}.json`);

		try {
			const content = await fs.readFile(filePath, "utf-8");
			this.session = JSON.parse(content) as RecordedAgentSession;
			console.log(`Replay: Loaded ${this.session.messages.length} messages from ${this.scenarioId}`);
		} catch (_error) {
			throw new Error(`Failed to load recording: ${filePath}`);
		}
	}

	async run(args: { prompt: string; options: Options; callbacks?: RunnerCallbacks }): Promise<SDKMessage | undefined> {
		if (!this.session) {
			throw new Error("GoldenReplayRunner: Session not loaded. Call load() first.");
		}

		const { callbacks } = args;

		// Replay all messages via callbacks
		let lastMessage: SDKMessage | undefined;
		for (const message of this.session.messages) {
			lastMessage = message;
			if (callbacks?.onMessage) {
				callbacks.onMessage(message);
			}
		}

		return lastMessage;
	}

	/**
	 * Get the loaded session.
	 */
	getSession(): RecordedAgentSession | null {
		return this.session;
	}
}

/**
 * Create a container configured for replay mode.
 *
 * @param category - Recording category (e.g., "golden/parser-agent")
 * @param scenarioId - Scenario identifier (e.g., "sample-tasks-basic")
 * @param recordingsDir - Base directory for recordings (default: "./recordings")
 * @returns Object with container and replay runner (call load() before using)
 */
export async function createReplayContainer(
	category: string,
	scenarioId: string,
	recordingsDir = "./recordings",
): Promise<{ container: Container; replayer: GoldenReplayRunner }> {
	const container = new Container();

	const config: IConfig = {
		isReplayMode: true,
		recordingsDir,
	};

	// Create replay runner
	const replayRunner = new GoldenReplayRunner(recordingsDir, category, scenarioId);
	await replayRunner.load();

	// Bind config
	container.bind({
		provide: IConfigToken,
		useValue: config,
	});

	// Bind the replay runner for both tokens
	container.bind({
		provide: IAgentRunnerToken,
		useValue: replayRunner,
	});

	container.bind({
		provide: IAnthropicRunnerToken,
		useValue: replayRunner,
	});

	container.bind({
		provide: IReplayRunnerToken,
		useValue: replayRunner,
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

	// Mock Monologue LLM (for replay tests, no-op)
	container.bind({
		provide: IMonologueLLMToken,
		useClass: MockMonologueLLM,
	});

	// Agents
	container.bind(CodingAgent);
	container.bind(ReviewAgent);
	container.bind(PlannerAgent);
	container.bind(ParserAgent);

	// Wire up decorator containers
	setDecoratorContainer(container);
	setMonologueContainer(container);

	return { container, replayer: replayRunner };
}
