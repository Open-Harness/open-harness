import { Database } from "bun:sqlite";
import type {
	RecordedEvent,
	Recording,
	RecordingListQuery,
	RecordingMetadata,
	RecordingStore,
} from "@open-harness/core";

export interface SqliteRecordingStoreOptions {
	filename?: string;
	db?: Database;
}

export class SqliteRecordingStore implements RecordingStore {
	private readonly db: Database;
	private readonly upsertRecording: ReturnType<Database["prepare"]>;
	private readonly selectRecording: ReturnType<Database["prepare"]>;
	private readonly selectEvents: ReturnType<Database["prepare"]>;
	private readonly selectAllMetadata: ReturnType<Database["prepare"]>;
	private readonly deleteEvents: ReturnType<Database["prepare"]>;
	private readonly insertEvent: ReturnType<Database["prepare"]>;
	private readonly writeRecording: (params: {
		id: string;
		metadata: string;
		output: string | null;
		error: string | null;
		events: RecordedEvent[];
	}) => void;

	constructor(options: SqliteRecordingStoreOptions = {}) {
		this.db = options.db ?? new Database(options.filename ?? "recordings.db");
		this.db.exec(
			`CREATE TABLE IF NOT EXISTS recordings (
        id TEXT PRIMARY KEY,
        metadata TEXT NOT NULL,
        output TEXT,
        error TEXT
      );
      CREATE TABLE IF NOT EXISTS recording_events (
        recording_id TEXT NOT NULL,
        seq INTEGER NOT NULL,
        timestamp INTEGER NOT NULL,
        event TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS recording_events_recording_id_seq
        ON recording_events(recording_id, seq);`,
		);

		this.upsertRecording = this.db.prepare(
			"INSERT OR REPLACE INTO recordings (id, metadata, output, error) VALUES (?, ?, ?, ?)",
		);
		this.selectRecording = this.db.prepare(
			"SELECT metadata, output, error FROM recordings WHERE id = ?",
		);
		this.selectEvents = this.db.prepare(
			"SELECT seq, timestamp, event FROM recording_events WHERE recording_id = ? ORDER BY seq ASC",
		);
		this.selectAllMetadata = this.db.prepare("SELECT metadata FROM recordings");
		this.deleteEvents = this.db.prepare(
			"DELETE FROM recording_events WHERE recording_id = ?",
		);
		this.insertEvent = this.db.prepare(
			"INSERT INTO recording_events (recording_id, seq, timestamp, event) VALUES (?, ?, ?, ?)",
		);

		this.writeRecording = this.db.transaction((params) => {
			this.upsertRecording.run(
				params.id,
				params.metadata,
				params.output,
				params.error,
			);
			this.deleteEvents.run(params.id);
			for (const recorded of params.events) {
				this.insertEvent.run(
					params.id,
					recorded.seq,
					recorded.timestamp,
					JSON.stringify(recorded.event),
				);
			}
		});
	}

	async save<T>(recording: Recording<T>): Promise<void> {
		const metadata = JSON.stringify(recording.metadata);
		const output =
			recording.output === undefined ? null : JSON.stringify(recording.output);
		const error = recording.error ? JSON.stringify(recording.error) : null;
		this.writeRecording({
			id: recording.id,
			metadata,
			output,
			error,
			events: recording.events,
		});
	}

	async load<T>(id: string): Promise<Recording<T> | null> {
		const row = this.selectRecording.get(id) as {
			metadata?: string;
			output?: string | null;
			error?: string | null;
		} | null;
		if (!row?.metadata) {
			return null;
		}

		const metadata = JSON.parse(row.metadata) as RecordingMetadata;
		const output = row.output ? (JSON.parse(row.output) as T) : undefined;
		const error = row.error
			? (JSON.parse(row.error) as Recording<T>["error"])
			: undefined;
		const events = (
			this.selectEvents.all(id) as Array<{
				seq: number;
				timestamp: number;
				event: string;
			}>
		).map((eventRow) => ({
			seq: eventRow.seq,
			timestamp: eventRow.timestamp,
			event: JSON.parse(eventRow.event),
		}));

		return {
			id,
			metadata,
			events,
			output,
			error,
		};
	}

	async list(query?: RecordingListQuery): Promise<RecordingMetadata[]> {
		const rows = this.selectAllMetadata.all() as Array<{ metadata: string }>;
		const results: RecordingMetadata[] = [];
		for (const row of rows) {
			const metadata = JSON.parse(row.metadata) as RecordingMetadata;
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
