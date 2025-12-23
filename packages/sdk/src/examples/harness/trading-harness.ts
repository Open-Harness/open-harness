/**
 * Trading Harness Example
 *
 * Demonstrates time-based polling pattern with Agent usage.
 * Shows how to use BaseHarness for continuous market monitoring.
 */

import { BaseHarness, Agent } from "../../harness/index.js";

interface TradingState {
	balance: number;
	position: number;
}

interface MarketData {
	price: number;
	rsi: number;
}

interface Trade {
	action: "BUY" | "SELL" | "HOLD";
	amount: number;
}

/**
 * Example: Trading harness with time-based polling
 * Uses max iterations (10) for demo purposes instead of infinite loop
 */
class TradingHarness extends BaseHarness<TradingState, MarketData, Trade> {
	private trader = new Agent<TradingState, MarketData, Trade>({
		name: "Trader",
		async run({ input, stepNumber }) {
			console.log(`Step ${stepNumber}: RSI=${input.rsi.toFixed(2)}, Price=$${input.price.toFixed(2)}`);

			if (input.rsi < 30) return { action: "BUY", amount: 0.1 };
			if (input.rsi > 70) return { action: "SELL", amount: 0.1 };
			return { action: "HOLD", amount: 0 };
		},
	});

	async *execute() {
		let iterations = 0;
		const maxIterations = 10; // Demo limit - prevents infinite loop

		while (iterations < maxIterations) {
			iterations++;
			// Simulate fetching market data
			const input: MarketData = await this.fetchMarketData();

			const context = this.loadContext();
			const output = await this.trader.run({
				input,
				context: context.state,
				stepNumber: this.currentStep + 1,
				stepHistory: this.getStepHistory(),
				constraints: { maxDrawdown: 0.1 },
			});

			// Update state based on trade
			if (output.action === "BUY") {
				this.state.updateState((s) => ({
					...s,
					position: s.position + output.amount,
					balance: s.balance - output.amount * input.price,
				}));
			} else if (output.action === "SELL") {
				this.state.updateState((s) => ({
					...s,
					position: s.position - output.amount,
					balance: s.balance + output.amount * input.price,
				}));
			}

			yield { input, output };

			// Wait before next poll (short delay for demo)
			await this.sleep(100);
		}
	}

	private async fetchMarketData(): Promise<MarketData> {
		// Mock - in real usage, call exchange API
		return {
			price: 50000 + Math.random() * 1000,
			rsi: Math.random() * 100,
		};
	}

	private sleep(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}
}

// Export for testing
export { TradingHarness, TradingState, MarketData, Trade };

// ============ EXECUTABLE MAIN ============
// Run with: bun packages/sdk/src/examples/harness/trading-harness.ts

async function main() {
	console.log("Starting Trading Harness Demo...\n");

	const harness = new TradingHarness({
		initialState: { balance: 10000, position: 0 },
	});

	await harness.run();

	console.log("\n=== Trading Complete ===");
	console.log(`Final state:`, harness.getState());
	console.log(`Total steps: ${harness.getCurrentStep()}`);
}

// Run if executed directly
if (import.meta.main) {
	main().catch(console.error);
}

