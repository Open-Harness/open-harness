# Options Strategy Demonstrator

Educational multi-agent workflow demonstrating options trading concepts using Open Harness.

## ⚠️ DISCLAIMER

**Educational purposes only.** This example uses:
- Simulated market data (not real prices)
- Simplified Greeks calculations (not Black-Scholes)
- Approximate probabilities (not true statistical models)

**Never use this for real trading without professional data and validation.**

## What This Demonstrates

### Open Harness Patterns
1. **Parallel Agent Execution** - Volatility + Market analysis run simultaneously
2. **Signal Chaining** - Agents trigger downstream agents via signals
3. **Guard Conditions** - Strategy selector waits for both analyses
4. **Reducers** - Parse JSON outputs into typed state
5. **Template Expansion** - Prompts reference state/signal data dynamically

### Options Concepts
1. **Implied Volatility (IV)** - What the market prices in
2. **Greeks** - Delta, Theta, Vega for risk measurement
3. **Multi-Leg Strategies** - Coordinating multiple option positions
4. **Risk/Reward Profiles** - Max risk, max profit, break-evens
5. **Strategy Selection** - Matching strategy to market conditions

## The 5 Core Strategies

| Strategy | Market View | IV Environment | Risk Profile |
|----------|-------------|----------------|--------------|
| **Covered Call** | Bullish + Income | High IV | Limited upside |
| **Cash-Secured Put** | Neutral-Bullish | High IV | Assignment risk |
| **Bull Call Spread** | Bullish | Low IV | Defined risk/reward |
| **Iron Condor** | Neutral | High IV | High probability |
| **Long Straddle** | Volatility Spike | Low IV | Unlimited profit |

### 1. Covered Call
```
Own 100 shares + Sell 1 OTM call
Income: Premium collected
Risk: Capped upside if stock rallies past strike
```

### 2. Cash-Secured Put
```
Sell 1 ATM/OTM put + Hold cash to cover
Income: Premium collected
Risk: Must buy shares if assigned
```

### 3. Bull Call Spread
```
Buy 1 ATM call + Sell 1 OTM call
Max Profit: Strike width - debit paid
Max Risk: Debit paid
```

### 4. Iron Condor
```
Sell OTM put spread + Sell OTM call spread
Max Profit: Net credit received
Max Risk: Wing width - credit
```

### 5. Long Straddle
```
Buy ATM call + Buy ATM put
Profit: Large move either direction
Risk: Premium paid (loses to theta decay)
```

## Agent Architecture

```
workflow:start
  ↓ (parallel)
  ├─→ Volatility Analyst → vol:analyzed
  └─→ Market Analyzer → market:analyzed
       ↓
     Strategy Selector → strategy:selected
       ↓
     Trade Builder → trade:constructed
       ↓
     Greeks Calculator → greeks:calculated
       ↓
     Risk Evaluator → risk:assessed
```

### Agent Responsibilities

| Agent | Input | Output | Purpose |
|-------|-------|--------|---------|
| **Volatility Analyst** | Current IV, HV, IV Rank | IV environment regime | Determine if options are "expensive" or "cheap" |
| **Market Analyzer** | Price, technicals | Directional outlook | Bullish/bearish/neutral bias |
| **Strategy Selector** | Vol + Market | Strategy name | Pick optimal strategy for conditions |
| **Trade Builder** | Strategy + strikes | Option legs | Construct multi-leg trade |
| **Greeks Calculator** | Legs + prices | Greeks, risk/reward | Calculate position metrics |
| **Risk Evaluator** | Trade + account | Approval decision | Validate position sizing |

## Key Concepts Explained

### Greeks (Risk Metrics)

**Delta** - Directional exposure
- Call delta: 0 to +1 (moves with stock)
- Put delta: 0 to -1 (moves opposite stock)
- Example: +50 delta = 50 shares of directional exposure

**Theta** - Time decay
- Negative for long positions (hurts you)
- Positive for short positions (helps you)
- Example: -$5/day = lose $5 daily to time decay

**Vega** - Volatility sensitivity
- Positive for long options (want IV to rise)
- Negative for short options (want IV to fall)
- Example: +$10 vega = gain $10 if IV rises 1%

