import { AnthropicAgentDefinition, type BaseEvent, defineChannel, defineHarness } from "../src/index.ts";

const ClaudeAgent = new AnthropicAgentDefinition({
	name: "Claude",
	options: {
		// Uses Claude Code subscription auth (no API keys).
		// Load project settings / CLAUDE.md so tools behave like Claude Code.
		settingSources: ["project"],
		// includePartialMessages: true,
		// Keep it non-interactive for this demo:
		// - disable built-in tools so Claude won't ask for permission prompts.
		tools: [],
		// model: "claude-sonnet-4-5-20250929",
	},
});

const LoggerAndSteeringChannel = defineChannel({
	name: "logger+steer",
	state: () => ({ runId: null as string | null }),
	on: {
		"agent:start": ({ hub, event, state }) => {
			const e = event.event as Extract<BaseEvent, { type: "agent:start" }>;
			state.runId = e.runId;
			console.log(`[agent] start runId=${e.runId}`);

			// Mid-run steering: inject a follow-up message into the active run.
			setTimeout(() => {
				if (!state.runId) return;
				try {
					hub.sendToRun(state.runId, "Quick add-on: actually talk about benin");
				} catch {
					// non-fatal
				}
			}, 2500);
		},
		"agent:text": ({ event }) => {
			const e = event.event as Extract<BaseEvent, { type: "agent:text" }>;
			process.stdout.write(e.content);
		},
		"agent:tool:*": ({ event }) => console.log(`\n[tool] ${event.event.type}`),
		"agent:complete": ({ event }) => {
			const e = event.event as Extract<BaseEvent, { type: "agent:complete" }>;
			console.log(`\n[agent] complete success=${e.success}`);
		},
	},
});

const Workflow = defineHarness({
	name: "anthropic",
	agents: { claude: ClaudeAgent },
	state: () => ({}),
	run: async ({ agents }) => {
		const result = await agents.claude.execute("Write a short greeting and mention one fruit.");
		return { result };
	},
});

async function main() {
	const out = await Workflow.create({}).attach(LoggerAndSteeringChannel).startSession().run();
	console.log("\n\nFinal result:", out.result);
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
