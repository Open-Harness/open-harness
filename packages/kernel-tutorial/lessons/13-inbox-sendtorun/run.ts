/**
 * Lesson 13: Inbox + sendToRun
 */

import type { AgentDefinition } from "@open-harness/kernel";
import { defineHarness } from "@open-harness/kernel";
import { consoleChannel } from "../../src/channels/console-channel.js";

const ReceiverAgent: AgentDefinition<{}, { received: string }> = {
	name: "receiver",
	async execute(_input, ctx) {
		const message = await ctx.inbox.pop();
		return { received: message.content };
	},
};

const Harness = defineHarness<{}, {}, { received: string }>({
	name: "inbox-sendtorun",
	agents: { receiver: ReceiverAgent },
	state: () => ({}),
	run: async ({ agents, hub }) => {
		const unsubscribe = hub.subscribe("agent:start", (event) => {
			const payload = event.event as { runId: string };
			hub.sendToRun(payload.runId, "hello from sendToRun");
		});

		const result = await agents.receiver.execute({});
		unsubscribe();
		return result;
	},
});

async function main() {
	console.log("Lesson 13: Inbox + sendToRun\n");

	const harness = Harness.create({});
	harness.attach(consoleChannel);

	const result = await harness.run();
	console.log("\nHarness result:", result.result);
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
