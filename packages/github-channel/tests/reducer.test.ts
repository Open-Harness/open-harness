import { describe, expect, it } from "bun:test";
import { initialState, reduce } from "../src/reducer.js";
import type { EnrichedEvent } from "../src/types.js";

function createEvent(
	type: string,
	payload: Record<string, unknown> = {},
	context: Record<string, unknown> = {},
): EnrichedEvent {
	return {
		id: `evt-${Date.now()}-${Math.random()}`,
		timestamp: new Date(),
		context: {
			sessionId: "test-session",
			...context,
		},
		event: {
			type,
			...payload,
		} as EnrichedEvent["event"],
	};
}

describe("reducer", () => {
	it("should handle phase:start", () => {
		const state = initialState();
		const event = createEvent("phase:start", {
			name: "Planning",
			phaseNumber: 1,
		});
		const newState = reduce(state, event);

		expect(newState.phase.name).toBe("Planning");
		expect(newState.phase.status).toBe("running");
		expect(newState.run.status).toBe("running");
		expect(newState.recent.length).toBe(1);
	});

	it("should handle task:start", () => {
		const state = initialState();
		const event = createEvent("task:start", { taskId: "task-1" });
		const newState = reduce(state, event);

		expect(newState.tasks.length).toBe(1);
		expect(newState.tasks[0]?.id).toBe("task-1");
		expect(newState.tasks[0]?.state).toBe("running");
	});

	it("should handle task:complete", () => {
		const state = initialState();
		const startEvent = createEvent("task:start", { taskId: "task-1" });
		let newState = reduce(state, startEvent);
		const completeEvent = createEvent("task:complete", {
			taskId: "task-1",
			result: "Success",
		});
		newState = reduce(newState, completeEvent);

		expect(newState.tasks[0]?.state).toBe("done");
		expect(newState.tasks[0]?.summary).toBe("Success");
	});

	it("should handle agent:start", () => {
		const state = initialState();
		const event = createEvent("agent:start", {
			agentName: "planner",
			runId: "run-1",
		});
		const newState = reduce(state, event);

		expect(newState.agents.length).toBe(1);
		expect(newState.agents[0]?.name).toBe("planner");
		expect(newState.agents[0]?.runId).toBe("run-1");
	});

	it("should handle agent:text", () => {
		const state = initialState();
		const startEvent = createEvent("agent:start", {
			agentName: "planner",
			runId: "run-1",
		});
		let newState = reduce(state, startEvent);
		const textEvent = createEvent(
			"agent:text",
			{ content: "Analyzing requirements", runId: "run-1" },
			{ agent: { name: "planner" } },
		);
		newState = reduce(newState, textEvent);

		expect(newState.agents[0]?.last).toContain("Analyzing requirements");
		expect(newState.recent.length).toBe(2);
	});

	it("should handle session:prompt", () => {
		const state = initialState();
		const event = createEvent("session:prompt", {
			promptId: "prompt-1",
			prompt: "Which approach?",
			choices: ["A", "B"],
		});
		const newState = reduce(state, event);

		expect(newState.prompts.length).toBe(1);
		expect(newState.prompts[0]?.promptId).toBe("prompt-1");
		expect(newState.prompts[0]?.status).toBe("open");
	});

	it("should handle session:reply", () => {
		const state = initialState();
		const promptEvent = createEvent("session:prompt", {
			promptId: "prompt-1",
			prompt: "Which approach?",
		});
		let newState = reduce(state, promptEvent);
		const replyEvent = createEvent("session:reply", {
			promptId: "prompt-1",
			content: "Option A",
		});
		newState = reduce(newState, replyEvent);

		expect(newState.prompts[0]?.status).toBe("answered");
	});

	it("should cap recent at maxRecent", () => {
		const state = initialState();
		const maxRecent = 5;
		let newState = state;

		// Add 10 events
		for (let i = 0; i < 10; i++) {
			const event = createEvent("narrative", { text: `Event ${i}` });
			newState = reduce(newState, event, maxRecent);
		}

		expect(newState.recent.length).toBe(maxRecent);
		expect(newState.summary).toBeDefined();
	});

	it("should handle session:abort", () => {
		const state = initialState();
		const event = createEvent("session:abort", { reason: "User cancelled" });
		const newState = reduce(state, event);

		expect(newState.run.status).toBe("aborted");
	});
});
