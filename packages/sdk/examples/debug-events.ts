/**
 * Debug Events - See what events are actually being emitted
 */

import { injectable } from "@needle-di/core";
import { defineHarness, defineChannel } from "../src/index.js";

@injectable()
class SimpleAgent {
	execute(input: string): string {
		return `Processed: ${input}`;
	}
}

// Debug channel that logs ALL events
const debugChannel = defineChannel({
	name: "Debug",
	on: {
		"*": ({ event }: any) => {
			console.log("📢 EVENT:", event.event.type, JSON.stringify(event.event, null, 2));
		},
	},
});

const TestHarness = defineHarness({
	name: "test",
	agents: { worker: SimpleAgent },
	state: () => ({ count: 0 }),
	run: async ({ agents, phase, task }) => {
		await phase("Testing", async () => {
			await task("test-task", async () => {
				const result = agents.worker.execute("hello");
				return { result };
			});
		});
		return { done: true };
	},
});

async function main() {
	console.log("🔍 Starting debug harness...\n");

	await TestHarness.create(undefined)
		.attach(debugChannel)
		.run();

	console.log("\n✅ Done");
}

main().catch(console.error);
