/**
 * Smoke Test: All Services Initialize
 * Verifies that all services can be instantiated without errors
 */

import { test, expect, describe } from 'bun:test'
import { createTestContext, generateMockCandles } from '../helpers/test-container'

describe('Services Smoke Tests', () => {
  test('ST-04: Container initializes with all dependencies', () => {
    const ctx = createTestContext()

    expect(ctx.container).toBeDefined()
    expect(ctx.timeSource).toBeDefined()
    expect(ctx.db).toBeDefined()
    expect(ctx.ccxt).toBeDefined()
    expect(ctx.marketService).toBeDefined()
    expect(ctx.orderService).toBeDefined()
    expect(ctx.riskService).toBeDefined()

    ctx.db.close()
  })

  test('ST-05: TimeSource works correctly', () => {
    const ctx = createTestContext(1000000)

    expect(ctx.timeSource.now()).toBe(1000000)

    ctx.timeSource.advance(5000)
    expect(ctx.timeSource.now()).toBe(1005000)

    ctx.timeSource.setTime(2000000)
    expect(ctx.timeSource.now()).toBe(2000000)

    ctx.db.close()
  })

  test('ST-06: MockCCXT can load and return candles', async () => {
    const ctx = createTestContext()
    const candles = generateMockCandles(10)

    ctx.ccxt.loadData('BTC/USDT', candles)

    const result = await ctx.ccxt.fetchOHLCV('BTC/USDT', '1h', undefined, 10)

    expect(result.length).toBe(10)
    expect(result[0].open).toBeDefined()
    expect(result[0].close).toBeDefined()

    ctx.db.close()
  })

  test('ST-07: MockCCXT can place and track orders', async () => {
    const ctx = createTestContext()
    const candles = generateMockCandles(10, 42000)
    ctx.ccxt.loadData('BTC/USDT', candles)

    const order = await ctx.ccxt.createOrder('BTC/USDT', 'market', 'buy', 0.01)

    expect(order.id).toMatch(/^MOCK_ORDER_/)
    expect(order.status).toBe('closed')
    expect(order.side).toBe('buy')
    expect(order.amount).toBe(0.01)

    ctx.db.close()
  })

  test('ST-08: RiskService validates orders correctly', async () => {
    const ctx = createTestContext()

    // Test with allowed symbol
    const result1 = await ctx.riskService.validateOrder({
      symbol: 'BTC/USDT',
      side: 'long',
      size: 0.01,
      currentPrice: 42000,
    })
    expect(result1.approved).toBe(true)

    // Test with disallowed symbol
    const result2 = await ctx.riskService.validateOrder({
      symbol: 'DOGE/USDT',
      side: 'long',
      size: 0.01,
      currentPrice: 0.1,
    })
    expect(result2.approved).toBe(false)
    expect(result2.reason).toBe('symbol_not_allowed')

    ctx.db.close()
  })
})
