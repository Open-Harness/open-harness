/**
 * Harness Factory - Creates TaskHarness without exposing DI container
 *
 * Provides a clean factory function for creating and configuring
 * the task execution harness.
 *
 * @module factory/harness-factory
 */

import { ParserAgent } from "../providers/anthropic/agents/parser-agent.js";
import { ValidationReviewAgent } from "../providers/anthropic/agents/validation-review-agent.js";
import { type ContainerOptions, createContainer } from "../core/container.js";
import { IEventBusToken } from "../core/tokens.js";
import { TaskHarness } from "../harness/task-harness.js";
import type { TaskHarnessConfig } from "../harness/task-harness-types.js";

/**
 * Options for creating a TaskHarness.
 */
export interface CreateTaskHarnessOptions {
	/** Configuration for the harness */
	config: TaskHarnessConfig;
	/** Container options (mode, custom bindings, etc.) */
	containerOptions?: Partial<ContainerOptions>;
}

/**
 * Create a TaskHarness with the given configuration.
 *
 * This factory function handles all DI container setup internally,
 * making it easy to create a harness without understanding the
 * underlying dependency injection.
 *
 * @param options - Harness configuration and options
 * @returns Configured TaskHarness ready to execute tasks
 *
 * @example
 * ```typescript
 * import { createTaskHarness } from '@openharness/sdk';
 *
 * const harness = createTaskHarness({
 *   config: {
 *     tasksFilePath: 'specs/my-feature/tasks.md',
 *     mode: 'live',
 *     continueOnFailure: false,
 *     taskTimeoutMs: 300000,
 *   },
 * });
 *
 * const summary = await harness.run({
 *   onNarrative: (entry) => console.log(`[${entry.agentName}] ${entry.text}`),
 *   onTaskComplete: (task, result) => console.log(`✓ ${task.id}`),
 *   onTaskFailed: (task, failure) => console.log(`✗ ${task.id}: ${failure.error}`),
 * });
 *
 * console.log(`Completed: ${summary.validatedTasks}/${summary.totalTasks} tasks`);
 * ```
 */
export function createTaskHarness(options: CreateTaskHarnessOptions): TaskHarness {
	const { config, containerOptions = {} } = options;

	// Create container with appropriate mode
	const container = createContainer({
		mode: config.mode,
		...containerOptions,
	});

	// Get dependencies from container
	const parserAgent = container.get(ParserAgent);
	const reviewAgent = container.get(ValidationReviewAgent);
	const eventBus = container.get(IEventBusToken, { optional: true }) ?? null;

	// Create and return harness
	return new TaskHarness(config, parserAgent, reviewAgent, eventBus);
}

/**
 * Create a TaskHarness configured for testing.
 *
 * Uses replay mode by default and sets up mock agents for
 * deterministic test execution.
 *
 * @param config - Harness configuration
 * @returns TaskHarness configured for testing
 *
 * @example
 * ```typescript
 * import { createTestTaskHarness } from '@openharness/sdk';
 *
 * const harness = createTestTaskHarness({
 *   tasksFilePath: 'test-fixtures/sample-tasks.md',
 *   mode: 'replay',
 * });
 *
 * const summary = await harness.run();
 * expect(summary.validatedTasks).toBe(3);
 * ```
 */
export function createTestTaskHarness(config: TaskHarnessConfig): TaskHarness {
	return createTaskHarness({
		config: {
			...config,
			mode: "replay",
		},
		containerOptions: {
			mode: "replay",
		},
	});
}
