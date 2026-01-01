// Protocol: Agent
// See docs/reference/protocol-types.md for authoritative definitions

import type { Hub } from "./hub.js";

/**
 * Context provided to agent execution.
 *
 * Agents use V2 SDK session pattern:
 * - hub: for emitting events and subscribing to session:message
 * - runId: routing key for targeted message injection
 *
 * Multi-turn pattern: subscribe to hub "session:message" events
 * filtered by runId, then call session.send() for each.
 */
export interface AgentExecuteContext {
	hub: Hub;
	runId: string;
}

export interface AgentDefinition<TIn = unknown, TOut = unknown> {
	name: string;
	emitsStartComplete?: boolean;
	execute(input: TIn, ctx: AgentExecuteContext): Promise<TOut>;
}

export interface ExecutableAgent<TIn = unknown, TOut = unknown> {
	name: string;
	execute(input: TIn): Promise<TOut>;
}
