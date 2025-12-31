/**
 * Lesson 02: Flow Edges
 *
 * Demonstrates explicit dependencies via edges.
 */

import { consoleChannel } from "../../src/channels/console-channel.js";
import { runFlowFile } from "../../src/flow-runner.js";

async function main() {
	console.log("Lesson 02: Flow Edges\n");

	const outputs = await runFlowFile({
		filePath: "lessons/02-flow-edges/flow.yaml",
		attachments: [consoleChannel],
	});

	console.log("\nFlow outputs:", outputs);
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
