import { CodingWorkflow } from "./harness";
import { ConsoleChannel } from "./console-channel";

async function main() {
	const prd = `Build a TODO app: add items, mark complete, delete items`;

	// Attach channel for beautiful console output
	const result = await CodingWorkflow.create({ prd })
		.attach(ConsoleChannel)
		.run();

	// Note: No manual event listeners needed!
	// The channel handles all output formatting
	console.log(`\nComplete! ${result.result.tasks.length} tasks processed.`);
}

main()
	.catch((e) => {
		if (e instanceof Error) {
			console.error(e.message);
			process.exit(1);
		} else {
			console.error("An unknown error occurred");
			process.exit(1);
		}
	})
	.finally(() => console.log("Complete!"));
