/**
 * Risk Service
 * Enforces all 12 safety invariants before order execution
 */

import type { CCXTInterface } from "../ccxt/ccxt-interface";
import type { TradingDatabase } from "../core/database";
import type { TimeSource } from "../core/time-source";

export interface RiskConfig {
	maxExposurePercent: number; // Invariant 1: Max exposure as % of account
	leverageCap: number; // Invariant 2: Maximum leverage allowed
	minLiquidationBuffer: number; // Invariant 3: Minimum $ distance to liquidation
	symbolAllowlist: string[]; // Invariant 4: Allowed trading symbols
	positionSizeLimit: number; // Invariant 8: Max position size per order
	dcaVelocityLimit: number; // Invariant 9: Max DCA additions per hour
	maxDrawdownPercent: number; // Invariant 10: Circuit breaker threshold
	maxPositionAge: number; // Invariant 11: Max hours without profit
	maxDcaLayers: number; // Invariant 12: Maximum DCA layers
	cooldownMinutes: number; // Invariant 6: Min time between entries
}

export interface ValidationResult {
	approved: boolean;
	reason?: string;
	details?: Record<string, any>;
}

export interface OrderValidationRequest {
	symbol: string;
	side: "long" | "short";
	size: number;
	leverage?: number;
	currentPrice: number;
}

const DEFAULT_CONFIG: RiskConfig = {
	maxExposurePercent: 10,
	leverageCap: 10,
	minLiquidationBuffer: 5000,
	symbolAllowlist: ["BTC/USDT", "ETH/USDT"],
	positionSizeLimit: 1.0,
	dcaVelocityLimit: 3,
	maxDrawdownPercent: 20,
	maxPositionAge: 24,
	maxDcaLayers: 5,
	cooldownMinutes: 30,
};

export class RiskService {
	private ccxt: CCXTInterface;
	private db: TradingDatabase;
	private timeSource: TimeSource;
	private config: RiskConfig;

	constructor(ccxt: CCXTInterface, db: TradingDatabase, timeSource: TimeSource, config: Partial<RiskConfig> = {}) {
		this.ccxt = ccxt;
		this.db = db;
		this.timeSource = timeSource;
		this.config = { ...DEFAULT_CONFIG, ...config };
	}

	async validateOrder(request: OrderValidationRequest): Promise<ValidationResult> {
		// Invariant 4: Symbol Allowlist
		if (!this.config.symbolAllowlist.includes(request.symbol)) {
			return { approved: false, reason: "symbol_not_allowed" };
		}

		// Invariant 2: Leverage Cap
		if (request.leverage && request.leverage > this.config.leverageCap) {
			return { approved: false, reason: "leverage_cap_exceeded" };
		}

		// Invariant 8: Position Size Limit
		if (request.size > this.config.positionSizeLimit) {
			return { approved: false, reason: "position_size_exceeded" };
		}

		// Invariant 1: Max Exposure
		const balance = await this.ccxt.fetchBalance();
		const totalBalance = balance.USDT?.total ?? 0;
		const currentExposure = await this.calculateTotalExposure();
		const newExposure = currentExposure + request.size * request.currentPrice;
		const exposurePercent = (newExposure / totalBalance) * 100;

		if (exposurePercent > this.config.maxExposurePercent) {
			return {
				approved: false,
				reason: "exposure_limit_reached",
				details: { currentPercent: exposurePercent, maxPercent: this.config.maxExposurePercent },
			};
		}

		// Invariant 3: Liquidation Distance
		const leverage = request.leverage ?? 1;
		const liquidationDistance = this.calculateLiquidationDistance(request.currentPrice, request.side, leverage);
		if (liquidationDistance < this.config.minLiquidationBuffer) {
			return {
				approved: false,
				reason: "liquidation_risk",
				details: { distance: liquidationDistance, required: this.config.minLiquidationBuffer },
			};
		}

		// Invariant 6: Cooldown Timer
		const lastEntry = await this.getLastEntryTime(request.symbol);
		if (lastEntry) {
			const cooldownMs = this.config.cooldownMinutes * 60 * 1000;
			const timeSinceEntry = this.timeSource.now() - lastEntry;
			if (timeSinceEntry < cooldownMs) {
				return {
					approved: false,
					reason: "cooldown_active",
					details: { remainingMs: cooldownMs - timeSinceEntry },
				};
			}
		}

		return { approved: true };
	}

