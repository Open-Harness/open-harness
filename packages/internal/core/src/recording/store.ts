import type { Recording, RecordingMetadata } from "./types.js";

export type RecordingListQuery = {
	providerType?: string;
	inputHash?: string;
};

export interface RecordingStore {
	save<T>(recording: Recording<T>): Promise<void>;
	load<T>(id: string): Promise<Recording<T> | null>;
	list(query?: RecordingListQuery): Promise<RecordingMetadata[]>;
}
