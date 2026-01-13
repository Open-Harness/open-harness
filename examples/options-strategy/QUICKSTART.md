# Quick Start Guide - Options Strategy Demonstrator

## Run the Example

```bash
# From repository root
bun run examples/options-strategy/index.ts
```

Expected runtime: ~2-3 minutes (6 agent calls to Claude API)

## What You'll See

The workflow analyzes a stock (default: AAPL) and recommends an options strategy:

```
1. Volatility Analysis
   ├─ IV vs HV comparison
   ├─ IV Rank calculation
   └─ Regime determination (high/normal/low IV)

2. Market Analysis
   ├─ Directional bias (bullish/bearish/neutral)
   ├─ Strength assessment
   └─ Timeframe evaluation

3. Strategy Selection
   ├─ Match strategy to market + IV environment
   ├─ Consider risk tolerance
   └─ Output recommendation with rationale

4. Trade Construction
   ├─ Select appropriate strikes
   ├─ Determine position size
   └─ Build multi-leg structure

5. Greeks Calculation
   ├─ Delta (directional exposure)
   ├─ Theta (time decay)
   ├─ Vega (volatility sensitivity)
   └─ Risk/reward metrics

6. Risk Assessment
   ├─ Validate position size
   ├─ Check capital requirements
   └─ Approve/reject trade
```

## Modify Parameters

Edit `index.ts` line ~320 to customize:

```typescript
state: {
  underlying: "AAPL",      // Change symbol
  accountSize: 50000,       // Your account size
  riskTolerance: "moderate", // conservative | moderate | aggressive
  daysToExpiration: 45,     // DTE for options
  // ...
}
```

## Understanding the Output

### Volatility Environment
- **High IV (Rank > 50)**: Options expensive → Sell premium (Covered Call, Iron Condor)
- **Low IV (Rank < 30)**: Options cheap → Buy options (Spreads, Straddles)

### Greeks Interpretation
- **Positive Delta**: Benefits from stock going up
- **Negative Delta**: Benefits from stock going down
- **Positive Theta**: Earns money as time passes (short options)
- **Negative Theta**: Loses money as time passes (long options)
- **Positive Vega**: Benefits from IV increase (long options)
- **Negative Vega**: Benefits from IV decrease (short options)

### Strategy Match Guide

| Market View | IV Environment | Best Strategy |
|-------------|----------------|---------------|
| Bullish | High IV | Covered Call |
| Bullish | Low IV | Bull Call Spread |
| Neutral-Bullish | High IV | Cash-Secured Put |
| Neutral | High IV | Iron Condor |
| Neutral | Low IV (expecting volatility) | Long Straddle |

## Common Issues

### "Cannot find module '@open-harness/core'"
Run from repository root: `bun run examples/options-strategy/index.ts`

### Agents not activating
Check the `when` guards - they may be preventing activation based on state conditions.

### Unexpected strategy selection
Review the Strategy Selector prompt - it uses rules to match strategy to conditions.

## Next Steps

1. **Run with different symbols** - Try tech (TSLA), blue-chip (MSFT), volatile (NVDA)
2. **Adjust risk tolerance** - See how it affects position sizing
3. **Change DTE** - Short-term (7-14 days) vs longer-term (60-90 days)
4. **Add your own strategy** - Copy an existing agent and modify the logic
5. **Connect real data** - Replace `SimulatedMarketData` with Polygon.io API

## Learning Resources

- **Greeks**: https://www.optionsplaybook.com/options-introduction/option-greeks/
- **IV Rank**: https://www.tastytrade.com/definitions/iv-rank
- **Strategies**: https://www.optionsplaybook.com/option-strategies/
- **Open Harness**: https://docs.open-harness.dev

## Sharing with Your Trader Friend

Questions to ask them:
1. Does the strategy selection logic make sense?
2. What strategies are missing that you actually use?
3. How would you improve the risk assessment?
4. What would make this actually useful in your workflow?
5. Would you pay for a production version of this?

Their feedback will guide whether to expand this into something more serious or keep it educational.
