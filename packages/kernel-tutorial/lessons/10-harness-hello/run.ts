/**
 * Lesson 10: Harness Hello
 */

import {
	defineHarness,
	type AgentDefinition,
} from "@open-harness/kernel";
import { consoleChannel } from "../../src/channels/console-channel.js";

const EchoAgent: AgentDefinition<{ text: string }, { text: string }> = {
	name: "echo.agent",
	async execute(input, ctx) {
		ctx.hub.emit({ type: "agent:text", content: input.text });
		return { text: input.text };
	},
};

const Harness = defineHarness<{}, {}, { text: string }>({
	name: "harness-hello",
	agents: { echo: EchoAgent },
	state: () => ({}),
	run: async ({ agents }) => {
		return agents.echo.execute({ text: "Hello from the harness" });
	},
});

async function main() {
	console.log("Lesson 10: Harness Hello\n");

	const harness = Harness.create({});
	harness.attach(consoleChannel);

	const result = await harness.run();
	console.log("\nHarness result:", result.result);
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