### Volatility Environment

**High IV (IV Rank > 50)**
- Options are "expensive" (high premiums)
- Favor: Selling premium (covered calls, iron condors)
- Why: Collect inflated premiums before IV contracts

**Low IV (IV Rank < 30)**
- Options are "cheap" (low premiums)
- Favor: Buying options (spreads, straddles)
- Why: Cheaper to enter, profit if IV expands

### Risk Management

**Position Sizing**
- Conservative: Max 2% of account per trade
- Moderate: Max 5% of account per trade
- Aggressive: Max 10% of account per trade

**Risk/Reward Ratio**
- Target: At least 1:2 (risk $1 to make $2+)
- Credit strategies: Ensure adequate probability of profit
- Debit strategies: Ensure potential profit justifies risk

## Running the Example

```bash
# From repository root
bun run examples/options-strategy/index.ts
```

## Example Output

```
=== Options Strategy Demonstrator ===

Analyzing: AAPL
Current Price: $175.50
IV: 45.2% | HV: 38.1% | IV Rank: 65/100
Target Expiration: 45 days

=== Volatility Analysis ===
IV: 45% | HV: 38%
IV Rank: 65/100 (high_iv)
Analysis: Elevated IV favors premium selling strategies

=== Market Outlook ===
Direction: bullish (moderate)
Timeframe: medium_term
Confidence: 70%

=== Recommended Strategy ===
Strategy: Covered Call
Type: income
Suitability: 85/100
Rationale: Moderate bullish outlook + high IV environment favors selling premium

=== Trade Setup ===
Strategy: Covered Call

Legs:
  1. BUY  1x STOCK $175.50 @ $175.50
  2. SELL 1x CALL $185.00 @ $3.25

Risk/Reward:
  Max Risk: $175.50 (stock can go to zero)
  Max Profit: $12.75 (strike - stock price + premium)
  Break-Even: $172.25
  Probability of Profit: 75%

Greeks:
  Delta: +0.70 (70% of stock movement)
  Theta: $0.15/day (earn from time decay)
  Vega: -$5.50/1% IV (benefit from IV contraction)
```

## File Structure

```
options-strategy/
├── index.ts           # Main workflow + agents
├── types.ts           # State and type definitions
├── market-data.ts     # Simulated market data provider
├── utils.ts           # Greeks and calculation helpers
├── package.json       # Dependencies
└── README.md          # This file
```

## Learning Path

1. **Start Here** - Run the example, read the output
2. **Study the Agents** - See how each agent's prompt guides analysis
3. **Modify Parameters** - Change symbol, DTE, risk tolerance
4. **Add Strategies** - Implement new strategies (Bear Put Spread, etc.)
5. **Real Data** - Connect to actual market data API (Polygon, IB)

## Next Steps for Real Trading

To make this production-ready, you would need:

1. **Real Market Data**
   - Live options chains with real bid/ask
   - Actual Greeks from market makers
   - Historical volatility calculations

2. **Accurate Pricing**
   - Black-Scholes model for theoretical values
   - Volatility surface for accurate IV
   - Interest rate and dividend adjustments

3. **Risk Management**
   - Portfolio-level Greeks aggregation
   - Margin requirement calculations
   - Position limits and diversification

4. **Execution**
   - Broker API integration
   - Multi-leg order routing
   - Fill handling and slippage

5. **Monitoring**
   - Position tracking and P&L
   - Adjustment rules (rolling, closing)
   - Early assignment risk management

## Resources

- [Options Greeks Explained](https://www.optionsplaybook.com/options-introduction/option-greeks/)
- [IV Rank vs IV Percentile](https://www.tastytrade.com/definitions/iv-rank)
- [Multi-Leg Strategies](https://www.optionsplaybook.com/option-strategies/)
- [Open Harness Documentation](https://docs.open-harness.dev)

## Contributing

Want to add more strategies or improve calculations? Contributions welcome!

Ideas:
- More strategies (Bear Put Spread, Calendar Spread, etc.)
- Better Greeks approximations
- Adjustment logic (when to roll or close)
- Backtesting framework
- Real data integration examples
