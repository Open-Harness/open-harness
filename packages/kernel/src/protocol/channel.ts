// Protocol: Channel
// See docs/reference/protocol-types.md for authoritative definitions

import type { BaseEvent, EnrichedEvent } from "./events.js";
import type { Hub } from "./hub.js";

export interface ChannelContext<TState> {
	hub: Hub;
	state: TState;
	event: EnrichedEvent<BaseEvent>;
	emit: (event: BaseEvent) => void;
}

export type ChannelHandler<TState> = (ctx: ChannelContext<TState>) => void | Promise<void>;

export interface ChannelDefinition<TState> {
	name: string;
	state?: () => TState;
	onStart?: (ctx: { hub: Hub; state: TState; emit: (event: BaseEvent) => void }) => void | Promise<void>;
	onComplete?: (ctx: { hub: Hub; state: TState; emit: (event: BaseEvent) => void }) => void | Promise<void>;
	on: Record<string, ChannelHandler<TState>>;
}
