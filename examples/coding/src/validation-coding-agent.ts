/**
 * Validation Coding Agent
 *
 * Custom coding agent that writes code to temp files without git operations.
 * Used for validation workflows where code execution is needed.
 */

import { z } from "zod";
import { defineAnthropicAgent } from "@openharness/anthropic";
import { createPromptTemplate } from "@openharness/anthropic/provider";

/**
 * Input schema for validation coding agent.
 */
export const ValidationCodingInputSchema = z.object({
	/** The coding task to perform */
	task: z.string().min(1, "Task is required"),
});

/**
 * Output schema for validation coding results.
 */
export const ValidationCodingOutputSchema = z.object({
	/** Path to the written code file */
	filePath: z.string(),
	/** Generated code content */
	code: z.string(),
	/** Programming language used */
	language: z.string(),
	/** Optional explanation of the code */
	explanation: z.string().optional(),
});

/**
 * Input type for validation coding.
 */
export type ValidationCodingInput = z.infer<typeof ValidationCodingInputSchema>;

/**
 * Output type for validation coding.
 */
export type ValidationCodingOutput = z.infer<typeof ValidationCodingOutputSchema>;

/**
 * Prompt template for validation coding agent.
 * Git-free version that writes code to temp files.
 */
export const VALIDATION_CODING_TEMPLATE = `# Coding Agent

You are a skilled software engineer. Your task is to implement code and write it to a temp file for validation.

## Task

{{task}}

## Instructions

1. **Analyze the Task**: Understand what needs to be built and plan your approach

2. **Write Clean Code**: Follow best practices for the language/framework
   - Use meaningful variable and function names
   - Include appropriate error handling
   - Keep the implementation focused and minimal

3. **Write to Temp File**: After writing the code, save it to a temp file:
   - Use path format: \`/tmp/code_\${Date.now()}.<extension>\`
   - Choose appropriate extension (.py, .js, .ts, etc.)
   - Use the Bash tool to write the file
   - Example: \`echo 'code content' > /tmp/code_1234567890.py\`

4. **Return Structured Output**: Provide JSON with:
   - \`filePath\`: The absolute path to the written file
   - \`code\`: The complete code content
   - \`language\`: The programming language (e.g., "python", "javascript")
   - \`explanation\`: Brief description of what the code does (optional)

## Example Workflow

\`\`\`bash
# Write code to temp file
cat > /tmp/code_1234567890.py << 'EOF'
def fibonacci(n):
    if n <= 1:
        return n
    return fibonacci(n-1) + fibonacci(n-2)

print(fibonacci(10))
EOF
\`\`\`

Then return:
\`\`\`json
{
  "filePath": "/tmp/code_1234567890.py",
  "code": "def fibonacci(n):\\n    if n <= 1:\\n        return n\\n    return fibonacci(n-1) + fibonacci(n-2)\\n\\nprint(fibonacci(10))",
  "language": "python",
  "explanation": "Recursive Fibonacci implementation that prints the 10th number"
}
\`\`\`

## Important

- Always write the file before returning the output
- Verify the file was written successfully
- The file path must be absolute and accessible
- No git operations are needed - this is for validation only
` as const;

/**
 * Validation coding agent prompt template.
 */
export const ValidationCodingPromptTemplate = createPromptTemplate<
	typeof VALIDATION_CODING_TEMPLATE,
	ValidationCodingInput
>(VALIDATION_CODING_TEMPLATE, ValidationCodingInputSchema);

/**
 * Validation Coding Agent - generates code and writes to temp files.
 */
export const ValidationCodingAgent = defineAnthropicAgent({
	name: "ValidationCodingAgent",
	prompt: ValidationCodingPromptTemplate,
	inputSchema: ValidationCodingInputSchema,
	outputSchema: ValidationCodingOutputSchema,
});
