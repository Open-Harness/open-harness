/**
 * Trading Agent Example
 *
 * Flagship multi-agent workflow demonstrating v0.3.0 reactive architecture:
 * - Parallel execution (Analyst + Risk Assessor start together)
 * - Signal chaining (agents trigger downstream agents)
 * - Guard conditions (Executor only runs if trade approved)
 * - State-driven decisions (confidence thresholds)
 * - Template expansion ({{ state.x }} syntax)
 *
 * Run: bun run examples/trading-agent/index.ts
 */

import { ClaudeHarness, createWorkflow } from "@open-harness/core";
import { render } from "../lib/render.js";

// =============================================================================
// 1. Define state type for trading workflow
// =============================================================================

type TradingState = {
	/** Symbol being traded */
	symbol: string;
	/** Market analysis result */
	analysis: {
		trend: "bullish" | "bearish" | "neutral";
		confidence: number;
		summary: string;
	} | null;
	/** Risk assessment result */
	risk: {
		level: "low" | "medium" | "high";
		maxPosition: number;
		warnings: string[];
	} | null;
	/** Proposed trade from trader */
	proposal: {
		action: "buy" | "sell" | "hold";
		quantity: number;
		price: number;
		reason: string;
	} | null;
	/** Review decision */
	review: {
		approved: boolean;
		feedback: string;
	} | null;
	/** Execution result */
	execution: {
		orderId: string;
		status: "filled" | "rejected" | "pending";
		timestamp: string;
	} | null;
	/** Minimum confidence threshold for trading */
	confidenceThreshold: number;
	/** Account balance */
	balance: number;
};

// =============================================================================
// 2. Create typed harness factory
// =============================================================================

const { agent, runReactive } = createWorkflow<TradingState>();

// =============================================================================
// 3. Define reactive agents
// =============================================================================

/**
 * Market Analyst - Analyzes market data and trends
 *
 * Runs in PARALLEL with Risk Assessor on workflow:start
 */
const analyst = agent({
	prompt: `You are a market analyst. Analyze the current market conditions for {{ state.symbol }}.

Determine:
1. Market trend (bullish, bearish, or neutral)
2. Confidence level (0-100%)
3. Brief summary of key factors

Output a JSON object with:
{
  "trend": "bullish" | "bearish" | "neutral",
  "confidence": 0-100,
  "summary": "Brief explanation"
}

Only output the JSON, nothing else.`,

	activateOn: ["workflow:start"],
	emits: ["analysis:complete"],

	// Only analyze if we have a valid symbol
	when: (ctx) => ctx.state.symbol.length > 0,
});

/**
 * Risk Assessor - Evaluates position risk
 *
 * Runs in PARALLEL with Market Analyst on workflow:start
 */
const riskAssessor = agent({
	prompt: `You are a risk management specialist. Assess the risk of trading {{ state.symbol }}.

Given:
- Current balance: {{ state.balance }} dollars
- Confidence threshold: {{ state.confidenceThreshold }}%

Determine:
1. Risk level (low, medium, high)
2. Maximum position size (as percentage of balance)
3. Any risk warnings

Output a JSON object with:
{
  "level": "low" | "medium" | "high",
  "maxPosition": number (dollars),
  "warnings": ["warning1", "warning2"]
}

Only output the JSON, nothing else.`,

	activateOn: ["workflow:start"],
	emits: ["risk:assessed"],

	// Only assess if we have balance to trade
	when: (ctx) => ctx.state.balance > 0,
});

/**
 * Trader - Proposes trades based on analysis and risk
 *
 * Waits for BOTH analysis and risk assessment to complete.
 * Demonstrates signal pattern matching with wildcards.
 */
const trader = agent({
	prompt: `You are a trader. Based on the market analysis and risk assessment, propose a trade.

Market Analysis: {{ signal.payload.output }}
Symbol: {{ state.symbol }}
Balance: {{ state.balance }} dollars

Create a trade proposal that respects:
1. The market trend and confidence from analysis
2. Risk guidelines (be conservative if risk is high)
3. Account balance constraints

Output a JSON object with:
{
  "action": "buy" | "sell" | "hold",
  "quantity": number (units to trade),
  "price": number (target price),
  "reason": "Brief explanation"
}

If conditions are unfavorable, propose "hold" with quantity 0.
Only output the JSON, nothing else.`,

	// Activates when analysis completes - risk is factored in via state
	activateOn: ["analysis:complete"],
	emits: ["trade:proposed"],

	// Only propose if analysis shows sufficient confidence
	// Note: state.analysis is populated by the reducer when analysis:complete fires
	when: (ctx) => {
		const analysis = ctx.state.analysis;
		return analysis !== null && analysis.confidence >= ctx.state.confidenceThreshold;
	},
});

/**
 * Reviewer - Reviews and approves/rejects trade proposals
 *
 * Acts as a safety check before execution.
 */
const reviewer = agent({
	prompt: `You are a senior trader reviewing a trade proposal.

Proposed Trade:
{{ signal.payload.output }}

Symbol: {{ state.symbol }}
Account Balance: {{ state.balance }} dollars

Review the proposal and decide whether to approve or reject.
Consider:
1. Does the trade make sense given market conditions?
2. Is the position size reasonable for the account?
3. Are there any red flags?

Output a JSON object with:
{
  "approved": true | false,
  "feedback": "Explanation of decision"
}

Only output the JSON, nothing else.`,

	activateOn: ["trade:proposed"],
	emits: ["trade:reviewed"],
});

/**
 * Executor - Executes approved trades
 *
 * Only runs if trade was APPROVED by reviewer.
 * Demonstrates guard conditions for conditional execution.
 */
