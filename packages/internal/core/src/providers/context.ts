import type { StreamEvent } from "./events.js";

/**
 * Minimal execution context passed to provider implementations.
 * 
 * This is intentionally minimal to avoid leaking runtime concerns
 * into provider implementations.
 */
export interface ExecutionContext {
	/**
	 * Abort signal for cancellation.
	 * 
	 * Provider should check `signal.aborted` periodically and
	 * throw if true. The adapter will handle converting this
	 * to a proper ProviderError.
	 */
	readonly signal: AbortSignal;
	
	/**
	 * Emit a stream event.
	 * 
	 * Called by provider as events occur (text deltas, tool calls, etc).
	 * The adapter will normalize these and forward to the runtime.
	 * 
	 * @param event - Stream event to emit
	 */
	readonly emit: (event: StreamEvent) => void;
}
