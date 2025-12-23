/**
 * Backtest Metrics Calculator
 * Calculates performance statistics from backtest results
 */

export interface Trade {
	entryTime: number;
	exitTime: number;
	symbol: string;
	side: "long" | "short";
	entryPrice: number;
	exitPrice: number;
	size: number;
	pnl: number;
	pnlPercent: number;
}

export interface EquityPoint {
	timestamp: number;
	equity: number;
	drawdown: number;
	drawdownPercent: number;
}

export interface BacktestMetrics {
	// Basic stats
	totalTrades: number;
	winningTrades: number;
	losingTrades: number;
	winRate: number;

	// PnL
	totalPnL: number;
	totalPnLPercent: number;
	averagePnL: number;
	averageWin: number;
	averageLoss: number;
	largestWin: number;
	largestLoss: number;
	profitFactor: number;

	// Risk metrics
	maxDrawdown: number;
	maxDrawdownPercent: number;
	sharpeRatio: number;
	sortinoRatio: number;
	calmarRatio: number;

	// Time metrics
	averageHoldingTime: number;
	longestHoldingTime: number;
	shortestHoldingTime: number;

	// Equity curve
	startingEquity: number;
	endingEquity: number;
	peakEquity: number;
	equityCurve: EquityPoint[];
}

export class BacktestMetricsCalculator {
	private trades: Trade[] = [];
	private equityCurve: EquityPoint[] = [];
	private initialEquity: number;
	private currentEquity: number;
	private peakEquity: number;
	private riskFreeRate: number;

	constructor(initialEquity: number = 10000, riskFreeRate: number = 0.02) {
		this.initialEquity = initialEquity;
		this.currentEquity = initialEquity;
		this.peakEquity = initialEquity;
		this.riskFreeRate = riskFreeRate;

		// Initialize equity curve with starting point
		this.equityCurve.push({
			timestamp: Date.now(),
			equity: initialEquity,
			drawdown: 0,
			drawdownPercent: 0,
		});
	}

	recordTrade(trade: Trade): void {
		this.trades.push(trade);

		// Update equity
		this.currentEquity += trade.pnl;

		// Update peak
		if (this.currentEquity > this.peakEquity) {
			this.peakEquity = this.currentEquity;
		}

		// Calculate drawdown
		const drawdown = this.peakEquity - this.currentEquity;
		const drawdownPercent = (drawdown / this.peakEquity) * 100;

		// Add equity point
		this.equityCurve.push({
			timestamp: trade.exitTime,
			equity: this.currentEquity,
			drawdown,
			drawdownPercent,
		});
	}

	recordEquitySnapshot(timestamp: number): void {
		const drawdown = this.peakEquity - this.currentEquity;
		const drawdownPercent = (drawdown / this.peakEquity) * 100;

		this.equityCurve.push({
			timestamp,
			equity: this.currentEquity,
			drawdown,
			drawdownPercent,
		});
	}

	calculate(): BacktestMetrics {
		const winningTrades = this.trades.filter((t) => t.pnl > 0);
		const losingTrades = this.trades.filter((t) => t.pnl <= 0);

		const totalPnL = this.trades.reduce((sum, t) => sum + t.pnl, 0);
		const grossProfit = winningTrades.reduce((sum, t) => sum + t.pnl, 0);
		const grossLoss = Math.abs(losingTrades.reduce((sum, t) => sum + t.pnl, 0));

		const returns = this.calculateReturns();
		const negativeReturns = returns.filter((r) => r < 0);

		const holdingTimes = this.trades.map((t) => t.exitTime - t.entryTime);

		return {
			// Basic stats
			totalTrades: this.trades.length,
			winningTrades: winningTrades.length,
			losingTrades: losingTrades.length,
			winRate: this.trades.length > 0 ? (winningTrades.length / this.trades.length) * 100 : 0,

			// PnL
			totalPnL,
			totalPnLPercent: (totalPnL / this.initialEquity) * 100,
			averagePnL: this.trades.length > 0 ? totalPnL / this.trades.length : 0,
			averageWin: winningTrades.length > 0 ? grossProfit / winningTrades.length : 0,
			averageLoss: losingTrades.length > 0 ? grossLoss / losingTrades.length : 0,
			largestWin: winningTrades.length > 0 ? Math.max(...winningTrades.map((t) => t.pnl)) : 0,
			largestLoss: losingTrades.length > 0 ? Math.min(...losingTrades.map((t) => t.pnl)) : 0,
			profitFactor: grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0,

			// Risk metrics
			maxDrawdown: Math.max(...this.equityCurve.map((e) => e.drawdown), 0),
			maxDrawdownPercent: Math.max(...this.equityCurve.map((e) => e.drawdownPercent), 0),
			sharpeRatio: this.calculateSharpeRatio(returns),
			sortinoRatio: this.calculateSortinoRatio(returns, negativeReturns),
			calmarRatio: this.calculateCalmarRatio(returns),

			// Time metrics
			averageHoldingTime: holdingTimes.length > 0 ? holdingTimes.reduce((a, b) => a + b, 0) / holdingTimes.length : 0,
			longestHoldingTime: holdingTimes.length > 0 ? Math.max(...holdingTimes) : 0,
			shortestHoldingTime: holdingTimes.length > 0 ? Math.min(...holdingTimes) : 0,

			// Equity curve
			startingEquity: this.initialEquity,
			endingEquity: this.currentEquity,
			peakEquity: this.peakEquity,
			equityCurve: this.equityCurve,
		};
	}

