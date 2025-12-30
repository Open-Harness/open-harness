import { type AgentDefinition, defineChannel, defineHarness } from "../src/index.ts";

// Minimal "agent" — does some work and emits one thinking event
const UppercaseAgent: AgentDefinition<{ text: string }, { text: string }> = {
	name: "Uppercase",
	async execute(input, { hub }) {
		hub.emit({ type: "agent:thinking", content: `Uppercasing "${input.text}"` });
		await new Promise((r) => setTimeout(r, 150));
		return { text: input.text.toUpperCase() };
	},
};

const clackLikeChannel = () =>
	defineChannel({
		name: "clack-like",
		state: () => ({ tasks: 0 }),
		onStart: () => {
			console.log("== OpenHarness ==");
		},
		on: {
			"phase:start": ({ event }) => {
				const e = event.event;
				if (e.type !== "phase:start") return;
				console.log(`\n[phase] ${e.name}`);
			},
			"task:start": ({ event, state }) => {
				const e = event.event;
				if (e.type !== "task:start") return;
				state.tasks++;
				console.log(`  - starting task: ${e.taskId}`);
			},
			"task:complete": ({ event }) => {
				const e = event.event;
				if (e.type !== "task:complete") return;
				console.log(`  ✓ done: ${e.taskId}`);
			},
			"task:failed": ({ event }) => {
				const e = event.event;
				if (e.type !== "task:failed") return;
				console.log(`  ✗ failed: ${e.taskId} (${e.error})`);
			},
			"agent:thinking": ({ event }) => {
				const e = event.event;
				if (e.type !== "agent:thinking") return;
				console.log(`    … ${e.content}`);
			},
			"harness:complete": ({ event, state }) => {
				const e = event.event;
				if (e.type !== "harness:complete") return;
				console.log(`\n== complete (${e.success ? "ok" : "failed"}) — tasks: ${state.tasks} ==`);
			},
		},
	});

const Workflow = defineHarness({
	name: "simple-workflow",
	agents: { upper: UppercaseAgent },
	state: (input: { items: string[] }) => ({ items: input.items, out: [] as string[] }),
	run: async ({ agents, state, phase, task }) => {
		await phase("Processing", async () => {
			for (const item of state.items) {
				await task(`upper:${item}`, async () => {
					const res = await agents.upper.execute({ text: item });
					state.out.push(res.text);
					return res;
				});
			}
		});
		return { out: state.out };
	},
});

async function main() {
	const result = await Workflow.create({ items: ["apple", "banana"] })
		.attach(clackLikeChannel())
		.run();
	console.log("\nresult:", result.result);
}

main().catch((e) => {
	console.error(e);
});
