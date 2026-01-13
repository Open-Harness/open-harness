/**
 * Options Strategy Demonstrator
 *
 * Educational multi-agent workflow demonstrating:
 * - Options fundamentals (calls, puts, spreads, Greeks)
 * - Strategy selection based on market + volatility environment
 * - Risk analysis and position sizing
 * - 5 core strategies: Covered Call, Cash-Secured Put, Bull Call Spread, Iron Condor, Long Straddle
 *
 * DISCLAIMER: Educational purposes only. Uses simulated data and simplified calculations.
 * Real trading requires professional data APIs and accurate pricing models.
 *
 * Run: bun run examples/options-strategy/index.ts
 */

import { ClaudeHarness, createWorkflow } from "@open-harness/core";
import { SimulatedMarketData } from "./market-data";
import type {
	MarketOutlook,
	OptionsWorkflowState,
	RiskReview,
	StrategyRecommendation,
	TradeSetup,
	VolatilityEnvironment,
} from "./types";
import {
	calculateBreakEven,
	calculateMaxProfit,
	calculateMaxRisk,
	calculatePositionGreeks,
	estimateProbabilityOfProfit,
	extractJSON,
} from "./utils";

// =============================================================================
// 1. Create typed workflow factory
// =============================================================================

const { agent, runReactive } = createWorkflow<OptionsWorkflowState>();

// =============================================================================
// 2. Define reactive agents
// =============================================================================

/**
 * Volatility Analyst - Analyzes IV environment to guide strategy selection
 *
 * Key concepts:
 * - High IV favors selling options (collect premium)
 * - Low IV favors buying options (cheaper to enter)
 * - IV Rank shows where current IV sits in 52-week range
 */
const volatilityAnalyst = agent({
	prompt: `You are a volatility specialist. Analyze the implied volatility environment for options trading.

Symbol: {{ state.underlying }}
Current Price: \${{ state.currentPrice }}

Market Data (simulated):
- Implied Volatility: 45%
- Historical Volatility: 38%
- IV Rank: 65/100 (65th percentile vs 52-week range)

Based on this IV environment, determine:
1. IV Regime: "high_iv" (IV Rank > 50), "normal_iv" (30-50), or "low_iv" (< 30)
2. Whether this favors buying or selling options
3. Key insights for strategy selection

Output JSON:
{
  "impliedVol": 45,
  "historicalVol": 38,
  "ivRank": 65,
  "regime": "high_iv" | "normal_iv" | "low_iv",
  "analysis": "Brief explanation of what this means for trading"
}

Only output the JSON, nothing else.`,

	activateOn: ["workflow:start"],
	emits: ["volatility:analyzed"],
});

/**
 * Market Analyzer - Determines directional bias and timeframe
 *
 * Guides whether to use bullish, bearish, or neutral strategies
 */
const marketAnalyzer = agent({
	prompt: `You are a market analyst. Determine the directional outlook for {{ state.underlying }}.

Current Price: \${{ state.currentPrice }}
Days to Expiration: {{ state.daysToExpiration }}

Analyze:
1. Market Direction: "bullish" | "bearish" | "neutral"
2. Strength: "strong" | "moderate" | "weak"
3. Timeframe: "short_term" (< 30 days) | "medium_term" (30-60) | "long_term" (> 60)
4. Confidence: 0-100

For this example, provide a moderate bullish outlook with 70% confidence.

Output JSON:
{
  "direction": "bullish" | "bearish" | "neutral",
  "strength": "strong" | "moderate" | "weak",
  "timeframe": "short_term" | "medium_term" | "long_term",
  "confidence": 70,
  "reasoning": "Brief explanation of outlook"
}

Only output the JSON, nothing else.`,

	activateOn: ["workflow:start"],
	emits: ["market:analyzed"],
});

