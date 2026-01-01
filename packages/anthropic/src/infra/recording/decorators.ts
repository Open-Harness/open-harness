/**
 * Decorators - DI-aware method decorators
 *
 * These decorators use factory injection pattern (Pattern 13)
 * to maintain testability while providing convenient syntax.
 *
 * Pure Promise-based, no async generators.
 */

import type { Options } from "@anthropic-ai/claude-agent-sdk";
import type { InjectionToken } from "@needle-di/core";
import type { GenericMessage, RunnerCallbacks } from "@openharness/sdk";
import type { IRecordingFactory } from "./types.js";

/**
 * Interface for DI container used by decorators.
 * Allows retrieving services by their injection token.
 */
export interface IContainer {
	get<T>(token: InjectionToken<T>): T;
}

// Token for the recording factory - will be set from the SDK's container
let _recordingFactoryToken: InjectionToken<IRecordingFactory> | null = null;

// Container import is deferred to avoid circular dependencies
// The container is set up in container.ts and imported lazily
let _container: IContainer | null = null;

/**
 * Set the container for decorators to use.
 * Called from container.ts after container is created.
 */
export function setDecoratorContainer(container: IContainer): void {
	_container = container;
}

/**
 * Set the recording factory token.
 * Called during container setup.
 */
export function setRecordingFactoryToken(token: InjectionToken<IRecordingFactory>): void {
	_recordingFactoryToken = token;
}

/**
 * Get the container, throwing if not set.
 */
function getContainer(): IContainer {
	if (!_container) {
		throw new Error("Decorator container not initialized. Call setDecoratorContainer() first.");
	}
	return _container;
}

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
export function Record(category: string, idProvider: (args: unknown[]) => string): MethodDecorator {
	return (_target: object, _propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
		const original = descriptor.value;

		descriptor.value = async function (...args: unknown[]): Promise<GenericMessage | undefined> {
			const id = idProvider(args);

			// Get factory from container (injectable!)
			const container = getContainer();
			if (!_recordingFactoryToken) {
				throw new Error("Recording factory token not set. Call setRecordingFactoryToken() first.");
			}
			const factory = container.get(_recordingFactoryToken);
			const recorder = factory.createRecorder(category, id);

			// Extract args - assumes (prompt, scenarioId, options?, callbacks?)
			const prompt = typeof args[0] === "string" ? args[0] : "";
			const options: Options = (args[2] as Options) ?? {};
			const callbacks: RunnerCallbacks | undefined = args[3] as RunnerCallbacks | undefined;

			// Create a run function that calls the original method
			const runFn = async (runArgs: { prompt: string; options: Options; callbacks?: RunnerCallbacks }) => {
				// Call original with modified callbacks
				return original.apply(this, [runArgs.prompt, id, runArgs.options, runArgs.callbacks]);
			};

			// Delegate to recorder
			return recorder.run({
				prompt,
				options,
				callbacks,
				runFn,
			});
		};

		return descriptor;
	};
}
