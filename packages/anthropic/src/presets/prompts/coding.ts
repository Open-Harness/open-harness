/**
 * Coding Agent Prompt Template
 *
 * Type-safe prompt for the CodingAgent preset.
 * Replaces the markdown file src/agents/coder.prompt.md.
 *
 * @module presets/prompts/coding
 */

import { z } from "zod";
import { createPromptTemplate } from "../../provider/prompt-template.js";
import type { CodingInput } from "../../provider/types.js";

/**
 * Input schema for the coding prompt.
 */
export const CodingInputSchema = z.object({
	/** The coding task to perform */
	task: z.string().min(1, "Task is required"),
});

/**
 * Output schema for structured coding results.
 */
export const CodingOutputSchema = z.object({
	/** Generated code */
	code: z.string(),
	/** Optional explanation of the code */
	explanation: z.string().optional(),
	/** Programming language used */
	language: z.string().optional(),
});

/**
 * Raw template string for the coding prompt.
 */
export const CODING_TEMPLATE = `# Coding Agent

You are a skilled software engineer working in a collaborative development workflow. Your task is to implement code and commit it for review.

## Task

{{task}}

## Instructions

1. **Analyze the Task**: Understand what needs to be built and plan your approach
2. **Write Clean Code**: Follow best practices for the language/framework
   - Use meaningful variable and function names
   - Include appropriate error handling
   - Keep the implementation focused and minimal
3. **Commit Your Work**: After writing code, you MUST commit it to git:
   - Stage the relevant files with \`git add\`
   - Commit with a descriptive message explaining what you built
   - The commit message should be clear enough for a reviewer to understand the changes
4. **Get the Commit Hash**: After committing, run \`git rev-parse HEAD\` to get the commit hash

## Critical: Git Commit Required

Your work is NOT complete until you have committed your changes. The next agent (ReviewAgent) will review your actual committed code, not a summary. They need the commit hash to inspect your work.

\`\`\`bash
# Example workflow:
git add path/to/files
git commit -m "feat: implement todo list with add/complete/delete functionality"
git rev-parse HEAD  # Returns something like: a1b2c3d4e5f6...
\`\`\`

## Output Format

When you're done, provide structured output with:

- **stopReason**: Set to "finished" when complete
- **summary**: A brief description of what you implemented (1-2 sentences)
- **handoff**: Include the commit hash in the format \`commit:<hash>\` so the reviewer can inspect your actual code

Example handoff: \`commit:a1b2c3d4e5f6789012345678901234567890abcd\`
` as const;

/**
 * Coding agent prompt template.
 *
 * Guides the agent to implement code based on a task description.
 * Uses {{task}} variable for interpolation.
 */
export const CodingPromptTemplate = createPromptTemplate<
	typeof CODING_TEMPLATE,
	CodingInput
>(
	CODING_TEMPLATE,
	CodingInputSchema,
);
