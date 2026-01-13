/**
 * Utility functions for options calculations
 */

import type { Greeks, OptionLeg } from "./types";

/**
 * Simplified Delta calculation
 * Real delta requires Black-Scholes model
 */
export function approximateDelta(type: "call" | "put", strike: number, spot: number, dte: number): number {
	const moneyness = spot / strike;
	const timeAdjustment = Math.min(1, dte / 30); // Approaches 0 or 1 near expiration

	if (type === "call") {
		if (moneyness > 1.1) return 0.8 * timeAdjustment; // Deep ITM
		if (moneyness > 1.05) return 0.7 * timeAdjustment; // ITM
		if (moneyness > 0.95) return 0.5; // ATM
		if (moneyness > 0.9) return 0.3 * timeAdjustment; // OTM
		return 0.15 * timeAdjustment; // Deep OTM
	} else {
		// Put deltas are negative
		if (moneyness < 0.9) return -0.8 * timeAdjustment; // Deep ITM
		if (moneyness < 0.95) return -0.7 * timeAdjustment; // ITM
		if (moneyness < 1.05) return -0.5; // ATM
		if (moneyness < 1.1) return -0.3 * timeAdjustment; // OTM
		return -0.15 * timeAdjustment; // Deep OTM
	}
}

/**
 * Simplified Theta calculation
 * Negative for long positions (time decay hurts)
 * Positive for short positions (time decay helps)
 */
export function approximateTheta(
	strike: number,
	spot: number,
	premium: number,
	dte: number,
	action: "buy" | "sell",
): number {
	const isATM = Math.abs(strike - spot) / spot < 0.05;
	const decayRate = isATM ? 0.03 : 0.015; // ATM decays faster

	// Theta accelerates as expiration approaches
	const timeMultiplier = dte > 30 ? 1 : 1 + (30 - dte) / 30;

	const dailyDecay = (premium * decayRate * timeMultiplier) / Math.sqrt(Math.max(1, dte));

	// Long positions lose to theta (negative), short positions gain (positive)
	return action === "buy" ? -dailyDecay : dailyDecay;
}

/**
 * Simplified Vega calculation
 * How much the option value changes per 1% change in IV
 */
export function approximateVega(strike: number, spot: number, premium: number, dte: number): number {
	const isATM = Math.abs(strike - spot) / spot < 0.05;
	const atmBonus = isATM ? 1.5 : 1.0;

	// Vega is higher with more time to expiration
	const timeComponent = Math.sqrt(dte / 365);

	return premium * 0.12 * atmBonus * timeComponent;
}

/**
 * Calculate position Greeks for a multi-leg trade
 */
export function calculatePositionGreeks(legs: OptionLeg[], spot: number, dte: number): Greeks {
	let totalDelta = 0;
	let totalTheta = 0;
	let totalVega = 0;

	for (const leg of legs) {
		const quantity = leg.quantity * 100; // 1 contract = 100 shares

		const legDelta = approximateDelta(leg.type, leg.strike, spot, dte);
		const legTheta = approximateTheta(leg.strike, spot, leg.premium, dte, leg.action);
		const legVega = approximateVega(leg.strike, spot, leg.premium, dte);

		// Sign convention: buying is positive exposure, selling is negative
		const sign = leg.action === "buy" ? 1 : -1;

		totalDelta += sign * legDelta * quantity;
		totalTheta += sign * legTheta * quantity;
		totalVega += sign * legVega * quantity;
	}

	return {
		delta: Math.round(totalDelta * 100) / 100,
		theta: Math.round(totalTheta * 100) / 100,
		vega: Math.round(totalVega * 100) / 100,
	};
}

/**
 * Calculate max risk for a defined-risk strategy
 */
export function calculateMaxRisk(legs: OptionLeg[]): number {
	// Check if this is a covered call (stock + short call)
	const hasStock = legs.some((leg) => leg.type === "stock");
	if (hasStock) {
		// Covered call: max risk is stock cost minus premium collected
		const stockLeg = legs.find((leg) => leg.type === "stock");
		const optionLeg = legs.find((leg) => leg.type === "call" || leg.type === "put");

		if (stockLeg && optionLeg) {
			const stockCost = stockLeg.premium * stockLeg.quantity;
			const optionPremium = optionLeg.premium * optionLeg.quantity * 100;
			return stockCost - optionPremium;
		}
	}

	// For spreads, max risk is the width minus premium collected
	const debits = legs
		.filter((leg) => leg.action === "buy" && leg.type !== "stock")
		.reduce((sum, leg) => sum + leg.premium * leg.quantity * 100, 0);

	const credits = legs
		.filter((leg) => leg.action === "sell" && leg.type !== "stock")
		.reduce((sum, leg) => sum + leg.premium * leg.quantity * 100, 0);

	// For spreads, also consider strike width
	const strikes = legs
		.filter((leg) => leg.type !== "stock")
		.map((leg) => leg.strike)
		.sort((a, b) => a - b);
	const strikeWidth =
		legs.length > 1 && strikes[strikes.length - 1] !== undefined && strikes[0] !== undefined
			? (strikes[strikes.length - 1]! - strikes[0]!) * 100
			: 0;

	// Max risk = debit paid OR (strike width - credit) for spreads
	if (debits > credits) {
		return debits - credits; // Net debit paid
	} else {
		return Math.max(0, strikeWidth - (credits - debits));
	}
}

