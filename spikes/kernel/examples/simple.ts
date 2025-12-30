import { defineChannel, defineHarness, type AgentDefinition, type BaseEvent } from "../src/index.ts";

// Minimal “agent” that just uppercases strings (no provider).
const UppercaseAgent: AgentDefinition<{ text: string }, { text: string }> = {
	name: "Uppercase",
	async execute(input, { hub }) {
		hub.emit({ type: "agent:thinking", content: `Uppercasing "${input.text}"` });
		return { text: input.text.toUpperCase() };
	},
};

const consoleChannel = defineChannel({
	name: "console",
	on: {
		"*": ({ event }) => {
			const { type } = event.event;
			console.log(`[${type}]`, event.context, event.event);
		},
	},
});

const demoClackishChannel = defineChannel({
	name: "demo-ui",
	state: () => ({ tasks: 0, done: 0 }),
	onStart: () => {
		console.log("== OpenHarness Kernel Demo ==");
	},
	on: {
		"phase:start": ({ event }) => {
			const e = event.event as Extract<BaseEvent, { type: "phase:start" }>;
			console.log(`\nPhase: ${e.name}`);
		},
		"task:start": ({ state, event }) => {
			const e = event.event as Extract<BaseEvent, { type: "task:start" }>;
			state.tasks++;
			console.log(`  ▶ Task: ${e.taskId}`);
		},
		"task:complete": ({ state, event }) => {
			const e = event.event as Extract<BaseEvent, { type: "task:complete" }>;
			state.done++;
			console.log(`  ✓ Done: ${e.taskId} (${state.done}/${state.tasks})`);
		},
		"task:failed": ({ event }) => {
			const e = event.event as Extract<BaseEvent, { type: "task:failed" }>;
			console.log(`  ✗ Failed: ${e.taskId}: ${e.error}`);
		},
	},
	onComplete: ({ state }) => {
		console.log(`\nComplete: ${state.done}/${state.tasks} tasks succeeded`);
	},
});

const Workflow = defineHarness({
	name: "simple",
	agents: { upper: UppercaseAgent },
	state: (input: { items: string[] }) => ({ items: input.items, out: [] as string[] }),
	run: async ({ agents, state, phase, task }) => {
		await phase("Process", async () => {
			for (const item of state.items) {
				await task(`process-${item}`, async () => {
					const result = await agents.upper.execute({ text: item });
					state.out.push(result.text);
					return result;
				});
			}
		});
		return { out: state.out };
	},
});

async function main() {
	const res = await Workflow.create({ items: ["apple", "banana", "cherry"] })
		.attach(demoClackishChannel)
		.attach(consoleChannel)
		.run();
	console.log("\nResult:", res.result);
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});

