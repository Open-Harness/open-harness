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

export const PromptRegistry = {
	async formatMonologue(data: MonologueData): Promise<string> {
		const template = await Bun.file("../prompts/monologue.md").text();
		return template
			.replace("{{agentName}}", data.agentName)
			.replace("{{history}}", data.history.join("\n") || "None")
			.replace("{{events}}", JSON.stringify(data.events, null, 2));
	},

	async formatCoding(data: CodingData): Promise<string> {
		const template = await Bun.file("../prompts/coder.md").text();
		return template.replace("{{task}}", data.task);
	},

	async formatReview(data: ReviewData): Promise<string> {
		const template = await Bun.file("../prompts/reviewer.md").text();
		return template.replace("{{task}}", data.task).replace("{{implementationSummary}}", data.implementationSummary);
	},
};
