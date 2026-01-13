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

import { ClaudeHarness, CodexHarness, createWorkflow } from "@open-harness/core";
import { render } from "../lib/render.js";

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
const claudeHarness = new ClaudeHarness({
	model: "claude-sonnet-4-20250514",
});

// Codex for quick summarization - fast and cost-effective
const codexHarness = new CodexHarness({
	model: "gpt-5-mini",
});

// =============================================================================
// 3. Create typed harness factory
// =============================================================================

const { agent, runReactive } = createWorkflow<ReviewState>();

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

	activateOn: ["workflow:start"],
	emits: ["analysis:complete"],

	// Use Claude for this agent
	signalHarness: claudeHarness,

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
	signalHarness: codexHarness,

	// Update state.summary with output
	updates: "summary",
});

// =============================================================================
// 5. Run the harness
// =============================================================================

async function main() {
	render.banner("Multi-Provider Example", "Demonstrating Claude + Codex in a single workflow.");

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
		// Infrastructure logging happens automatically via Pino
	});

	// =============================================================================
	// 6. Display results (user-facing output via render)
	// =============================================================================

	render.section("Execution Summary");
	render.metric("Duration", `${result.metrics.durationMs}ms`);
	render.metric("Agent Activations", result.metrics.activations);

	render.section("Signal Flow");
	const relevantSignals = result.signals.filter(
		(s) => s.name.startsWith("agent:") || s.name.startsWith("harness:") || s.name.includes(":complete"),
	);
	for (const signal of relevantSignals) {
		const payload = signal.payload as Record<string, unknown>;
		const agent = payload?.agent ?? "system";
		const source = (signal.source as Record<string, unknown>)?.provider;
		const providerInfo = source ? ` [${source}]` : "";
		render.text(`[${agent}]${providerInfo} ${signal.name}`);
	}

	render.section("Provider Usage");
	const providerStarts = result.signals.filter((s) => s.name === "harness:start");
	render.list(providerStarts.map((s) => {
		const source = s.source as Record<string, unknown>;
		return source?.provider as string ?? "unknown";
	}));

	render.section("Code Reviewed");
	render.text(sampleCode.trim());

	render.section("Analysis (Claude)");
	const analysisSignal = result.signals.find((s) => s.name === "analysis:complete");
	if (analysisSignal) {
		const payload = analysisSignal.payload as Record<string, unknown>;
		render.json(payload.output);
	}

	render.section("Summary (Codex)");
	const summarySignal = result.signals.find((s) => s.name === "summary:complete");
	if (summarySignal) {
		const payload = summarySignal.payload as Record<string, unknown>;
		render.text(payload.output as string);
	}
}

main().catch((err) => render.error(err.message));
