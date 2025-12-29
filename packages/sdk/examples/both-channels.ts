/**
 * Both Channels - Test console and clack channels together
 */

import { injectable } from "@needle-di/core";
import { defineHarness } from "../src/factory/define-harness.js";
import { consoleChannel } from "../../channels/src/console/index.js";
import { clackChannel } from "../../channels/src/clack/index.js";

@injectable()
class Worker {
	async work(id: string): Promise<{ id: string; result: string }> {
		await new Promise((r) => setTimeout(r, 500));
		return { id, result: `Completed ${id}` };
	}
}

const Workflow = defineHarness({
	name: "dual-channel-test",
	agents: { worker: Worker },
	state: () => ({ results: [] as string[] }),
	run: async ({ agents, state, phase, task }) => {
		await phase("Processing", async () => {
			await task("work-1", async () => {
				const r = await agents.worker.work("item-1");
				state.results.push(r.result);
				return r;
			});

			await task("work-2", async () => {
				const r = await agents.worker.work("item-2");
				state.results.push(r.result);
				return r;
			});
		});

		return state.results;
	},
});

async function main() {
	console.log("\n🔥 Testing BOTH Channels Together\n");
	console.log("Console output (simple):");
	console.log("─".repeat(50));

	await Workflow.create(undefined)
		.attach(consoleChannel({ colors: true, timestamps: false, verbosity: "normal" }))
		.attach(clackChannel({ showTasks: true, showPhases: true }))
		.run();

	console.log("\n✅ Both channels worked!\n");
}

main().catch(console.error);
