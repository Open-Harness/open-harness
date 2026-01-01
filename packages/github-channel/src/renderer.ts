import type { GithubChannelState } from "./types.js";

export function render(state: GithubChannelState): string {
	const lines: string[] = [];

	lines.push("<!-- DASHBOARD:START -->");
	lines.push("## Workflow Dashboard");
	lines.push("");

	// Header
	const statusEmoji =
		state.run.status === "running"
			? "🟢"
			: state.run.status === "complete"
				? "✅"
				: state.run.status === "aborted"
					? "🛑"
					: "⚪";
	lines.push(
		`**Status**: ${statusEmoji} ${state.run.status} | **Phase**: ${state.phase.name || "N/A"} | **Updated**: ${state.updatedAt}`,
	);
	lines.push("");

	// Tasks
	if (state.tasks.length > 0) {
		lines.push("### Tasks");
		lines.push("| ID | State | Summary |");
		lines.push("|----|-------|---------|");
		for (const task of state.tasks) {
			const stateEmoji =
				task.state === "done"
					? "✅"
					: task.state === "running"
						? "🟡"
						: task.state === "failed"
							? "❌"
							: "⚪";
			const summary = truncate(task.summary || "", 60);
			lines.push(`| ${task.id} | ${stateEmoji} ${task.state} | ${summary} |`);
		}
		lines.push("");
	}

	// Agents
	if (state.agents.length > 0) {
		lines.push("### Agents");
		lines.push("| Name | Status | Last |");
		lines.push("|------|--------|------|");
		for (const agent of state.agents) {
			const statusEmoji =
				agent.status === "complete"
					? "✅"
					: agent.status === "running"
						? "🟡"
						: agent.status === "failed"
							? "❌"
							: "⚪";
			const last = truncate(agent.last || "", 50);
			lines.push(
				`| ${agent.name} | ${statusEmoji} ${agent.status || "unknown"} | ${last} |`,
			);
		}
		lines.push("");
	}

	// Prompts (open only)
	const openPrompts = state.prompts.filter((p) => p.status === "open");
	if (openPrompts.length > 0) {
		lines.push("### Prompts (Needs Attention)");
		for (const prompt of openPrompts) {
			const choicesText = prompt.choices
				? ` [${prompt.choices.join(", ")}]`
				: "";
			const fromText = prompt.from ? ` @${prompt.from}` : "";
			lines.push(
				`- **${prompt.promptId}**: "${truncate(prompt.prompt, 80)}"${choicesText}${fromText}`,
			);
		}
		lines.push("");
	}

	// Recent Activity
	if (state.recent.length > 0) {
		lines.push("### Recent Activity");
		const recentToShow = state.recent.slice(-10); // Last 10
		for (const entry of recentToShow) {
			const time = new Date(entry.ts).toLocaleTimeString();
			const text = entry.text ? `: ${truncate(entry.text, 60)}` : "";
			lines.push(`- ${time} ${entry.type}${text}`);
		}
		if (state.recent.length > 10) {
			lines.push(`- ... (${state.recent.length - 10} more entries)`);
		}
		lines.push("");
	}

	// Errors
	if (state.errors.length > 0) {
		lines.push("### Errors");
		const recentErrors = state.errors.slice(-5); // Last 5
		for (const error of recentErrors) {
			const time = new Date(error.ts).toLocaleTimeString();
			lines.push(`- ${time}: ${truncate(error.message, 100)}`);
		}
		if (state.errors.length > 5) {
			lines.push(`- ... (${state.errors.length - 5} more errors)`);
		}
		lines.push("");
	}

	// Summary (if exists)
	if (state.summary) {
		lines.push("### Summary");
		lines.push("```");
		lines.push(truncate(state.summary, 500));
		lines.push("```");
		lines.push("");
	}

	// Control hints
	lines.push("---");
	lines.push(
		"**Commands**: `/pause` `/resume` `/abort <reason>` `/reply <id> <text>` `/choose <id> <choice>` `/status` `/help`",
	);
	lines.push(
		"**Reactions**: ✅ confirm | ⏸️ pause | ▶️ resume | 🛑 abort | 🔁 retry",
	);
	lines.push("<!-- DASHBOARD:END -->");

	return lines.join("\n");
}

export function hashContent(rendered: string): string {
	// Simple hash function for idempotency checks
	// In production, this could use Bun.hash() or crypto.createHash()
	let hash = 0;
	for (let i = 0; i < rendered.length; i++) {
		const char = rendered.charCodeAt(i);
		hash = (hash << 5) - hash + char;
		hash = hash & hash; // Convert to 32-bit integer
	}
	return Math.abs(hash).toString(16);
}

function truncate(text: string, maxLength: number): string {
	if (text.length <= maxLength) return text;
	return `${text.slice(0, maxLength - 3)}...`;
}