/**
 * Strategy Selector - Picks optimal strategy based on market + volatility
 *
 * The 5 core strategies:
 * 1. Covered Call (bullish + high IV) - Own stock, sell call
 * 2. Cash-Secured Put (neutral-bullish + high IV) - Sell put, collect premium
 * 3. Bull Call Spread (bullish + low IV) - Buy call, sell higher call
 * 4. Iron Condor (neutral + high IV) - Sell OTM put spread + call spread
 * 5. Long Straddle (neutral + low IV + expecting volatility spike) - Buy ATM call + put
 */
const strategySelector = agent({
	prompt: `You are a strategy specialist. Select the optimal options strategy.

Market Outlook: {{ signal.payload.output }}
IV Environment: {{ state.volatilityEnvironment.regime }}
Risk Tolerance: {{ state.riskTolerance }}

Available Strategies:
1. Covered Call - Bullish + High IV (own stock, sell call for income)
2. Cash-Secured Put - Neutral-Bullish + High IV (sell put, collect premium)
3. Bull Call Spread - Bullish + Low IV (defined risk directional play)
4. Iron Condor - Neutral + High IV (profit from range-bound price)
5. Long Straddle - Neutral + Low IV (profit from volatility spike)

Selection Criteria:
- High IV (> 50) → Favor selling premium (Covered Call, Cash-Secured Put, Iron Condor)
- Low IV (< 30) → Favor buying options (Bull Call Spread, Long Straddle)
- Bullish → Covered Call, Cash-Secured Put, Bull Call Spread
- Neutral → Iron Condor, Long Straddle
- Risk Tolerance: Conservative → defined-risk strategies (spreads, condors)

Output JSON:
{
  "name": "Strategy Name",
  "type": "directional" | "income" | "volatility",
  "rationale": "Why this strategy fits the market + IV environment",
  "suitability": 85 (0-100 match score)
}

Only output the JSON, nothing else.`,

	activateOn: ["market:analyzed"],
	emits: ["strategy:selected"],

	// Only select strategy if we have both analyses
	when: (ctx) => ctx.state.volatilityEnvironment !== null && ctx.state.marketOutlook !== null,
});

/**
 * Trade Builder - Constructs the multi-leg trade with specific strikes and premiums
 *
 * Uses simulated market data to build realistic option legs
 */
const tradeBuilder = agent({
	prompt: `You are a trade construction specialist. Build the specific option legs for this strategy.

Strategy: {{ state.recommendedStrategy.name }}
Underlying: {{ state.underlying }}
Current Price: \${{ state.currentPrice }}
Days to Expiration: {{ state.daysToExpiration }}
Account Size: \${{ state.accountSize }}

For the selected strategy, determine:
1. Which strikes to use (OTM, ATM, ITM based on strategy)
2. Number of contracts (based on account size)
3. Whether to buy or sell each leg

Guidelines by Strategy:
- Covered Call: Own 100 shares, sell 1 OTM call (delta ~0.30)
- Cash-Secured Put: Sell 1 ATM or slightly OTM put
- Bull Call Spread: Buy ATM call, sell OTM call (5-10 strikes higher)
- Iron Condor: Sell OTM put spread + OTM call spread (2-3 strikes wide)
- Long Straddle: Buy ATM call + ATM put

Use current price \${{ state.currentPrice }} to calculate strikes.
Premium estimate: ATM = 3-5% of stock price, OTM = 1-2%

Output JSON with leg array:
{
  "strategy": "{{ state.recommendedStrategy.name }}",
  "legs": [
    {
      "type": "call" | "put",
      "strike": number,
      "action": "buy" | "sell",
      "quantity": 1,
      "premium": number (per contract)
    }
  ],
  "explanation": "Brief description of the trade setup"
}

Only output the JSON, nothing else.`,

	activateOn: ["strategy:selected"],
	emits: ["trade:constructed"],
});

/**
 * Greeks Calculator - Computes position Greeks and risk metrics
 *
 * Greeks help understand risk exposure:
 * - Delta: Directional exposure (how position moves with stock)
 * - Theta: Time decay (daily P&L change from passing time)
 * - Vega: Volatility sensitivity (P&L change from IV move)
 */
