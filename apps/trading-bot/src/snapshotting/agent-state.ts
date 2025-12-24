/**
 * Agent State Types
 * Defines the complete agent state for snapshotting and time travel
 */

export interface DCALayer {
  layerNumber: number
  size: number
  entryPrice: number
  createdAt: number
}

export interface CompletedTrade {
  symbol: string
  side: 'long' | 'short'
  entryPrice: number
  exitPrice: number
  profit: number
  duration: number
}

export interface MonologueEntry {
  timestamp: number
  stage: string
  content: string
  confidence?: number
}

export interface AgentState {
  // Contextual knowledge
  context: {
    symbol: string
    currentPrice: number
    currentRSI: number
    currentTrend: 'bullish' | 'bearish' | 'neutral'
  }

  // Position state
  position: {
    hasOpenPosition: boolean
    symbol: string
    side: 'long' | 'short'
    size: number
    avgEntryPrice: number
    unrealizedPnL: number
    dcaLayers: DCALayer[]
  }

  // Trade history (memory)
  tradeHistory: {
    completedTrades: CompletedTrade[]
    totalTrades: number
    winRate: number
    totalProfit: number
  }

  // Recent decision monologues (short-term memory)
  recentMonologues: {
    entryAnalysis?: MonologueEntry
    exitAnalysis?: MonologueEntry
    dcaDecisions?: MonologueEntry[]
  }

  // Current strategy state
  strategy: {
    rsiThreshold: number
    dcaSteps: { triggerPercent: number; sizeMultiplier: number }[]
    minProfit: number
    currentStage: 'IDLE' | 'POSITION_OPEN' | 'MONITORING'
  }

  // Temporal context
  temporal: {
    currentTime: number
    marketPhase: string
    recentVolatility: number
  }

  // Agent beliefs (learned patterns)
  beliefs: {
    marketSentiment: 'bullish' | 'bearish' | 'neutral'
    confidence: number
    patternRecognition: string[]
  }
}

export interface Snapshot {
  id: string
  name: string
  timestamp: number
  state: AgentState
  monologues: MonologueEntry[]
  metadata: {
    createdBy: 'manual' | 'auto' | 'error'
    reason: string
  }
}
