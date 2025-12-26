/**
 * Composition Root - Single place where all DI bindings are configured
 *
 * This is the ONLY file that knows about concrete implementations.
 * All other files depend only on tokens (abstractions).
 */

import { Container } from "@needle-di/core";
import { AnthropicMonologueLLM } from "../monologue/anthropic-llm.js";
import { setMonologueContainer } from "../monologue/monologue-decorator.js";
import { CodingAgent } from "../providers/anthropic/agents/coding-agent.js";
import { PlannerAgent } from "../providers/anthropic/agents/planner-agent.js";
import { ReviewAgent } from "../providers/anthropic/agents/review-agent.js";
import { AnthropicRunner } from "../providers/anthropic/runner/anthropic-runner.js";
import { Workflow } from "../workflow/orchestrator.js";
import { setDecoratorContainer } from "./decorators.js";
import { EventBus } from "./event-bus.js";
import { RecordingFactory } from "./recording-factory.js";
import { ReplayRunner } from "./replay-runner.js";
import {
	type IAgentRunner,
	IAgentRunnerToken,
	IAnthropicRunnerToken,
	type IConfig,
	IConfigToken,
	IEventBusToken,
	IMonologueLLMToken,
	type IRecordingFactory,
	IRecordingFactoryToken,
	IReplayRunnerToken,
	type IVault,
	IVaultToken,
	// Task Harness tokens - uncomment when implementations exist:
	// IParserAgentToken,
	// ITaskHarnessToken,
} from "./tokens.js";
import { Vault } from "./vault.js";

// Re-export for convenience
export type { IConfig } from "./tokens.js";

/**
 * Default configuration
 */
const defaultConfig: IConfig = {
	isReplayMode: process.env.REPLAY_MODE === "true",
	recordingsDir: "./recordings",
};

export type ContainerMode = "live" | "replay";

export interface ContainerOptions {
	mode?: ContainerMode;
	config?: Partial<IConfig>;
}

/**
 * Create the application container with all bindings.
 *
 * @param options - Configuration options
 * @returns Configured Container
 *
 * @example
 * ```typescript
 * // Production
 * const container = createContainer({ mode: "live" });
 *
 * // Testing with replay
 * const container = createContainer({ mode: "replay" });
 *
 * // Custom config
 * const container = createContainer({
 *   config: { recordingsDir: "./test-recordings" }
 * });
 * ```
 */
export function createContainer(options: ContainerOptions = {}): Container {
	const container = new Container();
	const mode = options.mode ?? "live";

	// Merge config
	const config: IConfig = {
		...defaultConfig,
		...options.config,
		isReplayMode: mode === "replay" || options.config?.isReplayMode === true,
	};

	// =========================================================================
	// Infrastructure Layer
	// =========================================================================

	// Config
	container.bind({
		provide: IConfigToken,
		useValue: config,
	});

	// =========================================================================
	// Provider-Specific Runner Tokens
	// =========================================================================

	// Anthropic Runner (production)
	container.bind({
		provide: IAnthropicRunnerToken,
		useClass: AnthropicRunner,
	});

	// Replay Runner (testing)
	container.bind({
		provide: IReplayRunnerToken,
		useClass: ReplayRunner,
	});

	// Legacy IAgentRunnerToken (mode-dependent, for backward compatibility)
	container.bind({
		provide: IAgentRunnerToken,
		useClass: mode === "replay" ? ReplayRunner : AnthropicRunner,
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

	// Monologue LLM (narrative generation)
	container.bind({
		provide: IMonologueLLMToken,
		useClass: AnthropicMonologueLLM,
	});

	// =========================================================================
	// Domain Layer (Agents)
	// =========================================================================

	container.bind(CodingAgent);
	container.bind(ReviewAgent);
	container.bind(PlannerAgent);

	// =========================================================================
	// Application Layer (Workflows)
	// =========================================================================

	container.bind(Workflow);

	// =========================================================================
	// Wire up decorator container
	// =========================================================================
	setDecoratorContainer(container);
	setMonologueContainer(container);

	return container;
}

/**
 * Create a child container for test isolation.
 *
 * @param parent - Parent container
 * @param overrides - Bindings to override
 * @returns Child container with overrides
 *
 * @example
 * ```typescript
 * const testContainer = createTestContainer(appContainer, {
 *   runner: mockRunner,
 *   config: { isReplayMode: true }
 * });
 * ```
 */
export function createTestContainer(
	parent: Container,
	overrides: {
		runner?: IAgentRunner;
		vault?: IVault;
		config?: Partial<IConfig>;
		recordingFactory?: IRecordingFactory;
	} = {},
): Container {
	const child = parent.createChild();

	if (overrides.runner) {
		child.bind({
			provide: IAgentRunnerToken,
			useValue: overrides.runner,
		});
	}

	if (overrides.vault) {
		child.bind({
			provide: IVaultToken,
			useValue: overrides.vault,
		});
	}

	if (overrides.config) {
		const parentConfig = parent.get(IConfigToken);
		child.bind({
			provide: IConfigToken,
			useValue: { ...parentConfig, ...overrides.config },
		});
	}

	if (overrides.recordingFactory) {
		child.bind({
			provide: IRecordingFactoryToken,
			useValue: overrides.recordingFactory,
		});
	}

	// Update decorator container to use child
	setDecoratorContainer(child);

	return child;
}
