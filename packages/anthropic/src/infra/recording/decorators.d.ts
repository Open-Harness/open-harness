/**
 * Decorators - DI-aware method decorators
 *
 * These decorators use factory injection pattern (Pattern 13)
 * to maintain testability while providing convenient syntax.
 *
 * Pure Promise-based, no async generators.
 */
import type { InjectionToken } from "@needle-di/core";
import type { IRecordingFactory } from "./types.js";
/**
 * Interface for DI container used by decorators.
 * Allows retrieving services by their injection token.
 */
export interface IContainer {
    get<T>(token: InjectionToken<T>): T;
}
/**
 * Set the container for decorators to use.
 * Called from container.ts after container is created.
 */
export declare function setDecoratorContainer(container: IContainer): void;
/**
 * Set the recording factory token.
 * Called during container setup.
 */
export declare function setRecordingFactoryToken(token: InjectionToken<IRecordingFactory>): void;
/**
 * @Record decorator - Records/replays async method calls.
 *
 * Uses factory injection pattern to maintain testability:
 * - Factory is retrieved from container at runtime
 * - Factory can be mocked in tests
 * - Recorder handles actual record/replay logic
 *
 * The decorated method must have this signature:
 * (prompt: string, options: Options, callbacks?: RunnerCallbacks) => Promise<GenericMessage | undefined>
 *
 * @param category - Recording category (e.g., "golden", "agents")
 * @param idProvider - Function to extract recording ID from method args
 *
 * @example
 * ```typescript
 * @injectable()
 * class Harvester {
 *   @Record("golden", (args) => args[1])
 *   async capture(
 *     prompt: string,
 *     scenarioId: string,
 *     options: Options,
 *     callbacks?: RunnerCallbacks
 *   ): Promise<GenericMessage | undefined> {
 *     return this.runner.run({ prompt, options, callbacks });
 *   }
 * }
 * ```
 */
export declare function Record(category: string, idProvider: (args: unknown[]) => string): MethodDecorator;
