/**
 * Lesson 05: Flow When + Policy
 */

import { consoleChannel } from "../../src/channels/console-channel.js";
import { runFlowFile } from "../../src/flow-runner.js";

async function main() {
	console.log("Lesson 05: Flow When + Policy\n");

	const outputs = await runFlowFile({
		filePath: "lessons/05-flow-when-policy/flow.yaml",
		attachments: [consoleChannel],
	});

	console.log("\nFlow outputs:", outputs);
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
