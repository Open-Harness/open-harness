/**
 * Mock CCXT Implementation
 * For backtesting and testing without real exchange connections
 */

import type { Balance, CCXTInterface, OHLCV, OrderResult, Position } from "./ccxt-interface";

export class MockCCXT implements CCXTInterface {
	private data = new Map<string, OHLCV[]>();
	private orders = new Map<string, OrderResult>();
	private positions = new Map<string, Position>();
	private balances: Record<string, Balance> = {
		USDT: { total: 10000, free: 10000, used: 0 },
	};
	private orderIdCounter = 0;
	private leverage = 1;
	private currentTime = Date.now();

	loadData(symbol: string, candles: OHLCV[]): void {
		this.data.set(symbol, candles);
	}

	setBalance(currency: string, balance: Balance): void {
		this.balances[currency] = balance;
	}

	setTime(timestamp: number): void {
		this.currentTime = timestamp;
	}

	async fetchOHLCV(symbol: string, _timeframe: string, since?: number, limit: number = 100): Promise<OHLCV[]> {
		const candles = this.data.get(symbol);
		if (!candles) {
			throw new Error(`No data loaded for ${symbol}`);
		}

		let filtered = candles;
		if (since) {
			filtered = candles.filter((c) => c.timestamp >= since);
		}

		return filtered.slice(0, limit);
	}

	async createOrder(
		symbol: string,
		type: "market" | "limit",
		side: "buy" | "sell",
		amount: number,
		price?: number,
	): Promise<OrderResult> {
		const orderId = `MOCK_ORDER_${this.orderIdCounter++}`;
		const candles = this.data.get(symbol);
		const currentPrice = candles?.[candles.length - 1]?.close ?? price ?? 0;

		const order: OrderResult = {
			id: orderId,
			symbol,
			type,
			side,
			amount,
			price: type === "market" ? currentPrice : price,
			status: type === "market" ? "closed" : "open",
			timestamp: this.currentTime,
		};

		this.orders.set(orderId, order);

		// Update position for market orders
		if (type === "market") {
			this.updatePosition(symbol, side, amount, currentPrice);
		}

		return order;
	}

	async cancelOrder(orderId: string, _symbol: string): Promise<OrderResult> {
		const order = this.orders.get(orderId);
		if (!order) {
			throw new Error(`Order not found: ${orderId}`);
		}

		order.status = "canceled";
		return order;
	}

	async fetchPositions(symbols?: string[]): Promise<Position[]> {
		const result: Position[] = [];
		for (const [sym, pos] of this.positions) {
			if (!symbols || symbols.includes(sym)) {
				result.push(pos);
			}
		}
		return result;
	}

	async fetchBalance(): Promise<Record<string, Balance>> {
		return { ...this.balances };
	}

	async setLeverage(leverage: number, _symbol: string): Promise<void> {
		this.leverage = leverage;
	}

	private updatePosition(symbol: string, side: "buy" | "sell", amount: number, price: number): void {
		const existing = this.positions.get(symbol);
		const positionSide = side === "buy" ? "long" : "short";

		if (existing) {
			// Update existing position
			const newContracts = existing.side === positionSide ? existing.contracts + amount : existing.contracts - amount;

			if (newContracts <= 0) {
				this.positions.delete(symbol);
			} else {
				existing.contracts = newContracts;
				existing.entryPrice = (existing.entryPrice * existing.contracts + price * amount) / newContracts;
			}
		} else {
			// Create new position
			this.positions.set(symbol, {
				symbol,
				side: positionSide,
				contracts: amount,
				entryPrice: price,
				markPrice: price,
				unrealizedPnl: 0,
				leverage: this.leverage,
				liquidationPrice: this.calculateLiquidationPrice(price, positionSide, this.leverage),
			});
		}
	}

	private calculateLiquidationPrice(entryPrice: number, side: "long" | "short", leverage: number): number {
		const maintenanceMargin = 0.005; // 0.5%
		if (side === "long") {
			return entryPrice * (1 - 1 / leverage + maintenanceMargin);
		} else {
			return entryPrice * (1 + 1 / leverage - maintenanceMargin);
		}
	}
}
