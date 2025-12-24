/**
 * Backtest Module
 * Export all backtest-related functionality
 */

export { BacktestDataLoader, type DataLoaderConfig } from "./backtest-data-loader";

export {
	BacktestMetricsCalculator,
	formatMetrics,
	type BacktestMetrics,
	type EquityPoint,
	type Trade,
} from "./backtest-metrics";

export {
	BacktestRunner,
	runBacktest,
	type BacktestConfig,
	type BacktestLogEntry,
	type BacktestResult,
} from "./backtest-runner";
