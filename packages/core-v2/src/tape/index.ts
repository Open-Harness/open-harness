/**
 * Tape Module - Time-Travel Debugging
 *
 * This module exports the Tape interface and related types for time-travel
 * debugging of recorded workflow sessions.
 *
 * @module @core-v2/tape
 */

// Types (consumer-facing, no Effect internals)
export type {
	ComputeStateOptions,
	OnUnknownEventCallback,
	Tape,
	TapeConfig,
	TapeControls,
	TapeMetadata,
	TapeStatus,
	UnknownEventWarning,
} from "./Tape.js";

// Factories and utilities
export { computeState, createTape, createTapeFromDefinitions } from "./Tape.js";
