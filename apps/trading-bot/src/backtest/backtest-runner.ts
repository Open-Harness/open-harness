/**
 * Backtest Runner
 * Orchestrates backtesting with time-controlled replay
 */

import type { OHLCV } from "../ccxt/ccxt-interface";
import { MockCCXT } from "../ccxt/mock-ccxt";
import { Container } from "../core/container";
import { TradingDatabase } from "../core/database";
import { MockTimeSource } from "../core/time-source";
import { MarketService } from "../services/market-service";
import { OrderService } from "../services/order-service";
import { RiskService, type RiskConfig } from "../services/risk-service";
import { TradingWorkflow } from "../workflow/trading-workflow";
import { BacktestDataLoader } from "./backtest-data-loader";
import { BacktestMetricsCalculator, formatMetrics, type BacktestMetrics, type Trade } from "./backtest-metrics";

export interface BacktestConfig {
	symbol: string;
	startTime: number;
	endTime: number;
	initialEquity: number;
	timeframeMs: number;
	riskConfig?: Partial<RiskConfig>;
	dataSource?: "synthetic" | "file";
	dataPath?: string;
	syntheticConfig?: {
		startPrice: number;
		volatility?: number;
		trend?: number;
	};
}

export interface BacktestResult {
	config: BacktestConfig;
	metrics: BacktestMetrics;
	trades: Trade[];
	logs: BacktestLogEntry[];
}

export interface BacktestLogEntry {
	timestamp: number;
	type: "info" | "trade" | "signal" | "error";
	message: string;
	data?: Record<string, unknown>;
}

export class BacktestRunner {
	private config: BacktestConfig;
	private timeSource: MockTimeSource;
	private ccxt: MockCCXT;
	private db: TradingDatabase;
	private container: Container;
	private marketService: MarketService;
	private orderService: OrderService;
	private riskService: RiskService;
	private workflow: TradingWorkflow;
	private metricsCalculator: BacktestMetricsCalculator;
	private dataLoader: BacktestDataLoader;
	private logs: BacktestLogEntry[] = [];
	private allCandles: OHLCV[] = [];

	constructor(config: BacktestConfig) {
		this.config = config;
		this.dataLoader = new BacktestDataLoader();

		// Initialize mock time starting at backtest start
		this.timeSource = new MockTimeSource(config.startTime);

		// Initialize in-memory database
		this.db = new TradingDatabase({ path: ":memory:" });
		this.db.initialize();

		// Initialize container
		this.container = new Container({
			timeSource: this.timeSource,
			database: this.db,
			isMock: true,
		});

		// Initialize mock CCXT with initial balance
		this.ccxt = new MockCCXT();
		this.ccxt.setBalance("USDT", {
			total: config.initialEquity,
			free: config.initialEquity,
			used: 0,
		});

		// Initialize services
		this.marketService = new MarketService(this.ccxt, this.db, this.timeSource, {
			cacheTTL: 0, // Disable caching for backtest
		});

		this.orderService = new OrderService(this.ccxt, this.db, this.timeSource);

		this.riskService = new RiskService(this.ccxt, this.db, this.timeSource, config.riskConfig);

		// Initialize workflow
		this.workflow = new TradingWorkflow(
			this.container,
			this.marketService,
			this.orderService,
			this.riskService,
			config.symbol,
		);

		// Initialize metrics
		this.metricsCalculator = new BacktestMetricsCalculator(config.initialEquity);
	}

	async loadData(): Promise<void> {
		if (this.config.dataSource === "file" && this.config.dataPath) {
			if (this.config.dataPath.endsWith(".csv")) {
				this.allCandles = await this.dataLoader.loadFromCSV(this.config.dataPath);
			} else {
				this.allCandles = await this.dataLoader.loadFromJSON(this.config.dataPath);
			}
		} else {
			// Generate synthetic data
			const syntheticConfig = this.config.syntheticConfig ?? { startPrice: 42000 };
			this.allCandles = this.dataLoader.generateSynthetic({
				symbol: this.config.symbol,
				startTime: this.config.startTime,
				endTime: this.config.endTime,
				timeframeMs: this.config.timeframeMs,
				startPrice: syntheticConfig.startPrice,
				volatility: syntheticConfig.volatility,
				trend: syntheticConfig.trend,
			});
		}

		// Filter to backtest time range
		this.allCandles = this.dataLoader.sliceByTime(this.allCandles, this.config.startTime, this.config.endTime);

		this.log("info", `Loaded ${this.allCandles.length} candles for ${this.config.symbol}`);
	}

