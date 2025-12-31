/**
 * Lesson 08: Custom Node
 */

import { consoleChannel } from "../../src/channels/console-channel.js";
import { runFlowFile } from "../../src/flow-runner.js";

async function main() {
	console.log("Lesson 08: Custom Node\n");

	const outputs = await runFlowFile({
		filePath: "lessons/08-custom-node/flow.yaml",
		attachments: [consoleChannel],
		inputOverrides: { text: "custom node pack" },
	});

	console.log("\nFlow outputs:", outputs);
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