const greeksCalculator = agent({
	prompt: `You are a risk modeling specialist. Calculate the position Greeks and risk/reward.

Trade Setup: {{ signal.payload.output }}
Current Price: \${{ state.currentPrice }}
Days to Expiration: {{ state.daysToExpiration }}

NOTE: Greeks calculations are performed by the utility functions.
Your job is to interpret them and add max risk, max profit, breakeven points.

For the trade legs provided:
1. Calculate max risk (worst case loss)
2. Calculate max profit (best case gain)
3. Estimate breakeven price(s)
4. Estimate probability of profit (0-100)

Risk/Reward Guidelines:
- Debit Spreads: Max risk = debit paid, Max profit = strike width - debit
- Credit Spreads: Max profit = credit received, Max risk = strike width - credit
- Iron Condor: Max profit = net credit, Max risk = wing width - credit
- Long options: Max risk = premium paid, Max profit = unlimited (or strike difference)

Output JSON:
{
  "maxRisk": number (dollars),
  "maxProfit": number (dollars),
  "breakEven": [number, number?] (price points),
  "probabilityOfProfit": number (0-100)
}

Only output the JSON, nothing else.`,

	activateOn: ["trade:constructed"],
	emits: ["greeks:calculated"],
});

/**
 * Risk Evaluator - Final safety check before execution
 *
 * Validates:
 * - Position size relative to account
 * - Risk/reward ratio
 * - Capital requirements
 */
const riskEvaluator = agent({
	prompt: `You are a risk management specialist. Evaluate if this trade is appropriate.

Trade Setup: {{ state.tradeSetup.strategy }}
Max Risk: \${{ state.tradeSetup.maxRisk }}
Max Profit: \${{ state.tradeSetup.maxProfit }}
Account Size: \${{ state.accountSize }}
Risk Tolerance: {{ state.riskTolerance }}

Risk Management Rules:
- Conservative: Max 2% of account per trade
- Moderate: Max 5% of account per trade
- Aggressive: Max 10% of account per trade

Risk/Reward Guidelines:
- Prefer R:R ratio > 1:2 (risk $1 to make $2+)
- Credit strategies: Ensure adequate margin
- Debit strategies: Don't risk more than potential profit justifies

Evaluate:
1. Is position size appropriate for account and risk tolerance?
2. Is risk/reward ratio acceptable?
3. Are there any red flags?
4. What's the capital requirement (margin or cash secured)?

Output JSON:
{
  "approved": true | false,
  "concerns": ["concern1", "concern2"] or [],
  "capitalRequired": number (dollars needed),
  "riskRewardRatio": number (e.g., 1:2 = 2.0),
  "recommendation": "Brief summary and approval reasoning"
}

Only output the JSON, nothing else.`,

	activateOn: ["greeks:calculated"],
	emits: ["risk:assessed"],
});

// =============================================================================
// 3. Main execution
// =============================================================================

