/**
 * Order Service
 * Handles order placement, modification, and cancellation
 */

import type { CCXTInterface, OrderResult, Position } from '../ccxt/ccxt-interface'
import type { TradingDatabase } from '../core/database'
import type { TimeSource } from '../core/time-source'

export interface OrderRequest {
  symbol: string
  side: 'long' | 'short'
  size: number
  type?: 'market' | 'limit'
  price?: number
}

export class OrderService {
  private ccxt: CCXTInterface
  private db: TradingDatabase
  private timeSource: TimeSource

  constructor(ccxt: CCXTInterface, db: TradingDatabase, timeSource: TimeSource) {
    this.ccxt = ccxt
    this.db = db
    this.timeSource = timeSource
  }

  async placeOrder(request: OrderRequest): Promise<OrderResult> {
    const side = request.side === 'long' ? 'buy' : 'sell'
    const type = request.type ?? 'market'

    const result = await this.ccxt.createOrder(
      request.symbol,
      type,
      side,
      request.size,
      request.price
    )

    // Log to audit
    this.logAudit('EXECUTE', null, `place-order ${request.symbol} ${side} ${request.size}`, result)

    // Record trade if market order
    if (type === 'market' && result.status === 'closed') {
      this.recordTrade(request, result)
    }

    return result
  }

  async cancelOrder(orderId: string, symbol: string): Promise<OrderResult> {
    const result = await this.ccxt.cancelOrder(orderId, symbol)
    this.logAudit('EXECUTE', null, `cancel-order ${orderId}`, result)
    return result
  }

  async closePosition(symbol: string): Promise<OrderResult | null> {
    const positions = await this.ccxt.fetchPositions([symbol])
    const position = positions.find(p => p.symbol === symbol)

    if (!position || position.contracts === 0) {
      return null
    }

    const side = position.side === 'long' ? 'sell' : 'buy'
    const result = await this.ccxt.createOrder(
      symbol,
      'market',
      side,
      position.contracts
    )

    // Update trade record
    this.closeTrade(symbol, result)
    this.logAudit('EXECUTE', null, `close-position ${symbol}`, result)

    return result
  }

  async fetchPositions(symbols?: string[]): Promise<Position[]> {
    return this.ccxt.fetchPositions(symbols)
  }

  async setLeverage(leverage: number, symbol: string): Promise<void> {
    await this.ccxt.setLeverage(leverage, symbol)
    this.logAudit('EXECUTE', null, `set-leverage ${leverage}x ${symbol}`, { success: true })
  }

  private recordTrade(request: OrderRequest, result: OrderResult): void {
    this.db.run(
      `INSERT INTO trades (symbol, side, size, entry_price, status, created_at)
       VALUES (?, ?, ?, ?, 'open', ?)`,
      [request.symbol, request.side, request.size, result.price, this.timeSource.now()]
    )

    this.db.run(
      `INSERT INTO positions (symbol, side, size, avg_entry_price, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [request.symbol, request.side, request.size, result.price, this.timeSource.now()]
    )
  }

  private closeTrade(symbol: string, result: OrderResult): void {
    const trades = this.db.query<{ id: number; entry_price: number; size: number }>(
      'SELECT id, entry_price, size FROM trades WHERE symbol = ? AND status = ? ORDER BY created_at DESC LIMIT 1',
      [symbol, 'open']
    )

    if (trades.length > 0) {
      const trade = trades[0]
      const profit = (result.price! - trade.entry_price) * trade.size
      this.db.run(
        `UPDATE trades SET exit_price = ?, profit = ?, status = 'closed', closed_at = ? WHERE id = ?`,
        [result.price, profit, this.timeSource.now(), trade.id]
      )
    }

    this.db.run('DELETE FROM positions WHERE symbol = ?', [symbol])
  }

  private logAudit(stage: string, decision: string | null, command: string, result: any): void {
    this.db.run(
      `INSERT INTO audit_log (timestamp, stage, agent_decision, cli_command, result)
       VALUES (?, ?, ?, ?, ?)`,
      [this.timeSource.now(), stage, decision, command, JSON.stringify(result)]
    )
  }
}
