/**
 * Validation Agent
 *
 * Executes code files and validates their output.
 * Handles file execution with timeout and cleanup.
 */

import { z } from "zod";
import { defineAnthropicAgent } from "@openharness/anthropic";
import { createPromptTemplate } from "@openharness/anthropic/provider";

/**
 * Input schema for validation agent.
 */
export const ValidationInputSchema = z.object({
	/** Path to the code file to execute */
	filePath: z.string(),
	/** Programming language of the file */
	language: z.string(),
});

/**
 * Output schema for validation results.
 */
export const ValidationOutputSchema = z.object({
	/** Whether the execution succeeded */
	passed: z.boolean(),
	/** Standard output from execution */
	output: z.string().optional(),
	/** Error message if execution failed */
	error: z.string().optional(),
	/** Process exit code */
	exitCode: z.number(),
});

/**
 * Input type for validation.
 */
export type ValidationInput = z.infer<typeof ValidationInputSchema>;

/**
 * Output type for validation.
 */
export type ValidationOutput = z.infer<typeof ValidationOutputSchema>;

/**
 * Prompt template for validation agent.
 */
export const VALIDATION_TEMPLATE = `# Code Validation Agent

You are a code validator. Your job is to execute an existing code file and report the results.

## File to Execute

Path: {{filePath}}
Language: {{language}}

## Instructions

1. **Verify File Exists**: Check that the file exists at the provided path
   \`\`\`bash
   if [ ! -f "{{filePath}}" ]; then
     echo "File not found: {{filePath}}" >&2
     exit 1
   fi
   \`\`\`

2. **Execute Code**: Run the file with appropriate runner and timeout
   - Python: \`timeout 5s uv run python {{filePath}}\`
   - JavaScript/TypeScript: \`timeout 5s bun run {{filePath}}\`
   - Add 5-second timeout to prevent infinite loops

3. **Capture Results**: Save both stdout and stderr
   \`\`\`bash
   # Capture output and exit code
   OUTPUT=$(timeout 5s uv run python {{filePath}} 2>&1)
   EXIT_CODE=$?
   \`\`\`

4. **Clean Up**: Always delete the temp file, even if execution fails
   \`\`\`bash
   # Cleanup (use trap for reliability)
   trap 'rm -f {{filePath}}' EXIT
   \`\`\`

5. **Return Results**: Provide JSON with:
   - \`passed\`: true if exitCode === 0, false otherwise
   - \`output\`: stdout content if passed
   - \`error\`: stderr content if failed
   - \`exitCode\`: the process exit code

## Example Execution Flow

\`\`\`bash
#!/bin/bash
set -e

FILE_PATH="{{filePath}}"

# Setup cleanup trap
trap 'rm -f "$FILE_PATH"' EXIT

# Check file exists
if [ ! -f "$FILE_PATH" ]; then
  echo '{"passed": false, "error": "File not found", "exitCode": 1}'
  exit 0
fi

# Execute with timeout
OUTPUT=$(timeout 5s uv run python "$FILE_PATH" 2>&1)
EXIT_CODE=$?

# Determine if passed
if [ $EXIT_CODE -eq 0 ]; then
  # Success - return output
  echo "{\"passed\": true, \"output\": \"$OUTPUT\", \"exitCode\": 0}"
else
  # Failure - return error
  echo "{\"passed\": false, \"error\": \"$OUTPUT\", \"exitCode\": $EXIT_CODE}"
fi
\`\`\`

## Important Notes

- Always clean up the temp file using trap or try/finally
- Timeout prevents infinite loops (5 seconds max)
- Capture both stdout and stderr for debugging
- Return structured JSON output
- Exit code 0 means passed, non-zero means failed
- Handle edge cases: file not found, permission denied, syntax errors
` as const;

/**
 * Validation agent prompt template.
 */
export const ValidationPromptTemplate = createPromptTemplate<
	typeof VALIDATION_TEMPLATE,
	ValidationInput
>(VALIDATION_TEMPLATE, ValidationInputSchema);

/**
 * Validation Agent - executes code files and validates output.
 */
export const ValidationAgent = defineAnthropicAgent({
	name: "ValidationAgent",
	prompt: ValidationPromptTemplate,
	inputSchema: ValidationInputSchema,
	outputSchema: ValidationOutputSchema,
});