	async run(): Promise<BacktestResult> {
		await this.loadData();

		if (this.allCandles.length === 0) {
			throw new Error("No candle data available for backtest");
		}

		this.log("info", "Starting backtest...", {
			symbol: this.config.symbol,
			startTime: new Date(this.config.startTime).toISOString(),
			endTime: new Date(this.config.endTime).toISOString(),
			candles: this.allCandles.length,
		});

		let currentTime = this.config.startTime;
		let lastPositionState: "none" | "open" = "none";
		let entryTrade: { time: number; price: number; size: number; side: "long" | "short" } | null = null;

		// Main backtest loop
		while (currentTime < this.config.endTime) {
			// Update time
			this.timeSource.setTime(currentTime);

			// Load candles up to current time into mock CCXT
			const availableCandles = this.dataLoader.getCandlesUpTo(this.allCandles, currentTime, 200);

			if (availableCandles.length > 0) {
				this.ccxt.loadData(this.config.symbol, availableCandles);
				this.ccxt.setTime(currentTime);

				// Run single workflow cycle
				try {
					const state = await this.workflow.runSingleCycle();

					// Check for position changes
					const positions = await this.ccxt.fetchPositions([this.config.symbol]);
					const hasPosition = positions.length > 0 && positions[0].contracts > 0;

					if (hasPosition && lastPositionState === "none") {
						// New position opened
						const pos = positions[0];
						entryTrade = {
							time: currentTime,
							price: pos.entryPrice,
							size: pos.contracts,
							side: pos.side,
						};
						lastPositionState = "open";

						this.log("trade", `Opened ${pos.side} position`, {
							price: pos.entryPrice,
							size: pos.contracts,
							rsi: state.observeResult?.rsi,
						});
					} else if (!hasPosition && lastPositionState === "open" && entryTrade) {
						// Position closed
						const exitPrice = availableCandles[availableCandles.length - 1].close;
						const pnl =
							entryTrade.side === "long"
								? (exitPrice - entryTrade.price) * entryTrade.size
								: (entryTrade.price - exitPrice) * entryTrade.size;

						const trade: Trade = {
							entryTime: entryTrade.time,
							exitTime: currentTime,
							symbol: this.config.symbol,
							side: entryTrade.side,
							entryPrice: entryTrade.price,
							exitPrice,
							size: entryTrade.size,
							pnl,
							pnlPercent: (pnl / (entryTrade.price * entryTrade.size)) * 100,
						};

						this.metricsCalculator.recordTrade(trade);
						lastPositionState = "none";
						entryTrade = null;

						this.log("trade", `Closed position`, {
							pnl: pnl.toFixed(2),
							pnlPercent: trade.pnlPercent.toFixed(2),
						});
					}

					// Record signal if interesting
					if (state.analyzeResult) {
						if (state.analyzeResult.shouldEnter && !hasPosition) {
							this.log("signal", `Entry signal`, {
								confidence: state.analyzeResult.confidence,
								reason: state.analyzeResult.reasoning,
							});
						}
					}
				} catch (error) {
					this.log("error", `Workflow error: ${error instanceof Error ? error.message : String(error)}`);
				}
			}

			// Advance time by one candle
			currentTime += this.config.timeframeMs;
		}

		// Handle any remaining open position at end of backtest
		if (lastPositionState === "open" && entryTrade) {
			const exitPrice = this.allCandles[this.allCandles.length - 1].close;
			const pnl =
				entryTrade.side === "long"
					? (exitPrice - entryTrade.price) * entryTrade.size
					: (entryTrade.price - exitPrice) * entryTrade.size;

			const trade: Trade = {
				entryTime: entryTrade.time,
				exitTime: this.config.endTime,
				symbol: this.config.symbol,
				side: entryTrade.side,
				entryPrice: entryTrade.price,
				exitPrice,
				size: entryTrade.size,
				pnl,
				pnlPercent: (pnl / (entryTrade.price * entryTrade.size)) * 100,
			};

			this.metricsCalculator.recordTrade(trade);
			this.log("trade", `Forced close at end of backtest`, {
				pnl: pnl.toFixed(2),
			});
		}

		const metrics = this.metricsCalculator.calculate();
		const trades = this.metricsCalculator.getTrades();

		this.log("info", "Backtest complete", {
			totalTrades: metrics.totalTrades,
			totalPnL: metrics.totalPnL.toFixed(2),
			winRate: metrics.winRate.toFixed(1),
		});

		return {
			config: this.config,
			metrics,
			trades,
			logs: this.logs,
		};
	}

	printResults(result: BacktestResult): void {
		console.log(formatMetrics(result.metrics));
	}

	private log(type: BacktestLogEntry["type"], message: string, data?: Record<string, unknown>): void {
		this.logs.push({
			timestamp: this.timeSource.now(),
			type,
			message,
			data,
		});
	}

	cleanup(): void {
		this.db.close();
	}
}

/**
 * Convenience function to run a quick backtest
 */
export async function runBacktest(config: BacktestConfig): Promise<BacktestResult> {
	const runner = new BacktestRunner(config);

	try {
		const result = await runner.run();
		runner.printResults(result);
		return result;
	} finally {
		runner.cleanup();
	}
}
