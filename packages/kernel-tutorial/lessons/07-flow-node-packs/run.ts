/**
 * Lesson 07: Node Packs
 */

import { consoleChannel } from "../../src/channels/console-channel.js";
import { runFlowFile } from "../../src/flow-runner.js";

async function main() {
	console.log("Lesson 07: Node Packs\n");

	const outputs = await runFlowFile({
		filePath: "lessons/07-flow-node-packs/flow.yaml",
		attachments: [consoleChannel],
	});

	console.log("\nFlow outputs:", outputs);
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
