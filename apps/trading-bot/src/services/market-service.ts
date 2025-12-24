/**
 * Market Service
 * Handles market data fetching, caching, and indicator calculations
 */

import { ATR, BollingerBands, EMA, MACD, RSI, SMA } from "technicalindicators";
import type { CCXTInterface, OHLCV } from "../ccxt/ccxt-interface";
import type { TradingDatabase } from "../core/database";
import type { TimeSource } from "../core/time-source";

export interface IndicatorResult {
	rsi?: number[];
	bollingerBands?: { upper: number[]; middle: number[]; lower: number[] };
	sma?: number[];
	ema?: number[];
	macd?: { MACD: number[]; signal: number[]; histogram: number[] };
	atr?: number[];
}

export interface MarketServiceConfig {
	cacheTTL?: number; // Cache TTL in milliseconds
}

export class MarketService {
	private ccxt: CCXTInterface;
	private db: TradingDatabase;
	private timeSource: TimeSource;
	private cacheTTL: number;

	constructor(ccxt: CCXTInterface, db: TradingDatabase, timeSource: TimeSource, config: MarketServiceConfig = {}) {
		this.ccxt = ccxt;
		this.db = db;
		this.timeSource = timeSource;
		this.cacheTTL = config.cacheTTL ?? 60000; // 1 minute default
	}

	async fetchCandles(symbol: string, timeframe: string, limit: number = 100, since?: number): Promise<OHLCV[]> {
		const cacheKey = `candles:${symbol}:${timeframe}:${since ?? "latest"}:${limit}`;
		const cached = this.getFromCache<OHLCV[]>(cacheKey);
		if (cached) return cached;

		const candles = await this.ccxt.fetchOHLCV(symbol, timeframe, since, limit);
		this.setCache(cacheKey, candles);
		return candles;
	}

	async calculateIndicators(
		symbol: string,
		timeframe: string = "1h",
		options: {
			rsi?: boolean;
			bollingerBands?: boolean;
			sma?: number;
			ema?: number;
			macd?: boolean;
			atr?: boolean;
		} = {},
	): Promise<IndicatorResult> {
		const candles = await this.fetchCandles(symbol, timeframe, 200);
		const closes = candles.map((c) => c.close);
		const highs = candles.map((c) => c.high);
		const lows = candles.map((c) => c.low);

		const result: IndicatorResult = {};

		if (options.rsi !== false) {
			result.rsi = RSI.calculate({ values: closes, period: 14 });
		}

		if (options.bollingerBands !== false) {
			const bb = BollingerBands.calculate({
				values: closes,
				period: 20,
				stdDev: 2,
			});
			result.bollingerBands = {
				upper: bb.map((b) => b.upper),
				middle: bb.map((b) => b.middle),
				lower: bb.map((b) => b.lower),
			};
		}

		if (options.sma) {
			result.sma = SMA.calculate({ values: closes, period: options.sma });
		}

		if (options.ema) {
			result.ema = EMA.calculate({ values: closes, period: options.ema });
		}

		if (options.macd) {
			const macd = MACD.calculate({
				values: closes,
				fastPeriod: 12,
				slowPeriod: 26,
				signalPeriod: 9,
				SimpleMAOscillator: false,
				SimpleMASignal: false,
			});
			result.macd = {
				MACD: macd.map((m) => m.MACD ?? 0),
				signal: macd.map((m) => m.signal ?? 0),
				histogram: macd.map((m) => m.histogram ?? 0),
			};
		}

		if (options.atr) {
			result.atr = ATR.calculate({
				high: highs,
				low: lows,
				close: closes,
				period: 14,
			});
		}

		return result;
	}

	getCurrentRSI(rsiValues: number[]): number | undefined {
		return rsiValues[rsiValues.length - 1];
	}

	getCurrentPrice(candles: OHLCV[]): number {
		return candles[candles.length - 1]?.close ?? 0;
	}

	private getFromCache<T>(key: string): T | null {
		const now = this.timeSource.now();
		const rows = this.db.query<{ value: string; expires_at: number }>(
			"SELECT value, expires_at FROM cache WHERE key = ?",
			[key],
		);

		if (rows.length === 0) return null;
		if (rows[0].expires_at < now) {
			this.db.run("DELETE FROM cache WHERE key = ?", [key]);
			return null;
		}

		return JSON.parse(rows[0].value) as T;
	}

	private setCache<T>(key: string, value: T): void {
		const expiresAt = this.timeSource.now() + this.cacheTTL;
		this.db.run("INSERT OR REPLACE INTO cache (key, value, expires_at) VALUES (?, ?, ?)", [
			key,
			JSON.stringify(value),
			expiresAt,
		]);
	}
}
