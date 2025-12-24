/**
 * Example: Full Workflow Demo
 *
 * Shows how to use the new workflow builder:
 * - Create agents
 * - Define tasks
 * - Wire them together with orchestration logic
 * - Track progress with TaskList
 */

import { createAgent, createWorkflow } from "../index.js";

async function runWorkflowDemo() {
	console.log("Full Workflow Demo\n");

	// 1. Create workflow with tasks and agents
	const workflow = createWorkflow({
		name: "Code-Review-Pipeline",

		// Define tasks
		tasks: [
			{
				id: "task_1",
				description: "Create a simple TypeScript function that adds two numbers",
			},
			{
				id: "task_2",
				description: "Create a function that multiplies two numbers",
			},
		],

		// Define agents
		agents: {
			coder: createAgent("coder", { model: "haiku" }),
			reviewer: createAgent("reviewer", { model: "haiku" }),
		},

		// Define orchestration logic
		async execute({ agents, state, tasks }) {
			console.log(`Starting workflow with ${tasks.length} tasks\n`);

			for (const task of tasks) {
				console.log(`\n--- Task ${task.id}: ${task.description} ---`);

				// Mark task as in progress
				state.markInProgress(task.id);

				try {
					// 1. Coding Phase
					console.log("Coding phase...");
					const coderResult = await agents.coder.run(task.description, `session_${task.id}`, {
						callbacks: {
							onText: (content) => {
								console.log(`Coder: ${content.slice(0, 80)}...`);
							},
						},
					});

					console.log("Code generated successfully!");

					// 2. Review Phase
					console.log("Review phase...");
					// In a real workflow, you'd pass the code to reviewer
					// For now, just run a simple check
					const reviewResult = await agents.reviewer.run(
						`Review this task: ${task.description}`,
						`session_${task.id}_review`,
						{
							callbacks: {
								onText: (content) => {
									console.log(`Reviewer: ${content.slice(0, 80)}...`);
								},
							},
						},
					);

					// Mark complete
					state.markComplete(task.id, { coderResult, reviewResult });
					console.log(`✓ Task ${task.id} completed!`);
				} catch (error) {
					// Mark failed
					state.markFailed(task.id, String(error));
					console.error(`✗ Task ${task.id} failed:`, error);
				}

				// Show progress
				const progress = state.getProgress();
				console.log(`\nProgress: ${progress.completed}/${progress.total} completed (${progress.percentComplete}%)`);
			}

			console.log("\n=== Workflow Complete ===");
			const finalProgress = state.getProgress();
			console.log(`Total: ${finalProgress.total}`);
			console.log(`Completed: ${finalProgress.completed}`);
			console.log(`Failed: ${finalProgress.failed}`);
		},
	});

	// 2. Run the workflow
	await workflow.run();

	console.log("\nWorkflow demo complete!");
}

// Run if executed directly
if (import.meta.main) {
	runWorkflowDemo().catch(console.error);
}

export { runWorkflowDemo };
