/**
 * AgentRegistry Service Definition
 *
 * The AgentRegistry manages agent registration and lookup by name or triggering events.
 * This module defines the AgentRegistry service tag and interface for the
 * Effect Layer pattern.
 *
 * @module @core-v2/agent
 */

import { Context, Effect, Layer, Ref } from "effect";
import type { Agent } from "./Agent.js";
import { shouldActivate } from "./Agent.js";

// ============================================================================
// AgentRegistry Error
// ============================================================================

/**
 * AgentRegistry error codes for programmatic handling.
 */
export type AgentRegistryErrorCode = "AGENT_NOT_FOUND" | "DUPLICATE_AGENT" | "REGISTRATION_FAILED";

/**
 * AgentRegistry error class with typed error codes.
 * Used as Effect error channel type.
 */
export class AgentRegistryError extends Error {
	readonly _tag = "AgentRegistryError";

	constructor(
		/** Error code for programmatic handling */
		readonly code: AgentRegistryErrorCode,
		/** Human-readable error message */
		message: string,
		/** Original cause if available */
		override readonly cause?: unknown,
	) {
		super(message, { cause });
		this.name = "AgentRegistryError";
	}
}

// ============================================================================
// AgentRegistry Service Interface (Effect Internal)
// ============================================================================

/**
 * AgentRegistry service interface - defines operations for agent management.
 *
 * @remarks
 * This is the internal Effect service interface. All methods return
 * Effect types. The public API wraps these with Promise-based methods.
 *
 * Operations:
 * - `register`: Add an agent to the registry
 * - `get`: Retrieve an agent by name
 * - `findMatching`: Find agents that should activate for an event
 * - `has`: Check if an agent exists by name
 * - `getAll`: Get all registered agents (for debugging)
 * - `count`: Get the number of registered agents
 *
 * @typeParam S - The state type that agents operate on
 */
export interface AgentRegistryService<S = unknown> {
	/**
	 * Register an agent in the registry.
	 *
	 * @remarks
	 * Each agent name must be unique. Attempting to register a duplicate
	 * will fail with DUPLICATE_AGENT error.
	 *
	 * @param agent - The agent to register
	 * @returns Effect that succeeds with void or fails with AgentRegistryError
	 */
	readonly register: (agent: Agent<S, unknown>) => Effect.Effect<void, AgentRegistryError>;

	/**
	 * Get an agent by name.
	 *
	 * @param name - The agent name to look up
	 * @returns Effect with the agent or undefined if not found
	 */
	readonly get: (name: string) => Effect.Effect<Agent<S, unknown> | undefined>;

	/**
	 * Find all agents that should activate for a given event.
	 *
	 * @remarks
	 * This method:
	 * 1. Finds agents whose `activatesOn` includes the event name
	 * 2. Filters to only those whose `when` guard returns true (if present)
	 *
	 * @param eventName - The name of the triggering event
	 * @param state - Current workflow state (for guard evaluation)
	 * @returns Effect with array of matching agents
	 */
	readonly findMatching: (eventName: string, state: S) => Effect.Effect<readonly Agent<S, unknown>[]>;

	/**
	 * Check if an agent exists by name.
	 *
	 * @param name - The agent name to check
	 * @returns Effect with true if agent exists, false otherwise
	 */
	readonly has: (name: string) => Effect.Effect<boolean>;

	/**
	 * Get all registered agents.
	 *
	 * @remarks
	 * Useful for debugging and introspection.
	 *
	 * @returns Effect with readonly array of all agents
	 */
	readonly getAll: () => Effect.Effect<readonly Agent<S, unknown>[]>;

	/**
	 * Get the number of registered agents.
	 * Useful for testing and monitoring.
	 *
	 * @returns Effect with the agent count
	 */
	readonly count: () => Effect.Effect<number>;
}

// ============================================================================
// AgentRegistry Context Tag
// ============================================================================

/**
 * AgentRegistry service tag for Effect dependency injection.
 *
 * @example
 * ```typescript
 * // Using the AgentRegistry in an Effect program
 * const program = Effect.gen(function* () {
 *   const registry = yield* AgentRegistry;
 *
 *   // Register an agent
 *   yield* registry.register(myAgent);
 *
 *   // Find agents for an event
 *   const matching = yield* registry.findMatching("user:input", currentState);
 *   for (const agent of matching) {
 *     // Execute agent...
 *   }
 * });
 *
 * // Providing the AgentRegistry layer
 * const runnable = program.pipe(Effect.provide(AgentRegistryLive));
 * ```
 */
export class AgentRegistry extends Context.Tag("@core-v2/AgentRegistry")<AgentRegistry, AgentRegistryService>() {}

