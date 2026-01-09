import type { StreamEvent } from "../providers/events.js";
import type { RecordedEvent } from "./types.js";

export function createRecordedEvent(seq: number, event: StreamEvent, timestamp: number = Date.now()): RecordedEvent {
	return { seq, timestamp, event };
}
