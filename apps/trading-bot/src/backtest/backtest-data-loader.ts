/**
 * Backtest Data Loader
 * Loads historical OHLCV data from CSV or JSON files
 */

import type { OHLCV } from "../ccxt/ccxt-interface";

export interface DataLoaderConfig {
	dataDir?: string;
}

export class BacktestDataLoader {
	private dataDir: string;

	constructor(config: DataLoaderConfig = {}) {
		this.dataDir = config.dataDir ?? "./data";
	}

	/**
	 * Load candles from a JSON file
	 * Expected format: Array of OHLCV objects or arrays
	 */
	async loadFromJSON(filePath: string): Promise<OHLCV[]> {
		const file = Bun.file(filePath);

		if (!(await file.exists())) {
			throw new Error(`Data file not found: ${filePath}`);
		}

		const content = await file.json();
		return this.normalizeCandles(content);
	}

	/**
	 * Load candles from a CSV file
	 * Expected columns: timestamp,open,high,low,close,volume
	 */
	async loadFromCSV(filePath: string): Promise<OHLCV[]> {
		const file = Bun.file(filePath);

		if (!(await file.exists())) {
			throw new Error(`Data file not found: ${filePath}`);
		}

		const content = await file.text();
		const lines = content.trim().split("\n");

		// Skip header if present
		const startIndex = lines[0].toLowerCase().includes("timestamp") ? 1 : 0;
		const candles: OHLCV[] = [];

		for (let i = startIndex; i < lines.length; i++) {
			const parts = lines[i].split(",").map((p) => p.trim());

			if (parts.length >= 6) {
				candles.push({
					timestamp: this.parseTimestamp(parts[0]),
					open: parseFloat(parts[1]),
					high: parseFloat(parts[2]),
					low: parseFloat(parts[3]),
					close: parseFloat(parts[4]),
					volume: parseFloat(parts[5]),
				});
			}
		}

		return candles;
	}

	/**
	 * Generate synthetic candles for testing
	 * Creates a random walk with configurable parameters
	 */
	generateSynthetic(options: {
		symbol?: string;
		startTime: number;
		endTime: number;
		timeframeMs: number;
		startPrice: number;
		volatility?: number;
		trend?: number;
	}): OHLCV[] {
		const { startTime, endTime, timeframeMs, startPrice, volatility = 0.02, trend = 0 } = options;

		const candles: OHLCV[] = [];
		let price = startPrice;
		let time = startTime;

		while (time < endTime) {
			// Random walk with optional trend
			const change = (Math.random() - 0.5 + trend) * volatility * price;
			const open = price;
			const close = price + change;
			const high = Math.max(open, close) + Math.random() * volatility * price * 0.5;
			const low = Math.min(open, close) - Math.random() * volatility * price * 0.5;
			const volume = Math.random() * 1000 + 100;

			candles.push({
				timestamp: time,
				open,
				high,
				low,
				close,
				volume,
			});

			price = close;
			time += timeframeMs;
		}

		return candles;
	}

	/**
	 * Slice candles by time range
	 */
	sliceByTime(candles: OHLCV[], startTime: number, endTime: number): OHLCV[] {
		return candles.filter((c) => c.timestamp >= startTime && c.timestamp <= endTime);
	}

	/**
	 * Get candles up to a specific timestamp (for simulating "current" data)
	 */
	getCandlesUpTo(candles: OHLCV[], timestamp: number, limit?: number): OHLCV[] {
		const filtered = candles.filter((c) => c.timestamp <= timestamp);

		if (limit && filtered.length > limit) {
			return filtered.slice(-limit);
		}

		return filtered;
	}

	/**
	 * Resample candles to a different timeframe
	 * Only supports upsampling (e.g., 1m -> 1h)
	 */
	resample(candles: OHLCV[], targetTimeframeMs: number): OHLCV[] {
		if (candles.length === 0) return [];

		const resampled: OHLCV[] = [];
		let bucket: OHLCV[] = [];
		let bucketStart = Math.floor(candles[0].timestamp / targetTimeframeMs) * targetTimeframeMs;

		for (const candle of candles) {
			const candleBucket = Math.floor(candle.timestamp / targetTimeframeMs) * targetTimeframeMs;

			if (candleBucket !== bucketStart && bucket.length > 0) {
				// Aggregate bucket
				resampled.push(this.aggregateBucket(bucket, bucketStart));
				bucket = [];
				bucketStart = candleBucket;
			}

			bucket.push(candle);
		}

		// Don't forget the last bucket
		if (bucket.length > 0) {
			resampled.push(this.aggregateBucket(bucket, bucketStart));
		}

		return resampled;
	}

	private aggregateBucket(bucket: OHLCV[], timestamp: number): OHLCV {
		return {
			timestamp,
			open: bucket[0].open,
			high: Math.max(...bucket.map((c) => c.high)),
			low: Math.min(...bucket.map((c) => c.low)),
			close: bucket[bucket.length - 1].close,
			volume: bucket.reduce((sum, c) => sum + c.volume, 0),
		};
	}

	private normalizeCandles(data: unknown): OHLCV[] {
		if (!Array.isArray(data)) {
			throw new Error("Data must be an array");
		}

		return data.map((item, index) => {
			// Handle array format [timestamp, open, high, low, close, volume]
			if (Array.isArray(item)) {
				if (item.length < 6) {
					throw new Error(`Invalid candle at index ${index}: expected 6 elements`);
				}
				return {
					timestamp: this.parseTimestamp(item[0]),
					open: parseFloat(item[1]),
					high: parseFloat(item[2]),
					low: parseFloat(item[3]),
					close: parseFloat(item[4]),
					volume: parseFloat(item[5]),
				};
			}

			// Handle object format
			if (typeof item === "object" && item !== null) {
				const obj = item as Record<string, unknown>;
				return {
					timestamp: this.parseTimestamp(obj.timestamp ?? obj.time ?? obj.t ?? 0),
					open: parseFloat(String(obj.open ?? obj.o ?? 0)),
					high: parseFloat(String(obj.high ?? obj.h ?? 0)),
					low: parseFloat(String(obj.low ?? obj.l ?? 0)),
					close: parseFloat(String(obj.close ?? obj.c ?? 0)),
					volume: parseFloat(String(obj.volume ?? obj.v ?? 0)),
				};
			}

			throw new Error(`Invalid candle format at index ${index}`);
		});
	}

	private parseTimestamp(value: unknown): number {
		if (typeof value === "number") {
			// If timestamp is in seconds, convert to milliseconds
			return value < 1e12 ? value * 1000 : value;
		}

		if (typeof value === "string") {
			// Try parsing as ISO date
			const date = new Date(value);
			if (!isNaN(date.getTime())) {
				return date.getTime();
			}

			// Try parsing as number
			const num = parseFloat(value);
			if (!isNaN(num)) {
				return num < 1e12 ? num * 1000 : num;
			}
		}

		throw new Error(`Cannot parse timestamp: ${value}`);
	}
}
