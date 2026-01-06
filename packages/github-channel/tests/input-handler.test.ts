import { beforeEach, describe, expect, it, mock } from "bun:test";
import pino from "pino";
import { GithubInputHandler } from "../src/input-handler.js";
import type { EnrichedEvent, Hub } from "../src/types.js";

class MockHub implements Hub {
	public status: "idle" | "running" | "complete" | "aborted" = "idle";
	public sessionActive = true;
	public events: Array<{ type: string; [k: string]: unknown }> = [];
	public replies: Array<{ promptId: string; response: unknown }> = [];
	public aborts: Array<string | undefined> = [];

	subscribe() {
		return () => {};
	}

	emit(event: { type: string; [k: string]: unknown }): void {
		this.events.push(event);
	}

	scoped<T>(_context: unknown, fn: () => T): T {
		return fn();
	}

	current(): { sessionId?: string } {
		return { sessionId: "test-session" };
	}

	send(_message: string): void {}
	sendTo(_agent: string, _message: string): void {}
	sendToRun(_runId: string, _message: string): void {}

	reply(promptId: string, response: unknown): void {
		this.replies.push({ promptId, response });
	}

	abort(reason?: string): void {
		this.aborts.push(reason);
	}

	async *[Symbol.asyncIterator](): AsyncIterator<EnrichedEvent> {
		// Empty iterator
	}
}

const mockGithubFetch = mock(() =>
	Promise.resolve({
		ok: true,
		status: 200,
		json: () => Promise.resolve([]),
	} as Response),
);

global.fetch = mockGithubFetch as unknown as typeof fetch;