// ============================================================================
// AgentRegistry Live Implementation
// ============================================================================

/**
 * Internal storage type for agent registry.
 * Maps agent names to agent instances.
 */
type AgentStore<S> = ReadonlyMap<string, Agent<S, unknown>>;

/**
 * Creates the live AgentRegistry service using Effect Ref for agent storage.
 *
 * @remarks
 * This implementation:
 * - Uses `Ref` for thread-safe agent management
 * - Enforces unique agent names
 * - Provides fast O(1) lookup by name
 * - Efficiently finds matching agents by event name
 */
export const makeAgentRegistryService = <S>() =>
	Effect.gen(function* () {
		// Store agents in a Ref (thread-safe mutable reference)
		const agentsRef = yield* Ref.make<AgentStore<S>>(new Map());

		const service: AgentRegistryService<S> = {
			register: (agent: Agent<S, unknown>) =>
				Effect.gen(function* () {
					const agents = yield* Ref.get(agentsRef);

					// Check for duplicate
					if (agents.has(agent.name)) {
						return yield* Effect.fail(
							new AgentRegistryError(
								"DUPLICATE_AGENT",
								`Agent with name "${agent.name}" already registered. Agent names must be unique.`,
							),
						);
					}

					// Add the agent
					yield* Ref.update(agentsRef, (current) => {
						const newAgents = new Map(current);
						newAgents.set(agent.name, agent);
						return newAgents;
					});
				}),

			get: (name: string) =>
				Effect.gen(function* () {
					const agents = yield* Ref.get(agentsRef);
					return agents.get(name);
				}),

			findMatching: (eventName: string, state: S) =>
				Effect.gen(function* () {
					const agents = yield* Ref.get(agentsRef);
					const matching: Agent<S, unknown>[] = [];

					for (const agent of agents.values()) {
						if (shouldActivate(agent, eventName, state)) {
							matching.push(agent);
						}
					}

					return matching;
				}),

			has: (name: string) =>
				Effect.gen(function* () {
					const agents = yield* Ref.get(agentsRef);
					return agents.has(name);
				}),

			getAll: () =>
				Effect.gen(function* () {
					const agents = yield* Ref.get(agentsRef);
					return Array.from(agents.values());
				}),

			count: () =>
				Effect.gen(function* () {
					const agents = yield* Ref.get(agentsRef);
					return agents.size;
				}),
		};

		return service;
	});

/**
 * Live AgentRegistry layer for dependency injection.
 *
 * @remarks
 * Creates a registry with unknown state type. For type-safe state,
 * use makeAgentRegistryService<YourState>() directly.
 *
 * @example
 * ```typescript
 * const program = Effect.gen(function* () {
 *   const registry = yield* AgentRegistry;
 *   yield* registry.register(myAgent);
 * });
 *
 * const runnable = program.pipe(Effect.provide(AgentRegistryLive));
 * await Effect.runPromise(runnable);
 * ```
 */
export const AgentRegistryLive = Layer.effect(AgentRegistry, makeAgentRegistryService());

// ============================================================================
// Consumer-Facing AgentRegistry Interface (Promise-based)
// ============================================================================

/**
 * Consumer-facing AgentRegistry interface with Promise-based methods.
 * This is what the public API exposes - no Effect types.
 *
 * @typeParam S - The state type that agents operate on
 */
export interface PublicAgentRegistry<S = unknown> {
	/**
	 * Register an agent in the registry.
	 *
	 * @param agent - The agent to register
	 * @throws AgentRegistryError if duplicate agent name exists
	 */
	register(agent: Agent<S, unknown>): Promise<void>;

	/**
	 * Get an agent by name.
	 *
	 * @param name - The agent name to look up
	 * @returns The agent or undefined if not found
	 */
	get(name: string): Promise<Agent<S, unknown> | undefined>;

	/**
	 * Find all agents that should activate for a given event.
	 *
	 * @param eventName - The name of the triggering event
	 * @param state - Current workflow state (for guard evaluation)
	 * @returns Array of matching agents
	 */
	findMatching(eventName: string, state: S): Promise<readonly Agent<S, unknown>[]>;

	/**
	 * Check if an agent exists by name.
	 *
	 * @param name - The agent name to check
	 * @returns True if agent exists
	 */
	has(name: string): Promise<boolean>;

	/**
	 * Get all registered agents.
	 *
	 * @returns Array of all agents
	 */
	getAll(): Promise<readonly Agent<S, unknown>[]>;

	/**
	 * Get the number of registered agents.
	 */
	count(): Promise<number>;
}
