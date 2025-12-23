/**
 * Composition Root - Single place where all DI bindings are configured
 *
 * This is the ONLY file that knows about concrete implementations.
 * All other files depend only on tokens (abstractions).
 */

import { Container } from "@needle-di/core";
import { CodingAgent } from "../agents/coding-agent.js";
import { AgentMonologue } from "../agents/monologue.js";
import { ReviewAgent } from "../agents/review-agent.js";
import type { AgentEvent } from "../runner/models.js";
import { Workflow } from "../workflow/orchestrator.js";
import { setDecoratorContainer } from "./decorators.js";
import { LiveSDKRunner } from "./live-runner.js";
import { RecordingFactory } from "./recording-factory.js";
import { ReplayRunner } from "./replay-runner.js";
import {
	type IAgentRunner,
	IAgentRunnerToken,
	type IConfig,
	IConfigToken,
	type IEventBus,
	IEventBusToken,
	type IRecordingFactory,
	IRecordingFactoryToken,
	type IVault,
	IVaultToken,
} from "./tokens.js";
import { Vault } from "./vault.js";

// Re-export for convenience
export type { IConfig } from "./tokens.js";

/**
 * Simple EventBus implementation
 */
class EventBus implements IEventBus {
	private listeners: Array<(event: AgentEvent) => void | Promise<void>> = [];

	publish(event: AgentEvent): void {
		for (const listener of this.listeners) {
			listener(event);
		}
	}

	subscribe(listener: (event: AgentEvent) => void | Promise<void>): () => void {
		this.listeners.push(listener);
		return () => {
			const index = this.listeners.indexOf(listener);
			if (index > -1) this.listeners.splice(index, 1);
		};
	}
}

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

	// Agent Runner (mode-dependent)
	container.bind({
		provide: IAgentRunnerToken,
		useClass: mode === "replay" ? ReplayRunner : LiveSDKRunner,
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

	// =========================================================================
	// Domain Layer (Agents)
	// =========================================================================

	container.bind(CodingAgent);
	container.bind(ReviewAgent);
	container.bind(AgentMonologue);

	// =========================================================================
	// Application Layer (Workflows)
	// =========================================================================

	container.bind(Workflow);

	// =========================================================================
	// Wire up decorator container
	// =========================================================================
	setDecoratorContainer(container);

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
