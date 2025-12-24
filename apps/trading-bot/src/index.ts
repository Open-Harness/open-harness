/**
 * Trading Bot - Main Exports
 * Production-grade agentic trading bot built with Anthropic Agent SDK and Bun
 */

// Core
export { Container, container } from './core/container'
export { TradingDatabase } from './core/database'
export { TimeSource, RealTimeSource, MockTimeSource } from './core/time-source'

// CCXT
export type { CCXTInterface, OHLCV, OrderResult, Position, Balance } from './ccxt/ccxt-interface'
export { CCXTWrapper } from './ccxt/ccxt-wrapper'
export { MockCCXT } from './ccxt/mock-ccxt'

// Services
export { MarketService } from './services/market-service'
export { OrderService } from './services/order-service'
export { RiskService } from './services/risk-service'

// Workflow
export { TradingWorkflow } from './workflow/trading-workflow'

// Snapshotting
export type { AgentState, Snapshot, MonologueEntry, DCALayer, CompletedTrade } from './snapshotting/agent-state'
export { SnapshotStorage } from './snapshotting/snapshot-storage'
