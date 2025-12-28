/**
 * Composition Root - Single place where all DI bindings are configured
 *
 * This is a PROVIDER-AGNOSTIC container that only binds infrastructure.
 * Provider-specific bindings (agents, runners, recording) should be
 * added via @openharness/anthropic or other provider packages.
 *
 * For Anthropic/Claude support, use:
 *   import { registerAnthropicProvider } from "@openharness/anthropic";
 *   const container = createContainer();
 *   registerAnthropicProvider(container);
 */

import { Container } from "@needle-di/core";
import { setMonologueContainer } from "../monologue/monologue-decorator.js";
import { EventBus } from "./event-bus.js";
import { type IConfig, IConfigToken, IEventBusToken, IUnifiedEventBusToken } from "./tokens.js";
import { UnifiedEventBus } from "./unified-event-bus.js";

// Re-export for convenience
export type { IConfig } from "./tokens.js";

/**
 * Default configuration
 *
 * NOTE: Recording is opt-in via @Record decorator from @openharness/anthropic.
 * The recordingsDir is only used when recording is explicitly enabled.
 */
const defaultConfig: IConfig = {
	isReplayMode: process.env.REPLAY_MODE === "true",
	recordingsDir: "./tests/fixtures/artifacts",
};

export type ContainerMode = "live" | "replay";

export interface ContainerOptions {
	mode?: ContainerMode;
	config?: Partial<IConfig>;
}

/**
 * Create the application container with provider-agnostic infrastructure.
 *
 * This container provides:
 * - Configuration (IConfigToken)
 * - Event system (IEventBusToken, IUnifiedEventBusToken)
 * - Monologue service infrastructure (decorator container setup)
 *
 * For LLM provider support, use a provider package:
 * - @openharness/anthropic: Anthropic/Claude support
 *
 * @param options - Configuration options
 * @returns Configured Container
 *
 * @example
 * ```typescript
 * // Provider-agnostic container
 * const container = createContainer();
 *
 * // With Anthropic provider
 * import { registerAnthropicProvider } from "@openharness/anthropic";
 * const container = createContainer({ mode: "live" });
 * registerAnthropicProvider(container);
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
	// Infrastructure Layer (Provider-Agnostic)
	// =========================================================================

	// Config
	container.bind({
		provide: IConfigToken,
		useValue: config,
	});

	// Event Bus (Legacy)
	container.bind({
		provide: IEventBusToken,
		useFactory: () => new EventBus(),
	});

	// Unified Event Bus (008-unified-event-system)
	container.bind({
		provide: IUnifiedEventBusToken,
		useFactory: () => new UnifiedEventBus(),
	});

	// =========================================================================
	// Wire up monologue decorator container
	// =========================================================================
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
 *   config: { isReplayMode: true }
 * });
 * ```
 */
export function createTestContainer(
	parent: Container,
	overrides: {
		config?: Partial<IConfig>;
	} = {},
): Container {
	const child = parent.createChild();

	if (overrides.config) {
		const parentConfig = parent.get(IConfigToken);
		child.bind({
			provide: IConfigToken,
			useValue: { ...parentConfig, ...overrides.config },
		});
	}

	// Update decorator container to use child
	setMonologueContainer(child);

	return child;
}
