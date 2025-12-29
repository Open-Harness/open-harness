/**
 * Review Agent Prompt Template
 *
 * Type-safe prompt for the ReviewAgent preset.
 * Replaces the markdown file src/agents/reviewer.prompt.md.
 *
 * @module presets/prompts/review
 */
import { z } from "zod";
import type { ReviewInput } from "../../provider/types.js";
/**
 * Input schema for the review prompt.
 */
export declare const ReviewInputSchema: z.ZodObject<{
    task: z.ZodString;
    implementationSummary: z.ZodString;
}, z.core.$strip>;
/**
 * Issue schema for code review findings.
 */
export declare const ReviewIssueSchema: z.ZodObject<{
    severity: z.ZodEnum<{
        error: "error";
        warning: "warning";
        info: "info";
    }>;
    message: z.ZodString;
    location: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
/**
 * Output schema for structured review results.
 */
export declare const ReviewOutputSchema: z.ZodObject<{
    approved: z.ZodBoolean;
    issues: z.ZodArray<z.ZodObject<{
        severity: z.ZodEnum<{
            error: "error";
            warning: "warning";
            info: "info";
        }>;
        message: z.ZodString;
        location: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    suggestions: z.ZodOptional<z.ZodArray<z.ZodString>>;
}, z.core.$strip>;
/**
 * Raw template string for the review prompt.
 */
export declare const REVIEW_TEMPLATE: "# Code Review Agent\n\nYou are a senior code reviewer. Your job is to review ACTUAL CODE that was committed by the CodingAgent.\n\n## Original Task\n\n{{task}}\n\n## Implementation Summary\n\n{{implementationSummary}}\n\n## Critical: Review the Actual Commit\n\nThe implementation summary above contains a commit hash in the format `commit:<hash>`. You MUST:\n\n1. **Extract the commit hash** from the implementation summary\n2. **Inspect the actual code** using git commands:\n   ```bash\n   # View the commit details and diff\n   git show <commit-hash>\n\n   # Or view specific files that were changed\n   git diff <commit-hash>^..<commit-hash>\n   ```\n3. **Read the actual files** if needed using the Read tool\n\nDo NOT approve or reject based solely on the summary - you must verify the actual implementation.\n\n## Review Checklist\n\nWhen reviewing the code, check for:\n\n1. **Correctness**: Does the implementation actually meet the task requirements?\n2. **Completeness**: Are all aspects of the task addressed?\n3. **Code Quality**: Is the code clean, readable, and well-structured?\n4. **Error Handling**: Are edge cases and errors handled appropriately?\n5. **Best Practices**: Does it follow language/framework conventions?\n\n## Decision Criteria\n\n- **Approve**: The code correctly implements the task, is well-written, and ready to merge\n- **Reject**: The code has significant issues, bugs, or doesn't meet requirements\n\n## Output Format\n\nProvide your decision with:\n\n- **decision**: Either \"approve\" or \"reject\"\n- **feedback**: Specific, constructive feedback about the code you reviewed. Reference actual code you saw in the commit.\n";
/**
 * Review agent prompt template.
 *
 * Guides the agent to review code based on task and implementation summary.
 * Uses {{task}} and {{implementationSummary}} variables for interpolation.
 */
export declare const ReviewPromptTemplate: import("../../index.js").PromptTemplate<ReviewInput>;
