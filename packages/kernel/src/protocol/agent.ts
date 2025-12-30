// Protocol: Agent
// See docs/reference/protocol-types.md for authoritative definitions

import type { Hub } from "./hub.js";

export interface InjectedMessage {
	content: string;
	timestamp: Date;
}

export interface AgentInbox extends AsyncIterable<InjectedMessage> {
	pop(): Promise<InjectedMessage>;
	drain(): InjectedMessage[];
}

export interface AgentExecuteContext {
	hub: Hub;
	inbox: AgentInbox;
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
