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

import { createHarness } from "@internal/core";
import { ClaudeProvider } from "@signals/provider-claude";

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

const { agent, runReactive } = createHarness<TradingState>();

// =============================================================================
// 3. Define reactive agents
// =============================================================================

/**
 * Market Analyst - Analyzes market data and trends
 *
 * Runs in PARALLEL with Risk Assessor on harness:start
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

	activateOn: ["harness:start"],
	emits: ["analysis:complete"],

	// Only analyze if we have a valid symbol
	when: (ctx) => ctx.state.symbol.length > 0,
});

/**
 * Risk Assessor - Evaluates position risk
 *
 * Runs in PARALLEL with Market Analyst on harness:start
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

	activateOn: ["harness:start"],
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
	when: (ctx) => {
		return ctx.state.review?.approved === true;
	},
});

// =============================================================================
// 4. Run the harness
// =============================================================================

async function main() {
	console.log("=== Trading Agent Example ===\n");
	console.log("Demonstrating parallel execution, signal chaining, and guard conditions.\n");

	const provider = new ClaudeProvider({
		model: "claude-sonnet-4-20250514",
	});

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
		provider,
		// End when we have either:
		// 1. An executed trade
		// 2. A rejected trade (review.approved = false)
		// 3. Trader decided to hold (no proposal)
		endWhen: (state) =>
			state.execution !== null || state.review?.approved === false || state.proposal?.action === "hold",
	});

	// =============================================================================
	// 5. Display results
	// =============================================================================

	console.log("=== Execution Summary ===\n");
	console.log(`Duration: ${result.metrics.durationMs}ms`);
	console.log(`Agent Activations: ${result.metrics.activations}`);
	console.log(`Terminated Early: ${result.terminatedEarly}`);

	console.log("\n=== Signal Flow ===\n");
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
		console.log(`[${agent}] ${signal.name}`);
	}

	console.log("\n=== Final State ===\n");
	const { analysis, risk, proposal, review, execution } = result.state;

	if (analysis) {
		console.log(`Market Analysis:`);
		console.log(`  Trend: ${analysis.trend} (${analysis.confidence}% confidence)`);
		console.log(`  Summary: ${analysis.summary}`);
	}

	if (risk) {
		console.log(`\nRisk Assessment:`);
		console.log(`  Level: ${risk.level}`);
		console.log(`  Max Position: $${risk.maxPosition}`);
		if (risk.warnings.length > 0) {
			console.log(`  Warnings: ${risk.warnings.join(", ")}`);
		}
	}

	if (proposal) {
		console.log(`\nTrade Proposal:`);
		console.log(`  Action: ${proposal.action}`);
		console.log(`  Quantity: ${proposal.quantity}`);
		console.log(`  Price: $${proposal.price}`);
		console.log(`  Reason: ${proposal.reason}`);
	}

	if (review) {
		console.log(`\nReview Decision:`);
		console.log(`  Approved: ${review.approved}`);
		console.log(`  Feedback: ${review.feedback}`);
	}

	if (execution) {
		console.log(`\nExecution Result:`);
		console.log(`  Order ID: ${execution.orderId}`);
		console.log(`  Status: ${execution.status}`);
		console.log(`  Timestamp: ${execution.timestamp}`);
	}

	// Outcome summary
	console.log("\n=== Outcome ===\n");
	if (execution?.status === "filled") {
		console.log("Trade executed successfully.");
	} else if (review?.approved === false) {
		console.log("Trade rejected by reviewer.");
	} else if (proposal?.action === "hold") {
		console.log("Decided to hold - no trade executed.");
	} else {
		console.log("Workflow completed without execution.");
	}
}

main().catch(console.error);
