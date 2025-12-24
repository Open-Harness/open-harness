/**
 * ValidationReviewAgent - Validates task completion against criteria
 *
 * Specialized agent for validating coding tasks within the TaskHarness.
 * Uses structured output to return validation results with confidence scores.
 *
 * @module agents/validation-review-agent
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import { inject, injectable } from "@needle-di/core";
import type { IAgentCallbacks } from "../callbacks/types.js";
import { IAnthropicRunnerToken, IEventBusToken } from "../core/tokens.js";
import type { ReviewAgentInput, ReviewAgentOutput, ValidationResult } from "../harness/task-harness-types.js";
import { ReviewAgentOutputSchema } from "../harness/task-harness-types.js";
import { zodToSdkSchema } from "../runner/models.js";
import { BaseAnthropicAgent } from "./base-anthropic-agent.js";

/**
 * SDK schema for structured output.
 */
const ReviewAgentOutputSdkSchema = zodToSdkSchema(ReviewAgentOutputSchema);

/**
 * Options for ValidationReviewAgent execution.
 */
export interface ValidationReviewAgentOptions {
	/** Event callbacks */
	callbacks?: IAgentCallbacks<ReviewAgentOutput>;
	/** Timeout in milliseconds */
	timeoutMs?: number;
}

/**
 * ValidationReviewAgent - Validates completed coding tasks.
 *
 * This agent checks whether a coding task's implementation satisfies
 * its validation criteria. It uses the reviewer.md prompt template
 * and returns structured output with pass/fail, reasoning, and confidence.
 *
 * @example
 * ```typescript
 * const agent = container.get(ValidationReviewAgent);
 *
 * const result = await agent.validate({
 *   task,
 *   codingResult,
 *   validationCriteria: task.validationCriteria,
 *   context: { phase, expectedFiles, previousAttempts: [] },
 * }, "session-1");
 *
 * if (result.passed) {
 *   console.log("Task validated successfully");
 * } else {
 *   console.log("Suggested fixes:", result.suggestedFixes);
 * }
 * ```
 */
@injectable()
export class ValidationReviewAgent extends BaseAnthropicAgent {
	private promptTemplate: string | null = null;

	constructor(runner = inject(IAnthropicRunnerToken), eventBus = inject(IEventBusToken, { optional: true }) ?? null) {
		super("ValidationReviewer", runner, eventBus);
	}

	/**
	 * Validate a completed coding task against its criteria.
	 *
	 * @param input - Validation input with task, coding result, and criteria
	 * @param sessionId - Unique session identifier
	 * @param options - Optional execution options
	 * @returns Structured validation result
	 */
	async validate(
		input: ReviewAgentInput,
		sessionId: string,
		options?: ValidationReviewAgentOptions,
	): Promise<ReviewAgentOutput> {
		const prompt = await this.buildPrompt(input);

		const result = await this.run<ReviewAgentOutput>(prompt, sessionId, {
			allowedTools: ["Read", "Glob", "Grep", "Bash"],
			outputFormat: ReviewAgentOutputSdkSchema,
			callbacks: options?.callbacks,
			timeoutMs: options?.timeoutMs,
		});

		return ReviewAgentOutputSchema.parse(result);
	}

	/**
	 * Convert ReviewAgentOutput to ValidationResult format used by TaskHarness.
	 *
	 * @param taskId - The task ID being validated
	 * @param output - Output from the validation agent
	 * @returns ValidationResult for TaskHarness state management
	 */
	toValidationResult(taskId: string, output: ReviewAgentOutput): ValidationResult {
		return {
			taskId,
			passed: output.passed,
			reasoning: output.reasoning,
			suggestedFixes: output.suggestedFixes,
			confidence: output.confidence,
			uncertainties: output.uncertainties,
		};
	}

	/**
	 * Build the prompt for validation.
	 */
	private async buildPrompt(input: ReviewAgentInput): Promise<string> {
		const template = await this.loadPromptTemplate();

		const sections: string[] = [];

		// Add template context
		sections.push(template);
		sections.push("\n---\n");

		// Add task details
		sections.push("## Task to Validate\n");
		sections.push(`**Task ID**: ${input.task.id}`);
		sections.push(`**Phase**: ${input.task.phase} (Phase ${input.task.phaseNumber})`);
		sections.push(`**Description**: ${input.task.description}`);
		sections.push(`**User Story**: ${input.task.userStory ?? "None"}`);
		sections.push(`**Expected Files**: ${input.task.filePaths.join(", ") || "None specified"}`);
		sections.push("");

		// Add validation criteria
		sections.push("## Validation Criteria\n");
		sections.push(input.validationCriteria);
		sections.push("");

		// Add coding result
		sections.push("## Coding Result\n");
		sections.push(`**Success**: ${input.codingResult.success ? "Yes" : "No"}`);
		sections.push(`**Summary**: ${input.codingResult.summary}`);
		sections.push(`**Files Modified**: ${input.codingResult.filesModified?.join(", ") || "None"}`);

		if (input.codingResult.actions && input.codingResult.actions.length > 0) {
			sections.push("\n### Actions Taken:");
			for (const action of input.codingResult.actions) {
				sections.push(`- ${action.type}: ${action.description}`);
				if (action.filePath) sections.push(`  File: ${action.filePath}`);
			}
		}
		sections.push("");

		// Add context
		sections.push("## Context\n");
		sections.push(`**Phase Goal**: ${input.context.phase.goal || "Not specified"}`);
		sections.push(`**Expected Files After Task**: ${input.context.expectedFiles.join(", ") || "None"}`);

		if (input.context.previousAttempts.length > 0) {
			sections.push("\n### Previous Validation Attempts:");
			for (const attempt of input.context.previousAttempts) {
				sections.push(`- **Passed**: ${attempt.passed}, **Reasoning**: ${attempt.reasoning}`);
				if (attempt.suggestedFixes.length > 0) {
					sections.push(`  Suggested fixes: ${attempt.suggestedFixes.join("; ")}`);
				}
			}
		}

		sections.push("\n---\n");
		sections.push("Now validate this task against the criteria above and return your structured output.");

		return sections.join("\n");
	}

	/**
	 * Load the prompt template from file.
	 */
	private async loadPromptTemplate(): Promise<string> {
		if (this.promptTemplate) {
			return this.promptTemplate;
		}

		const promptPath = path.join(import.meta.dirname, "../../prompts/reviewer.md");

		try {
			this.promptTemplate = await fs.readFile(promptPath, "utf-8");
			return this.promptTemplate;
		} catch {
			// Fallback to inline template if file not found
			return `# Task Validation Agent

You are a validation agent that checks whether coding tasks have been completed correctly.

## Output Schema

Return your validation in JSON format with these fields:
- passed: boolean
- reasoning: string (1-3 sentences)
- suggestedFixes: string[] (empty if passed)
- confidence: number (0.0-1.0)
- uncertainties: string[]
- checksPerformed: array of { name, passed, reason }

PASS if all criteria met. FAIL if any criteria not met.`;
		}
	}
}
