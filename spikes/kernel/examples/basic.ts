import { type AgentDefinition, type BaseEvent, defineChannel, defineHarness } from "../src/index.ts";

const UppercaseAgent: AgentDefinition<{ input: string }, { output: string }> = {
	name: "Uppercase",
	async execute({ input }, { hub }) {
		hub.emit({ type: "agent:thinking", content: `Uppercasing "${input}"` });
		await new Promise((r) => setTimeout(r, 50));
		return { output: input.toUpperCase() };
	},
};

const LoggerChannel = defineChannel({
	name: "logger",
	on: {
		"phase:*": ({ event }) =>
			console.log(`[phase] ${event.event.type} ${"name" in event.event ? event.event.name : ""}`),
		"task:*": ({ event }) => console.log(`[task] ${event.event.type}`),
		"agent:*": ({ event }) => console.log(`[agent] ${event.event.type}`),
		"session:prompt": async ({ hub, event }) => {
			const e = event.event as Extract<BaseEvent, { type: "session:prompt" }>;
			console.log(`[prompt] ${e.prompt}`);
			// auto-reply (demo of bidirectional channel → harness)
			hub.reply(e.promptId, { content: "yes", timestamp: new Date() });
		},
	},
});

const Workflow = defineHarness({
	name: "basic",
	agents: { upper: UppercaseAgent },
	state: (input: { items: string[] }) => ({ items: input.items, out: [] as string[] }),
	run: async ({ agents, state, phase, task, session }) => {
		await phase("Processing", async () => {
			for (const item of state.items) {
				await task(`upper:${item}`, async () => {
					const res = await agents.upper.execute({ input: item });
					state.out.push(res.output);
					return res;
				});
			}
		});

		if (!session) throw new Error("Session not active. Call .startSession() before .run().");
		const ok = await session.waitForUser("Continue?", { choices: ["yes", "no"] });
		return { ok, out: state.out };
	},
});

async function main() {
	const result = await Workflow.create({ items: ["apple", "banana"] })
		.attach(LoggerChannel)
		.startSession()
		.run();
	console.log(result.result);
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
