import { describe, expect, it } from "bun:test";
import { dispatchCommand } from "../src/dispatcher.js";
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

describe("dispatchCommand", () => {
	it("should handle abort command", () => {
		const hub = new MockHub();
		const result = dispatchCommand(hub, { type: "abort", reason: "test" });

		expect(result.handled).toBe(true);
		expect(result.ack).toBe("Aborting workflow");
		expect(hub.aborts).toEqual(["test"]);
	});

	it("should handle abort without reason", () => {
		const hub = new MockHub();
		const result = dispatchCommand(hub, { type: "abort" });

		expect(result.handled).toBe(true);
		expect(hub.aborts).toEqual([undefined]);
	});

	it("should handle reply command", () => {
		const hub = new MockHub();
		const result = dispatchCommand(hub, {
			type: "reply",
			promptId: "prompt-1",
			text: "test response",
		});

		expect(result.handled).toBe(true);
		expect(result.ack).toBe("Replied to prompt-1");
		expect(hub.replies).toHaveLength(1);
		expect(hub.replies[0]?.promptId).toBe("prompt-1");
		expect((hub.replies[0]?.response as { content: string }).content).toBe(
			"test response",
		);
	});

	it("should handle choose command", () => {
		const hub = new MockHub();
		const result = dispatchCommand(hub, {
			type: "choose",
			promptId: "prompt-2",
			choice: "option-a",
		});

		expect(result.handled).toBe(true);
		expect(result.ack).toBe('Chose "option-a"');
		expect(hub.replies).toHaveLength(1);
		expect(hub.replies[0]?.promptId).toBe("prompt-2");
		const response = hub.replies[0]?.response as {
			content: string;
			choice: string;
		};
		expect(response.content).toBe("option-a");
		expect(response.choice).toBe("option-a");
	});

	it("should handle pause command", () => {
		const hub = new MockHub();
		const result = dispatchCommand(hub, { type: "pause" });

		expect(result.handled).toBe(true);
		expect(result.ack).toBe("Pause requested");
		expect(hub.events).toHaveLength(1);
		expect(hub.events[0]?.type).toBe("channel:pause");
		expect(hub.events[0]).toHaveProperty("source", "github");
	});

	it("should handle resume command", () => {
		const hub = new MockHub();
		const result = dispatchCommand(hub, { type: "resume" });

		expect(result.handled).toBe(true);
		expect(result.ack).toBe("Resume requested");
		expect(hub.events).toHaveLength(1);
		expect(hub.events[0]?.type).toBe("channel:resume");
		expect(hub.events[0]).toHaveProperty("source", "github");
	});

	it("should handle status command (no-op)", () => {
		const hub = new MockHub();
		const result = dispatchCommand(hub, { type: "status" });

		expect(result.handled).toBe(true);
		expect(result.ack).toBeUndefined();
		expect(hub.events).toHaveLength(0);
		expect(hub.replies).toHaveLength(0);
	});

	it("should handle help command", () => {
		const hub = new MockHub();
		const result = dispatchCommand(hub, { type: "help" });

		expect(result.handled).toBe(true);
		expect(result.ack).toContain("Commands:");
	});

	it("should handle confirm reaction with open prompt", () => {
		const hub = new MockHub();
		const result = dispatchCommand(
			hub,
			{ type: "confirm" },
			{ openPromptId: "prompt-3" },
		);

		expect(result.handled).toBe(true);
		expect(result.ack).toBe("Confirmed");
		expect(hub.replies).toHaveLength(1);
		expect(hub.replies[0]?.promptId).toBe("prompt-3");
	});

	it("should handle confirm reaction without open prompt as pause", () => {
		const hub = new MockHub();
		const result = dispatchCommand(hub, { type: "confirm" });

		// +1 reaction without prompt acts as pause (per updated dispatcher logic)
		expect(result.handled).toBe(true);
		expect(hub.events).toHaveLength(1);
		expect(hub.events[0]?.type).toBe("channel:pause");
		expect(hub.replies).toHaveLength(0);
	});

	it("should handle retry reaction", () => {
		const hub = new MockHub();
		const result = dispatchCommand(hub, { type: "retry" });

		expect(result.handled).toBe(true);
		expect(hub.events).toHaveLength(1);
		expect(hub.events[0]?.type).toBe("channel:retry");
		expect(hub.events[0]).toHaveProperty("source", "github");
	});

	it("should handle thumbsUp reaction", () => {
		const hub = new MockHub();
		const result = dispatchCommand(hub, { type: "thumbsUp" });

		expect(result.handled).toBe(true);
		expect(hub.events).toHaveLength(1);
		expect(hub.events[0]?.type).toBe("channel:feedback");
		expect(hub.events[0]).toHaveProperty("value", "thumbsUp");
	});

	it("should handle thumbsDown reaction", () => {
		const hub = new MockHub();
		const result = dispatchCommand(hub, { type: "thumbsDown" });

		expect(result.handled).toBe(true);
		expect(hub.events).toHaveLength(1);
		expect(hub.events[0]?.type).toBe("channel:feedback");
		expect(hub.events[0]).toHaveProperty("value", "thumbsDown");
	});

	it("should not handle unknown command", () => {
		const hub = new MockHub();
		const result = dispatchCommand(hub, { type: "unknown" });

		expect(result.handled).toBe(false);
		expect(hub.events).toHaveLength(0);
		expect(hub.replies).toHaveLength(0);
		expect(hub.aborts).toHaveLength(0);
	});
});
