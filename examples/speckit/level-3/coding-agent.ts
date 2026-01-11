import { createWorkflow, ClaudeHarness, MemorySignalStore } from "@open-harness/core";

/**
 * Coding Agent - Level 3
 *
 * Implements tasks with self-validation. The key concept here is that
 * agents can validate their own output and iterate until quality thresholds
 * are met (or max attempts reached).
 *
 * In v0.3.0, agents are stateless - state lives on the harness.
 * This example wraps the agent in a harness to demonstrate state tracking.
 *
 * Self-validation pattern:
 * 1. Produce implementation
 * 2. Validate against criteria
 * 3. If validation fails, note issues for next attempt
 * 4. Repeat until validation passes or max attempts reached
 *
 * v0.3.0 Migration:
 * - Uses createWorkflow() for typed agent factory
 * - Uses runReactive() instead of run()
 * - Agent has activateOn/emits for signal-based activation
 */

// =============================================================================
// 1. Types
// =============================================================================

/**
 * Validation result tracks whether implementation passes quality checks
 */
export interface ValidationResult {
	passed: boolean;
	issues: string[];
}

/**
 * State tracks attempts and validation history
 */
export interface CodingAgentState {
	/** User's task prompt */
	prompt: string;
	/** Generated code output */
	code: string | null;
	/** Number of attempts made */
	attempts: number;
	/** Last validation result */
	lastValidation: ValidationResult | null;
	/** Maximum attempts allowed */
	maxAttempts: number;
}

export const initialState: CodingAgentState = {
	prompt: "",
	code: null,
	attempts: 0,
	lastValidation: null,
	maxAttempts: 3,
};

// =============================================================================
// 2. Create typed harness factory
// =============================================================================

const { agent, runReactive } = createWorkflow<CodingAgentState>();

// =============================================================================
// 3. Define the coding agent
// =============================================================================

/**
 * The coding agent (stateless).
 *
 * Output format (text-based for now):
 * - CODE section with implementation
 * - VALIDATION section with self-assessment
 * - STATUS: COMPLETE, NEEDS_REVISION, or BLOCKED
 */
export const codingAgentDef = agent({
	prompt: `You are a coding agent that implements tasks and validates its own work.

Given a task, you must:
1. Implement a solution
2. Self-validate your implementation against quality criteria
3. Be honest about issues - don't claim success if there are problems

Task: {{ state.prompt }}

Your response MUST include these sections:

## CODE
\`\`\`
[Your implementation here]
\`\`\`

## VALIDATION
- List each criterion you checked
- Mark each as PASS or FAIL
- Explain any failures

## ISSUES (if any)
- List specific problems found
- Suggest fixes for next attempt

## STATUS
One of:
- COMPLETE: Implementation passes all validation
- NEEDS_REVISION: Found issues, need another attempt
- BLOCKED: Cannot complete (explain why)

Be critical of your own work. It's better to catch issues now than deploy broken code.`,

	activateOn: ["workflow:start"],
	emits: ["code:complete"],
	updates: "code",
});

// =============================================================================
// 4. Export runner function
// =============================================================================

const harness = new ClaudeHarness({
	model: "claude-sonnet-4-20250514",
});

export type RecordingMode = "record" | "replay";

export interface RunOptions {
	fixture?: string;
	mode?: RecordingMode;
	store?: MemorySignalStore;
}

/**
 * Run the coding agent with a prompt.
 */
export async function runCodingAgent(prompt: string, options: RunOptions = {}) {
	const result = await runReactive({
		agents: { coder: codingAgentDef },
		state: {
			...initialState,
			prompt,
		},
		harness,
		recording: options.fixture
			? {
					mode: options.mode ?? "replay",
					store: options.store,
					name: options.fixture,
				}
			: undefined,
		endWhen: (state) => state.code !== null,
	});

	// Extract text content from code output
	const codeOutput = result.state.code as { content?: string } | string | null;
	const output = typeof codeOutput === "string" ? codeOutput : codeOutput?.content ?? "";

	return {
		output,
		state: result.state,
		metrics: {
			latencyMs: result.metrics.durationMs,
			activations: result.metrics.activations,
		},
		signals: result.signals,
	};
}

// Legacy export for backwards compatibility
export const codingAgent = {
	run: runCodingAgent,
};

// =============================================================================
// 5. Parsing utility
// =============================================================================

/**
 * Parse the agent's text output to extract validation status.
 * Returns true if the output indicates COMPLETE status.
 */
export function parseValidationStatus(output: string): {
	passed: boolean;
	status: "complete" | "needs_revision" | "blocked";
	issues: string[];
} {
	const outputUpper = output.toUpperCase();

	// Extract status
	let status: "complete" | "needs_revision" | "blocked" = "needs_revision";
	if (outputUpper.includes("STATUS") && outputUpper.includes("COMPLETE")) {
		if (!outputUpper.includes("NEEDS_REVISION")) {
			status = "complete";
		}
	}
	if (outputUpper.includes("STATUS") && outputUpper.includes("BLOCKED")) {
		status = "blocked";
	}

	// Extract issues section
	const issues: string[] = [];
	const issuesMatch = output.match(/## ISSUES[\s\S]*?(?=## |$)/i);
	if (issuesMatch) {
		const issueLines = issuesMatch[0].split("\n").filter((line) => line.trim().startsWith("-"));
		issues.push(...issueLines.map((line) => line.replace(/^-\s*/, "").trim()));
	}

	return {
		passed: status === "complete",
		status,
		issues,
	};
}
