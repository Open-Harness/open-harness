// Protocol: FlowRuntime
// See docs/reference/protocol-types.md for authoritative definitions

import type { EnrichedEvent } from "./events.js";
import type { Hub, HubStatus } from "./hub.js";

export type Cleanup = void | (() => void) | (() => Promise<void>);
export type Attachment = (hub: Hub) => Cleanup;

export interface FlowRunResult {
	outputs: Record<string, unknown>;
	events: EnrichedEvent[];
	durationMs: number;
	status: HubStatus;
}

export interface FlowRuntimeInstance extends Hub {
	attach(attachment: Attachment): this;
	startSession(): this;
	run(): Promise<FlowRunResult>;
}
