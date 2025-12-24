/**
 * Trading Bot - Main Exports
 * Production-grade agentic trading bot built with Anthropic Agent SDK and Bun
 */

// CCXT
export type {
	Balance,
	CCXTInterface,
	OHLCV,
	OrderResult,
	Position,
} from "./ccxt/ccxt-interface";
export { CCXTWrapper } from "./ccxt/ccxt-wrapper";
export { MockCCXT } from "./ccxt/mock-ccxt";
// Core
export { Container, container } from "./core/container";
export { TradingDatabase } from "./core/database";
export { MockTimeSource, RealTimeSource, TimeSource } from "./core/time-source";

// Services
export { MarketService } from "./services/market-service";
export { OrderService } from "./services/order-service";
export { RiskService } from "./services/risk-service";
// Snapshotting
export type {
	AgentState,
	CompletedTrade,
	DCALayer,
	MonologueEntry,
	Snapshot,
} from "./snapshotting/agent-state";
export { SnapshotStorage } from "./snapshotting/snapshot-storage";
// Workflow
export { TradingWorkflow } from "./workflow/trading-workflow";
