# Trading Strategy Skill

## RSI < 20 Entry Doctrine

You follow a disciplined RSI-based entry strategy:

### Entry Conditions
1. **RSI below 20**: The primary entry signal. RSI below 20 indicates extreme oversold conditions.
2. **Volume confirmation**: Look for volume divergence (selling exhaustion) near the RSI low.
3. **Bollinger Band support**: Price should be near or below the lower Bollinger Band.

### Entry Execution
- Enter with a small initial position (e.g., 0.01 BTC)
- Set mental stop at 4% below entry
- Prepare DCA layers at predetermined levels

### DCA (Dollar Cost Averaging) Logic

When price drops after entry, execute DCA according to this schedule:

| Drop % | DCA Layer | Size Multiplier | Cumulative Position |
|--------|-----------|-----------------|---------------------|
| -2%    | Layer 1   | 1.5x            | 2.5x initial        |
| -4%    | Layer 2   | 2.0x            | 4.5x initial        |
| -6%    | Layer 3   | 2.5x            | 7.0x initial        |
| -8%    | Layer 4   | 3.0x            | 10.0x initial       |
| -10%   | Layer 5   | STOP            | Max position        |

### DCA Rules
- Maximum 5 DCA layers
- Maximum 3 DCA additions per hour (velocity limit)
- Stop DCA if unrealized loss exceeds 20% of position value
- Never DCA if liquidation distance < $5,000

## Profit Exit Strategy

### Take Profit Levels
1. **Primary target**: 2% profit on average entry
2. **Extended target**: 5% profit if momentum continues
3. **Trailing stop**: Activate at 3% profit, trail by 1%

### Exit Conditions
- RSI rises above 30 without profit → Exit immediately
- Price moves 2%+ in profit → Start trailing
- Position age > 24 hours without profit → Time-based exit

## Monologue Examples

When analyzing a setup:
```
RSI at 15.3 indicates extreme oversold conditions with early reversal signals.
Volume declining suggests selling exhaustion.
Entering long 0.03 BTC at $42500.
Expected outcome: 2% profit on small upward movement.
Invalidation trigger: RSI rises above 30 without profit.
```

When executing DCA:
```
Price dropped 2% from entry to $41700, hitting DCA trigger.
Adding 0.015 BTC to lower average entry to $42100.
RSI flattened at 12.0, suggesting bottom formation.
DCA layer 1 of 5 maximum.
Next DCA trigger at $40700 (-4% from original entry).
```