async function main() {
	console.log("=== Options Strategy Demonstrator ===\n");
	console.log("Educational example demonstrating multi-agent options analysis.\n");
	console.log("DISCLAIMER: Simulated data only. Not for real trading.\n");

	// Initialize market data
	const marketData = new SimulatedMarketData();

	// Example parameters
	const symbol = "AAPL";
	const daysToExpiration = 45; // ~6 weeks out

	const currentPrice = marketData.getStockPrice(symbol);
	const iv = marketData.getImpliedVolatility(symbol);
	const hv = marketData.getHistoricalVolatility(symbol);
	const ivRank = marketData.getIVRank(symbol);

	console.log(`Analyzing: ${symbol}`);
	console.log(`Current Price: $${currentPrice.toFixed(2)}`);
	console.log(`IV: ${(iv * 100).toFixed(1)}% | HV: ${(hv * 100).toFixed(1)}% | IV Rank: ${ivRank.toFixed(0)}/100`);
	console.log(`Target Expiration: ${daysToExpiration} days\n`);

	const harness = new ClaudeHarness({
		model: "claude-sonnet-4-20250514",
	});

	const result = await runReactive({
		agents: {
			volatilityAnalyst,
			marketAnalyzer,
			strategySelector,
			tradeBuilder,
			greeksCalculator,
			riskEvaluator,
		},
		state: {
			underlying: symbol,
			currentPrice,
			accountSize: 50000,
			riskTolerance: "moderate",
			daysToExpiration,
			volatilityEnvironment: null,
			marketOutlook: null,
			recommendedStrategy: null,
			tradeSetup: null,
			riskReview: null,
		},
		harness,

		// Reducers to parse agent outputs
		reducers: {
			"volatility:analyzed": (state, signal) => {
				const payload = signal.payload as { output?: unknown };
				const parsed = extractJSON<VolatilityEnvironment>(payload.output);
				if (parsed) {
					state.volatilityEnvironment = parsed;
				}
			},
			"market:analyzed": (state, signal) => {
				const payload = signal.payload as { output?: unknown };
				const parsed = extractJSON<MarketOutlook>(payload.output);
				if (parsed) {
					state.marketOutlook = parsed;
				}
			},
			"strategy:selected": (state, signal) => {
				const payload = signal.payload as { output?: unknown };
				const parsed = extractJSON<StrategyRecommendation>(payload.output);
				if (parsed) {
					state.recommendedStrategy = parsed;
				}
			},
			"trade:constructed": (state, signal) => {
				const payload = signal.payload as { output?: unknown };
				const parsed = extractJSON<Partial<TradeSetup>>(payload.output);
				if (parsed?.legs) {
					// Calculate Greeks using utility functions
					const greeks = calculatePositionGreeks(parsed.legs, state.currentPrice, state.daysToExpiration);

					state.tradeSetup = {
						strategy: parsed.strategy ?? state.recommendedStrategy?.name ?? "Unknown",
						legs: parsed.legs,
						maxRisk: 0, // Will be filled by greeks calculator
						maxProfit: 0,
						breakEven: [],
						probabilityOfProfit: 0,
						greeks,
						explanation: parsed.explanation ?? "",
					};
				}
			},
			"greeks:calculated": (state, signal) => {
				const payload = signal.payload as { output?: unknown };
				const parsed = extractJSON<Partial<TradeSetup>>(payload.output);
				if (parsed && state.tradeSetup) {
					// Calculate actual risk/reward metrics
					const maxRisk = calculateMaxRisk(state.tradeSetup.legs);
					const maxProfit = calculateMaxProfit(state.tradeSetup.legs);
					const breakEven = calculateBreakEven(state.tradeSetup.legs, state.currentPrice);
					const probabilityOfProfit = estimateProbabilityOfProfit(
						breakEven,
						state.currentPrice,
						iv,
						state.daysToExpiration,
					);

					state.tradeSetup = {
						...state.tradeSetup,
						maxRisk,
						maxProfit,
						breakEven,
						probabilityOfProfit,
					};
				}
			},
			"risk:assessed": (state, signal) => {
				const payload = signal.payload as { output?: unknown };
				const parsed = extractJSON<RiskReview>(payload.output);
				if (parsed) {
					state.riskReview = parsed;
				}
			},
		},

		// End when risk assessment is complete
		endWhen: (state) => state.riskReview !== null,
	});

	// =============================================================================
	// 4. Display results
	// =============================================================================

	console.log("\n=== Execution Summary ===\n");
	console.log(`Duration: ${result.metrics.durationMs}ms`);
	console.log(`Agent Activations: ${result.metrics.activations}`);

	const { volatilityEnvironment, marketOutlook, recommendedStrategy, tradeSetup, riskReview } = result.state;

	if (volatilityEnvironment) {
		console.log("\n=== Volatility Analysis ===");
		console.log(`IV: ${volatilityEnvironment.impliedVol}% | HV: ${volatilityEnvironment.historicalVol}%`);
		console.log(`IV Rank: ${volatilityEnvironment.ivRank}/100 (${volatilityEnvironment.regime})`);
		console.log(`Analysis: ${volatilityEnvironment.analysis}`);
	}

	if (marketOutlook) {
		console.log("\n=== Market Outlook ===");
		console.log(`Direction: ${marketOutlook.direction} (${marketOutlook.strength})`);
		console.log(`Timeframe: ${marketOutlook.timeframe}`);
		console.log(`Confidence: ${marketOutlook.confidence}%`);
		console.log(`Reasoning: ${marketOutlook.reasoning}`);
	}

	if (recommendedStrategy) {
		console.log("\n=== Recommended Strategy ===");
		console.log(`Strategy: ${recommendedStrategy.name}`);
		console.log(`Type: ${recommendedStrategy.type}`);
		console.log(`Suitability: ${recommendedStrategy.suitability}/100`);
		console.log(`Rationale: ${recommendedStrategy.rationale}`);
	}

	if (tradeSetup) {
		console.log("\n=== Trade Setup ===");
		console.log(`Strategy: ${tradeSetup.strategy}`);
		console.log(`\nLegs:`);
		for (const [idx, leg] of tradeSetup.legs.entries()) {
			const action = leg.action === "buy" ? "BUY " : "SELL";
			const type = leg.type.toUpperCase().padEnd(4);
			console.log(
				`  ${idx + 1}. ${action} ${leg.quantity}x ${type} $${leg.strike.toFixed(2)} @ $${leg.premium.toFixed(2)}`,
			);
		}

		console.log(`\nRisk/Reward:`);
		console.log(`  Max Risk: $${tradeSetup.maxRisk.toFixed(2)}`);
		console.log(`  Max Profit: $${tradeSetup.maxProfit === 999999 ? "Unlimited" : tradeSetup.maxProfit.toFixed(2)}`);
		console.log(`  Break-Even: $${tradeSetup.breakEven.map((be) => be.toFixed(2)).join(", $")}`);
		console.log(`  Probability of Profit: ${tradeSetup.probabilityOfProfit}%`);

		console.log(`\nGreeks:`);
		console.log(`  Delta: ${tradeSetup.greeks.delta.toFixed(2)} (directional exposure)`);
		console.log(`  Theta: $${tradeSetup.greeks.theta.toFixed(2)}/day (time decay)`);
		console.log(`  Vega: $${tradeSetup.greeks.vega.toFixed(2)}/1% IV (volatility sensitivity)`);

		if (tradeSetup.explanation) {
			console.log(`\nExplanation: ${tradeSetup.explanation}`);
		}
	}

	if (riskReview) {
		console.log("\n=== Risk Assessment ===");
		console.log(`Status: ${riskReview.approved ? "✓ APPROVED" : "✗ REJECTED"}`);
		console.log(`Capital Required: $${riskReview.capitalRequired.toFixed(2)}`);

		const rrRatio =
			riskReview.riskRewardRatio !== null ? `1:${riskReview.riskRewardRatio.toFixed(2)}` : "N/A (calculation error)";
		console.log(`Risk/Reward Ratio: ${rrRatio}`);

		if (riskReview.concerns.length > 0) {
			console.log(`\nConcerns:`);
			for (const concern of riskReview.concerns) {
				console.log(`  - ${concern}`);
			}
		}

		console.log(`\nRecommendation: ${riskReview.recommendation}`);
	}

	console.log("\n=== Educational Notes ===");
	console.log("1. This uses SIMULATED data - real trading requires live market data");
	console.log("2. Greeks are APPROXIMATIONS - real calculations use Black-Scholes");
	console.log("3. Always paper trade first and validate with your broker");
	console.log("4. Options carry significant risk - never risk more than you can afford to lose");
}

main().catch(console.error);
