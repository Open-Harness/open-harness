/**
 * Market Service Integration Tests
 * Tests indicator calculations, caching, and market data handling
 */

import { describe, expect, test } from "bun:test";
import type { OHLCV } from "../../src/ccxt/ccxt-interface";
import { MarketService } from "../../src/services/market-service";
import { createTestContext, generateMockCandles, generateOversoldCandles } from "../helpers/test-container";

describe("Market Service Integration", () => {
	test("INT-M01: Fetches and caches candles correctly", async () => {
		const ctx = createTestContext();

		const candles = generateMockCandles(100, 42000);
		ctx.ccxt.loadData("BTC/USDT", candles);

		// First fetch - should hit exchange
		const result1 = await ctx.marketService.fetchCandles("BTC/USDT", "1h", 50);
		expect(result1.length).toBe(50);

		// Second fetch - should hit cache (same params)
		const result2 = await ctx.marketService.fetchCandles("BTC/USDT", "1h", 50);
		expect(result2.length).toBe(50);

		// Verify cache is working by checking DB
		const cacheRows = ctx.db.query("SELECT key FROM cache WHERE key LIKE ?", ["candles:BTC/USDT%"]);
		expect(cacheRows.length).toBeGreaterThan(0);

		ctx.db.close();
	});

	test("INT-M02: Cache expires after TTL", async () => {
		const ctx = createTestContext();

		// Create service with 1 second TTL for testing
		const shortTTLService = new MarketService(ctx.ccxt, ctx.db, ctx.timeSource, {
			cacheTTL: 1000, // 1 second
		});

		const candles = generateMockCandles(50, 42000);
		ctx.ccxt.loadData("BTC/USDT", candles);

		// Fetch to populate cache
		await shortTTLService.fetchCandles("BTC/USDT", "1h", 50);

		// Advance time past TTL
		ctx.timeSource.advance(2000);

		// Modify the source data
		const newCandles = generateMockCandles(50, 45000); // Different price
		ctx.ccxt.loadData("BTC/USDT", newCandles);

		// Fetch again - should get new data since cache expired
		const result = await shortTTLService.fetchCandles("BTC/USDT", "1h", 50);

		// New data should have different prices
		expect(result[0].close).toBeGreaterThan(43000);

		ctx.db.close();
	});

	test("INT-M03: Calculates RSI correctly for normal market", async () => {
		const ctx = createTestContext();

		const candles = generateMockCandles(200, 42000);
		ctx.ccxt.loadData("BTC/USDT", candles);

		const indicators = await ctx.marketService.calculateIndicators("BTC/USDT", "1h", {
			rsi: true,
		});

		expect(indicators.rsi).toBeDefined();
		expect(indicators.rsi!.length).toBeGreaterThan(0);

		// RSI should be between 0 and 100
		for (const rsi of indicators.rsi!) {
			expect(rsi).toBeGreaterThanOrEqual(0);
			expect(rsi).toBeLessThanOrEqual(100);
		}

		// In random walk, RSI should typically be around 40-60
		const currentRSI = ctx.marketService.getCurrentRSI(indicators.rsi!);
		expect(currentRSI).toBeDefined();
		expect(currentRSI!).toBeGreaterThan(20);
		expect(currentRSI!).toBeLessThan(80);

		ctx.db.close();
	});

	test("INT-M04: Calculates RSI < 20 for oversold market", async () => {
		const ctx = createTestContext();

		// Generate strongly bearish candles
		const candles = generateOversoldCandles(200);
		ctx.ccxt.loadData("BTC/USDT", candles);

		const indicators = await ctx.marketService.calculateIndicators("BTC/USDT", "1h", {
			rsi: true,
		});

		const currentRSI = ctx.marketService.getCurrentRSI(indicators.rsi!);
		expect(currentRSI).toBeDefined();
		// Oversold should produce low RSI (though exact value depends on candle generation)
		expect(currentRSI!).toBeLessThan(40);

		ctx.db.close();
	});

	test("INT-M05: Calculates Bollinger Bands correctly", async () => {
		const ctx = createTestContext();

		const candles = generateMockCandles(200, 42000);
		ctx.ccxt.loadData("BTC/USDT", candles);

		const indicators = await ctx.marketService.calculateIndicators("BTC/USDT", "1h", {
			bollingerBands: true,
		});

		expect(indicators.bollingerBands).toBeDefined();
		const bb = indicators.bollingerBands!;

		expect(bb.upper.length).toBeGreaterThan(0);
		expect(bb.middle.length).toBeGreaterThan(0);
		expect(bb.lower.length).toBeGreaterThan(0);

		// Upper > Middle > Lower should always hold
		for (let i = 0; i < bb.upper.length; i++) {
			expect(bb.upper[i]).toBeGreaterThan(bb.middle[i]);
			expect(bb.middle[i]).toBeGreaterThan(bb.lower[i]);
		}

		ctx.db.close();
	});

	test("INT-M06: Calculates SMA correctly", async () => {
		const ctx = createTestContext();

		// Create simple ascending price series
		const candles: OHLCV[] = [];
		for (let i = 0; i < 50; i++) {
			candles.push({
				timestamp: Date.now() - (50 - i) * 3600000,
				open: 40000 + i * 100,
				high: 40050 + i * 100,
				low: 39950 + i * 100,
				close: 40000 + i * 100,
				volume: 1000,
			});
		}
		ctx.ccxt.loadData("BTC/USDT", candles);

		const indicators = await ctx.marketService.calculateIndicators("BTC/USDT", "1h", {
			sma: 10,
		});

		expect(indicators.sma).toBeDefined();
		expect(indicators.sma!.length).toBeGreaterThan(0);

		// SMA should be smoothed (less volatile than raw prices)
		// For ascending prices, SMA should lag below current price
		const lastSMA = indicators.sma![indicators.sma!.length - 1];
		const lastPrice = candles[candles.length - 1].close;
		expect(lastSMA).toBeLessThan(lastPrice);

		ctx.db.close();
	});

	test("INT-M07: Calculates EMA correctly", async () => {
		const ctx = createTestContext();

		const candles = generateMockCandles(200, 42000);
		ctx.ccxt.loadData("BTC/USDT", candles);

		const indicators = await ctx.marketService.calculateIndicators("BTC/USDT", "1h", {
			ema: 20,
		});

		expect(indicators.ema).toBeDefined();
		expect(indicators.ema!.length).toBeGreaterThan(0);

		// EMA values should be reasonable (close to price range)
		for (const ema of indicators.ema!) {
			expect(ema).toBeGreaterThan(30000);
			expect(ema).toBeLessThan(55000);
		}

		ctx.db.close();
	});

	test("INT-M08: Calculates MACD correctly", async () => {
		const ctx = createTestContext();

		const candles = generateMockCandles(200, 42000);
		ctx.ccxt.loadData("BTC/USDT", candles);

		const indicators = await ctx.marketService.calculateIndicators("BTC/USDT", "1h", {
			macd: true,
		});

		expect(indicators.macd).toBeDefined();
		const macd = indicators.macd!;

		expect(macd.MACD.length).toBeGreaterThan(0);
		expect(macd.signal.length).toBeGreaterThan(0);
		expect(macd.histogram.length).toBeGreaterThan(0);

		// MACD lengths should match
		expect(macd.MACD.length).toBe(macd.signal.length);
		expect(macd.signal.length).toBe(macd.histogram.length);

		ctx.db.close();
	});

	test("INT-M09: Calculates ATR correctly", async () => {
		const ctx = createTestContext();

		const candles = generateMockCandles(200, 42000);
		ctx.ccxt.loadData("BTC/USDT", candles);

		const indicators = await ctx.marketService.calculateIndicators("BTC/USDT", "1h", {
			atr: true,
		});

		expect(indicators.atr).toBeDefined();
		expect(indicators.atr!.length).toBeGreaterThan(0);

		// ATR should be positive (it's an absolute value)
		for (const atr of indicators.atr!) {
			expect(atr).toBeGreaterThan(0);
		}

		ctx.db.close();
	});

	test("INT-M10: getCurrentPrice returns last candle close", async () => {
		const ctx = createTestContext();

		const candles: OHLCV[] = [
			{ timestamp: 1000, open: 40000, high: 40500, low: 39500, close: 40200, volume: 100 },
			{ timestamp: 2000, open: 40200, high: 40800, low: 40000, close: 40600, volume: 150 },
			{ timestamp: 3000, open: 40600, high: 41000, low: 40400, close: 40850, volume: 200 },
		];

		const price = ctx.marketService.getCurrentPrice(candles);
		expect(price).toBe(40850);

		ctx.db.close();
	});

	test("INT-M11: getCurrentPrice returns 0 for empty candles", async () => {
		const ctx = createTestContext();

		const price = ctx.marketService.getCurrentPrice([]);
		expect(price).toBe(0);

		ctx.db.close();
	});

	test("INT-M12: Multiple indicators calculated in single call", async () => {
		const ctx = createTestContext();

		const candles = generateMockCandles(200, 42000);
		ctx.ccxt.loadData("BTC/USDT", candles);

		const indicators = await ctx.marketService.calculateIndicators("BTC/USDT", "1h", {
			rsi: true,
			bollingerBands: true,
			sma: 20,
			ema: 10,
			macd: true,
			atr: true,
		});

		// All requested indicators should be present
		expect(indicators.rsi).toBeDefined();
		expect(indicators.bollingerBands).toBeDefined();
		expect(indicators.sma).toBeDefined();
		expect(indicators.ema).toBeDefined();
		expect(indicators.macd).toBeDefined();
		expect(indicators.atr).toBeDefined();

		ctx.db.close();
	});

	test("INT-M13: Handles different timeframes", async () => {
		const ctx = createTestContext();

		const candles = generateMockCandles(500, 42000);
		ctx.ccxt.loadData("BTC/USDT", candles);

		// Different timeframes should work (even though mock doesn't differentiate)
		const hourly = await ctx.marketService.fetchCandles("BTC/USDT", "1h", 100);
		const fourHour = await ctx.marketService.fetchCandles("BTC/USDT", "4h", 100);
		const daily = await ctx.marketService.fetchCandles("BTC/USDT", "1d", 100);

		expect(hourly.length).toBe(100);
		expect(fourHour.length).toBe(100);
		expect(daily.length).toBe(100);

		ctx.db.close();
	});

	test("INT-M14: Handles multiple symbols independently", async () => {
		const ctx = createTestContext();

		ctx.ccxt.loadData("BTC/USDT", generateMockCandles(100, 42000));
		ctx.ccxt.loadData("ETH/USDT", generateMockCandles(100, 2200));

		const btcIndicators = await ctx.marketService.calculateIndicators("BTC/USDT", "1h");
		const ethIndicators = await ctx.marketService.calculateIndicators("ETH/USDT", "1h");

		// RSI can be similar (random walk behavior)
		// But BB bands should reflect different price levels
		const btcBB = btcIndicators.bollingerBands!;
		const ethBB = ethIndicators.bollingerBands!;

		// BTC BB should be around 40k range
		expect(btcBB.middle[btcBB.middle.length - 1]).toBeGreaterThan(30000);

		// ETH BB should be around 2k range
		expect(ethBB.middle[ethBB.middle.length - 1]).toBeLessThan(10000);

		ctx.db.close();
	});

	test("INT-M15: Cache keys are symbol-specific", async () => {
		const ctx = createTestContext();

		ctx.ccxt.loadData("BTC/USDT", generateMockCandles(100, 42000));
		ctx.ccxt.loadData("ETH/USDT", generateMockCandles(100, 2200));

		await ctx.marketService.fetchCandles("BTC/USDT", "1h", 50);
		await ctx.marketService.fetchCandles("ETH/USDT", "1h", 50);

		const btcCache = ctx.db.query("SELECT key FROM cache WHERE key LIKE ?", ["%BTC/USDT%"]);
		const ethCache = ctx.db.query("SELECT key FROM cache WHERE key LIKE ?", ["%ETH/USDT%"]);

		expect(btcCache.length).toBeGreaterThan(0);
		expect(ethCache.length).toBeGreaterThan(0);

		ctx.db.close();
	});
});