	async validateDCA(symbol: string, _size: number): Promise<ValidationResult> {
		// Invariant 9: DCA Velocity Limit
		const dcaCountLastHour = await this.getDCACountLastHour(symbol);
		if (dcaCountLastHour >= this.config.dcaVelocityLimit) {
			return { approved: false, reason: "dca_velocity_exceeded" };
		}

		// Invariant 12: DCA Layer Limit
		const currentLayers = await this.getDCALayerCount(symbol);
		if (currentLayers >= this.config.maxDcaLayers) {
			return { approved: false, reason: "dca_layer_limit_reached" };
		}

		// Invariant 10: Drawdown Circuit Breaker
		const drawdown = await this.calculateUnrealizedDrawdown(symbol);
		if (drawdown > this.config.maxDrawdownPercent) {
			return {
				approved: false,
				reason: "drawdown_circuit_breaker",
				details: { currentDrawdown: drawdown, maxAllowed: this.config.maxDrawdownPercent },
			};
		}

		return { approved: true };
	}

	async checkTimeBasedExit(symbol: string): Promise<{ shouldExit: boolean; reason?: string }> {
		// Invariant 11: Time-Forced Exit
		const position = await this.getPositionAge(symbol);
		if (!position) return { shouldExit: false };

		const ageHours = (this.timeSource.now() - position.createdAt) / (1000 * 60 * 60);
		if (ageHours > this.config.maxPositionAge && position.unrealizedPnl <= 0) {
			return { shouldExit: true, reason: "max_age_without_profit" };
		}

		return { shouldExit: false };
	}

	private async calculateTotalExposure(): Promise<number> {
		const positions = await this.ccxt.fetchPositions();
		return positions.reduce((sum, p) => sum + p.contracts * p.markPrice, 0);
	}

	private calculateLiquidationDistance(price: number, side: "long" | "short", leverage: number): number {
		const maintenanceMargin = 0.005;
		const liqPrice =
			side === "long" ? price * (1 - 1 / leverage + maintenanceMargin) : price * (1 + 1 / leverage - maintenanceMargin);
		return Math.abs(price - liqPrice);
	}

	private async getLastEntryTime(symbol: string): Promise<number | null> {
		const rows = this.db.query<{ created_at: number }>(
			"SELECT created_at FROM trades WHERE symbol = ? ORDER BY created_at DESC LIMIT 1",
			[symbol],
		);
		return rows.length > 0 ? rows[0].created_at : null;
	}

	private async getDCACountLastHour(symbol: string): Promise<number> {
		const oneHourAgo = this.timeSource.now() - 3600000;
		const rows = this.db.query<{ count: number }>(
			"SELECT COUNT(*) as count FROM dca_layers WHERE position_id IN (SELECT id FROM positions WHERE symbol = ?) AND created_at > ?",
			[symbol, oneHourAgo],
		);
		return rows[0]?.count ?? 0;
	}

	private async getDCALayerCount(symbol: string): Promise<number> {
		const rows = this.db.query<{ count: number }>(
			"SELECT COUNT(*) as count FROM dca_layers WHERE position_id IN (SELECT id FROM positions WHERE symbol = ?)",
			[symbol],
		);
		return rows[0]?.count ?? 0;
	}

	private async calculateUnrealizedDrawdown(symbol: string): Promise<number> {
		const positions = await this.ccxt.fetchPositions([symbol]);
		const position = positions.find((p) => p.symbol === symbol);
		if (!position) return 0;

		const pnlPercent = (position.unrealizedPnl / (position.contracts * position.entryPrice)) * 100;
		return Math.abs(Math.min(0, pnlPercent));
	}

	private async getPositionAge(symbol: string): Promise<{ createdAt: number; unrealizedPnl: number } | null> {
		const rows = this.db.query<{ created_at: number }>("SELECT created_at FROM positions WHERE symbol = ? LIMIT 1", [
			symbol,
		]);
		if (rows.length === 0) return null;

		const positions = await this.ccxt.fetchPositions([symbol]);
		const position = positions.find((p) => p.symbol === symbol);

		return {
			createdAt: rows[0].created_at,
			unrealizedPnl: position?.unrealizedPnl ?? 0,
		};
	}
}
