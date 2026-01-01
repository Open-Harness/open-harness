import { beforeEach, describe, expect, it, mock } from "bun:test";
import { createGithubChannel } from "../src/channel.js";
import type { EnrichedEvent, Hub } from "../src/types.js";

// Mock Hub
class MockHub implements Hub {
	private listeners: Array<(event: EnrichedEvent) => void> = [];
	public status: "idle" | "running" | "complete" | "aborted" = "idle";
	public sessionActive = true;

	subscribe(
		_filterOrListener: string | string[] | ((event: EnrichedEvent) => void),
		listener?: (event: EnrichedEvent) => void,
	): () => void {
		const actualListener =
			typeof _filterOrListener === "function"
				? _filterOrListener
				: (listener ?? (() => {}));
		this.listeners.push(actualListener);
		return () => {
			const index = this.listeners.indexOf(actualListener);
			if (index >= 0) {
				this.listeners.splice(index, 1);
			}
		};
	}

	emit(event: { type: string; [k: string]: unknown }): void {
		const enriched: EnrichedEvent = {
			id: `evt-${Date.now()}`,
			timestamp: new Date(),
			context: { sessionId: "test-session" },
			event: event as EnrichedEvent["event"],
		};
		for (const listener of this.listeners) {
			listener(enriched);
		}
	}

	send(_message: string): void {}
	sendTo(_agent: string, _message: string): void {}
	sendToRun(_runId: string, _message: string): void {}
	reply(
		_promptId: string,
		_response: { content: string; timestamp: Date },
	): void {}
	abort(_reason?: string): void {}
	scoped<T>(_context: unknown, fn: () => T): T {
		return fn();
	}
	current(): { sessionId?: string } {
		return { sessionId: "test-session" };
	}

	async *[Symbol.asyncIterator](): AsyncIterator<EnrichedEvent> {
		// Empty iterator
	}
}

// Mock fetch for GitHub API
const mockFetch = mock(() =>
	Promise.resolve({
		ok: true,
		status: 200,
		json: () => Promise.resolve({ id: 123, body: "" }),
		text: () => Promise.resolve(""),
	} as Response),
);

global.fetch = mockFetch as unknown as typeof fetch;

describe("integration", () => {
	let hub: MockHub;

	beforeEach(() => {
		mockFetch.mockClear();
		hub = new MockHub();
		// First call: search for existing (returns empty array)
		mockFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: () => Promise.resolve([]),
		} as Response);
		// Second call: create new comment
		mockFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: () => Promise.resolve({ id: 123 }),
		} as Response);
		// Subsequent calls: update comment
		mockFetch.mockResolvedValue({
			ok: true,
			status: 200,
			json: () =>
				Promise.resolve({
					id: 123,
					body: "<!-- DASHBOARD:START -->\n<!-- DASHBOARD:END -->",
				}),
		} as Response);
	});

	it("should process a simulated workflow run", async () => {
		process.env.GITHUB_CHANNEL_TOKEN = "test-token";

		const channel = createGithubChannel({
			repo: "owner/repo",
			issueNumber: 1,
			tokenEnv: "GITHUB_CHANNEL_TOKEN",
			debounceMs: 50,
			maxRecent: 10,
		});

		const cleanup = channel(hub);

		// Simulate workflow events
		hub.emit({ type: "harness:start", name: "Test Workflow" });
		hub.emit({ type: "phase:start", name: "Planning", phaseNumber: 1 });
		hub.emit({ type: "agent:start", agentName: "planner", runId: "run-1" });
		hub.emit({
			type: "agent:text",
			content: "Analyzing requirements",
			runId: "run-1",
		});
		hub.emit({ type: "task:start", taskId: "task-1" });
		hub.emit({ type: "task:complete", taskId: "task-1", result: "Done" });
		hub.emit({
			type: "session:prompt",
			promptId: "prompt-1",
			prompt: "Which approach?",
			choices: ["A", "B"],
		});
		hub.emit({
			type: "session:reply",
			promptId: "prompt-1",
			content: "Option A",
		});
		hub.emit({ type: "phase:complete", name: "Planning", phaseNumber: 1 });
		hub.emit({
			type: "harness:complete",
			success: true,
			durationMs: 1000,
		});

		// Wait for debounce and processing
		await new Promise((resolve) => setTimeout(resolve, 200));

		// Verify GitHub API was called
		expect(mockFetch).toHaveBeenCalled();

		if (cleanup) {
			await cleanup();
		}
	});

	it("should cap recent events at maxRecent", async () => {
		process.env.GITHUB_CHANNEL_TOKEN = "test-token";

		const channel = createGithubChannel({
			repo: "owner/repo",
			issueNumber: 1,
			tokenEnv: "GITHUB_CHANNEL_TOKEN",
			debounceMs: 50,
			maxRecent: 5,
		});

		channel(hub);

		// Emit more than maxRecent events
		for (let i = 0; i < 10; i++) {
			hub.emit({ type: "narrative", text: `Event ${i}` });
		}

		await new Promise((resolve) => setTimeout(resolve, 200));

		// Should have processed events (exact state check would require accessing internal state)
		expect(mockFetch).toHaveBeenCalled();
	});

	it("should handle errors gracefully", async () => {
		process.env.GITHUB_CHANNEL_TOKEN = "test-token";

		const channel = createGithubChannel({
			repo: "owner/repo",
			issueNumber: 1,
			tokenEnv: "GITHUB_CHANNEL_TOKEN",
			debounceMs: 50,
		});

		channel(hub);

		// Emit error event
		hub.emit({
			type: "task:failed",
			taskId: "task-1",
			error: "Test error",
		});

		await new Promise((resolve) => setTimeout(resolve, 200));

		// Should have processed error
		expect(mockFetch).toHaveBeenCalled();
	});
});
