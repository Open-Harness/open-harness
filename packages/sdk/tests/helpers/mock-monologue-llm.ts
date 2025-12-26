/**
 * MockMonologueLLM - Test helper for mocking narrative generation
 *
 * Provides a configurable mock implementation of IMonologueLLM for testing.
 * Use this instead of making real API calls in unit and integration tests.
 *
 * @module tests/helpers/mock-monologue-llm
 */

import type { AgentEvent, IMonologueLLM, MonologueConfig } from "../../src/monologue/types.js";

/**
 * Configuration options for MockMonologueLLM.
 */
export interface MockMonologueLLMOptions {
	/**
	 * Default response when no queued responses remain.
	 * @default "Mock narrative"
	 */
	defaultResponse?: string;

	/**
	 * If true, simulate "wait" behavior by returning "..." initially.
	 * @default false
	 */
	waitByDefault?: boolean;

	/**
	 * Simulated latency in milliseconds.
	 * @default 0
	 */
	latencyMs?: number;
}

/**
 * Mock implementation of IMonologueLLM for testing.
 *
 * Features:
 * - Queue responses for sequential calls
 * - Track call history and arguments
 * - Configurable default behavior
 * - Simulated latency
 *
 * @example
 * ```typescript
 * // Basic usage
 * const mockLLM = new MockMonologueLLM();
 * mockLLM.queueResponses("First narrative", "Second narrative");
 *
 * const service = createMonologueService({ llm: mockLLM, ... });
 * await service.addEvent(event); // Gets "First narrative"
 * await service.addEvent(event); // Gets "Second narrative"
 *
 * // Check call history
 * expect(mockLLM.callCount).toBe(2);
 * expect(mockLLM.calls[0].events.length).toBe(1);
 * ```
 *
 * @example
 * ```typescript
 * // Simulate wait-then-narrate pattern
 * const mockLLM = new MockMonologueLLM({ waitByDefault: true });
 * mockLLM.queueResponses("...", "...", "Now I understand the code");
 * // First two calls return "...", third returns narrative
 * ```
 */
export class MockMonologueLLM implements IMonologueLLM {
	private readonly options: Required<MockMonologueLLMOptions>;
	private responseQueue: string[] = [];

	/**
	 * Number of times generate() was called.
	 */
	public callCount = 0;

	/**
	 * Detailed history of all generate() calls.
	 */
	public calls: Array<{
		events: AgentEvent[];
		history: string[];
		config: MonologueConfig;
		isFirst: boolean;
		isFinal: boolean;
		response: string;
	}> = [];

	/**
	 * Events from the most recent call (convenience accessor).
	 */
	public get lastEvents(): AgentEvent[] {
		return this.calls[this.calls.length - 1]?.events ?? [];
	}

	/**
	 * History from the most recent call (convenience accessor).
	 */
	public get lastHistory(): string[] {
		return this.calls[this.calls.length - 1]?.history ?? [];
	}

	/**
	 * isFirst flag from the most recent call (convenience accessor).
	 */
	public get lastIsFirst(): boolean {
		return this.calls[this.calls.length - 1]?.isFirst ?? false;
	}

	/**
	 * isFinal flag from the most recent call (convenience accessor).
	 */
	public get lastIsFinal(): boolean {
		return this.calls[this.calls.length - 1]?.isFinal ?? false;
	}

	constructor(options: MockMonologueLLMOptions = {}) {
		this.options = {
			defaultResponse: options.defaultResponse ?? "Mock narrative",
			waitByDefault: options.waitByDefault ?? false,
			latencyMs: options.latencyMs ?? 0,
		};
	}

	/**
	 * Queue one or more responses to be returned in order.
	 *
	 * @param responses - Responses to queue (can include "..." for wait signal)
	 *
	 * @example
	 * mockLLM.queueResponses("First", "Second", "Third");
	 */
	queueResponses(...responses: string[]): void {
		this.responseQueue.push(...responses);
	}

	/**
	 * Queue a "wait" signal ("...").
	 *
	 * @param count - Number of wait signals to queue
	 *
	 * @example
	 * mockLLM.queueWaits(3); // Waits 3 times before narrating
	 * mockLLM.queueResponses("Finally ready to narrate");
	 */
	queueWaits(count: number): void {
		for (let i = 0; i < count; i++) {
			this.responseQueue.push("...");
		}
	}

	/**
	 * Clear all queued responses and reset call history.
	 */
	reset(): void {
		this.responseQueue = [];
		this.callCount = 0;
		this.calls = [];
	}

	/**
	 * Generate a mock narrative response.
	 *
	 * Returns responses from the queue in order. When queue is empty,
	 * returns default response (or "..." if waitByDefault is true).
	 */
	async generate(
		events: AgentEvent[],
		history: string[],
		config: MonologueConfig,
		isFirst: boolean,
		isFinal: boolean,
	): Promise<string> {
		// Simulate latency if configured
		if (this.options.latencyMs > 0) {
			await new Promise((resolve) => setTimeout(resolve, this.options.latencyMs));
		}

		this.callCount++;

		// Determine response
		let response: string;
		const queued = this.responseQueue.shift();
		if (queued !== undefined) {
			response = queued;
		} else if (this.options.waitByDefault && !isFinal) {
			response = "...";
		} else {
			response = this.options.defaultResponse;
		}

		// Record call
		this.calls.push({
			events: [...events],
			history: [...history],
			config,
			isFirst,
			isFinal,
			response,
		});

		return response;
	}
}

/**
 * Create a simple mock LLM with a single response.
 *
 * @param response - The response to return (defaults to "Mock narrative")
 * @returns Configured MockMonologueLLM instance
 *
 * @example
 * const mockLLM = createMockLLM("Found the database configuration");
 */
export function createMockLLM(response = "Mock narrative"): MockMonologueLLM {
	const mock = new MockMonologueLLM({ defaultResponse: response });
	return mock;
}

/**
 * Create a mock LLM that initially waits, then narrates.
 *
 * @param waitCount - Number of "..." responses before narrating
 * @param finalResponse - The narrative after waiting
 * @returns Configured MockMonologueLLM instance
 *
 * @example
 * const mockLLM = createWaitingMockLLM(2, "After observing the events, I see a pattern");
 * // First call: "...", Second call: "...", Third call: narrative
 */
export function createWaitingMockLLM(waitCount: number, finalResponse: string): MockMonologueLLM {
	const mock = new MockMonologueLLM();
	mock.queueWaits(waitCount);
	mock.queueResponses(finalResponse);
	return mock;
}
