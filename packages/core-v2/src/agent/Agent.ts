/**
 * Agent Primitives
 *
 * This module defines the Agent types and factories for the event-sourced
 * workflow system. Agents are AI actors that respond to specific events
 * by generating LLM prompts and emitting new events based on structured output.
 *
 * **CRITICAL**: Every agent MUST have an `outputSchema`. This is non-negotiable
 * for reliable workflow state. The runtime converts Zod to JSON Schema and passes
 * to the SDK as `outputFormat: { type: "json_schema", schema }`.
 *
 * @module @core-v2/agent
 */

import type { AnyEvent } from "../event/index.js";

// ============================================================================
// Prompt Types
// ============================================================================

/**
 * A single part of a prompt template.
 * Can be either static text or a variable placeholder.
 */
export interface PromptPart {
	readonly type: "text" | "variable";
	readonly content: string;
}

/**
 * Prompt template that can be a simple string or an array of parts.
 * String prompts are used directly; part arrays allow for dynamic composition.
 */
export type PromptTemplate = string | readonly PromptPart[];

// ============================================================================
// Agent Interface
// ============================================================================

/**
 * Agent definition - the AI actor that responds to events.
 *
 * Agents declare:
 * - `activatesOn`: Which events trigger this agent
 * - `emits`: Which event types this agent can produce
 * - `prompt`: How to generate the LLM prompt from state and triggering event
 * - `outputSchema`: REQUIRED - The structured output schema using Zod
 *
 * @typeParam S - The workflow state type
 * @typeParam O - The structured output type (inferred from outputSchema)
 *
 * @example
 * ```typescript
 * import { z } from "zod";
 * import { createEvent } from "@open-harness/core-v2";
 *
 * const ResearchOutput = z.object({
 *   findings: z.array(z.string()),
 *   confidence: z.number(),
 * });
 *
 * const researcher: Agent<ChatState, z.infer<typeof ResearchOutput>> = {
 *   name: "researcher",
 *   activatesOn: ["task:research-requested"],
 *   emits: ["agent:started", "text:delta", "research:complete", "agent:completed"],
 *   outputSchema: ResearchOutput,
 *   prompt: (state, event) => `Research: ${event.payload.topic}`,
 *   onOutput: (output, event) => [
 *     createEvent("research:complete", { findings: output.findings }, event.id),
 *   ],
 * };
 * ```
 */
export interface Agent<S = unknown, O = unknown> {
	/** Unique agent identifier */
	readonly name: string;

	/** Event names that trigger this agent */
	readonly activatesOn: readonly string[];

	/** Event types this agent can produce */
	readonly emits: readonly string[];

	/** Optional LLM model override (e.g., "claude-sonnet-4-20250514") */
	readonly model?: string;

	/**
	 * Generate the LLM prompt from current state and triggering event.
	 *
	 * @param state - Current workflow state
	 * @param event - The event that triggered this agent
	 * @returns Prompt string or template parts
	 */
	readonly prompt: (state: S, event: AnyEvent) => PromptTemplate;

	/**
	 * Optional guard condition - agent only activates if this returns true.
	 * Useful for preventing agents from activating in certain states.
	 *
	 * @param state - Current workflow state
	 * @returns Whether the agent should activate
	 */
	readonly when?: (state: S) => boolean;

	/**
	 * REQUIRED: Structured output schema using Zod.
	 *
	 * Every agent MUST define what the LLM should output. This ensures:
	 * 1. Reliable workflow state (no parsing failures)
	 * 2. Type-safe event emission via onOutput
	 * 3. Deterministic replay
	 *
	 * The runtime converts Zod schema to JSON Schema and passes to the SDK as
	 * `outputFormat: { type: "json_schema", schema }`.
	 */
	readonly outputSchema: unknown; // z.ZodType<O> at runtime

	/**
	 * Transform structured output to events.
	 *
	 * Called with the validated LLM output (matching outputSchema).
	 * Returns events to emit, which handlers then process.
	 *
	 * @param output - The parsed structured output (type O)
	 * @param event - The triggering event (for causedBy linking)
	 * @returns Array of events to emit
	 */
	readonly onOutput: (output: O, event: AnyEvent) => readonly AnyEvent[];
}

// ============================================================================
// Agent Factory Types
// ============================================================================

/**
 * Options for the `agent()` factory function.
 *
 * Both `outputSchema` and `onOutput` are REQUIRED. Every agent must
 * define structured output for reliable workflow state.
 *
 * @typeParam S - The workflow state type
 * @typeParam O - The structured output type
 */
