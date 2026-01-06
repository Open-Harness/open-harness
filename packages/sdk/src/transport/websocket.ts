/**
 * Transport interface for adapting runtime events/commands.
 * This is a shared contract that all transport implementations must implement.
 *
 * WebSocketTransport has been moved to @open-harness/transport-websocket package.
 */
export interface Transport {
	/** Start the transport. */
	start(): Promise<void>;
	/** Stop the transport. */
	stop(): Promise<void>;
}
