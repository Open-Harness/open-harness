/**
 * Test Container Helper
 *
 * Creates a configured DI container for unit and integration tests.
 * Uses only UnifiedEventBus (no legacy EventBus).
 */

import { Container } from "@needle-di/core";
import type { GenericMessage, IAgentRunner, RunnerCallbacks } from "@openharness/sdk";
import { IAgentRunnerToken, IConfigToken, IUnifiedEventBusToken, setMonologueContainer, UnifiedEventBus } from "@openharness/sdk";
import { setDecoratorContainer } from "../../src/infra/recording/decorators.js";

/**
 * Mock runner for tests that returns predefined results.
 */
export class MockAgentRunner implements IAgentRunner {
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
 * Create a test container with mock runner and unified event bus.
 *
 * @returns Container with mock runner and test configuration
 */
export function createTestContainer(): { container: Container; mockRunner: MockAgentRunner } {
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

	// Bind unified event bus (no legacy EventBus)
	container.bind({
		provide: IUnifiedEventBusToken,
		useFactory: () => new UnifiedEventBus(),
	});

	// Wire up decorator containers
	setDecoratorContainer(container);
	setMonologueContainer(container);

	return { container, mockRunner };
}
