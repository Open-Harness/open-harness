import type { Hub } from "./hub.js";

export interface InjectedMessage {
	content: string;
	timestamp: Date;
}

/**
 * Read-only inbox for messages injected by channels (via hub.sendTo(agent, ...)).
 *
 * A provider wrapper can:
 * - concurrently `for await` messages and forward them to the underlying SDK session
 * - or `await inbox.pop()` when it wants to block for the next message
 */
export interface AgentInbox extends AsyncIterable<InjectedMessage> {
	pop(): Promise<InjectedMessage>;
	drain(): InjectedMessage[];
}

export interface AgentExecuteContext {
	hub: Hub;
	inbox: AgentInbox;
	/** Unique ID for this particular agent execution (for run-scoped message injection) */
	runId: string;
}

/**
 * AgentDefinition is the thing you register in `defineHarness({ agents })`.
 *
 * It receives the `hub` so it can emit events, but the harness will wrap it
 * so workflow code can call `agents.foo.execute(input)` with no extra args.
 */
export interface AgentDefinition<TIn = unknown, TOut = unknown> {
	name: string;
	/**
	 * If true, the agent implementation is responsible for emitting:
	 * - `agent:start` and `agent:complete`
	 *
	 * This is useful for provider adapters that want tighter control over
	 * run lifecycle events (e.g. streaming SDKs).
	 */
	emitsStartComplete?: boolean;
	execute(input: TIn, ctx: AgentExecuteContext): Promise<TOut>;
}

/**
 * ExecutableAgent is what workflow code sees at runtime.
 */
export interface ExecutableAgent<TIn = unknown, TOut = unknown> {
	name: string;
	execute(input: TIn): Promise<TOut>;
}

// Convenience alias used by examples/docs
export type Agent<TIn = unknown, TOut = unknown> = AgentDefinition<TIn, TOut>;
