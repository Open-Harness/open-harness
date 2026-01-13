/**
 * Simulated Market Data Provider
 *
 * Educational purposes only. Real trading requires actual market data APIs.
 */

import type { OptionsChainEntry } from "./types";

export class SimulatedMarketData {
	/**
	 * Get simulated stock price
	 */
	getStockPrice(symbol: string): number {
		// Deterministic prices based on symbol for reproducibility
		const hash = symbol.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
		return 100 + (hash % 400); // Prices between $100-$500
	}

	/**
	 * Get simulated implied volatility
	 */
	getImpliedVolatility(symbol: string): number {
		const hash = symbol.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
		// IV between 20% and 80%
		return 0.2 + (hash % 60) / 100;
	}

	/**
	 * Get simulated historical volatility (usually lower than IV)
	 */
	getHistoricalVolatility(symbol: string): number {
		const iv = this.getImpliedVolatility(symbol);
		// HV is typically 80-90% of IV in normal markets
		return iv * (0.8 + Math.random() * 0.1);
	}

	/**
	 * Generate strike prices around current spot
	 */
	private generateStrikes(spot: number, count: number = 15): number[] {
		const strikes: number[] = [];
		const strikeSpacing = this.getStrikeSpacing(spot);

		// Generate strikes from 20% below to 20% above spot
		const startStrike = Math.floor((spot * 0.8) / strikeSpacing) * strikeSpacing;

		for (let i = 0; i < count; i++) {
			strikes.push(startStrike + i * strikeSpacing);
		}

		return strikes;
	}

	/**
	 * Determine strike spacing based on stock price
	 */
	private getStrikeSpacing(price: number): number {
		if (price < 50) return 1;
		if (price < 100) return 2.5;
		if (price < 200) return 5;
		return 10;
	}

	/**
	 * Calculate days to expiration
	 */
	private getDTE(expiration: Date): number {
		const now = new Date();
		const diff = expiration.getTime() - now.getTime();
		return Math.max(1, Math.floor(diff / (1000 * 60 * 60 * 24)));
	}

	/**
	 * Calculate simulated option premium using simplified model
	 */
	private calculatePremium(type: "call" | "put", strike: number, spot: number, iv: number, dte: number): number {
		// Intrinsic value
		const intrinsic = type === "call" ? Math.max(0, spot - strike) : Math.max(0, strike - spot);

		// Time value (simplified - real calculation uses Black-Scholes)
		const moneyness = Math.abs(strike - spot) / spot;
		const timeValue = spot * iv * Math.sqrt(dte / 365) * Math.exp(-moneyness * 5);

		return Math.max(0.05, intrinsic + timeValue);
	}

	/**
	 * Get full options chain for a symbol at given expiration
	 */
	getOptionsChain(symbol: string, expiration: Date): OptionsChainEntry[] {
		const spot = this.getStockPrice(symbol);
		const iv = this.getImpliedVolatility(symbol);
		const dte = this.getDTE(expiration);
		const strikes = this.generateStrikes(spot);

		return strikes.map((strike) => {
			const callPremium = this.calculatePremium("call", strike, spot, iv, dte);
			const putPremium = this.calculatePremium("put", strike, spot, iv, dte);

			// Add bid-ask spread (1-2%)
			const spread = 0.015;

			return {
				strike,
				call: {
					bid: callPremium * (1 - spread),
					ask: callPremium * (1 + spread),
				},
				put: {
					bid: putPremium * (1 - spread),
					ask: putPremium * (1 + spread),
				},
			};
		});
	}

	/**
	 * Get expiration date N days in the future
	 */
	getExpirationDate(daysOut: number): Date {
		const date = new Date();
		date.setDate(date.getDate() + daysOut);
		return date;
	}

	/**
	 * Calculate IV Rank (simulated 52-week range)
	 */
	getIVRank(symbol: string): number {
		const currentIV = this.getImpliedVolatility(symbol);
		// Simulate 52-week IV range
		const yearLow = currentIV * 0.6;
		const yearHigh = currentIV * 1.4;

		// Where does current IV sit in this range?
		return ((currentIV - yearLow) / (yearHigh - yearLow)) * 100;
	}
}
