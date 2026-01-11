import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type {
	RecordedEvent,
	Recording,
	RecordingListQuery,
	RecordingMetadata,
	RecordingStore,
} from "@open-harness/core";

export interface FileRecordingStoreOptions {
	directory?: string;
}

export class FileRecordingStore implements RecordingStore {
	private readonly directory: string;

	constructor(options: FileRecordingStoreOptions = {}) {
		this.directory = options.directory ?? "recordings";
	}

	async save<T>(recording: Recording<T>): Promise<void> {
		await this.ensureDirectory();
		const metadataPath = this.metadataPath(recording.id);
		const eventsPath = this.eventsPath(recording.id);

		const metadataPayload = {
			metadata: recording.metadata,
			output: recording.output,
			error: recording.error,
		};

		await writeFile(
			metadataPath,
			JSON.stringify(metadataPayload, null, 2),
			"utf8",
		);

		const eventsPayload = recording.events
			.map((recorded) => JSON.stringify(recorded))
			.join("\n");
		await writeFile(
			eventsPath,
			eventsPayload ? `${eventsPayload}\n` : "",
			"utf8",
		);
	}

	async load<T>(id: string): Promise<Recording<T> | null> {
		const metadataPath = this.metadataPath(id);
		const metadataPayload = await this.readJsonFile(metadataPath);
		if (!metadataPayload) {
			return null;
		}

		const events = await this.readEvents(id);
		return {
			id,
			metadata: metadataPayload.metadata as RecordingMetadata,
			events,
			output: metadataPayload.output as T | undefined,
			error: metadataPayload.error as Recording<T>["error"],
		};
	}

	async list(query?: RecordingListQuery): Promise<RecordingMetadata[]> {
		const entries = await this.safeReadDir();
		const results: RecordingMetadata[] = [];
		for (const entry of entries) {
			if (!entry.endsWith(".json") || !entry.startsWith("recording-")) {
				continue;
			}
			const payload = await this.readJsonFile(join(this.directory, entry));
			if (!payload) {
				continue;
			}
			const metadata = payload.metadata as RecordingMetadata;
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

	private metadataPath(id: string): string {
		return join(this.directory, `recording-${id}.json`);
	}

	private eventsPath(id: string): string {
		return join(this.directory, `recording-${id}.jsonl`);
	}

	private async ensureDirectory(): Promise<void> {
		await mkdir(this.directory, { recursive: true });
	}

	private async safeReadDir(): Promise<string[]> {
		try {
			return await readdir(this.directory);
		} catch (error) {
			if (
				error instanceof Error &&
				(error as NodeJS.ErrnoException).code === "ENOENT"
			) {
				return [];
			}
			throw error;
		}
	}

	private async readJsonFile(path: string): Promise<{
		metadata: RecordingMetadata;
		output?: unknown;
		error?: Recording<unknown>["error"];
	} | null> {
		try {
			const raw = await readFile(path, "utf8");
			return JSON.parse(raw) as {
				metadata: RecordingMetadata;
				output?: unknown;
				error?: Recording<unknown>["error"];
			};
		} catch (error) {
			if (
				error instanceof Error &&
				(error as NodeJS.ErrnoException).code === "ENOENT"
			) {
				return null;
			}
			throw error;
		}
	}

	private async readEvents(id: string): Promise<RecordedEvent[]> {
		const eventsPath = this.eventsPath(id);
		try {
			const raw = await readFile(eventsPath, "utf8");
			if (!raw.trim()) {
				return [];
			}
			return raw
				.split("\n")
				.filter((line) => line.trim().length > 0)
				.map((line) => JSON.parse(line) as RecordedEvent);
		} catch (error) {
			if (
				error instanceof Error &&
				(error as NodeJS.ErrnoException).code === "ENOENT"
			) {
				return [];
			}
			throw error;
		}
	}
}
