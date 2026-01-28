/**
 * ProviderRecorder service - records provider responses for deterministic replay.
 *
 * This is RECORDING/PLAYBACK, not caching:
 * - Recording: Store complete stream transcripts to disk
 * - Playback: Replay recorded streams deterministically
 *
 * Replaces AgentFixtureStore with a cleaner interface.
 *
 * @module
 */

import type { Effect } from "effect"
import { Context } from "effect"

import type { StoreError } from "../Domain/Errors.js"
import type { AgentRunResult, AgentStreamEvent } from "../Domain/Provider.js"

/**
 * A recorded provider response entry.
 */
export interface RecordingEntry {
  /** Hash of the request (includes prompt, schema, tools, etc.) */
  readonly hash: string
  /** The prompt that generated this response */
  readonly prompt: string
  /** Provider name (e.g., "anthropic") */
  readonly provider: string
  /** Streaming events in order (for replay) */
  readonly streamData: ReadonlyArray<AgentStreamEvent>
  /** Final result (for quick lookup) */
  readonly result: AgentRunResult
  /** When this was recorded */
  readonly recordedAt: Date
}

/**
 * Summary info for listing recorded entries.
 */
export interface RecordingEntryMeta {
  readonly hash: string
  readonly prompt: string
  readonly provider: string
  readonly recordedAt: Date
}

/**
 * Operations for provider response recording/playback.
 */
export interface ProviderRecorderService {
  /**
   * Load a recorded response by request hash.
   * Returns null if not found.
   */
  readonly load: (hash: string) => Effect.Effect<RecordingEntry | null, StoreError>

  /**
   * Save a complete recording entry (hash, events, result).
   * Used after streaming completes in live mode.
   *
   * @deprecated Use startRecording, appendEvent, finalizeRecording for crash-safe incremental recording.
   */
  readonly save: (entry: Omit<RecordingEntry, "recordedAt">) => Effect.Effect<void, StoreError>

  /**
   * Delete a recorded entry by hash.
   */
  readonly delete: (hash: string) => Effect.Effect<void, StoreError>

  /**
   * List all recorded entries (metadata only).
   */
  readonly list: () => Effect.Effect<ReadonlyArray<RecordingEntryMeta>, StoreError>

  // ─────────────────────────────────────────────────────────────────
  // Incremental Recording API (crash-safe)
  // ─────────────────────────────────────────────────────────────────

  /**
   * Start a new incremental recording session.
   * Events will be appended incrementally and persisted immediately.
   *
   * @param hash - The request hash for this recording
   * @param metadata - Recording metadata (prompt, provider)
   * @returns A unique recording ID to use with appendEvent and finalizeRecording
   */
  readonly startRecording: (
    hash: string,
    metadata: { prompt: string; provider: string }
  ) => Effect.Effect<string, StoreError>

  /**
   * Append a stream event to an in-progress recording.
   * The event is persisted immediately (crash-safe).
   *
   * @param recordingId - The recording ID from startRecording
   * @param event - The stream event to append
   */
  readonly appendEvent: (recordingId: string, event: AgentStreamEvent) => Effect.Effect<void, StoreError>

  /**
   * Finalize a recording after stream completion.
   * Marks the recording as complete and stores the final result.
   *
   * @param recordingId - The recording ID from startRecording
   * @param result - The final agent result
   */
  readonly finalizeRecording: (recordingId: string, result: AgentRunResult) => Effect.Effect<void, StoreError>
}

/**
 * Context.Tag for ProviderRecorder dependency injection.
 *
 * Used to record/playback provider responses.
 *
 * @example
 * ```typescript
 * import { Effect } from "effect"
 * import { ProviderRecorder } from "@open-scaffold/core"
 *
 * const replayRecording = Effect.gen(function*() {
 *   const recorder = yield* ProviderRecorder
 *   const entry = yield* recorder.load("hash123")
 *   if (entry) {
 *     // Replay recorded events
 *     for (const event of entry.streamData) {
 *       // ...
 *     }
 *   }
 * })
 * ```
 */
export class ProviderRecorder extends Context.Tag("@open-scaffold/ProviderRecorder")<
  ProviderRecorder,
  ProviderRecorderService
>() {}
