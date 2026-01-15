/**
 * FileSignalStore - File-based implementation of SignalStore
 *
 * Storage format:
 * - Each recording is a directory: {baseDir}/{recordingId}/
 * - Metadata: metadata.json
 * - Signals: signals.jsonl (append-only)
 * - Checkpoints: checkpoints.json
 *
 * @example
 * ```ts
 * const store = new FileSignalStore({ baseDir: ".test-recordings" });
 *
 * const id = await store.create({ name: "test" });
 * await store.append(id, signal1);
 * await store.append(id, signal2);
 * await store.finalize(id);
 *
 * const recording = await store.load(id);
 * ```
 */

import { access, appendFile, mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Signal } from "@internal/signals-core";
import type { Checkpoint, Recording, RecordingMetadata, RecordingQuery, SignalStore } from "./store.js";

// ============================================================================
// Internal Types
// ============================================================================

/**
 * Mutable version of RecordingMetadata for internal file storage.
 * RecordingMetadata has readonly properties, but we need to mutate them during
 * recording operations (append, finalize).
 */
interface StoredMetadata {
	id: string;
	createdAt: string;
	name?: string;
	tags?: string[];
	harnessType?: string;
	signalCount: number;
	durationMs?: number;
	finalized: boolean;
}

// ============================================================================
// FileSignalStore
// ============================================================================

export interface FileSignalStoreOptions {
	/** Base directory for recordings */
	baseDir: string;
}

/**
 * File-based SignalStore implementation.
 *
 * Stores recordings as directories with JSONL signal files.
 * Suitable for testing, debugging, and lightweight persistence.
 */
export class FileSignalStore implements SignalStore {
	private readonly baseDir: string;
	private nextId = 1;

	constructor(options: FileSignalStoreOptions) {
		this.baseDir = options.baseDir;
	}

	/**
	 * Generate a unique recording ID
	 */
	private generateId(): string {
		return `rec_${Date.now()}_${this.nextId++}`;
	}

	/**
	 * Get the directory path for a recording
	 */
	private getRecordingDir(recordingId: string): string {
		return join(this.baseDir, recordingId);
	}

	/**
	 * Get the metadata file path for a recording
	 */
	private getMetadataPath(recordingId: string): string {
		return join(this.getRecordingDir(recordingId), "metadata.json");
	}

	/**
	 * Get the signals file path for a recording
	 */
	private getSignalsPath(recordingId: string): string {
		return join(this.getRecordingDir(recordingId), "signals.jsonl");
	}

	/**
	 * Get the checkpoints file path for a recording
	 */
	private getCheckpointsPath(recordingId: string): string {
		return join(this.getRecordingDir(recordingId), "checkpoints.json");
	}

	/**
	 * Read metadata for a recording
	 */
	private async readMetadata(recordingId: string): Promise<StoredMetadata | null> {
		try {
			const content = await readFile(this.getMetadataPath(recordingId), "utf-8");
			return JSON.parse(content) as StoredMetadata;
		} catch {
			return null;
		}
	}

	/**
	 * Write metadata for a recording
	 */
	private async writeMetadata(recordingId: string, metadata: StoredMetadata): Promise<void> {
		await writeFile(this.getMetadataPath(recordingId), JSON.stringify(metadata, null, 2));
	}

	async create(options?: { name?: string; tags?: string[]; harnessType?: string }): Promise<string> {
		const id = this.generateId();
		const now = new Date().toISOString();

		// Create recording directory
		await mkdir(this.getRecordingDir(id), { recursive: true });

		// Write initial metadata
		const metadata: StoredMetadata = {
			id,
			createdAt: now,
			name: options?.name,
			tags: options?.tags,
			harnessType: options?.harnessType,
			signalCount: 0,
			finalized: false,
		};
		await this.writeMetadata(id, metadata);

		// Create empty signals file
		await writeFile(this.getSignalsPath(id), "");

		// Create empty checkpoints file
		await writeFile(this.getCheckpointsPath(id), "[]");

		return id;
	}

	async append(recordingId: string, signal: Signal): Promise<void> {
		const metadata = await this.readMetadata(recordingId);
		if (!metadata) {
			throw new Error(`Recording not found: ${recordingId}`);
		}
		if (metadata.finalized) {
			throw new Error(`Recording is finalized: ${recordingId}`);
		}

		// Append signal as JSONL
		await appendFile(this.getSignalsPath(recordingId), JSON.stringify(signal) + "\n");

		// Update metadata
		metadata.signalCount++;
		await this.writeMetadata(recordingId, metadata);
	}

	async appendBatch(recordingId: string, signals: Signal[]): Promise<void> {
		const metadata = await this.readMetadata(recordingId);
		if (!metadata) {
			throw new Error(`Recording not found: ${recordingId}`);
		}
		if (metadata.finalized) {
			throw new Error(`Recording is finalized: ${recordingId}`);
		}

		// Append all signals as JSONL
		const content = signals.map((s) => JSON.stringify(s)).join("\n") + (signals.length > 0 ? "\n" : "");
		await appendFile(this.getSignalsPath(recordingId), content);

		// Update metadata
		metadata.signalCount += signals.length;
		await this.writeMetadata(recordingId, metadata);
	}

