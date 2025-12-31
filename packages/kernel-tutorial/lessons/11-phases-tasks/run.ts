/**
 * Lesson 11: Phases + Tasks
 */

import { defineHarness } from "@open-harness/kernel";
import { consoleChannel } from "../../src/channels/console-channel.js";

const Harness = defineHarness<{}, {}, { plan: string; build: string }>({
	name: "phases-tasks",
	agents: {},
	state: () => ({}),
	run: async ({ phase, task }) => {
		const plan = await phase("Planning", async () => {
			return task("plan", async () => "Define milestones");
		});

		const build = await phase("Build", async () => {
			return task("implement", async () => "Ship it");
		});

		return { plan, build };
	},
});

async function main() {
	console.log("Lesson 11: Phases + Tasks\n");

	const harness = Harness.create({});
	harness.attach(consoleChannel);

	const result = await harness.run();
	console.log("\nHarness result:", result.result);
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
