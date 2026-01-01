import { defineChannel } from "@openharness/sdk";

/**
 * Beautiful console output channel
 * Demonstrates pattern matching, state management, and RenderOutput helpers
 */
export const ConsoleChannel = defineChannel({
	name: "Console",

	// Fresh state on each harness run
	state: () => ({
		phaseCount: 0,
		taskCount: 0,
		completedTasks: 0,
		currentPhase: "",
	}),

	// Pattern-based event handlers
	on: {
		// Phase events
		"phase:start": ({ event, output, state }) => {
			state.phaseCount++;
			state.currentPhase = event.event.name;
			output.newline();
			output.line(`┌─ Phase ${state.phaseCount}: ${event.event.name}`);
		},

		"phase:complete": ({ event, output }) => {
			output.success(`└─ ${event.event.name} complete`);
		},

		// Task events
		"task:start": ({ event, output, state }) => {
			state.taskCount++;
			output.line(`  ├─ Starting: ${event.event.id}`);
		},

		"task:complete": ({ output, state }) => {
			state.completedTasks++;
			output.success(`  ├─ Done (${state.completedTasks}/${state.taskCount})`);
		},

		// Agent narrative (thinking out loud)
		narrative: ({ event, output }) => {
			output.line(`  │  💭 ${event.event.text}`);
		},

		// Errors
		"task:failed": ({ event, output }) => {
			output.fail(`  ├─ FAILED: ${event.event.error}`);
		},
	},

	// Lifecycle hooks
	onStart: ({ output }) => {
		output.line("╔════════════════════════════════════════╗");
		output.line("║   Coding Workflow                      ║");
		output.line("╚════════════════════════════════════════╝");
	},

	onComplete: ({ output, state }) => {
		output.newline();
		output.success(
			`🎉 Workflow complete! ${state.completedTasks} tasks processed across ${state.phaseCount} phases`,
		);
	},
});