const executor = agent({
	prompt: `You are a trade executor. Execute the approved trade.

Trade Details:
- Symbol: {{ state.symbol }}
- Action: {{ state.proposal.action }}
- Quantity: {{ state.proposal.quantity }}
- Target Price: {{ state.proposal.price }}

Simulate executing this trade and return the result.

Output a JSON object with:
{
  "orderId": "ORD-XXXXXX" (generate a random ID),
  "status": "filled" | "rejected" | "pending",
  "timestamp": "ISO timestamp"
}

Only output the JSON, nothing else.`,

	activateOn: ["trade:reviewed"],
	emits: ["trade:executed"],

	// GUARD: Only execute if trade was approved
	// Note: state.review is populated by the reducer when trade:reviewed fires
	when: (ctx) => {
		const review = ctx.state.review;
		return review?.approved === true;
	},
});

// =============================================================================
// 4. Run the harness
// =============================================================================

async function main() {
	render.banner("Trading Agent Example", "Demonstrating parallel execution, signal chaining, and guard conditions.");

	const harness = new ClaudeHarness({
		model: "claude-sonnet-4-20250514",
	});

	// Helper to extract JSON from provider output
	const extractJSON = (output: unknown): unknown => {
		const raw = output as { content?: string } | string | null;
		const text = typeof raw === "string" ? raw : (raw?.content ?? "");
		try {
			// Find JSON in the text (may have markdown code blocks)
			const jsonMatch = text.match(/\{[\s\S]*\}/);
			return jsonMatch ? JSON.parse(jsonMatch[0]) : null;
		} catch {
			return null;
		}
	};

	const result = await runReactive({
		agents: {
			analyst,
			riskAssessor,
			trader,
			reviewer,
			executor,
		},
		state: {
			symbol: "AAPL",
			analysis: null,
			risk: null,
			proposal: null,
			review: null,
			execution: null,
			confidenceThreshold: 60,
			balance: 10000,
		},
		harness,

		// Reducers parse JSON output from agent signals
		reducers: {
			"analysis:complete": (state, signal) => {
				const payload = signal.payload as { output?: unknown };
				state.analysis = extractJSON(payload.output) as TradingState["analysis"];
			},
			"risk:assessed": (state, signal) => {
				const payload = signal.payload as { output?: unknown };
				state.risk = extractJSON(payload.output) as TradingState["risk"];
			},
			"trade:proposed": (state, signal) => {
				const payload = signal.payload as { output?: unknown };
				state.proposal = extractJSON(payload.output) as TradingState["proposal"];
			},
			"trade:reviewed": (state, signal) => {
				const payload = signal.payload as { output?: unknown };
				state.review = extractJSON(payload.output) as TradingState["review"];
			},
			"trade:executed": (state, signal) => {
				const payload = signal.payload as { output?: unknown };
				state.execution = extractJSON(payload.output) as TradingState["execution"];
			},
		},

		// End when we have either:
		// 1. An executed trade
		// 2. A rejected trade (review.approved = false)
		// 3. Trader decided to hold (no proposal)
		endWhen: (state) =>
			state.execution !== null || state.review?.approved === false || state.proposal?.action === "hold",
	});

	// =============================================================================
	// 5. Display results (user-facing output via render)
	// =============================================================================

	render.section("Execution Summary");
	render.metric("Duration", `${result.metrics.durationMs}ms`);
	render.metric("Agent Activations", result.metrics.activations);
	render.metric("Terminated Early", result.terminatedEarly);

	render.section("Signal Flow");
	const agentSignals = result.signals.filter(
		(s) =>
			s.name.startsWith("agent:") ||
			s.name.startsWith("harness:") ||
			s.name.includes(":complete") ||
			s.name.includes(":assessed") ||
			s.name.includes(":proposed") ||
			s.name.includes(":reviewed") ||
			s.name.includes(":executed"),
	);
	for (const signal of agentSignals) {
		const payload = signal.payload as Record<string, unknown>;
		const agent = payload?.agent ?? "system";
		render.text(`[${agent}] ${signal.name}`);
	}

	render.section("Final State");
	const { analysis, risk, proposal, review, execution } = result.state;

	if (analysis) {
		render.text("Market Analysis:");
		render.metric("  Trend", `${analysis.trend} (${analysis.confidence}% confidence)`);
		render.metric("  Summary", analysis.summary);
	}

	if (risk) {
		render.blank();
		render.text("Risk Assessment:");
		render.metric("  Level", risk.level);
		render.metric("  Max Position", `$${risk.maxPosition}`);
		if (risk.warnings.length > 0) {
			render.metric("  Warnings", risk.warnings.join(", "));
		}
	}

	if (proposal) {
		render.blank();
		render.text("Trade Proposal:");
		render.metric("  Action", proposal.action);
		render.metric("  Quantity", proposal.quantity);
		render.metric("  Price", `$${proposal.price}`);
		render.metric("  Reason", proposal.reason);
	}

	if (review) {
		render.blank();
		render.text("Review Decision:");
		render.metric("  Approved", review.approved);
		render.metric("  Feedback", review.feedback);
	}

	if (execution) {
		render.blank();
		render.text("Execution Result:");
		render.metric("  Order ID", execution.orderId);
		render.metric("  Status", execution.status);
		render.metric("  Timestamp", execution.timestamp);
	}

	// Outcome summary
	render.section("Outcome");
	if (execution?.status === "filled") {
		render.text("Trade executed successfully.");
	} else if (review?.approved === false) {
		render.text("Trade rejected by reviewer.");
	} else if (proposal?.action === "hold") {
		render.text("Decided to hold - no trade executed.");
	} else {
		render.text("Workflow completed without execution.");
	}
}

main().catch((err) => render.error(err.message));
