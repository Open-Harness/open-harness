/**
 * Trading Workflow Orchestrator
 * Implements the 7-stage pipeline: OBSERVE → ANALYZE → VALIDATE → EXECUTE → NARRATE → MONITOR → FINAL_NARRATE
 */

import type { Container } from '../core/container'
import type { MarketService } from '../services/market-service'
import type { OrderService, OrderRequest } from '../services/order-service'
import type { RiskService } from '../services/risk-service'
import type { OHLCV } from '../ccxt/ccxt-interface'

export type WorkflowStage =
  | 'IDLE'
  | 'OBSERVE'
  | 'ANALYZE'
  | 'VALIDATE'
  | 'EXECUTE'
  | 'NARRATE'
  | 'MONITOR'
  | 'FINAL_NARRATE'

export interface ObserveResult {
  symbol: string
  candles: OHLCV[]
  currentPrice: number
  rsi: number
  bollingerBands: { upper: number; middle: number; lower: number }
  positions: any[]
}

export interface AnalyzeResult {
  shouldEnter: boolean
  confidence: number
  reasoning: string
  orderRequest?: OrderRequest
}

export interface WorkflowState {
  stage: WorkflowStage
  symbol: string
  observeResult?: ObserveResult
  analyzeResult?: AnalyzeResult
  lastError?: string
}

export class TradingWorkflow {
  private container: Container
  private marketService: MarketService
  private orderService: OrderService
  private riskService: RiskService
  private state: WorkflowState
  private isRunning = false

  constructor(
    container: Container,
    marketService: MarketService,
    orderService: OrderService,
    riskService: RiskService,
    symbol: string = 'BTC/USDT'
  ) {
    this.container = container
    this.marketService = marketService
    this.orderService = orderService
    this.riskService = riskService
    this.state = {
      stage: 'IDLE',
      symbol,
    }
  }

  async runContinuous(tickIntervalMs: number = 60000): Promise<void> {
    this.isRunning = true

    while (this.isRunning) {
      await this.runSingleCycle()
      await this.container.timeSource.sleep(tickIntervalMs)
    }
  }

  async runSingleCycle(): Promise<WorkflowState> {
    try {
      // Stage 1: OBSERVE (CLI deterministic)
      await this.observe()

      // Stage 2: ANALYZE (Agent + Monologue non-deterministic)
      await this.analyze()

      if (this.state.analyzeResult?.shouldEnter) {
        // Stage 3: VALIDATE (CLI deterministic)
        const validated = await this.validate()

        if (validated) {
          // Stage 4: EXECUTE (CLI deterministic)
          await this.execute()

          // Stage 5: NARRATE (Agent + Monologue non-deterministic)
          await this.narrate()

          // Stage 6: MONITOR (Agent + CLI continuous loop)
          await this.monitor()

          // Stage 7: FINAL_NARRATE (Agent + Monologue)
          await this.finalNarrate()
        }
      }
    } catch (error) {
      this.state.lastError = error instanceof Error ? error.message : String(error)
      console.error(`Workflow error: ${this.state.lastError}`)
    }

    this.state.stage = 'IDLE'
    return this.state
  }

  stop(): void {
    this.isRunning = false
  }

  getState(): WorkflowState {
    return { ...this.state }
  }

  private async observe(): Promise<void> {
    this.state.stage = 'OBSERVE'

    const candles = await this.marketService.fetchCandles(this.state.symbol, '1h', 100)
    const indicators = await this.marketService.calculateIndicators(this.state.symbol, '1h')
    const positions = await this.orderService.fetchPositions([this.state.symbol])

    const currentRSI = indicators.rsi?.[indicators.rsi.length - 1] ?? 50
    const bb = indicators.bollingerBands
    const currentBB = {
      upper: bb?.upper[bb.upper.length - 1] ?? 0,
      middle: bb?.middle[bb.middle.length - 1] ?? 0,
      lower: bb?.lower[bb.lower.length - 1] ?? 0,
    }

    this.state.observeResult = {
      symbol: this.state.symbol,
      candles,
      currentPrice: this.marketService.getCurrentPrice(candles),
      rsi: currentRSI,
      bollingerBands: currentBB,
      positions,
    }
  }

