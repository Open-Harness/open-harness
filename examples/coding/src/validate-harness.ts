/**
 * Validation Workflow Harness
 *
 * Three-phase end-to-end validation workflow:
 * 1. Planning: Break down task
 * 2. Coding: Generate code and write to temp file
 * 3. Validation: Execute file and verify output
 *
 * Demonstrates clean agent handoff with file-based communication.
 */

import { defineHarness } from "@openharness/sdk";
import { PlannerAgent, type PlannerOutput } from "@openharness/anthropic/presets";
import {
	ValidationCodingAgent,
	type ValidationCodingOutput,
} from "./validation-coding-agent.js";
import { ValidationAgent, type ValidationOutput } from "./validation-agent.js";

/**
 * State for the validation workflow.
 */
interface ValidationState {
	/** The task to implement */
	task: string;
	/** Planning result */
	plan?: PlannerOutput;
	/** Coding result (includes file path) */
	codeResult?: ValidationCodingOutput;
	/** Validation result */
	validationResult?: ValidationOutput;
}

/**
 * Validation Workflow - end-to-end code generation and validation.
 *
 * This harness demonstrates:
 * - Pure control flow (no bash commands or file I/O)
 * - Agent-to-agent handoff via file paths
 * - Custom event emission for channels
 * - Clean separation of concerns
 */
export const ValidationWorkflow = defineHarness({
	name: "validation-workflow",

	// Agents used in this workflow
	agents: {
		planner: PlannerAgent, // Plans the implementation
		coder: ValidationCodingAgent, // Generates code and writes file
		validator: ValidationAgent, // Executes file and validates
	},

	// Initialize state from input
	state: (input: { task: string }): ValidationState => ({
		task: input.task,
	}),

	// Workflow execution
	run: async ({ agents, state, phase, emit }) => {
		// Phase 1: Planning
		await phase("Planning", async () => {
			const plan = await agents.planner.execute({ prd: state.task });
			state.plan = plan;
			return { taskCount: plan.tasks.length };
		});

		// Phase 2: Coding
		// Agent writes code to temp file and returns path
		await phase("Coding", async () => {
			const result = await agents.coder.execute({ task: state.task });
			state.codeResult = result;
			return {
				language: result.language,
				filePath: result.filePath,
			};
		});

		// Phase 3: Validation
		// Agent executes file at path and cleans up
		await phase("Validation", async () => {
			const validation = await agents.validator.execute({
				filePath: state.codeResult!.filePath,
				language: state.codeResult!.language,
			});

			state.validationResult = validation;

			// Emit custom event for validation results
			emit("validation:result", {
				passed: validation.passed,
				output: validation.output,
				error: validation.error,
				exitCode: validation.exitCode,
			});

			return { passed: validation.passed };
		});

		// Return final result
		return {
			passed: state.validationResult!.passed,
			output: state.validationResult?.output,
			error: state.validationResult?.error,
		};
	},
});

export type { ValidationState };