	async checkpoint(recordingId: string, name: string): Promise<void> {
		const metadata = await this.readMetadata(recordingId);
		if (!metadata) {
			throw new Error(`Recording not found: ${recordingId}`);
		}

		// Read existing checkpoints
		const checkpointsContent = await readFile(this.getCheckpointsPath(recordingId), "utf-8");
		const checkpoints: Checkpoint[] = JSON.parse(checkpointsContent);

		// Add new checkpoint
		checkpoints.push({
			name,
			index: metadata.signalCount - 1,
			timestamp: new Date().toISOString(),
		});

		// Write updated checkpoints
		await writeFile(this.getCheckpointsPath(recordingId), JSON.stringify(checkpoints, null, 2));
	}

	async getCheckpoints(recordingId: string): Promise<Checkpoint[]> {
		const metadata = await this.readMetadata(recordingId);
		if (!metadata) {
			throw new Error(`Recording not found: ${recordingId}`);
		}

		const content = await readFile(this.getCheckpointsPath(recordingId), "utf-8");
		return JSON.parse(content) as Checkpoint[];
	}

	async finalize(recordingId: string, durationMs?: number): Promise<void> {
		const metadata = await this.readMetadata(recordingId);
		if (!metadata) {
			throw new Error(`Recording not found: ${recordingId}`);
		}

		metadata.finalized = true;
		if (durationMs !== undefined) {
			metadata.durationMs = durationMs;
		}
		await this.writeMetadata(recordingId, metadata);
	}

	async load(recordingId: string): Promise<Recording | null> {
		const metadata = await this.readMetadata(recordingId);
		if (!metadata) {
			return null;
		}

		// Read signals from JSONL
		const signalsContent = await readFile(this.getSignalsPath(recordingId), "utf-8");
		const signals: Signal[] = signalsContent
			.split("\n")
			.filter((line) => line.trim())
			.map((line) => JSON.parse(line) as Signal);

		// Return recording with metadata as RecordingMetadata type
		const publicMetadata: RecordingMetadata = {
			id: metadata.id,
			createdAt: metadata.createdAt,
			name: metadata.name,
			tags: metadata.tags,
			harnessType: metadata.harnessType,
			signalCount: metadata.signalCount,
			durationMs: metadata.durationMs,
		};
		return {
			metadata: publicMetadata,
			signals,
		};
	}

	async loadSignals(
		recordingId: string,
		options?: {
			fromIndex?: number;
			toIndex?: number;
			patterns?: string[];
		},
	): Promise<Signal[]> {
		const recording = await this.load(recordingId);
		if (!recording) {
			throw new Error(`Recording not found: ${recordingId}`);
		}

		let signals = [...recording.signals];

		// Apply range filter
		const from = options?.fromIndex ?? 0;
		const to = options?.toIndex ?? signals.length;
		signals = signals.slice(from, to);

		// Apply pattern filter
		if (options?.patterns && options.patterns.length > 0) {
			const regexes = options.patterns.map((p) => patternToRegex(p));
			signals = signals.filter((s) => regexes.some((r) => r.test(s.name)));
		}

		return signals;
	}

	async list(query?: RecordingQuery): Promise<RecordingMetadata[]> {
		// Ensure base directory exists
		try {
			await access(this.baseDir);
		} catch {
			return [];
		}

		// Read all recording directories
		const entries = await readdir(this.baseDir, { withFileTypes: true });
		const recordingDirs = entries.filter((e) => e.isDirectory() && e.name.startsWith("rec_"));

		// Load metadata for each
		const metadataPromises = recordingDirs.map(async (dir) => {
			const metadata = await this.readMetadata(dir.name);
			if (metadata) {
				// Return as RecordingMetadata without internal finalized flag
				const result: RecordingMetadata = {
					id: metadata.id,
					createdAt: metadata.createdAt,
					name: metadata.name,
					tags: metadata.tags,
					harnessType: metadata.harnessType,
					signalCount: metadata.signalCount,
					durationMs: metadata.durationMs,
				};
				return result;
			}
			return null;
		});

		const allResults = await Promise.all(metadataPromises);
		let results: RecordingMetadata[] = allResults.filter((m): m is RecordingMetadata => m !== null);

		// Filter by harness type
		if (query?.harnessType) {
			results = results.filter((m) => m.harnessType === query.harnessType);
		}

		// Filter by tags
		if (query?.tags && query.tags.length > 0) {
			const queryTags = query.tags;
			results = results.filter((m) => m.tags?.some((t) => queryTags.includes(t)));
		}

		// Sort by creation time (newest first)
		results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

		// Apply pagination
		const offset = query?.offset ?? 0;
		const limit = query?.limit ?? results.length;
		results = results.slice(offset, offset + limit);

		return results;
	}

	async delete(recordingId: string): Promise<void> {
		const dir = this.getRecordingDir(recordingId);
		try {
			await rm(dir, { recursive: true });
		} catch {
			// Ignore if doesn't exist
		}
	}

	async exists(recordingId: string): Promise<boolean> {
		try {
			await access(this.getMetadataPath(recordingId));
			return true;
		} catch {
			return false;
		}
	}

	/**
	 * Delete all recordings (useful for test cleanup)
	 */
	async clear(): Promise<void> {
		try {
			await rm(this.baseDir, { recursive: true });
		} catch {
			// Ignore if doesn't exist
		}
	}
}

// ============================================================================
// Helpers
// ============================================================================

function patternToRegex(pattern: string): RegExp {
	// Escape special regex characters except *
	const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
	// Replace * with .* for wildcard matching
	const regexStr = escaped.replace(/\*/g, ".*");
	return new RegExp(`^${regexStr}$`);
}