  private async analyze(): Promise<void> {
    this.state.stage = 'ANALYZE'

    const obs = this.state.observeResult!
    const hasPosition = obs.positions.length > 0

    // Simple RSI < 20 entry doctrine (to be enhanced with agent)
    const shouldEnter = !hasPosition && obs.rsi < 20
    const confidence = shouldEnter ? Math.min(100, (20 - obs.rsi) * 5 + 50) : 0

    let reasoning = ''
    if (shouldEnter) {
      reasoning = `RSI at ${obs.rsi.toFixed(1)} indicates oversold conditions. `
      reasoning += `Price near lower Bollinger Band (${obs.bollingerBands.lower.toFixed(2)}). `
      reasoning += `Confidence: ${confidence.toFixed(0)}%`
    } else if (hasPosition) {
      reasoning = 'Already holding a position, monitoring for exit.'
    } else {
      reasoning = `RSI at ${obs.rsi.toFixed(1)} - waiting for oversold conditions (< 20).`
    }

    this.state.analyzeResult = {
      shouldEnter,
      confidence,
      reasoning,
      orderRequest: shouldEnter
        ? {
            symbol: obs.symbol,
            side: 'long',
            size: 0.01, // Small test size
          }
        : undefined,
    }
  }

  private async validate(): Promise<boolean> {
    this.state.stage = 'VALIDATE'

    const request = this.state.analyzeResult?.orderRequest
    if (!request) return false

    const obs = this.state.observeResult!
    const validation = await this.riskService.validateOrder({
      ...request,
      currentPrice: obs.currentPrice,
    })

    if (!validation.approved) {
      console.log(`Order rejected: ${validation.reason}`)
      return false
    }

    return true
  }

  private async execute(): Promise<void> {
    this.state.stage = 'EXECUTE'

    const request = this.state.analyzeResult?.orderRequest
    if (!request) return

    await this.orderService.placeOrder(request)
    console.log(`Order placed: ${request.side} ${request.size} ${request.symbol}`)
  }

  private async narrate(): Promise<void> {
    this.state.stage = 'NARRATE'

    const obs = this.state.observeResult!
    const analysis = this.state.analyzeResult!

    console.log('\n--- Trade Narrative ---')
    console.log(`Entered ${analysis.orderRequest?.side} position on ${obs.symbol}`)
    console.log(`Reasoning: ${analysis.reasoning}`)
    console.log(`Entry price: ${obs.currentPrice}`)
    console.log('------------------------\n')
  }

  private async monitor(): Promise<void> {
    this.state.stage = 'MONITOR'

    // Simple monitoring loop - check for profit exit or DCA triggers
    let monitoring = true
    let monitorCycles = 0
    const maxMonitorCycles = 60 // Max 1 hour of monitoring at 1-min intervals

    while (monitoring && this.isRunning && monitorCycles < maxMonitorCycles) {
      const positions = await this.orderService.fetchPositions([this.state.symbol])

      if (positions.length === 0) {
        // Position closed
        monitoring = false
        break
      }

      const position = positions[0]

      // Check profit exit (2% target)
      const pnlPercent = (position.unrealizedPnl / (position.contracts * position.entryPrice)) * 100
      if (pnlPercent >= 2) {
        await this.orderService.closePosition(this.state.symbol)
        monitoring = false
        break
      }

      // Check time-based exit
      const exitCheck = await this.riskService.checkTimeBasedExit(this.state.symbol)
      if (exitCheck.shouldExit) {
        await this.orderService.closePosition(this.state.symbol)
        monitoring = false
        break
      }

      monitorCycles++
      await this.container.timeSource.sleep(60000) // 1 minute intervals
    }
  }

  private async finalNarrate(): Promise<void> {
    this.state.stage = 'FINAL_NARRATE'

    console.log('\n--- Trade Completed ---')
    console.log(`Symbol: ${this.state.symbol}`)
    console.log(`Final stage reached. Trade cycle complete.`)
    console.log('------------------------\n')
  }
}
