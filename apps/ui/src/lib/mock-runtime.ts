import type { RunSnapshot, Runtime, RuntimeCommand, RuntimeEvent } from "@open-harness/sdk";

/**
 * MockRuntime that replays captured RuntimeEvents for UI demos.
 */
export class MockRuntime implements Runtime {
	private events: RuntimeEvent[] = [];
	private listeners: Set<(event: RuntimeEvent) => void> = new Set();
	private dispatchedCommands: RuntimeCommand[] = [];
	private isReplaying = false;

	constructor(events?: RuntimeEvent[]) {
		if (events) {
			this.events = events;
		}
	}

	/**
	 * Load events from a fixture file.
	 */
	loadEvents(events: RuntimeEvent[]): void {
		this.events = events;
	}

	/**
	 * Dispatch a command. For demo purposes, this triggers event replay.
	 */
	dispatch(command: RuntimeCommand): void {
		this.dispatchedCommands.push(command);

		// If it's a "send" command, start replaying events
		if (command.type === "send" && !this.isReplaying) {
			// Wait a tick to ensure listeners are registered
			setTimeout(() => {
				this.replayEvents();
			}, 0);
		}
	}

	/**
	 * Replay all loaded events asynchronously.
	 */
	private async replayEvents(): Promise<void> {
		if (this.isReplaying) {
			return;
		}

		this.isReplaying = true;

		// Filter to only agent events (skip flow/node lifecycle events for cleaner demo)
		const agentEvents = this.events.filter((e) => e.type.startsWith("agent:"));

		console.log(`[MockRuntime] Replaying ${agentEvents.length} agent events to ${this.listeners.size} listeners`);

		// Emit events with small delays to simulate streaming
		for (const event of agentEvents) {
			// Emit to all listeners
			for (const listener of this.listeners) {
				try {
					listener(event);
				} catch (error) {
					console.error("[MockRuntime] Error in event listener:", error);
				}
			}

			// Small delay between events to simulate real streaming
			await new Promise((resolve) => setTimeout(resolve, 10));
		}

		console.log("[MockRuntime] Finished replaying events");
		this.isReplaying = false;
	}

	/**
	 * Subscribe to runtime events.
	 */
	onEvent(listener: (event: RuntimeEvent) => void): () => void {
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	}

	/**
	 * Get current snapshot (minimal implementation for demo).
	 */
	getSnapshot(): RunSnapshot {
		return {
			status: this.isReplaying ? "running" : "idle",
			outputs: {},
			state: {},
			nodeStatus: {},
			edgeStatus: {},
			loopCounters: {},
			inbox: [],
			agentSessions: {},
		};
	}

	/**
	 * Run the runtime (no-op for mock).
	 */
	async run(_input?: Record<string, unknown>): Promise<RunSnapshot> {
		return this.getSnapshot();
	}

	/**
	 * Get dispatched commands (for debugging).
	 */
	getDispatchedCommands(): RuntimeCommand[] {
		return [...this.dispatchedCommands];
	}
}
