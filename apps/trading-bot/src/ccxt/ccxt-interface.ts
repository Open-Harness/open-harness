/**
 * CCXT Interface Types
 * Common types used by both real and mock CCXT implementations
 */

export interface OHLCV {
	timestamp: number;
	open: number;
	high: number;
	low: number;
	close: number;
	volume: number;
}

export interface OrderResult {
	id: string;
	symbol: string;
	type: string;
	side: "buy" | "sell";
	amount: number;
	price?: number;
	status: "open" | "closed" | "canceled";
	timestamp: number;
}

export interface Position {
	symbol: string;
	side: "long" | "short";
	contracts: number;
	entryPrice: number;
	markPrice: number;
	unrealizedPnl: number;
	leverage: number;
	liquidationPrice: number;
}

export interface Balance {
	total: number;
	free: number;
	used: number;
}

export interface CCXTInterface {
	fetchOHLCV(symbol: string, timeframe: string, since?: number, limit?: number): Promise<OHLCV[]>;

	createOrder(
		symbol: string,
		type: "market" | "limit",
		side: "buy" | "sell",
		amount: number,
		price?: number,
	): Promise<OrderResult>;

	cancelOrder(orderId: string, symbol: string): Promise<OrderResult>;

	fetchPositions(symbols?: string[]): Promise<Position[]>;

	fetchBalance(): Promise<Record<string, Balance>>;

	setLeverage(leverage: number, symbol: string): Promise<void>;
}
