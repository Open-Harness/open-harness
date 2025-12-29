import { consoleAttachment } from "./console";
import { CodingWorkflow } from "./harness";

async function main() {
	const prd = `Build a TODO app: add items, mark complete, delete items`;

	// Attach console output
	const result = await CodingWorkflow.create({ prd }).attach(consoleAttachment).run();

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
