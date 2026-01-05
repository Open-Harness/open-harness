/**
 * Lesson 03: Flow Inputs + Overrides
 */

import { consoleChannel } from "../../src/channels/console-channel.js";
import { runFlowFile } from "../../src/flow-runner.js";

async function main() {
	console.log("Lesson 03: Flow Inputs\n");

	const outputs = await runFlowFile({
		filePath: "lessons/03-flow-inputs/flow.yaml",
		attachments: [consoleChannel],
		inputOverrides: { name: "Ada" },
	});

	console.log("\nFlow outputs:", outputs);
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
