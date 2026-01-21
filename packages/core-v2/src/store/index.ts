/**
 * Store Module - Public Exports
 *
 * Re-exports consumer-facing types for event persistence.
 * Internal Effect types (Store Context.Tag) are NOT exported here.
 *
 * @module @core-v2/store
 */

// Types and interfaces
// SessionId utilities
export type {
	PublicStore,
	SessionId,
	SessionMetadata,
	StateSnapshot,
	StoreErrorCode,
} from "./Store.js";
// Classes and errors
export { generateSessionId, makeSessionId, StoreError } from "./Store.js";