describe("GithubInputHandler", () => {
	let hub: MockHub;
	let handler: GithubInputHandler;
	const config = {
		repo: "owner/repo",
		issueNumber: 1,
		token: "test-token",
		allowCommands: ["pause", "resume", "abort", "status", "reply", "choose"],
		pollIntervalMs: 1000,
	};

	beforeEach(() => {
		mockGithubFetch.mockClear();
		hub = new MockHub();
		handler = new GithubInputHandler(
			config,
			123, // managedCommentId
			hub,
			() => undefined, // getOpenPromptId
			pino({ level: "silent" }),
		);
	});

	it("should poll comments and dispatch commands", async () => {
		mockGithubFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: () =>
				Promise.resolve([
					{
						id: 100,
						body: "/pause",
						user: { login: "testuser" },
						created_at: "2024-01-01T00:00:00Z",
					},
				]),
		} as Response);

		// Mock reactions endpoint
		mockGithubFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: () => Promise.resolve([]),
		} as Response);

		await handler.poll();

		// Command dispatch emits the command event + a narrative entry for dashboard visibility
		expect(hub.events.map((e) => e.type)).toContain("channel:pause");
		expect(hub.events.map((e) => e.type)).toContain("narrative");
	});

	it("should skip managed comment", async () => {
		mockGithubFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: () =>
				Promise.resolve([
					{
						id: 123, // This is the managed comment ID
						body: "/pause",
						user: { login: "bot" },
						created_at: "2024-01-01T00:00:00Z",
					},
				]),
		} as Response);

		mockGithubFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: () => Promise.resolve([]),
		} as Response);

		await handler.poll();

		expect(hub.events).toHaveLength(0);
	});

	it("should respect allowlist", async () => {
		const restrictedHandler = new GithubInputHandler(
			{
				...config,
				allowCommands: ["status"], // Only allow status
			},
			123,
			hub,
			() => undefined,
			pino({ level: "silent" }),
		);

		mockGithubFetch.mockResolvedValueOnce({
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

		mockGithubFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: () => Promise.resolve([]),
		} as Response);

		await restrictedHandler.poll();

		// /pause should be ignored, /status should be handled (no-op) but still yields narrative
		expect(hub.events.map((e) => e.type)).toContain("narrative");
	});

	it("should poll reactions and dispatch commands", async () => {
		mockGithubFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: () => Promise.resolve([]),
		} as Response);

		mockGithubFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: () =>
				Promise.resolve([
					{
						user: { login: "testuser" },
						content: "+1", // GitHub API name for pause (when no prompt open)
					},
				]),
		} as Response);

		await handler.poll();

		expect(hub.events.map((e) => e.type)).toContain("channel:pause");
		expect(hub.events.map((e) => e.type)).toContain("narrative");
	});

	it("should deduplicate reactions", async () => {
		mockGithubFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: () => Promise.resolve([]),
		} as Response);

		mockGithubFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: () =>
				Promise.resolve([
					{
						user: { login: "testuser" },
						content: "+1", // GitHub API name
					},
				]),
		} as Response);

		await handler.poll();
		// +1 with no open prompt should act as pause (per dispatcher logic) + narrative
		expect(hub.events.map((e) => e.type)).toContain("channel:pause");
		expect(hub.events.map((e) => e.type)).toContain("narrative");

		// Poll again - same reaction should be ignored (deduplicated)
		await handler.poll();
		expect(hub.events.filter((e) => e.type === "channel:pause")).toHaveLength(
			1,
		);
	});

	it("should handle abort command with reason", async () => {
		mockGithubFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: () =>
				Promise.resolve([
					{
						id: 100,
						body: "/abort test reason",
						user: { login: "testuser" },
						created_at: "2024-01-01T00:00:00Z",
					},
				]),
		} as Response);

		mockGithubFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: () => Promise.resolve([]),
		} as Response);

		await handler.poll();

		expect(hub.aborts).toHaveLength(1);
		expect(hub.aborts[0]).toBe("test reason");
		expect(hub.events.map((e) => e.type)).toContain("narrative");
	});

	it("should handle reply command", async () => {
		mockGithubFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: () =>
				Promise.resolve([
					{
						id: 100,
						body: "/reply prompt-123 my answer",
						user: { login: "testuser" },
						created_at: "2024-01-01T00:00:00Z",
					},
				]),
		} as Response);

		mockGithubFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: () => Promise.resolve([]),
		} as Response);

		await handler.poll();

		expect(hub.replies).toHaveLength(1);
		expect(hub.replies[0]?.promptId).toBe("prompt-123");
		expect((hub.replies[0]?.response as { content: string }).content).toBe(
			"my answer",
		);
		expect(hub.events.map((e) => e.type)).toContain("narrative");
	});

	it("should stop polling on auth error", async () => {
		mockGithubFetch.mockResolvedValueOnce({
			ok: false,
			status: 401,
			json: () => Promise.resolve({ message: "Unauthorized" }),
		} as Response);

		await handler.poll();

		// Handler should have stopped polling
		// We can't easily test this without exposing internal state,
		// but we can verify it doesn't crash
		expect(mockGithubFetch).toHaveBeenCalled();
	});

	it("should handle 404 on reactions endpoint gracefully", async () => {
		mockGithubFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: () => Promise.resolve([]),
		} as Response);

		mockGithubFetch.mockResolvedValueOnce({
			ok: false,
			status: 404,
			json: () => Promise.resolve({ message: "Not Found" }),
		} as Response);

		// Should not throw
		await handler.poll();
		expect(mockGithubFetch).toHaveBeenCalledTimes(2);
	});

	it("should track lastCommentId to avoid reprocessing", async () => {
		mockGithubFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: () =>
				Promise.resolve([
					{
						id: 100,
						body: "/pause",
						user: { login: "testuser" },
						created_at: "2024-01-01T00:00:00Z",
					},
				]),
		} as Response);

		mockGithubFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: () => Promise.resolve([]),
		} as Response);

		await handler.poll();
		expect(hub.events.map((e) => e.type)).toContain("channel:pause");

		// Poll again with same comment - should not process again
		mockGithubFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: () =>
				Promise.resolve([
					{
						id: 100, // Same ID
						body: "/pause",
						user: { login: "testuser" },
						created_at: "2024-01-01T00:00:00Z",
					},
				]),
		} as Response);

		mockGithubFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: () => Promise.resolve([]),
		} as Response);

		await handler.poll();
		// Should still be 1 pause event
		expect(hub.events.filter((e) => e.type === "channel:pause")).toHaveLength(
			1,
		);
	});

	it("should start and stop polling", () => {
		const stopPolling = handler.startPolling();
		expect(stopPolling).toBeDefined();

		// Should be able to stop
		stopPolling();
		// Can't easily verify internal state, but should not throw
		expect(typeof stopPolling).toBe("function");
	});

	it("should initialize lastCommentId from existing comments on first poll", async () => {
		// First poll with existing comments
		mockGithubFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: () =>
				Promise.resolve([
					{
						id: 150, // Highest ID
						body: "some comment",
						user: { login: "user1" },
						created_at: "2024-01-01T00:00:02Z",
					},
					{
						id: 100, // Lower ID
						body: "another comment",
						user: { login: "user2" },
						created_at: "2024-01-01T00:00:01Z",
					},
					{
						id: 120, // Middle ID
						body: "third comment",
						user: { login: "user3" },
						created_at: "2024-01-01T00:00:01Z",
					},
				]),
		} as Response);

		mockGithubFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: () => Promise.resolve([]),
		} as Response);

		await handler.poll();

		// Second poll - new comment should be processed
		mockGithubFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: () =>
				Promise.resolve([
					{
						id: 200, // New comment after initialization
						body: "/pause",
						user: { login: "testuser" },
						created_at: "2024-01-01T00:00:03Z",
					},
					{
						id: 150, // Old comment, should be skipped
						body: "/resume",
						user: { login: "user1" },
						created_at: "2024-01-01T00:00:02Z",
					},
				]),
		} as Response);

		mockGithubFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: () => Promise.resolve([]),
		} as Response);

		await handler.poll();

		// Should only process the new comment (id 200), not the old one (id 150)
		expect(hub.events.filter((e) => e.type === "channel:pause")).toHaveLength(
			1,
		);
		expect(hub.events.map((e) => e.type)).toContain("narrative");
	});

	it("should process comments posted before polling starts", async () => {
		// First poll - initialize with existing comments, including a command
		mockGithubFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: () =>
				Promise.resolve([
					{
						id: 100,
						body: "/pause", // Command posted before polling started
						user: { login: "testuser" },
						created_at: "2024-01-01T00:00:00Z",
					},
				]),
		} as Response);

		mockGithubFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: () => Promise.resolve([]),
		} as Response);

		await handler.poll();

		// Command should be processed even though it was posted before polling started
		expect(hub.events.map((e) => e.type)).toContain("channel:pause");
		expect(hub.events.map((e) => e.type)).toContain("narrative");
	});
});
