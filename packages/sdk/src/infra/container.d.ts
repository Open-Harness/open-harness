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
import { type IConfig } from "./tokens.js";
export type { IConfig } from "./tokens.js";
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
 * - Event system (IUnifiedEventBusToken)
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
export declare function createContainer(options?: ContainerOptions): Container;
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
export declare function createTestContainer(parent: Container, overrides?: {
    config?: Partial<IConfig>;
}): Container;
