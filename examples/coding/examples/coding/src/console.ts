/**
 * Simple console attachment for terminal output
 * Just uses console.log - no fancy abstraction needed
 */

import type { Attachment } from "@openharness/sdk";

export const consoleAttachment: Attachment = (transport) => {
	let phaseCount = 0;
	let taskCount = 0;
	let completedTasks = 0;

	// Header
	console.log("");
	console.log("╔════════════════════════════════════════╗");
	console.log("║   Coding Workflow                      ║");
	console.log("╚════════════════════════════════════════╝");

	transport.subscribe((event) => {
		const e = event as any;

		if (e.type === "phase" && e.status === "start") {
			phaseCount++;
			console.log("");
			console.log(`┌─ Phase ${phaseCount}: ${e.name}`);
		} else if (e.type === "phase" && e.status === "complete") {
			console.log(`└─ ✓ ${e.name} complete`);
		} else if (e.type === "task" && e.status === "start") {
			taskCount++;
			console.log(`  ├─ Starting: ${e.id}`);
		} else if (e.type === "task" && e.status === "complete") {
			completedTasks++;
			console.log(`  ├─ ✓ Done (${completedTasks}/${taskCount})`);
		} else if (e.type === "task" && e.status === "failed") {
			console.log(`  ├─ ✗ FAILED: ${e.error}`);
		} else if (e.type === "narrative") {
			console.log(`  │  💭 ${e.text}`);
		}
	});

	// No cleanup needed
	return undefined;
};
