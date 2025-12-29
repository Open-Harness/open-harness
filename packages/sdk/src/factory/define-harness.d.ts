/**
 * defineHarness Factory - Fluent API for creating harnesses
 *
 * Provides a clean factory function for defining harnesses with:
 * - Typed agent access
 * - State factory pattern
 * - Declarative event handling
 * - Auto-cleanup on completion
 *
 * @module factory/define-harness
 */
import type { Attachment, IUnifiedEventBus } from "../infra/unified-events/types.js";
import type { FluentEventHandler, FluentHarnessEvent, HarnessEventType, ParallelOptions, RetryOptions, StepYield } from "../harness/event-types.js";
/**
 * Base constraint for agent constructors.
 * Any class that can be instantiated is accepted.
 * This is intentionally loose to allow full type inference.
 */
export type AgentConstructor<T = any> = new (...args: unknown[]) => T;
/**
 * Type helper: converts agent constructor record to instance record.
 * Preserves the full instance type including all methods and properties.
 */
export type ResolvedAgents<T extends Record<string, AgentConstructor<any>>> = {
    [K in keyof T]: InstanceType<T[K]>;
};
/**
 * Context passed to both run() and execute() functions.
 * Provides access to agents, state, and event helpers.
 */
export interface ExecuteContext<TAgents extends Record<string, AgentConstructor<any>>, TState> {
    /** Resolved agent instances (not constructors) */
    agents: ResolvedAgents<TAgents>;
    /** Mutable state object */
    state: TState;
    /**
     * Phase helper - wraps work with auto start/complete events.
     * Emits phase:start before, phase:complete after (with return value).
     */
    phase: <T>(name: string, fn: () => Promise<T>) => Promise<T>;
    /**
     * Task helper - wraps work with auto start/complete/failed events.
     * Emits task:start before, task:complete or task:failed after.
     */
    task: <T>(id: string, fn: () => Promise<T>) => Promise<T>;
    /** Escape hatch for custom events not covered by helpers */
    emit: (type: string, data: Record<string, unknown>) => void;
    /**
     * Retry helper with auto-emitted events.
     * Emits: retry:start, retry:attempt, retry:backoff, retry:success, retry:failure
     */
    retry: <T>(name: string, fn: () => Promise<T>, options?: RetryOptions) => Promise<T>;
    /**
     * Parallel execution helper with auto-emitted events.
     * Emits: parallel:start, parallel:item:complete, parallel:complete
     */
    parallel: <T>(name: string, fns: Array<() => Promise<T>>, options?: ParallelOptions) => Promise<T[]>;
}
/**
 * Configuration for defineHarness().
 * Supports both run: (simple) and execute: (generator) patterns.
 * These are mutually exclusive.
 */
export interface HarnessConfig<TAgents extends Record<string, AgentConstructor<any>>, TState = Record<string, never>, TInput = void, TResult = void> {
    /** Optional harness name for debugging/logging. Default: 'anonymous-harness' */
    name?: string;
    /** Execution mode. Default: 'live' */
    mode?: "live" | "replay";
    /** Agent constructors to resolve and inject */
    agents: TAgents;
    /** State factory function. Default: () => ({}) */
    state?: (input: TInput) => TState;
    /** Simple async function execution (no generator) */
    run?: (context: ExecuteContext<TAgents, TState>, input: TInput) => Promise<TResult>;
    /** Generator execution with step recording via yields */
    execute?: (context: ExecuteContext<TAgents, TState>) => AsyncGenerator<StepYield, TResult>;
    /**
     * Pre-registered attachments (T058).
     * These attachments are applied to every instance created by this factory.
     * Use for environment-based configuration (debug logging, metrics, etc.).
     */
    attachments?: Attachment[];
}
/**
 * Options for harness instance creation.
 */
export interface CreateOptions {
    /** Optional unified event bus for context propagation (008-unified-event-system) */
    unifiedBus?: IUnifiedEventBus;
}
/**
 * Factory returned by defineHarness().
 * Call create() to get a runnable instance.
 */
export interface HarnessFactory<TState, TInput, TResult> {
    /** Create a new harness instance with the given input */
    create: (input: TInput, options?: CreateOptions) => HarnessInstance<TState, TResult>;
}
/**
 * Running harness instance.
 * Supports chainable event subscription and execution.
 */
export interface HarnessInstance<TState, TResult> {
    /** Chainable event subscription. Returns this for chaining. */
    on: <E extends HarnessEventType>(type: E, handler: FluentEventHandler<E>) => this;
    /** Execute the harness. Returns result with state and collected events. */
    run: () => Promise<HarnessResult<TState, TResult>>;
    /** Access current state (readonly from external perspective) */
    readonly state: TState;
}
/**
 * Result of harness.run().
 * Contains the execution result, final state, collected events, and timing.
 */
export interface HarnessResult<TState, TResult> {
    /** Return value from run()/execute() */
    result: TResult;
    /** Final state after execution */
    state: TState;
    /** All events emitted during execution */
    events: FluentHarnessEvent[];
    /** Total execution time in milliseconds */
    duration: number;
}
/**
 * Define a harness configuration.
 *
 * @param config - Harness configuration
 * @returns HarnessFactory with create() method
 *
 * @example
 * ```typescript
 * import { defineHarness } from '@openharness/sdk';
 * import { CodingAgent } from './agents/coding-agent.js';
 *
 * // Level 2: Simple workflow (no state)
 * const SimpleWorkflow = defineHarness({
 *   agents: { coder: CodingAgent },
 *   run: async ({ agents }) => {
 *     return agents.coder.execute('Write hello world');
 *   },
 * });
 *
 * // Level 3: Full workflow (with state)
 * const FullWorkflow = defineHarness({
 *   agents: { coder: CodingAgent },
 *   state: (input: { goal: string }) => ({ goal: input.goal, steps: [] }),
 *   run: async ({ agents, state, phase }) => {
 *     return await phase('coding', async () => {
 *       return agents.coder.execute(state.goal);
 *     });
 *   },
 * });
 *
 * // Usage
 * const instance = FullWorkflow.create({ goal: 'Build a CLI' });
 * const result = await instance
 *   .on('phase', (e) => console.log(`Phase: ${e.name}`))
 *   .on('narrative', (e) => console.log(`[${e.agent}] ${e.text}`))
 *   .run();
 * ```
 */
export declare function defineHarness<TAgents extends Record<string, AgentConstructor<any>>, TState = Record<string, never>, TInput = void, TResult = void>(config: HarnessConfig<TAgents, TState, TInput, TResult>): HarnessFactory<TState, TInput, TResult>;
