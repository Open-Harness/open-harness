# Risk Management Skill

## The 12 Safety Invariants

These invariants are enforced by the CLI deterministically. They cannot be overridden by agent decisions.

### Invariant 1: Max Exposure
- **Rule**: Total exposure cannot exceed N% of account balance
- **Default**: 10% max exposure
- **Enforcement**: CLI rejects orders that would exceed limit
- **Example**: With $100k account, max exposure is $10k

### Invariant 2: Leverage Cap
- **Rule**: Hard floor on maximum leverage
- **Default**: 10x maximum
- **Enforcement**: CLI rejects orders requesting higher leverage
- **Reason**: Prevents excessive liquidation risk

### Invariant 3: Liquidation Distance
- **Rule**: Minimum $ distance to liquidation price
- **Default**: $5,000 minimum buffer
- **Enforcement**: CLI calculates liquidation price and rejects if too close
- **Calculation**: Based on position size, leverage, and maintenance margin

### Invariant 4: Symbol Allowlist
- **Rule**: Only whitelisted trading pairs allowed
- **Default**: ['BTC/USDT', 'ETH/USDT']
- **Enforcement**: CLI rejects trades on non-whitelisted instruments
- **Reason**: Prevents accidental trades on illiquid or unknown pairs

### Invariant 5: Reduce-Only Validation
- **Rule**: Closing positions cannot result in negative net position
- **Enforcement**: CLI validates close orders against current position
- **Reason**: Prevents accidental position reversal

### Invariant 6: Cooldown Timer
- **Rule**: Minimum time between new position entries
- **Default**: 30 minutes
- **Enforcement**: CLI tracks last entry time per symbol
- **Reason**: Prevents emotional rapid-fire trading

### Invariant 7: Dry-Run Mode
- **Rule**: All CLI calls are no-ops unless `--live` flag set
- **Default**: Dry-run enabled
- **Enforcement**: Orders logged but not executed
- **Reason**: Safe testing environment

### Invariant 8: Position Size Limits
- **Rule**: Per-order and cumulative position caps
- **Default**: 1.0 BTC per order
- **Enforcement**: CLI rejects oversized orders
- **Reason**: Prevents fat-finger errors

### Invariant 9: DCA Velocity Limit
- **Rule**: Maximum N DCA additions per hour
- **Default**: 3 per hour
- **Enforcement**: CLI tracks DCA history
- **Reason**: Prevents runaway averaging in fast-moving markets

### Invariant 10: Cumulative Drawdown Circuit Breaker
- **Rule**: Auto-refuse new DCA if unrealized loss exceeds X%
- **Default**: 20% max drawdown
- **Enforcement**: CLI calculates unrealized PnL before DCA
- **Reason**: Stops throwing good money after bad

### Invariant 11: Time-Forced Exit
- **Rule**: Auto-close positions older than T hours without profit
- **Default**: 24 hours
- **Enforcement**: CLI checks position age during monitoring
- **Reason**: Prevents capital being locked in stagnant trades

### Invariant 12: DCA Layer Limit
- **Rule**: Maximum number of DCA layers allowed
- **Default**: 5 layers
- **Enforcement**: CLI counts existing layers before allowing more
- **Reason**: Limits max position size

## Risk Calculation Examples

### Liquidation Price Calculation
```typescript
// For long positions:
liqPrice = entryPrice * (1 - 1/leverage + maintenanceMargin)

// For short positions:
liqPrice = entryPrice * (1 + 1/leverage - maintenanceMargin)

// Example: Long BTC at $42000, 5x leverage, 0.5% maintenance
liqPrice = 42000 * (1 - 0.2 + 0.005) = $33,810
distance = $42000 - $33810 = $8,190 ✅ (> $5000 minimum)
```

### Exposure Calculation
```typescript
exposure = positionSize * markPrice
exposurePercent = (exposure / accountBalance) * 100

// Example: 0.5 BTC position at $42000, $100k account
exposure = 0.5 * 42000 = $21,000
exposurePercent = 21% ❌ (exceeds 10% limit)
```
