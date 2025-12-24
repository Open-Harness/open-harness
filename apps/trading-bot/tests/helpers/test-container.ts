/**
 * Test Container
 * Reusable DI container for testing with mock dependencies
 */

import { Container } from '../../src/core/container'
import { TradingDatabase } from '../../src/core/database'
import { MockTimeSource } from '../../src/core/time-source'
import { MockCCXT } from '../../src/ccxt/mock-ccxt'
import { MarketService } from '../../src/services/market-service'
import { OrderService } from '../../src/services/order-service'
import { RiskService } from '../../src/services/risk-service'
import type { OHLCV } from '../../src/ccxt/ccxt-interface'

export interface TestContext {
  container: Container
  timeSource: MockTimeSource
  db: TradingDatabase
  ccxt: MockCCXT
  marketService: MarketService
  orderService: OrderService
  riskService: RiskService
}

export function createTestContext(startTime?: number): TestContext {
  const timeSource = new MockTimeSource(startTime ?? Date.now())
  const db = new TradingDatabase({ path: ':memory:' })
  db.initialize()

  const container = new Container({
    timeSource,
    database: db,
    isMock: true,
  })

  const ccxt = new MockCCXT()
  const marketService = new MarketService(ccxt, db, timeSource)
  const orderService = new OrderService(ccxt, db, timeSource)
  const riskService = new RiskService(ccxt, db, timeSource)

  return {
    container,
    timeSource,
    db,
    ccxt,
    marketService,
    orderService,
    riskService,
  }
}

export function generateMockCandles(
  count: number,
  startPrice: number = 40000,
  startTime: number = Date.now() - count * 3600000
): OHLCV[] {
  const candles: OHLCV[] = []
  let price = startPrice

  for (let i = 0; i < count; i++) {
    const change = (Math.random() - 0.5) * 200 // ±$100
    const open = price
    const close = price + change
    const high = Math.max(open, close) + Math.random() * 50
    const low = Math.min(open, close) - Math.random() * 50
    const volume = Math.random() * 1000 + 500

    candles.push({
      timestamp: startTime + i * 3600000,
      open,
      high,
      low,
      close,
      volume,
    })

    price = close
  }

  return candles
}

export function generateOversoldCandles(count: number = 50): OHLCV[] {
  const candles: OHLCV[] = []
  let price = 45000
  const startTime = Date.now() - count * 3600000

  // Simulate a strong downtrend to trigger RSI < 20
  for (let i = 0; i < count; i++) {
    const change = i < count - 5
      ? -Math.random() * 100 - 50 // Strong decline
      : -Math.random() * 20 // Slowing decline at end

    const open = price
    const close = Math.max(price + change, 30000) // Floor at 30k
    const high = open + Math.random() * 20
    const low = close - Math.random() * 20

    candles.push({
      timestamp: startTime + i * 3600000,
      open,
      high,
      low,
      close,
      volume: Math.random() * 2000 + 1000,
    })

    price = close
  }

  return candles
}
