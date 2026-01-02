import type { EnrichedEvent, GithubChannelState } from "./types.js";

export function initialState(): GithubChannelState {
	return {
		run: { id: null, status: "idle" },
		phase: { name: null, status: "idle" },
		tasks: [],
		agents: [],
		prompts: [],
		recent: [],
		errors: [],
		updatedAt: new Date().toISOString(),
	};
}

export function reduce(
	state: GithubChannelState,
	event: EnrichedEvent,
	maxRecent: number = 50,
): GithubChannelState {
	const newState = { ...state };
	const eventType = event.event.type;
	const ts = event.timestamp.toISOString();

	// Update updatedAt on every reduction
	newState.updatedAt = ts;

	// Phase events
	if (eventType === "phase:start") {
		const evt = event.event as {
			type: "phase:start";
			name: string;
			phaseNumber?: number;
		};
		newState.phase = {
			name: evt.name,
			number: evt.phaseNumber,
			status: "running",
		};
		newState.run.status = "running";
		if (event.context.sessionId) {
			newState.run.id = event.context.sessionId;
		}
		addRecent(newState, ts, "phase:start", evt.name);
	} else if (eventType === "phase:complete") {
		const evt = event.event as {
			type: "phase:complete";
			name: string;
			phaseNumber?: number;
		};
		newState.phase = {
			name: evt.name,
			number: evt.phaseNumber,
			status: "complete",
		};
		addRecent(newState, ts, "phase:complete", evt.name);
	} else if (eventType === "phase:failed") {
		const evt = event.event as {
			type: "phase:failed";
			name: string;
			error: string;
			stack?: string;
			phaseNumber?: number;
		};
		newState.phase = {
			name: evt.name,
			number: evt.phaseNumber,
			status: "failed",
		};
		newState.errors.push({ ts, message: evt.error });
		addRecent(newState, ts, "phase:failed", `${evt.name}: ${evt.error}`);
	}
	// Task events
	else if (eventType === "task:start") {
		const evt = event.event as { type: "task:start"; taskId: string };
		const taskId = evt.taskId;
		const existingIndex = newState.tasks.findIndex((t) => t.id === taskId);
		const task = {
			id: taskId,
			label: event.context.task?.id === taskId ? taskId : undefined,
			state: "running" as const,
		};
		if (existingIndex >= 0) {
			newState.tasks[existingIndex] = task;
		} else {
			newState.tasks.push(task);
		}
		addRecent(newState, ts, "task:start", taskId);
	} else if (eventType === "task:complete") {
		const evt = event.event as {
			type: "task:complete";
			taskId: string;
			result?: unknown;
		};
		const taskId = evt.taskId;
		const existingIndex = newState.tasks.findIndex((t) => t.id === taskId);
		const summary =
			typeof evt.result === "string"
				? evt.result
				: evt.result
					? JSON.stringify(evt.result).slice(0, 100)
					: "Completed";
		const task = {
			id: taskId,
			label: event.context.task?.id === taskId ? taskId : undefined,
			state: "done" as const,
			summary,
		};
		if (existingIndex >= 0) {
			newState.tasks[existingIndex] = task;
		} else {
			newState.tasks.push(task);
		}
		addRecent(newState, ts, "task:complete", taskId);
	} else if (eventType === "task:failed") {
		const evt = event.event as {
			type: "task:failed";
			taskId: string;
			error: string;
			stack?: string;
		};
		const taskId = evt.taskId;
		const existingIndex = newState.tasks.findIndex((t) => t.id === taskId);
		const task = {
			id: taskId,
			label: event.context.task?.id === taskId ? taskId : undefined,
			state: "failed" as const,
			summary: evt.error,
		};
		if (existingIndex >= 0) {
			newState.tasks[existingIndex] = task;
		} else {
			newState.tasks.push(task);
		}
		newState.errors.push({ ts, message: `Task ${taskId}: ${evt.error}` });
		addRecent(newState, ts, "task:failed", `${taskId}: ${evt.error}`);
	}
	// Agent events
	else if (eventType === "agent:start") {
		const evt = event.event as {
			type: "agent:start";
			agentName: string;
			runId: string;
		};
		const existingIndex = newState.agents.findIndex(
			(a) => a.name === evt.agentName && a.runId === evt.runId,
		);
		const agent: GithubChannelState["agents"][number] = {
			name: evt.agentName,
			runId: evt.runId,
			status: "running",
		};
		if (existingIndex >= 0) {
			newState.agents[existingIndex] = agent;
		} else {
			newState.agents.push(agent);
		}
		addRecent(newState, ts, "agent:start", evt.agentName);
	} else if (eventType === "agent:thinking") {
		const evt = event.event as {
			type: "agent:thinking";
			content: string;
			runId?: string;
		};
		const agentName = event.context.agent?.name || "unknown";
		updateAgentLast(newState, agentName, evt.runId, evt.content);
		addRecent(newState, ts, "agent:thinking", evt.content.slice(0, 100));
	} else if (eventType === "agent:text") {
		const evt = event.event as {
			type: "agent:text";
			content: string;
			runId?: string;
		};
		const agentName = event.context.agent?.name || "unknown";
		updateAgentLast(newState, agentName, evt.runId, evt.content);
		addRecent(newState, ts, "agent:text", evt.content.slice(0, 100));
	} else if (eventType === "agent:tool:start") {
		const evt = event.event as {
			type: "agent:tool:start";
			toolName: string;
			input?: unknown;
			runId?: string;
		};
		const agentName = event.context.agent?.name || "unknown";
		const toolDesc = `Using tool: ${evt.toolName}`;
		updateAgentLast(newState, agentName, evt.runId, toolDesc);
		addRecent(newState, ts, "agent:tool:start", toolDesc);
	} else if (eventType === "agent:tool:complete") {
		const evt = event.event as {
			type: "agent:tool:complete";
			toolName: string;
			result?: unknown;
			isError?: boolean;
			runId?: string;
		};
		const agentName = event.context.agent?.name || "unknown";
		const toolDesc = `Tool ${evt.toolName} ${evt.isError ? "failed" : "completed"}`;
		updateAgentLast(newState, agentName, evt.runId, toolDesc);
		addRecent(newState, ts, "agent:tool:complete", toolDesc);
	} else if (eventType === "agent:complete") {
		const evt = event.event as {
			type: "agent:complete";
			agentName: string;
			success: boolean;
			runId: string;
		};
		const existingIndex = newState.agents.findIndex(
			(a) => a.name === evt.agentName && a.runId === evt.runId,
		);
		if (existingIndex >= 0 && newState.agents[existingIndex]) {
			const existing = newState.agents[existingIndex];
			newState.agents[existingIndex] = {
				name: existing.name,
				runId: existing.runId,
				status: evt.success ? "complete" : "failed",
				last: existing.last,
			};
		}
		addRecent(
			newState,
			ts,
			"agent:complete",
			`${evt.agentName} ${evt.success ? "succeeded" : "failed"}`,
		);
	}
	// Session events
	else if (eventType === "session:prompt") {
		const evt = event.event as {
			type: "session:prompt";
			promptId: string;
			prompt: string;
			choices?: string[];
			allowText?: boolean;
		};
		newState.prompts.push({
			promptId: evt.promptId,
			prompt: evt.prompt,
			choices: evt.choices,
			allowText: evt.allowText,
			status: "open",
			from: event.context.agent?.name,
		});
		addRecent(newState, ts, "session:prompt", evt.prompt);
	} else if (eventType === "session:reply") {
		const evt = event.event as {
			type: "session:reply";
			promptId: string;
			content: string;
			choice?: string;
		};
		const promptIndex = newState.prompts.findIndex(
			(p) => p.promptId === evt.promptId,
		);
		if (promptIndex >= 0 && newState.prompts[promptIndex]) {
			newState.prompts[promptIndex] = {
				...newState.prompts[promptIndex],
				status: "answered",
			};
		}
		addRecent(newState, ts, "session:reply", evt.content);
	} else if (eventType === "session:abort") {
		const evt = event.event as { type: "session:abort"; reason?: string };
		newState.run.status = "aborted";
		if (evt.reason) {
			addRecent(newState, ts, "session:abort", evt.reason);
		}
	}
	// Narrative events
	else if (eventType === "narrative") {
		const evt = event.event as {
			type: "narrative";
			text: string;
			importance?: "low" | "normal" | "high";
		};
		addRecent(newState, ts, "narrative", evt.text);
	}
	// Harness lifecycle
	else if (eventType === "harness:start") {
		const evt = event.event as { type: "harness:start"; name: string };
		newState.run.status = "running";
		if (event.context.sessionId) {
			newState.run.id = event.context.sessionId;
		}
		addRecent(newState, ts, "harness:start", evt.name);
	} else if (eventType === "harness:complete") {
		const evt = event.event as {
			type: "harness:complete";
			success: boolean;
			durationMs: number;
		};
		newState.run.status = evt.success ? "complete" : "aborted";
		addRecent(
			newState,
			ts,
			"harness:complete",
			evt.success ? "Success" : "Failed",
		);
	}

	// Enforce maxRecent cap and roll-up summary
	if (newState.recent.length > maxRecent) {
		const overflow = newState.recent.slice(0, -maxRecent);
		const summaryText = overflow
			.map((e) => `${e.ts} ${e.type}${e.text ? `: ${e.text}` : ""}`)
			.join("\n");
		newState.summary = newState.summary
			? `${newState.summary}\n\n${summaryText}`
			: summaryText;
		newState.recent = newState.recent.slice(-maxRecent);
	}

	return newState;
}

function addRecent(
	state: GithubChannelState,
	ts: string,
	type: string,
	text?: string,
) {
	state.recent.push({ ts, type, text });
	// Enforce maxRecent cap (will be handled by caller with maxRecent config)
}

function updateAgentLast(
	state: GithubChannelState,
	agentName: string,
	runId: string | undefined,
	last: string,
) {
	const existingIndex = state.agents.findIndex(
		(a) => a.name === agentName && (!runId || a.runId === runId),
	);
	if (existingIndex >= 0 && state.agents[existingIndex]) {
		const existing = state.agents[existingIndex];
		state.agents[existingIndex] = {
			name: existing.name,
			runId: existing.runId,
			status: existing.status,
			last: last.slice(0, 200), // Truncate
		};
	} else {
		state.agents.push({
			name: agentName,
			runId,
			last: last.slice(0, 200),
		});
	}
}