export interface AgentOptions<S, O = unknown> {
	/** Unique agent name */
	readonly name: string;
	/** Event names that trigger this agent */
	readonly activatesOn: readonly string[];
	/** Event types this agent can produce */
	readonly emits: readonly string[];
	/** Optional LLM model override */
	readonly model?: string;
	/** Prompt generator function */
	readonly prompt: (state: S, event: AnyEvent) => PromptTemplate;
	/** Optional guard condition */
	readonly when?: (state: S) => boolean;
	/** REQUIRED: Structured output schema using Zod */
	readonly outputSchema: unknown;
	/** REQUIRED: Transform structured output to events */
	readonly onOutput: (output: O, event: AnyEvent) => readonly AnyEvent[];
}

// ============================================================================
// Agent Factory
// ============================================================================

/**
 * Error thrown when an agent is created without the required outputSchema.
 */
export class MissingOutputSchemaError extends Error {
	constructor(agentName: string) {
		super(
			`outputSchema is required for agent "${agentName}" - it ensures reliable workflow state. ` +
				`Every agent must define what the LLM should output using a Zod schema.`,
		);
		this.name = "MissingOutputSchemaError";
	}
}

/**
 * Creates a type-safe agent with validation.
 *
 * **CRITICAL**: This factory throws if `outputSchema` is not provided.
 * Structured output is mandatory for all agents.
 *
 * @param options - Agent configuration options
 * @returns A validated Agent instance
 * @throws MissingOutputSchemaError if outputSchema is missing
 *
 * @example
 * ```typescript
 * import { z } from "zod";
 * import { agent, createEvent } from "@open-harness/core-v2";
 *
 * const TaskOutput = z.object({
 *   tasks: z.array(z.object({
 *     id: z.string(),
 *     title: z.string(),
 *   })),
 * });
 *
 * const planner = agent<PlannerState, z.infer<typeof TaskOutput>>({
 *   name: "planner",
 *   activatesOn: ["workflow:start"],
 *   emits: ["plan:created"],
 *   outputSchema: TaskOutput,
 *   prompt: (state) => `Create tasks for: ${state.goal}`,
 *   onOutput: (output, triggerEvent) => [
 *     createEvent("plan:created", { tasks: output.tasks }, triggerEvent.id),
 *   ],
 * });
 * ```
 */
export function agent<S, O = unknown>(options: AgentOptions<S, O>): Agent<S, O> {
	// Validate required outputSchema
	if (options.outputSchema === undefined || options.outputSchema === null) {
		throw new MissingOutputSchemaError(options.name);
	}

	return {
		name: options.name,
		activatesOn: options.activatesOn,
		emits: options.emits,
		model: options.model,
		prompt: options.prompt,
		when: options.when,
		outputSchema: options.outputSchema,
		onOutput: options.onOutput,
	};
}

// ============================================================================
// Agent Registry Type
// ============================================================================

/**
 * Agent registry - maps agent names to agent instances.
 *
 * Used internally by the workflow runtime to look up agents by name
 * and find agents that match specific event names.
 */
export type AgentRegistry<S> = ReadonlyMap<string, Agent<S, unknown>>;

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Checks if an agent should activate for a given event.
 *
 * @param agent - The agent to check
 * @param eventName - The name of the event
 * @param state - Current workflow state
 * @returns True if the agent should activate
 */
// biome-ignore lint/suspicious/noExplicitAny: Output type is not needed for activation check
export function shouldActivate<S>(agent: Agent<S, any>, eventName: string, state: S): boolean {
	// Check if agent listens for this event
	if (!agent.activatesOn.includes(eventName)) {
		return false;
	}

	// Check optional guard condition
	if (agent.when !== undefined) {
		return agent.when(state);
	}

	return true;
}

/**
 * Finds all agents that should activate for a given event.
 *
 * @param registry - The agent registry to search
 * @param eventName - The name of the event
 * @param state - Current workflow state
 * @returns Array of agents that should activate
 */
export function findMatchingAgents<S>(
	registry: AgentRegistry<S>,
	eventName: string,
	state: S,
	// biome-ignore lint/suspicious/noExplicitAny: Output type is not needed for matching
): readonly Agent<S, any>[] {
	// biome-ignore lint/suspicious/noExplicitAny: Output type is not needed for matching
	const matching: Agent<S, any>[] = [];

	for (const agent of registry.values()) {
		if (shouldActivate(agent, eventName, state)) {
			matching.push(agent);
		}
	}

	return matching;
}

/**
 * Creates an AgentRegistry from an array of agents.
 *
 * @param agents - Array of agents to register
 * @returns A read-only Map of agent name → agent
 * @throws Error if duplicate agent names are found
 */
// biome-ignore lint/suspicious/noExplicitAny: Output type is not needed for registry creation
export function createAgentRegistry<S>(agents: readonly Agent<S, any>[]): AgentRegistry<S> {
	const registry = new Map<string, Agent<S, unknown>>();

	for (const agentDef of agents) {
		if (registry.has(agentDef.name)) {
			throw new Error(`Duplicate agent name: "${agentDef.name}". Agent names must be unique.`);
		}
		registry.set(agentDef.name, agentDef);
	}

	return registry;
}
