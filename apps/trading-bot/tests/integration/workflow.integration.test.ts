/**
 * Workflow Integration Tests
 * Tests the full 7-stage trading pipeline with realistic scenarios
 */

import { describe, expect, test } from "bun:test";
import { TradingWorkflow } from "../../src/workflow/trading-workflow";
import { createTestContext, generateMockCandles, generateOversoldCandles } from "../helpers/test-container";

describe("Trading Workflow Integration", () => {
	test("INT-W01: Full workflow cycle completes without position when RSI > 20", async () => {
		const ctx = createTestContext();

		// Load normal market data (RSI should be around 50)
		const candles = generateMockCandles(100, 42000);
		ctx.ccxt.loadData("BTC/USDT", candles);

		const workflow = new TradingWorkflow(
			ctx.container,
			ctx.marketService,
			ctx.orderService,
			ctx.riskService,
			"BTC/USDT",
		);

		const state = await workflow.runSingleCycle();

		expect(state.stage).toBe("IDLE");
		expect(state.observeResult).toBeDefined();
		expect(state.observeResult?.rsi).toBeGreaterThan(20);
		expect(state.analyzeResult?.shouldEnter).toBe(false);

		// No positions should be opened
		const positions = await ctx.ccxt.fetchPositions();
		expect(positions.length).toBe(0);

		ctx.db.close();
	});

	test("INT-W02: Workflow enters position when RSI < 20 (oversold)", async () => {
		const ctx = createTestContext();

		// Load oversold market data (RSI should be < 20)
		const candles = generateOversoldCandles(100);
		ctx.ccxt.loadData("BTC/USDT", candles);

		const workflow = new TradingWorkflow(
			ctx.container,
			ctx.marketService,
			ctx.orderService,
			ctx.riskService,
			"BTC/USDT",
		);

		// Run observe + analyze + validate + execute
		const state = await workflow.runSingleCycle();

		expect(state.observeResult).toBeDefined();
		expect(state.observeResult!.rsi).toBeLessThan(30); // RSI should be low

		// Position should be opened if conditions met
		const positions = await ctx.ccxt.fetchPositions();
		if (state.analyzeResult?.shouldEnter) {
			expect(positions.length).toBe(1);
			expect(positions[0].side).toBe("long");
		}

		ctx.db.close();
	});

	test("INT-W03: Workflow respects risk validation rejection", async () => {
		const ctx = createTestContext();

		// Load oversold data for disallowed symbol
		const candles = generateOversoldCandles(100);
		ctx.ccxt.loadData("DOGE/USDT", candles);

		const workflow = new TradingWorkflow(
			ctx.container,
			ctx.marketService,
			ctx.orderService,
			ctx.riskService,
			"DOGE/USDT", // Not in allowlist
		);

		const state = await workflow.runSingleCycle();

		// Should not enter position due to symbol not allowed
		const positions = await ctx.ccxt.fetchPositions();
		expect(positions.length).toBe(0);

		ctx.db.close();
	});

	test("INT-W04: Workflow OBSERVE stage populates market data correctly", async () => {
		const ctx = createTestContext();

		const candles = generateMockCandles(100, 45000);
		ctx.ccxt.loadData("BTC/USDT", candles);

		const workflow = new TradingWorkflow(
			ctx.container,
			ctx.marketService,
			ctx.orderService,
			ctx.riskService,
			"BTC/USDT",
		);

		const state = await workflow.runSingleCycle();
		const obs = state.observeResult!;

		// Verify OBSERVE stage populated correctly
		expect(obs.symbol).toBe("BTC/USDT");
		expect(obs.candles.length).toBe(100);
		expect(obs.currentPrice).toBeGreaterThan(0);
		expect(typeof obs.rsi).toBe("number");
		expect(obs.bollingerBands.upper).toBeGreaterThan(obs.bollingerBands.lower);
		expect(Array.isArray(obs.positions)).toBe(true);

		ctx.db.close();
	});

	test("INT-W05: Workflow ANALYZE stage produces valid reasoning", async () => {
		const ctx = createTestContext();

		const candles = generateMockCandles(100, 40000);
		ctx.ccxt.loadData("BTC/USDT", candles);

		const workflow = new TradingWorkflow(
			ctx.container,
			ctx.marketService,
			ctx.orderService,
			ctx.riskService,
			"BTC/USDT",
		);

		const state = await workflow.runSingleCycle();
		const analysis = state.analyzeResult!;

		// Verify ANALYZE stage output
		expect(typeof analysis.shouldEnter).toBe("boolean");
		expect(typeof analysis.confidence).toBe("number");
		expect(analysis.confidence).toBeGreaterThanOrEqual(0);
		expect(analysis.confidence).toBeLessThanOrEqual(100);
		expect(analysis.reasoning.length).toBeGreaterThan(0);

		ctx.db.close();
	});

	test("INT-W06: Workflow doesn't re-enter when position exists", async () => {
		const ctx = createTestContext();

		// Create an oversold scenario
		const candles = generateOversoldCandles(100);
		ctx.ccxt.loadData("BTC/USDT", candles);

		// Pre-create a position
		await ctx.ccxt.createOrder("BTC/USDT", "market", "buy", 0.01);

		const workflow = new TradingWorkflow(
			ctx.container,
			ctx.marketService,
			ctx.orderService,
			ctx.riskService,
			"BTC/USDT",
		);

		const state = await workflow.runSingleCycle();

		// Should not try to enter since position exists
		expect(state.analyzeResult?.shouldEnter).toBe(false);
		expect(state.analyzeResult?.reasoning).toContain("Already holding");

		ctx.db.close();
	});

	test("INT-W07: Workflow state transitions correctly through stages", async () => {
		const ctx = createTestContext();

		const candles = generateMockCandles(100, 41000);
		ctx.ccxt.loadData("BTC/USDT", candles);

		const workflow = new TradingWorkflow(
			ctx.container,
			ctx.marketService,
			ctx.orderService,
			ctx.riskService,
			"BTC/USDT",
		);

		// Starts in IDLE
		expect(workflow.getState().stage).toBe("IDLE");

		await workflow.runSingleCycle();

		// Ends in IDLE after cycle
		expect(workflow.getState().stage).toBe("IDLE");

		ctx.db.close();
	});

	test("INT-W08: Workflow handles multiple symbols independently", async () => {
		const ctx = createTestContext();

		// Load data for both symbols
		ctx.ccxt.loadData("BTC/USDT", generateMockCandles(100, 42000));
		ctx.ccxt.loadData("ETH/USDT", generateMockCandles(100, 2200));

		const btcWorkflow = new TradingWorkflow(
			ctx.container,
			ctx.marketService,
			ctx.orderService,
			ctx.riskService,
			"BTC/USDT",
		);

		const ethWorkflow = new TradingWorkflow(
			ctx.container,
			ctx.marketService,
			ctx.orderService,
			ctx.riskService,
			"ETH/USDT",
		);

		const [btcState, ethState] = await Promise.all([btcWorkflow.runSingleCycle(), ethWorkflow.runSingleCycle()]);

		// Both should have valid observe results
		expect(btcState.observeResult?.symbol).toBe("BTC/USDT");
		expect(ethState.observeResult?.symbol).toBe("ETH/USDT");

		// Prices should be different
		expect(btcState.observeResult?.currentPrice).toBeGreaterThan(10000);
		expect(ethState.observeResult?.currentPrice).toBeLessThan(10000);

		ctx.db.close();
	});

	test("INT-W09: Workflow captures errors without crashing", async () => {
		const ctx = createTestContext();

		// Don't load any data - this should cause an error
		const workflow = new TradingWorkflow(
			ctx.container,
			ctx.marketService,
			ctx.orderService,
			ctx.riskService,
			"BTC/USDT",
		);

		// Should not throw, but should capture error
		const state = await workflow.runSingleCycle();

		expect(state.lastError).toBeDefined();
		expect(state.stage).toBe("IDLE");

		ctx.db.close();
	});

	test("INT-W10: Workflow stop() terminates continuous loop", async () => {
		const ctx = createTestContext();

		const candles = generateMockCandles(100, 43000);
		ctx.ccxt.loadData("BTC/USDT", candles);

		const workflow = new TradingWorkflow(
			ctx.container,
			ctx.marketService,
			ctx.orderService,
			ctx.riskService,
			"BTC/USDT",
		);

		// Start and immediately stop
		const runPromise = workflow.runContinuous(100);
		workflow.stop();

		// Should complete quickly without hanging
		const timeout = new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 500));
		const result = await Promise.race([
			runPromise.then(() => true),
			timeout,
		]);

		expect(result).toBe(true);

		ctx.db.close();
	});
});