	private calculateReturns(): number[] {
		if (this.equityCurve.length < 2) return [];

		const returns: number[] = [];
		for (let i = 1; i < this.equityCurve.length; i++) {
			const prev = this.equityCurve[i - 1].equity;
			const curr = this.equityCurve[i].equity;
			if (prev > 0) {
				returns.push((curr - prev) / prev);
			}
		}
		return returns;
	}

	private calculateSharpeRatio(returns: number[]): number {
		if (returns.length < 2) return 0;

		const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
		const stdDev = this.calculateStdDev(returns);

		if (stdDev === 0) return 0;

		// Annualize assuming daily returns
		const annualizedReturn = avgReturn * 252;
		const annualizedStdDev = stdDev * Math.sqrt(252);

		return (annualizedReturn - this.riskFreeRate) / annualizedStdDev;
	}

	private calculateSortinoRatio(returns: number[], negativeReturns: number[]): number {
		if (returns.length < 2 || negativeReturns.length === 0) return 0;

		const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
		const downDev = this.calculateStdDev(negativeReturns);

		if (downDev === 0) return 0;

		// Annualize
		const annualizedReturn = avgReturn * 252;
		const annualizedDownDev = downDev * Math.sqrt(252);

		return (annualizedReturn - this.riskFreeRate) / annualizedDownDev;
	}

	private calculateCalmarRatio(returns: number[]): number {
		if (returns.length < 2) return 0;

		const maxDrawdownPercent = Math.max(...this.equityCurve.map((e) => e.drawdownPercent), 0);
		if (maxDrawdownPercent === 0) return 0;

		const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
		const annualizedReturn = avgReturn * 252 * 100; // Convert to percentage

		return annualizedReturn / maxDrawdownPercent;
	}

	private calculateStdDev(values: number[]): number {
		if (values.length < 2) return 0;

		const mean = values.reduce((a, b) => a + b, 0) / values.length;
		const squaredDiffs = values.map((v) => Math.pow(v - mean, 2));
		const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / values.length;

		return Math.sqrt(avgSquaredDiff);
	}

	getTrades(): Trade[] {
		return [...this.trades];
	}

	getEquityCurve(): EquityPoint[] {
		return [...this.equityCurve];
	}

	getCurrentEquity(): number {
		return this.currentEquity;
	}

	reset(): void {
		this.trades = [];
		this.currentEquity = this.initialEquity;
		this.peakEquity = this.initialEquity;
		this.equityCurve = [
			{
				timestamp: Date.now(),
				equity: this.initialEquity,
				drawdown: 0,
				drawdownPercent: 0,
			},
		];
	}
}

/**
 * Format metrics for display
 */
export function formatMetrics(metrics: BacktestMetrics): string {
	const lines: string[] = [];

	lines.push("═══════════════════════════════════════════");
	lines.push("           BACKTEST RESULTS                ");
	lines.push("═══════════════════════════════════════════");
	lines.push("");

	lines.push("📊 PERFORMANCE");
	lines.push(`   Total PnL:        $${metrics.totalPnL.toFixed(2)} (${metrics.totalPnLPercent.toFixed(2)}%)`);
	lines.push(`   Starting Equity:  $${metrics.startingEquity.toFixed(2)}`);
	lines.push(`   Ending Equity:    $${metrics.endingEquity.toFixed(2)}`);
	lines.push(`   Peak Equity:      $${metrics.peakEquity.toFixed(2)}`);
	lines.push("");

	lines.push("📈 TRADES");
	lines.push(`   Total Trades:     ${metrics.totalTrades}`);
	lines.push(`   Winning:          ${metrics.winningTrades} (${metrics.winRate.toFixed(1)}%)`);
	lines.push(`   Losing:           ${metrics.losingTrades}`);
	lines.push(`   Avg Win:          $${metrics.averageWin.toFixed(2)}`);
	lines.push(`   Avg Loss:         $${metrics.averageLoss.toFixed(2)}`);
	lines.push(`   Largest Win:      $${metrics.largestWin.toFixed(2)}`);
	lines.push(`   Largest Loss:     $${metrics.largestLoss.toFixed(2)}`);
	lines.push(`   Profit Factor:    ${metrics.profitFactor === Infinity ? "∞" : metrics.profitFactor.toFixed(2)}`);
	lines.push("");

	lines.push("⚠️  RISK");
	lines.push(`   Max Drawdown:     $${metrics.maxDrawdown.toFixed(2)} (${metrics.maxDrawdownPercent.toFixed(2)}%)`);
	lines.push(`   Sharpe Ratio:     ${metrics.sharpeRatio.toFixed(2)}`);
	lines.push(`   Sortino Ratio:    ${metrics.sortinoRatio.toFixed(2)}`);
	lines.push(`   Calmar Ratio:     ${metrics.calmarRatio.toFixed(2)}`);
	lines.push("");

	lines.push("⏱️  TIME");
	lines.push(`   Avg Holding:      ${formatDuration(metrics.averageHoldingTime)}`);
	lines.push(`   Longest:          ${formatDuration(metrics.longestHoldingTime)}`);
	lines.push(`   Shortest:         ${formatDuration(metrics.shortestHoldingTime)}`);
	lines.push("");

	lines.push("═══════════════════════════════════════════");

	return lines.join("\n");
}

function formatDuration(ms: number): string {
	if (ms === 0) return "N/A";

	const hours = Math.floor(ms / (1000 * 60 * 60));
	const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));

	if (hours > 24) {
		const days = Math.floor(hours / 24);
		return `${days}d ${hours % 24}h`;
	}

	return `${hours}h ${minutes}m`;
}
