/**
 * wrapAgent Factory - Level 1 API for single agent execution
 *
 * Provides the simplest possible API for running a single agent:
 * one-liner execution with optional event handling.
 *
 * @module factory/wrap-agent
 */
import type { FluentEventHandler, HarnessEventType } from "../harness/event-types.js";
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
export declare function wrapAgent<T extends ExecutableAgent>(agentClass: AgentConstructor<T>): WrappedAgent<T>;
