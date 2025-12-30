/**
 * CLI demo: planning + working phases with planner/coder/reviewer agents.
 *
 * Usage: bun scripts/live/workflow-demo.ts
 */

import { defineHarness } from "../../kernel/src/engine/harness.js";
import type { AgentDefinition } from "../../kernel/src/protocol/agent.js";
import type { EnrichedEvent } from "../../kernel/src/protocol/events.js";

type DemoInput = {
	goal: string;
};

type DemoState = {
	goal: string;
	plan?: string;
	code?: string;
	review?: string;
};

type PlanResult = { plan: string };

type CodeResult = { code: string };

type ReviewResult = { review: string };

const PlannerAgent: AgentDefinition<{ goal: string }, PlanResult> = {
	name: "planner",
	async execute(input, ctx) {
		ctx.hub.emit({
			type: "agent:thinking",
			content: `Planning for: ${input.goal}`,
			runId: ctx.runId,
		});

		const plan = [
			"1. Clarify requirements and constraints",
			"2. Sketch data model and CLI commands",
			"3. Implement core commands (add/list/done)",
			"4. Add tests and polish UX",
		].join("\n");

		ctx.hub.emit({
			type: "agent:text",
			content: plan,
			runId: ctx.runId,
		});

		return { plan };
	},
};

const CoderAgent: AgentDefinition<{ plan: string }, CodeResult> = {
	name: "coder",
	async execute(input, ctx) {
		ctx.hub.emit({
			type: "agent:thinking",
			content: "Implementing based on plan...",
			runId: ctx.runId,
		});

		const code = [
			"// pseudo-code",
			"command add(title): store item",
			"command list(): print items",
			"command done(id): mark complete",
			"command remove(id): delete",
		].join("\n");

		ctx.hub.emit({
			type: "agent:text",
			content: code,
			runId: ctx.runId,
		});

		return { code: `${input.plan}\n\n${code}` };
	},
};

const ReviewerAgent: AgentDefinition<{ code: string }, ReviewResult> = {
	name: "reviewer",
	async execute(input, ctx) {
		ctx.hub.emit({
			type: "agent:thinking",
			content: "Reviewing code for gaps and risks...",
			runId: ctx.runId,
		});

		const review = [
			"- Add input validation and error messaging",
			"- Persist data to file for durability",
			"- Add tests for edge cases (empty list, invalid id)",
			"- Consider command aliases for UX",
		].join("\n");

		ctx.hub.emit({
			type: "agent:text",
			content: review,
			runId: ctx.runId,
		});

		return { review };
	},
};

const DemoHarness = defineHarness<DemoInput, DemoState, {
	plan: string;
	code: string;
	review: string;
}>({
	name: "demo-workflow",
	agents: {
		planner: PlannerAgent,
		coder: CoderAgent,
		reviewer: ReviewerAgent,
	},
	state: (input) => ({ goal: input.goal }),
	run: async ({ agents, state, phase, task }) => {
		await phase("Planning", async () => {
			state.plan = await task("planner", async () => {
				const result = await agents.planner.execute({ goal: state.goal });
				return result.plan;
			});
		});

		await phase("Working", async () => {
			state.code = await task("coder", async () => {
				const result = await agents.coder.execute({
					plan: state.plan ?? "No plan provided",
				});
				return result.code;
			});

			state.review = await task("reviewer", async () => {
				const result = await agents.reviewer.execute({
					code: state.code ?? "",
				});
				return result.review;
			});
		});

		return {
			plan: state.plan ?? "",
			code: state.code ?? "",
			review: state.review ?? "",
		};
	},
});

function formatEvent(event: EnrichedEvent): string {
	const payload = event.event as Record<string, unknown> & { type: string };
	const context = event.context;
	const contextParts: string[] = [];

	if (context.phase?.name) {
		contextParts.push(`phase=${context.phase.name}`);
	}
	if (context.task?.id) {
		contextParts.push(`task=${context.task.id}`);
	}
	if (context.agent?.name) {
		contextParts.push(`agent=${context.agent.name}`);
	}

	const contextLabel =
		contextParts.length > 0 ? ` [${contextParts.join(" ")}]` : "";

	let detail = "";
	if (typeof payload.content === "string") {
		detail = ` ${payload.content}`;
	} else if (typeof payload.taskId === "string") {
		detail = ` ${payload.taskId}`;
	} else if (typeof payload.name === "string") {
		detail = ` ${payload.name}`;
	} else if (typeof payload.agentName === "string") {
		detail = ` ${payload.agentName}`;
	}

	return `${event.timestamp.toISOString()} ${payload.type}${contextLabel}${detail}`;
}

async function runDemo() {
	console.log("🧪 Running workflow demo (CLI)...");

	const harness = DemoHarness.create({
		goal: "Build a CLI TODO app",
	});

	harness.subscribe("*", (event) => {
		console.log(formatEvent(event));
	});

	const result = await harness.run();

	console.log("\nResult summary:");
	console.log(result.result);
}

runDemo().catch((error) => {
	console.error("Fatal error:", error);
	process.exit(1);
});
