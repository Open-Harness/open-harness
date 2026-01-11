/**
 * MemorySignalStore - In-memory implementation of SignalStore
 *
 * Useful for:
 * - Testing
 * - Short-lived recordings
 * - Development/debugging
 */

import type { Signal } from "@internal/signals-core";
import type { Checkpoint, Recording, RecordingMetadata, RecordingQuery, SignalStore } from "./store.js";

// ============================================================================
// Internal Types
// ============================================================================

interface RecordingState {
	metadata: RecordingMetadata;
	signals: Signal[];
	checkpoints: Checkpoint[];
	finalized: boolean;
}

// ============================================================================
// MemorySignalStore
// ============================================================================

/**
 * In-memory SignalStore implementation
 *
 * @example
 * ```ts
 * const store = new MemorySignalStore();
 *
 * const id = await store.create({ name: "test" });
 * await store.append(id, signal1);
 * await store.append(id, signal2);
 * await store.finalize(id);
 *
 * const recording = await store.load(id);
 * ```
 */
export class MemorySignalStore implements SignalStore {
	private recordings: Map<string, RecordingState> = new Map();
	private nextId = 1;

	/**
	 * Generate a unique recording ID
	 */
	private generateId(): string {
		return `rec_${Date.now()}_${this.nextId++}`;
	}

	async create(options?: { name?: string; tags?: string[]; providerType?: string }): Promise<string> {
		const id = this.generateId();
		const now = new Date().toISOString();

		const state: RecordingState = {
			metadata: {
				id,
				createdAt: now,
				name: options?.name,
				tags: options?.tags,
				providerType: options?.providerType,
				signalCount: 0,
			},
			signals: [],
			checkpoints: [],
			finalized: false,
		};

		this.recordings.set(id, state);
		return id;
	}

	async append(recordingId: string, signal: Signal): Promise<void> {
		const state = this.recordings.get(recordingId);
		if (!state) {
			throw new Error(`Recording not found: ${recordingId}`);
		}
		if (state.finalized) {
			throw new Error(`Recording is finalized: ${recordingId}`);
		}

		state.signals.push(signal);
		state.metadata = {
			...state.metadata,
			signalCount: state.signals.length,
		};
	}

	async appendBatch(recordingId: string, signals: Signal[]): Promise<void> {
		const state = this.recordings.get(recordingId);
		if (!state) {
			throw new Error(`Recording not found: ${recordingId}`);
		}
		if (state.finalized) {
			throw new Error(`Recording is finalized: ${recordingId}`);
		}

		state.signals.push(...signals);
		state.metadata = {
			...state.metadata,
			signalCount: state.signals.length,
		};
	}

	async checkpoint(recordingId: string, name: string): Promise<void> {
		const state = this.recordings.get(recordingId);
		if (!state) {
			throw new Error(`Recording not found: ${recordingId}`);
		}

		state.checkpoints.push({
			name,
			index: state.signals.length - 1,
			timestamp: new Date().toISOString(),
		});
	}

	async getCheckpoints(recordingId: string): Promise<Checkpoint[]> {
		const state = this.recordings.get(recordingId);
		if (!state) {
			throw new Error(`Recording not found: ${recordingId}`);
		}

		return [...state.checkpoints];
	}

	async finalize(recordingId: string, durationMs?: number): Promise<void> {
		const state = this.recordings.get(recordingId);
		if (!state) {
			throw new Error(`Recording not found: ${recordingId}`);
		}

		state.finalized = true;
		if (durationMs !== undefined) {
			state.metadata = {
				...state.metadata,
				durationMs,
			};
		}
	}

	async load(recordingId: string): Promise<Recording | null> {
		const state = this.recordings.get(recordingId);
		if (!state) {
			return null;
		}

		return {
			metadata: state.metadata,
			signals: [...state.signals],
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
		const state = this.recordings.get(recordingId);
		if (!state) {
			throw new Error(`Recording not found: ${recordingId}`);
		}

		let signals = state.signals;

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
		let results = Array.from(this.recordings.values()).map((s) => s.metadata);

		// Filter by provider type
		if (query?.providerType) {
			results = results.filter((m) => m.providerType === query.providerType);
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
		this.recordings.delete(recordingId);
	}

	async exists(recordingId: string): Promise<boolean> {
		return this.recordings.has(recordingId);
	}

	/**
	 * Clear all recordings (useful for testing)
	 */
	clear(): void {
		this.recordings.clear();
		this.nextId = 1;
	}

	/**
	 * Get count of recordings (useful for testing)
	 */
	count(): number {
		return this.recordings.size;
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
