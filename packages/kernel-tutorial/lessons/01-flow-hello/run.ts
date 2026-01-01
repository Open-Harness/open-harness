/**
 * Lesson 01: Flow Hello
 *
 * Run a single-node flow via the shared flow runner.
 */

import { consoleChannel } from "../../src/channels/console-channel.js";
import { runFlowFile } from "../../src/flow-runner.js";

async function main() {
	console.log("Lesson 01: Flow Hello\n");

	const outputs = await runFlowFile({
		filePath: "lessons/01-flow-hello/flow.yaml",
		attachments: [consoleChannel],
	});

	console.log("\nFlow outputs:", outputs);
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
