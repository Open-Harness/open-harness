import type { Runtime } from "../runtime/runtime.js";

/**
 * Transport interface for adapting runtime events/commands.
 */
export interface Transport {
	/** Start the transport. */
	start(): Promise<void>;
	/** Stop the transport. */
	stop(): Promise<void>;
}

/**
 * WebSocket transport options.
 *
 * @property {number} port - Listening port.
 * @property {string} [path] - WebSocket path.
 */
export interface WebSocketTransportOptions {
	port: number;
	path?: string;
}

/**
 * WebSocket transport adapter for the runtime.
 */
export declare class WebSocketTransport implements Transport {
	/**
	 * Create a WebSocket transport.
	 * @param runtime - Runtime instance.
	 * @param options - Transport options.
	 */
	constructor(runtime: Runtime, options: WebSocketTransportOptions);
	/** Start the transport. */
	start(): Promise<void>;
	/** Stop the transport. */
	stop(): Promise<void>;
}
