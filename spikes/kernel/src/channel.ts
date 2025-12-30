import type { BaseEvent, EnrichedEvent } from "./events.js";
import { matchesFilter } from "./filter.js";
import type { Attachment } from "./harness.js";
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

export function defineChannel<TState = Record<string, never>>(def: ChannelDefinition<TState>): Attachment {
	return (hub) => {
		const state = def.state?.() ?? ({} as TState);

		const emit = (event: BaseEvent) => hub.emit(event);

		if (def.onStart) void def.onStart({ hub, state, emit });

		const unsub = hub.subscribe("*", (event) => {
			for (const [pattern, handler] of Object.entries(def.on)) {
				if (!matchesFilter(event.event.type, pattern)) continue;
				try {
					void handler({ hub, state, event, emit });
				} catch {
					// non-fatal
				}
			}
		});

		return async () => {
			try {
				if (def.onComplete) await def.onComplete({ hub, state, emit });
			} finally {
				unsub();
			}
		};
	};
}
