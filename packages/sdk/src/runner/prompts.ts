import type { AgentEvent } from "./models.js";

export type MonologueData = {
	agentName: string;
	history: string[];
	events: AgentEvent[];
};

export type CodingData = {
	task: string;
};

export type ReviewData = {
	task: string;
	implementationSummary: string;
};

export type PlannerData = {
	prd: string;
};

// Resolve prompt paths relative to agents directory
const agentsDir = new URL("../agents", import.meta.url).pathname;

export const PromptRegistry = {
	async formatMonologue(data: MonologueData): Promise<string> {
		const template = await Bun.file(`${agentsDir}/monologue.prompt.md`).text();
		return template
			.replace("{{agentName}}", data.agentName)
			.replace("{{history}}", data.history.join("\n") || "None")
			.replace("{{events}}", JSON.stringify(data.events, null, 2));
	},

	async formatCoding(data: CodingData): Promise<string> {
		const template = await Bun.file(`${agentsDir}/coder.prompt.md`).text();
		return template.replace("{{task}}", data.task);
	},

	async formatReview(data: ReviewData): Promise<string> {
		const template = await Bun.file(`${agentsDir}/reviewer.prompt.md`).text();
		return template.replace("{{task}}", data.task).replace("{{implementationSummary}}", data.implementationSummary);
	},

	async formatPlanner(data: PlannerData): Promise<string> {
		const template = await Bun.file(`${agentsDir}/planner.prompt.md`).text();
		return template.replace("{{prd}}", data.prd);
	},
};
