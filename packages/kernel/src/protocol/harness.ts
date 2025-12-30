// Protocol: Harness
// See docs/reference/protocol-types.md for authoritative definitions

import type { AgentDefinition, ExecutableAgent } from "./agent.js";
import type { BaseEvent, EnrichedEvent } from "./events.js";
import type { Hub, HubStatus, UserResponse } from "./hub.js";

export type Cleanup = void | (() => void) | (() => Promise<void>);
export type Attachment = (hub: Hub) => Cleanup;

export interface SessionContext {
	waitForUser(prompt: string, options?: { choices?: string[]; allowText?: boolean }): Promise<UserResponse>;
	hasMessages(): boolean;
	readMessages(): Array<{ content: string; agent?: string; timestamp: Date }>;
	isAborted(): boolean;
}

export type ExecutableAgents<T extends Record<string, AgentDefinition>> = {
	[K in keyof T]: T[K] extends AgentDefinition<infer TIn, infer TOut> ? ExecutableAgent<TIn, TOut> : never;
};

export interface ExecuteContext<TAgentDefs extends Record<string, AgentDefinition>, TState> {
	agents: ExecutableAgents<TAgentDefs>;
	state: TState;
	hub: Hub;
	phase: <T>(name: string, fn: () => Promise<T>) => Promise<T>;
	task: <T>(id: string, fn: () => Promise<T>) => Promise<T>;
	emit: (event: BaseEvent) => void;
	session?: SessionContext;
}

export interface HarnessResult<TState, TResult> {
	result: TResult;
	state: TState;
	events: EnrichedEvent[];
	durationMs: number;
	status: HubStatus;
}

export interface HarnessInstance<TState, TResult> extends Hub {
	readonly state: TState;
	attach(attachment: Attachment): this;
	startSession(): this;
	run(): Promise<HarnessResult<TState, TResult>>;
}

export interface HarnessFactory<TInput, TState, TResult> {
	create(input: TInput): HarnessInstance<TState, TResult>;
}
