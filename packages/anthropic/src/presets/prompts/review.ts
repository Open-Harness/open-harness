/**
 * Review Agent Prompt Template
 *
 * Type-safe prompt for the ReviewAgent preset.
 * Replaces the markdown file src/agents/reviewer.prompt.md.
 *
 * @module presets/prompts/review
 */

import { z } from "zod";
import { createPromptTemplate } from "../../provider/prompt-template.js";
import type { ReviewInput } from "../../provider/types.js";

/**
 * Input schema for the review prompt.
 */
export const ReviewInputSchema = z.object({
	/** Original task that was implemented */
	task: z.string().min(1, "Task is required"),
	/** Summary of what was implemented */
	implementationSummary: z.string().min(1, "Implementation summary is required"),
});

/**
 * Issue schema for code review findings.
 */
export const ReviewIssueSchema = z.object({
	/** Issue severity level */
	severity: z.enum(["error", "warning", "info"]),
	/** Description of the issue */
	message: z.string(),
	/** Optional file/line location */
	location: z.string().optional(),
});

/**
 * Output schema for structured review results.
 */
export const ReviewOutputSchema = z.object({
	/** Whether the implementation is approved */
	approved: z.boolean(),
	/** List of issues found */
	issues: z.array(ReviewIssueSchema),
	/** Optional improvement suggestions */
	suggestions: z.array(z.string()).optional(),
});

/**
 * Raw template string for the review prompt.
 */
export const REVIEW_TEMPLATE = `# Code Review Agent

You are a senior code reviewer. Your job is to review ACTUAL CODE that was committed by the CodingAgent.

## Original Task

{{task}}

## Implementation Summary

{{implementationSummary}}

## Critical: Review the Actual Commit

The implementation summary above contains a commit hash in the format \`commit:<hash>\`. You MUST:

1. **Extract the commit hash** from the implementation summary
2. **Inspect the actual code** using git commands:
   \`\`\`bash
   # View the commit details and diff
   git show <commit-hash>

   # Or view specific files that were changed
   git diff <commit-hash>^..<commit-hash>
   \`\`\`
3. **Read the actual files** if needed using the Read tool

Do NOT approve or reject based solely on the summary - you must verify the actual implementation.

## Review Checklist

When reviewing the code, check for:

1. **Correctness**: Does the implementation actually meet the task requirements?
2. **Completeness**: Are all aspects of the task addressed?
3. **Code Quality**: Is the code clean, readable, and well-structured?
4. **Error Handling**: Are edge cases and errors handled appropriately?
5. **Best Practices**: Does it follow language/framework conventions?

## Decision Criteria

- **Approve**: The code correctly implements the task, is well-written, and ready to merge
- **Reject**: The code has significant issues, bugs, or doesn't meet requirements

## Output Format

Provide your decision with:

- **decision**: Either "approve" or "reject"
- **feedback**: Specific, constructive feedback about the code you reviewed. Reference actual code you saw in the commit.
` as const;

/**
 * Review agent prompt template.
 *
 * Guides the agent to review code based on task and implementation summary.
 * Uses {{task}} and {{implementationSummary}} variables for interpolation.
 */
export const ReviewPromptTemplate = createPromptTemplate<
	typeof REVIEW_TEMPLATE,
	ReviewInput
>(
	REVIEW_TEMPLATE,
	ReviewInputSchema,
);
