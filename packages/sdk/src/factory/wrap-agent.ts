/**
 * wrapAgent Factory - Level 1 API for single agent execution
 *
 * Provides the simplest possible API for running a single agent:
 * one-liner execution with optional event handling.
 *
 * @module factory/wrap-agent
 */

import { createContainer } from "../core/container.js";
import type {
	FluentEventHandler,
	FluentHarnessEvent,
	HarnessEventType,
	NarrativeEvent,
} from "../harness/event-types.js";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Base interface for agents with an execute method.
 * TArgs and TReturn use `unknown` for type-safe defaults.
 */
export interface ExecutableAgent<TArgs extends unknown[] = unknown[], TReturn = unknown> {
	execute(...args: TArgs): TReturn;
}

/**
 * Agent constructor type.
 * Agents must have an execute method and be instantiable.
 * Constructor args use unknown[] for type safety.
 */
export type AgentConstructor<T extends ExecutableAgent = ExecutableAgent> = new (...args: unknown[]) => T;

/**
 * Wrapped agent with chainable event subscription.
 * Provides Level 1 API for single agent execution.
 *
 * @typeParam TAgent - The agent instance type (must have execute method)
 */
export interface WrappedAgent<TAgent extends ExecutableAgent> {
	/** Subscribe to events. Chainable - returns this. */
	on: <E extends HarnessEventType>(type: E, handler: FluentEventHandler<E>) => this;

	/** Execute the agent's main method */
	run: TAgent["execute"];
}

/**
 * Internal subscription entry for tracking event handlers.
 */
interface Subscription {
	type: HarnessEventType;
	handler: (event: FluentHarnessEvent) => void;
}

// ============================================================================
// WRAPPED AGENT CLASS
// ============================================================================

/**
 * Internal implementation of WrappedAgent.
 * Provides a lightweight wrapper around a single agent.
 */
class WrappedAgentImpl<T extends ExecutableAgent> implements WrappedAgent<T> {
	private readonly _agent: T;
	private readonly _agentName: string;
	private readonly _subscriptions: Subscription[] = [];

	constructor(agent: T, agentName: string) {
		this._agent = agent;
		this._agentName = agentName;
	}

	/**
	 * Chainable event subscription.
	 */
	on<E extends HarnessEventType>(type: E, handler: FluentEventHandler<E>): this {
		this._subscriptions.push({
			type,
			handler: handler as (event: FluentHarnessEvent) => void,
		});
		return this;
	}

	/**
	 * Emit an event to all matching subscribers.
	 */
	private _emit(event: FluentHarnessEvent): void {
		for (const subscription of this._subscriptions) {
			if (this._shouldDeliver(event, subscription.type)) {
				try {
					subscription.handler(event);
				} catch (error) {
					const message = error instanceof Error ? error.message : String(error);
					console.error(`[WrapAgent] Event handler error: ${message}`);
				}
			}
		}
	}

	/**
	 * Check if an event should be delivered to a subscription.
	 */
	private _shouldDeliver(event: FluentHarnessEvent, subscriptionType: HarnessEventType): boolean {
		if (subscriptionType === "*") {
			return true;
		}
		if (event.type === subscriptionType) {
			return true;
		}
		if (event.type.startsWith(`${subscriptionType}:`)) {
			return true;
		}
		return false;
	}

	/**
	 * Execute the agent's main method.
	 * This creates a bound method that proxies to the agent.
	 */
	// biome-ignore lint/suspicious/noExplicitAny: Required for dynamic method binding
	run: T["execute"] = ((...args: any[]): any => {
		// Emit narrative:start event
		this._emit({
			type: "narrative",
			agent: this._agentName,
			text: "Starting execution",
			timestamp: new Date(),
		} as NarrativeEvent);

		try {
			// Call the agent's execute method
			const result = this._agent.execute(...args);

			// Handle async results
			if (result instanceof Promise) {
				return result
					.then((value) => {
						this._emit({
							type: "narrative",
							agent: this._agentName,
							text: "Execution complete",
							timestamp: new Date(),
						} as NarrativeEvent);
						return value;
					})
					.catch((error) => {
						this._emit({
							type: "error",
							message: error instanceof Error ? error.message : String(error),
							stack: error instanceof Error ? error.stack : undefined,
							timestamp: new Date(),
						} as FluentHarnessEvent);
						throw error;
					});
			}

			// Sync result
			this._emit({
				type: "narrative",
				agent: this._agentName,
				text: "Execution complete",
				timestamp: new Date(),
			} as NarrativeEvent);

			return result;
		} catch (error) {
			this._emit({
				type: "error",
				message: error instanceof Error ? error.message : String(error),
				stack: error instanceof Error ? error.stack : undefined,
				timestamp: new Date(),
			} as FluentHarnessEvent);
			throw error;
		}
		// biome-ignore lint/suspicious/noExplicitAny: Required for dynamic method binding
	}) as any;
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

/**
 * Wrap a single agent for quick execution.
 *
 * @param agentClass - Agent constructor to wrap
 * @returns WrappedAgent with on() and run() methods
 *
 * @example
 * ```typescript
 * import { wrapAgent } from '@openharness/sdk';
 * import { CodingAgent } from './agents/coding-agent.js';
 *
 * // Simplest usage - one-liner
 * const result = await wrapAgent(CodingAgent).run('Write hello world');
 *
 * // With event handling
 * const result = await wrapAgent(CodingAgent)
 *   .on('narrative', (e) => console.log(`[${e.agent}] ${e.text}`))
 *   .on('error', (e) => console.error(`Error: ${e.message}`))
 *   .run('Write hello world');
 * ```
 */
export function wrapAgent<T extends ExecutableAgent>(agentClass: AgentConstructor<T>): WrappedAgent<T> {
	// Create container and resolve agent
	const container = createContainer({ mode: "live" });
	container.bind(agentClass as new (...args: unknown[]) => unknown);

	let agent: T;
	try {
		agent = container.get(agentClass) as T;
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		throw new Error(
			`WrapAgentError: Failed to resolve agent "${agentClass.name}"\n` +
				`  Error: ${message}\n` +
				`  Hint: Ensure the agent class has @injectable() decorator`,
		);
	}

	// Return wrapped agent
	return new WrappedAgentImpl(agent, agentClass.name);
}
