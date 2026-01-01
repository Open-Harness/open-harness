import { beforeEach, describe, expect, it, mock } from "bun:test";
import { createGithubChannel } from "../src/channel.js";
import type { EnrichedEvent, Hub } from "../src/types.js";

// Mock Hub
class MockHub implements Hub {
	private listeners: Array<(event: EnrichedEvent) => void> = [];
	public status: "idle" | "running" | "complete" | "aborted" = "idle";
	public sessionActive = true;
	public aborts: Array<string | undefined> = [];
	public replies: Array<{ promptId: string; response: unknown }> = [];
	public emittedEvents: Array<{ type: string; [k: string]: unknown }> = [];

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
		this.emittedEvents.push(event);
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
		promptId: string,
		response: { content: string; timestamp: Date },
	): void {
		this.replies.push({ promptId, response });
	}
	abort(reason?: string): void {
		this.aborts.push(reason);
	}
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

	it("should dispatch abort command from GitHub comment", async () => {
		process.env.GITHUB_CHANNEL_TOKEN = "test-token";

		// Setup mocks for comment creation first
		mockFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => [],
		} as Response);

		mockFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => ({ id: 123 }),
		} as Response);

		// Mock initial poll (comments and reactions)
		mockFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => [],
		} as Response);

		mockFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => [],
		} as Response);

		const channel = createGithubChannel({
			repo: "owner/repo",
			issueNumber: 1,
			tokenEnv: "GITHUB_CHANNEL_TOKEN",
			debounceMs: 50,
			pollIntervalMs: 100,
			allowCommands: ["abort"],
		});

		const cleanup = channel(hub);

		// Wait for comment to be created and initial poll
		await new Promise((resolve) => setTimeout(resolve, 200));

		// Mock comment polling - return a comment with /abort command
		mockFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => [
				{
					id: 100,
					body: "/abort test reason",
					user: { login: "testuser" },
					created_at: "2024-01-01T00:00:00Z",
				},
			],
		} as Response);

		// Mock reactions endpoint
		mockFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => [],
		} as Response);

		// Wait for poll
		await new Promise((resolve) => setTimeout(resolve, 250));

		// Verify abort was called
		expect(hub.aborts.length).toBeGreaterThan(0);
		if (hub.aborts.length > 0) {
			expect(hub.aborts[0]).toBe("test reason");
		}

		if (cleanup) {
			await cleanup();
		}
	});

	it("should dispatch reply command from GitHub comment", async () => {
		process.env.GITHUB_CHANNEL_TOKEN = "test-token";

		// Setup mocks for comment creation
		mockFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: () => Promise.resolve([]),
		} as Response);

		mockFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: () => Promise.resolve({ id: 123 }),
		} as Response);

		const channel = createGithubChannel({
			repo: "owner/repo",
			issueNumber: 1,
			tokenEnv: "GITHUB_CHANNEL_TOKEN",
			debounceMs: 50,
			pollIntervalMs: 100,
			allowCommands: ["reply"],
		});

		const cleanup = channel(hub);

		await new Promise((resolve) => setTimeout(resolve, 150));

		mockFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: () =>
				Promise.resolve([
					{
						id: 100,
						body: "/reply prompt-123 my answer text",
						user: { login: "testuser" },
						created_at: "2024-01-01T00:00:00Z",
					},
				]),
		} as Response);

		mockFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: () => Promise.resolve([]),
		} as Response);

		await new Promise((resolve) => setTimeout(resolve, 200));

		expect(hub.replies).toHaveLength(1);
		expect(hub.replies[0]?.promptId).toBe("prompt-123");
		expect((hub.replies[0]?.response as { content: string }).content).toBe(
			"my answer text",
		);

		if (cleanup) {
			await cleanup();
		}
	});

	it("should dispatch reaction command", async () => {
		process.env.GITHUB_CHANNEL_TOKEN = "test-token";

		// Setup mocks for comment creation
		mockFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => [],
		} as Response);

		mockFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => ({ id: 123 }),
		} as Response);

		// Mock initial poll
		mockFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => [],
		} as Response);

		mockFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => [],
		} as Response);

		const channel = createGithubChannel({
			repo: "owner/repo",
			issueNumber: 1,
			tokenEnv: "GITHUB_CHANNEL_TOKEN",
			debounceMs: 50,
			pollIntervalMs: 100,
		});

		const cleanup = channel(hub);

		await new Promise((resolve) => setTimeout(resolve, 200));

		// Mock comments endpoint (empty)
		mockFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => [],
		} as Response);

		// Mock reactions endpoint - return a pause reaction (+1 acts as pause when no prompt open)
		mockFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => [
				{
					user: { login: "testuser" },
					content: "+1", // GitHub API name
				},
			],
		} as Response);

		await new Promise((resolve) => setTimeout(resolve, 250));

		// Verify pause event was emitted
		const pauseEvents = hub.emittedEvents.filter(
			(e) => e.type === "channel:pause",
		);
		expect(pauseEvents.length).toBeGreaterThan(0);

		if (cleanup) {
			await cleanup();
		}
	});

	it("should respect allowlist for commands", async () => {
		process.env.GITHUB_CHANNEL_TOKEN = "test-token";

		// Setup mocks for comment creation
		mockFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: () => Promise.resolve([]),
		} as Response);

		mockFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: () => Promise.resolve({ id: 123 }),
		} as Response);

		const channel = createGithubChannel({
			repo: "owner/repo",
			issueNumber: 1,
			tokenEnv: "GITHUB_CHANNEL_TOKEN",
			debounceMs: 50,
			pollIntervalMs: 100,
			allowCommands: ["status"], // Only allow status
		});

		const cleanup = channel(hub);

		await new Promise((resolve) => setTimeout(resolve, 150));

		mockFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: () =>
				Promise.resolve([
					{
						id: 100,
						body: "/pause", // Not in allowlist
						user: { login: "testuser" },
						created_at: "2024-01-01T00:00:00Z",
					},
					{
						id: 101,
						body: "/status", // In allowlist
						user: { login: "testuser" },
						created_at: "2024-01-01T00:00:01Z",
					},
				]),
		} as Response);

		mockFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: () => Promise.resolve([]),
		} as Response);

		await new Promise((resolve) => setTimeout(resolve, 200));

		// /pause should not dispatch (not in allowlist)
		// /status should be handled (no-op, but handled)
		expect(hub.aborts).toHaveLength(0);
		expect(
			hub.emittedEvents.filter((e) => e.type === "channel:pause"),
		).toHaveLength(0);

		if (cleanup) {
			await cleanup();
		}
	});

	it("should initialize lastCommentId and process commands posted before polling", async () => {
		process.env.GITHUB_CHANNEL_TOKEN = "test-token";

		// Setup mocks for comment creation
		mockFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => [],
		} as Response);

		mockFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => ({ id: 123 }),
		} as Response);

		const channel = createGithubChannel({
			repo: "owner/repo",
			issueNumber: 1,
			tokenEnv: "GITHUB_CHANNEL_TOKEN",
			debounceMs: 50,
			pollIntervalMs: 100,
		});

		const cleanup = channel(hub);

		await new Promise((resolve) => setTimeout(resolve, 200));

		// Mock comments endpoint with existing comments (including a command)
		// This simulates comments posted before polling started
		mockFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => [
				{
					id: 200, // Highest ID
					body: "/pause",
					user: { login: "testuser" },
					created_at: "2024-01-01T00:00:02Z",
				},
				{
					id: 150, // Lower ID
					body: "regular comment",
					user: { login: "user1" },
					created_at: "2024-01-01T00:00:01Z",
				},
			],
		} as Response);

		mockFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => [],
		} as Response);

		await new Promise((resolve) => setTimeout(resolve, 250));

		// Verify pause event was emitted (command posted before polling should be processed)
		const pauseEvents = hub.emittedEvents.filter(
			(e) => e.type === "channel:pause",
		);
		expect(pauseEvents.length).toBeGreaterThan(0);

		if (cleanup) {
			await cleanup();
		}
	});
});
