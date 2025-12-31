/**
 * Lesson 12: Channels
 */

import type { Attachment } from "@open-harness/kernel";
import { defineHarness } from "@open-harness/kernel";
import { consoleChannel } from "../../src/channels/console-channel.js";

const metricsChannel: Attachment = (hub) => {
	let completed = 0;
	const unsubscribe = hub.subscribe("task:complete", () => {
		completed += 1;
	});

	return () => {
		unsubscribe();
		console.log(`\n📈 Tasks completed: ${completed}`);
	};
};

const Harness = defineHarness<{}, {}, { ok: boolean }>({
	name: "channels-demo",
	agents: {},
	state: () => ({}),
	run: async ({ phase, task }) => {
		await phase("Run", async () => {
			await task("first", async () => "one");
			await task("second", async () => "two");
		});
		return { ok: true };
	},
});

async function main() {
	console.log("Lesson 12: Channels\n");

	const harness = Harness.create({});
	harness.attach(consoleChannel);
	harness.attach(metricsChannel);

	const result = await harness.run();
	console.log("\nHarness result:", result.result);
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
