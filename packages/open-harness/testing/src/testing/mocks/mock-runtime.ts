import type { RunSnapshot, Runtime, RuntimeCommand, RuntimeEvent, RuntimeEventListener } from "@open-harness/core";

/**
 * Mock runtime for testing transports and other runtime consumers.
 * Provides a simple implementation of the Runtime interface for unit tests.
 */
export class MockRuntime implements Runtime {
	private listeners: RuntimeEventListener[] = [];
	private dispatchedCommands: RuntimeCommand[] = [];

	onEvent(listener: RuntimeEventListener): () => void {
		this.listeners.push(listener);
		return () => {
			const index = this.listeners.indexOf(listener);
			if (index > -1) {
				this.listeners.splice(index, 1);
			}
		};
	}

	dispatch(command: RuntimeCommand): void {
		this.dispatchedCommands.push(command);
	}

	getSnapshot(): RunSnapshot {
		return {
			runId: "mock-run-id",
			status: "idle",
			state: {},
			outputs: {},
			nodeStatus: {},
			edgeStatus: {},
			loopCounters: {},
			inbox: [],
			agentSessions: {},
		};
	}

	async run(): Promise<RunSnapshot> {
		return this.getSnapshot();
	}

	/**
	 * Emit an event to all listeners (for testing).
	 */
	emit(event: RuntimeEvent): void {
		for (const listener of this.listeners) {
			listener(event);
		}
	}

	/**
	 * Get all dispatched commands (for testing).
	 */
	getDispatchedCommands(): RuntimeCommand[] {
		return [...this.dispatchedCommands];
	}

	/**
	 * Clear dispatched commands (for testing).
	 */
	clearDispatchedCommands(): void {
		this.dispatchedCommands = [];
	}
}
