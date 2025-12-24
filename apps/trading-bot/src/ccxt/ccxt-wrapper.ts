/**
 * CCXT Wrapper
 * Real CCXT implementation for live trading
 */

import * as ccxt from "ccxt";
import type { Balance, CCXTInterface, OHLCV, OrderResult, Position } from "./ccxt-interface";

export interface CCXTConfig {
	exchangeId: "binance" | "bybit" | "okx";
	apiKey?: string;
	secret?: string;
	sandbox?: boolean;
}

export class CCXTWrapper implements CCXTInterface {
	private exchange: ccxt.Exchange;

	constructor(config: CCXTConfig) {
		// biome-ignore lint/suspicious/noExplicitAny: CCXT doesn't provide proper TypeScript types for dynamic exchange classes
		const ExchangeClass = ccxt[config.exchangeId] as any;
		this.exchange = new ExchangeClass({
			apiKey: config.apiKey,
			secret: config.secret,
			sandbox: config.sandbox ?? false,
			enableRateLimit: true,
		});
	}

	async fetchOHLCV(symbol: string, timeframe: string, since?: number, limit: number = 100): Promise<OHLCV[]> {
		const candles = await this.exchange.fetchOHLCV(symbol, timeframe, since, limit);
		return candles.map((c: number[]) => ({
			timestamp: c[0],
			open: c[1],
			high: c[2],
			low: c[3],
			close: c[4],
			volume: c[5],
		}));
	}

	async createOrder(
		symbol: string,
		type: "market" | "limit",
		side: "buy" | "sell",
		amount: number,
		price?: number,
	): Promise<OrderResult> {
		const order = await this.exchange.createOrder(symbol, type, side, amount, price);
		return {
			id: order.id,
			symbol: order.symbol,
			type: order.type,
			side: order.side as "buy" | "sell",
			amount: order.amount,
			price: order.price,
			status: order.status as "open" | "closed" | "canceled",
			timestamp: order.timestamp,
		};
	}

	async cancelOrder(orderId: string, symbol: string): Promise<OrderResult> {
		const order = await this.exchange.cancelOrder(orderId, symbol);
		return {
			id: order.id,
			symbol: order.symbol,
			type: order.type,
			side: order.side as "buy" | "sell",
			amount: order.amount,
			price: order.price,
			status: "canceled",
			timestamp: order.timestamp,
		};
	}

	async fetchPositions(symbols?: string[]): Promise<Position[]> {
		const positions = await this.exchange.fetchPositions(symbols);
		return positions
			.filter((p: ccxt.Position) => p.contracts > 0)
			.map((p: ccxt.Position) => ({
				symbol: p.symbol,
				side: p.side as "long" | "short",
				contracts: p.contracts,
				entryPrice: p.entryPrice,
				markPrice: p.markPrice,
				unrealizedPnl: p.unrealizedPnl,
				leverage: p.leverage,
				liquidationPrice: p.liquidationPrice,
			}));
	}

	async fetchBalance(): Promise<Record<string, Balance>> {
		const balance = await this.exchange.fetchBalance();
		const result: Record<string, Balance> = {};
		for (const [currency, data] of Object.entries(balance)) {
			if (typeof data === "object" && data !== null && "total" in data) {
				result[currency] = {
					total: (data as any).total ?? 0,
					free: (data as any).free ?? 0,
					used: (data as any).used ?? 0,
				};
			}
		}
		return result;
	}

	async setLeverage(leverage: number, symbol: string): Promise<void> {
		await this.exchange.setLeverage(leverage, symbol);
	}
}
