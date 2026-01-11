import type { Recording, RecordingMetadata } from "./types.js";
import type { RecordingListQuery, RecordingStore } from "./store.js";

export class InMemoryRecordingStore implements RecordingStore {
	private readonly recordings = new Map<string, Recording<unknown>>();

	async save<T>(recording: Recording<T>): Promise<void> {
		this.recordings.set(recording.id, recording as Recording<unknown>);
	}

	async load<T>(id: string): Promise<Recording<T> | null> {
		const recording = this.recordings.get(id);
		return (recording as Recording<T> | undefined) ?? null;
	}

	async list(query?: RecordingListQuery): Promise<RecordingMetadata[]> {
		const results: RecordingMetadata[] = [];
		for (const recording of this.recordings.values()) {
			const metadata = recording.metadata;
			if (query?.providerType && metadata.providerType !== query.providerType) {
				continue;
			}
			if (query?.inputHash && metadata.inputHash !== query.inputHash) {
				continue;
			}
			results.push(metadata);
		}
		return results;
	}
}
