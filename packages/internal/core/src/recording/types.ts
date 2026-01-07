import type { StreamEvent } from "../providers/events.js";

export type RecordingMetadata = {
	providerType: string;
	createdAt: string;
	inputHash: string;
	model?: string;
	tags?: string[];
};

export type RecordedEvent = {
	seq: number;
	timestamp: number;
	event: StreamEvent;
};

export type Recording<TOutput = unknown> = {
	id: string;
	metadata: RecordingMetadata;
	events: RecordedEvent[];
	output?: TOutput;
	error?: { code: string; message: string };
};
