/**
 * Example: Custom Workflow with Monologue
 *
 * Shows advanced workflow patterns:
 * - Custom agents in workflows
 * - Task metadata and results
 * - Conditional logic based on task results
 * - Monologue integration for readable output
 */

import { createAgent, createWorkflow, withMonologue } from "../index.js";

async function runCustomWorkflow() {
	console.log("Custom Workflow Example\n");

	// Create agents (one with monologue!)
	const researcher = createAgent({
		name: "Researcher",
		prompt: "Research this topic and provide 3 key insights: {{topic}}",
		model: "haiku",
	});

	const writerBase = createAgent({
		name: "Writer",
		prompt: "Write a blog post based on these insights: {{insights}}",
		model: "haiku",
	});
	const writerWrapped = withMonologue(writerBase, {
		bufferSize: 3,
		onNarrative: (text) => {
			console.log(`\n📖 Writer's Monologue: "${text}"\n`);
		},
	});

	const editor = createAgent({
		name: "Editor",
		prompt: "Review and improve this content: {{content}}",
		model: "haiku",
	});

	// Create workflow with conditional logic
	const workflow = createWorkflow({
		name: "Content-Creation-Pipeline",

		tasks: [
			{
				id: "research",
				description: "AI agents and workflows",
				metadata: { priority: "high" },
			},
			{
				id: "write",
				description: "Draft blog post",
				metadata: { priority: "high" },
			},
			{
				id: "edit",
				description: "Polish content",
				metadata: { priority: "medium" },
			},
		],

		agents: {
			researcher,
			writer: writerBase,
			editor,
		},

		async execute({ agents, state, tasks }) {
			console.log("🚀 Starting content creation pipeline\n");

			let insights = "";
			let draft = "";

			for (const task of tasks) {
				console.log(`\n--- ${task.id.toUpperCase()} ---`);

				state.markInProgress(task.id);

				try {
					if (task.id === "research") {
						// Research phase
						if (!agents.researcher) throw new Error("Researcher agent not found");
						await agents.researcher.run(
							`Research this topic and provide 3 key insights: ${task.description}`,
							`session_${task.id}`,
							{
								callbacks: {
									onText: (content) => {
										insights = content;
										console.log(`📚 Research: ${content.slice(0, 100)}...`);
									},
								},
							},
						);
						state.markComplete(task.id, { insights });
					} else if (task.id === "write") {
						// Writing phase (with monologue!)
						if (!agents.writer) throw new Error("Writer agent not found");
						await writerWrapped.run(`Write a blog post based on these insights: ${insights}`, `session_${task.id}`, {
							callbacks: {
								onText: (content) => {
									draft = content;
									console.log(`✍️  Draft: ${content.slice(0, 100)}...`);
								},
							},
						});
						state.markComplete(task.id, { draft });
					} else if (task.id === "edit") {
						// Editing phase
						if (!agents.editor) throw new Error("Editor agent not found");
						await agents.editor.run(`Review and improve this content: ${draft}`, `session_${task.id}`, {
							callbacks: {
								onText: (content) => {
									console.log(`✨ Final: ${content.slice(0, 100)}...`);
								},
							},
						});
						state.markComplete(task.id, { final: draft });
					}

					console.log(`✓ ${task.id} complete`);
				} catch (error) {
					console.error(`✗ ${task.id} failed:`, error);
					state.markFailed(task.id, String(error));

					// Conditional: skip remaining if research fails
					if (task.id === "research") {
						console.log("Research failed - skipping remaining tasks");
						tasks.forEach((t) => {
							if (t.status === "pending") {
								state.markSkipped(t.id);
							}
						});
						break;
					}
				}
			}

			// Final report
			console.log("\n=== Pipeline Complete ===");
			const progress = state.getProgress();
			console.log(`Completed: ${progress.completed}`);
			console.log(`Failed: ${progress.failed}`);
			console.log(`Skipped: ${progress.skipped}`);

			// Access results from state
			const researchTask = state.tasks.get("research");
			if (researchTask?.result) {
				console.log("\nResearch Insights:", researchTask.result.insights);
			}
		},
	});

	// Run the workflow
	await workflow.run();

	console.log("\n✓ Custom workflow complete!");
}

if (import.meta.main) {
	runCustomWorkflow().catch(console.error);
}

export { runCustomWorkflow };
