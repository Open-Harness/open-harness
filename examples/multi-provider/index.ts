/**
 * Multi-Provider Example
 *
 * Demonstrates using multiple AI providers in a single reactive workflow.
 * Each agent can use a different provider based on its needs:
 * - Claude for nuanced analysis
 * - Codex (OpenAI) for fast, cost-effective tasks
 *
 * Run: bun run examples/multi-provider/index.ts
 */

import { ClaudeProvider, CodexProvider, createHarness } from "@open-harness/core";

// =============================================================================
// 1. Define state type
// ============ =================================================================

type ReviewState = {
	/** Code to review */
	code: string;
	/** Detailed analysis from Claude */
	analysis: {
		issues: string[];
		suggestions: string[];
		quality: "good" | "needs-work" | "poor";
	} | null;
	/** Quick summary from Codex */
	summary: string | null;
};

// =============================================================================
// 2. Create providers with different models
// =============================================================================

// Claude for deep analysis - better at nuanced reasoning
const claudeProvider = new ClaudeProvider({
	model: "claude-sonnet-4-20250514",
});

// Codex for quick summarization - fast and cost-effective
const codexProvider = new CodexProvider({
	model: "gpt-5-mini",
});

// =============================================================================
// 3. Create typed harness factory
// =============================================================================

const { agent, runReactive } = createHarness<ReviewState>();

// =============================================================================
// 4. Define agents with different providers
// =============================================================================

/**
 * Code Analyzer - Uses Claude for detailed analysis
 *
 * Claude excels at nuanced code review and catching subtle issues.
 */
const analyzer = agent({
	prompt: `You are a senior code reviewer. Analyze this code thoroughly:

\`\`\`
{{ state.code }}
\`\`\`

Identify:
1. Any bugs or potential issues
2. Suggestions for improvement
3. Overall code quality

Output a JSON object:
{
  "issues": ["issue1", "issue2"],
  "suggestions": ["suggestion1", "suggestion2"],
  "quality": "good" | "needs-work" | "poor"
}

Only output the JSON, nothing else.`,

	activateOn: ["harness:start"],
	emits: ["analysis:complete"],

	// Use Claude for this agent
	signalProvider: claudeProvider,

	// Update state.analysis with output
	updates: "analysis",
});

/**
 * Summarizer - Uses Codex for quick summarization
 *
 * Codex is fast and cost-effective for straightforward tasks.
 */
const summarizer = agent({
	prompt: `Summarize this code review analysis in one concise sentence:

Analysis: {{ signal.payload.output }}

Output only the summary sentence, nothing else.`,

	activateOn: ["analysis:complete"],
	emits: ["summary:complete"],

	// Use Codex for this agent
	signalProvider: codexProvider,

	// Update state.summary with output
	updates: "summary",
});

// =============================================================================
// 5. Run the harness
// =============================================================================

async function main() {
	console.log("=== Multi-Provider Example ===\n");
	console.log("Demonstrating Claude + Codex in a single workflow.\n");

	const sampleCode = `
function fetchUser(id) {
  const response = fetch('/api/users/' + id);
  return response.json();
}
`;

	const result = await runReactive({
		agents: { analyzer, summarizer },
		state: {
			code: sampleCode,
			analysis: null,
			summary: null,
		},
		// No default provider - each agent has its own
		endWhen: (state) => state.summary !== null,
	});

	// =============================================================================
	// 6. Display results
	// =============================================================================

	console.log("=== Execution Summary ===\n");
	console.log(`Duration: ${result.metrics.durationMs}ms`);
	console.log(`Agent Activations: ${result.metrics.activations}`);

	console.log("\n=== Signal Flow ===\n");
	const relevantSignals = result.signals.filter(
		(s) => s.name.startsWith("agent:") || s.name.startsWith("harness:") || s.name.includes(":complete"),
	);
	for (const signal of relevantSignals) {
		const payload = signal.payload as Record<string, unknown>;
		const agent = payload?.agent ?? "system";
		const source = (signal.source as Record<string, unknown>)?.provider;
		const providerInfo = source ? ` [${source}]` : "";
		console.log(`[${agent}]${providerInfo} ${signal.name}`);
	}

	console.log("\n=== Provider Usage ===\n");
	const providerStarts = result.signals.filter((s) => s.name === "provider:start");
	for (const signal of providerStarts) {
		const source = signal.source as Record<string, unknown>;
		console.log(`- ${source?.provider ?? "unknown"}`);
	}

	console.log("\n=== Code Reviewed ===\n");
	console.log(sampleCode.trim());

	console.log("\n=== Analysis (Claude) ===\n");
	const analysisSignal = result.signals.find((s) => s.name === "analysis:complete");
	if (analysisSignal) {
		const payload = analysisSignal.payload as Record<string, unknown>;
		console.log(JSON.stringify(payload.output, null, 2));
	}

	console.log("\n=== Summary (Codex) ===\n");
	const summarySignal = result.signals.find((s) => s.name === "summary:complete");
	if (summarySignal) {
		const payload = summarySignal.payload as Record<string, unknown>;
		console.log(payload.output);
	}
}

main().catch(console.error);
