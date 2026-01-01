/**
 * Lesson 04: Flow Bindings
 */

import { consoleChannel } from "../../src/channels/console-channel.js";
import { runFlowFile } from "../../src/flow-runner.js";

async function main() {
	console.log("Lesson 04: Flow Bindings\n");

	const outputs = await runFlowFile({
		filePath: "lessons/04-flow-bindings/flow.yaml",
		attachments: [consoleChannel],
	});

	console.log("\nFlow outputs:", outputs);
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