/**
 * Calculate max profit for a strategy
 */
export function calculateMaxProfit(legs: OptionLeg[]): number {
	// Check if this is a covered call (stock + short call)
	const hasStock = legs.some((leg) => leg.type === "stock");
	if (hasStock) {
		// Covered call: max profit = (strike - stock price) + premium collected
		const stockLeg = legs.find((leg) => leg.type === "stock");
		const callLeg = legs.find((leg) => leg.type === "call");

		if (stockLeg && callLeg) {
			const stockPrice = stockLeg.premium; // Premium field holds the stock price for stock legs
			const strikePrice = callLeg.strike;
			const premiumCollected = callLeg.premium * callLeg.quantity * 100;
			const capitalGain = (strikePrice - stockPrice) * stockLeg.quantity;
			return capitalGain + premiumCollected;
		}
	}

	const debits = legs
		.filter((leg) => leg.action === "buy" && leg.type !== "stock")
		.reduce((sum, leg) => sum + leg.premium * leg.quantity * 100, 0);

	const credits = legs
		.filter((leg) => leg.action === "sell" && leg.type !== "stock")
		.reduce((sum, leg) => sum + leg.premium * leg.quantity * 100, 0);

	const netCredit = credits - debits;

	// For credit spreads, max profit is the credit received
	if (netCredit > 0) {
		return netCredit;
	}

	// For debit spreads, max profit is strike width minus debit paid
	const strikes = legs
		.filter((leg) => leg.type !== "stock")
		.map((leg) => leg.strike)
		.sort((a, b) => a - b);
	if (strikes.length > 1 && strikes[strikes.length - 1] !== undefined && strikes[0] !== undefined) {
		const strikeWidth = (strikes[strikes.length - 1]! - strikes[0]!) * 100;
		return strikeWidth - Math.abs(netCredit);
	}

	// For single long options, max profit is theoretically unlimited (return large number)
	return 999999;
}

/**
 * Calculate break-even price(s) for a strategy
 */
export function calculateBreakEven(legs: OptionLeg[], spot: number): number[] {
	// Simplified: for most strategies, breakeven is near the strikes
	const strikes = legs.map((leg) => leg.strike).sort((a, b) => a - b);

	const netPremium =
		legs.reduce((sum, leg) => {
			const sign = leg.action === "buy" ? -1 : 1;
			return sum + sign * leg.premium;
		}, 0) / legs.length;

	// For vertical spreads, breakevens are adjusted from strikes
	if (strikes.length === 2 && strikes[0] !== undefined && strikes[1] !== undefined) {
		return [strikes[0]! + Math.abs(netPremium), strikes[1]! - Math.abs(netPremium)];
	}

	// For iron condors (4 legs), two breakevens
	if (strikes.length === 4 && strikes[1] !== undefined && strikes[2] !== undefined) {
		return [strikes[1]! - Math.abs(netPremium), strikes[2]! + Math.abs(netPremium)];
	}

	// For single options or straddles
	return [spot + netPremium, spot - netPremium];
}

/**
 * Estimate probability of profit (simplified)
 */
export function estimateProbabilityOfProfit(breakEvens: number[], spot: number, iv: number, dte: number): number {
	// Simplified: assume normal distribution of price at expiration
	// Real calculation uses cumulative normal distribution

	const expectedMove = spot * iv * Math.sqrt(dte / 365);

	if (breakEvens.length === 2) {
		// Range strategy (like iron condor)
		const lowerBE = Math.min(...breakEvens);
		const upperBE = Math.max(...breakEvens);
		const rangeWidth = upperBE - lowerBE;

		// PoP roughly scales with range width vs expected move
		const pop = Math.min(95, (rangeWidth / (2 * expectedMove)) * 68);
		return Math.round(pop);
	} else {
		// Directional strategy
		const mainBE = breakEvens[0];
		if (mainBE === undefined) return 50; // Default if no breakeven

		const distance = Math.abs(mainBE - spot);

		// Further OTM breakeven = higher PoP for selling, lower for buying
		const pop = 50 + ((expectedMove - distance) / expectedMove) * 30;
		return Math.max(10, Math.min(90, Math.round(pop)));
	}
}

/**
 * Extract JSON from agent output (may have markdown code blocks)
 */
export function extractJSON<T>(output: unknown): T | null {
	const raw = output as { content?: string } | string | null;
	let text = typeof raw === "string" ? raw : (raw?.content ?? "");

	try {
		// Try to strip markdown code blocks first
		const markdownMatch = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
		if (markdownMatch) {
			text = markdownMatch[1];
		}

		// Find JSON in the text
		const jsonMatch = text.match(/\{[\s\S]*\}/);
		if (!jsonMatch) return null;

		return JSON.parse(jsonMatch[0]) as T;
	} catch (error) {
		console.error("[extractJSON] Parse error:", error, "Text:", text.substring(0, 200));
		return null;
	}
}
