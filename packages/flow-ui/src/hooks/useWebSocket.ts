/**
 * WebSocket Hook for Hub Connection
 *
 * Manages WebSocket connection to the kernel's WebSocket channel.
 * Provides connection status, event streaming, and command sending.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { ConnectionStatus, HubEvent, WSCommand, WSMessage } from "../types/index.js";

export interface UseWebSocketOptions {
	/** WebSocket server URL (default: ws://localhost:3001/ws) */
	url?: string;
	/** Auto-reconnect on disconnect (default: true) */
	autoReconnect?: boolean;
	/** Reconnect delay in ms (default: 3000) */
	reconnectDelay?: number;
	/** Event callback */
	onEvent?: (event: HubEvent) => void;
	/** Error callback */
	onError?: (error: string) => void;
}

export interface UseWebSocketReturn {
	/** Current connection status */
	status: ConnectionStatus;
	/** Send a command to the hub */
	sendCommand: (command: WSCommand) => void;
	/** Manually connect */
	connect: () => void;
	/** Manually disconnect */
	disconnect: () => void;
	/** Recent events (last 100) */
	events: HubEvent[];
}

/**
 * Hook for managing WebSocket connection to kernel hub.
 *
 * @example
 * ```tsx
 * const { status, sendCommand, events } = useWebSocket({
 *   url: "ws://localhost:3001/ws",
 *   onEvent: (event) => console.log("Event:", event),
 * });
 *
 * // Send a message to the hub
 * sendCommand({ type: "send", message: "Hello!" });
 * ```
 */
export function useWebSocket(options: UseWebSocketOptions = {}): UseWebSocketReturn {
	const { url = "ws://localhost:3001/ws", autoReconnect = true, reconnectDelay = 3000 } = options;

	const [status, setStatus] = useState<ConnectionStatus>("disconnected");
	const [events, setEvents] = useState<HubEvent[]>([]);

	const wsRef = useRef<WebSocket | null>(null);
	const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const shouldReconnectRef = useRef(autoReconnect);

	// Store callbacks in refs to avoid recreating connect function
	const onEventRef = useRef(options.onEvent);
	const onErrorRef = useRef(options.onError);

	// Update refs when callbacks change
	useEffect(() => {
		onEventRef.current = options.onEvent;
		onErrorRef.current = options.onError;
	}, [options.onEvent, options.onError]);

	// Clear reconnect timeout
	const clearReconnectTimeout = useCallback(() => {
		if (reconnectTimeoutRef.current) {
			clearTimeout(reconnectTimeoutRef.current);
			reconnectTimeoutRef.current = null;
		}
	}, []);

	// Connect to WebSocket
	const connect = useCallback(() => {
		// Don't connect if already connected or connecting
		if (wsRef.current?.readyState === WebSocket.OPEN || wsRef.current?.readyState === WebSocket.CONNECTING) {
			return;
		}

		setStatus("connecting");
		clearReconnectTimeout();

		try {
			const ws = new WebSocket(url);

			ws.onopen = () => {
				setStatus("connected");
			};

			ws.onclose = () => {
				setStatus("disconnected");
				wsRef.current = null;

				// Auto-reconnect if enabled
				if (shouldReconnectRef.current) {
					reconnectTimeoutRef.current = setTimeout(() => {
						connect();
					}, reconnectDelay);
				}
			};

			ws.onerror = () => {
				onErrorRef.current?.("WebSocket connection error");
			};

			ws.onmessage = (event) => {
				try {
					const message = JSON.parse(event.data) as WSMessage;

					if (message.type === "event") {
						const hubEvent = message as HubEvent;

						// Add to events (keep last 100)
						setEvents((prev) => {
							const next = [...prev, hubEvent];
							return next.slice(-100);
						});

						// Call event callback
						onEventRef.current?.(hubEvent);
					} else if (message.type === "error") {
						onErrorRef.current?.(message.error);
					}
					// Ack messages are silently ignored
				} catch {
					onErrorRef.current?.("Failed to parse WebSocket message");
				}
			};

			wsRef.current = ws;
		} catch (err) {
			setStatus("disconnected");
			onErrorRef.current?.(`Failed to connect: ${err instanceof Error ? err.message : "Unknown error"}`);
		}
	}, [url, reconnectDelay, clearReconnectTimeout]);

	// Disconnect from WebSocket
	const disconnect = useCallback(() => {
		shouldReconnectRef.current = false;
		clearReconnectTimeout();

		if (wsRef.current) {
			wsRef.current.close(1000, "Client disconnected");
			wsRef.current = null;
		}

		setStatus("disconnected");
	}, [clearReconnectTimeout]);

	// Send command to hub
	const sendCommand = useCallback((command: WSCommand) => {
		if (wsRef.current?.readyState !== WebSocket.OPEN) {
			onErrorRef.current?.("WebSocket not connected");
			return;
		}

		try {
			wsRef.current.send(JSON.stringify(command));
		} catch (err) {
			onErrorRef.current?.(`Failed to send command: ${err instanceof Error ? err.message : "Unknown error"}`);
		}
	}, []);

	// Auto-connect on mount
	useEffect(() => {
		shouldReconnectRef.current = autoReconnect;
		connect();

		return () => {
			shouldReconnectRef.current = false;
			clearReconnectTimeout();
			if (wsRef.current) {
				wsRef.current.close(1000, "Component unmounted");
			}
		};
	}, [connect, autoReconnect, clearReconnectTimeout]);

	return {
		status,
		sendCommand,
		connect,
		disconnect,
		events,
	};
}
